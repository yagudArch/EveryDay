/**
 * AIService — the integration surface consumed by BACKEND (FND-004).
 *
 * Contract agreed with BACKEND:
 *   new AIService(provider?: AIProvider)   // defaults to DisabledProvider
 *   getStatus(): AIStatus                  // AIServiceError if the provider status is invalid
 *   parse(text, context, options?): Promise<ActionPreview>
 *
 * Guarantees:
 *  - No provider configured  -> parse rejects with HTTP 503 / code AI_UNAVAILABLE.
 *  - Configured provider     -> requires context.preferences.aiConsent, the structured_output
 *                               capability, a strict input contract, a request timeout and
 *                               strict validation of the provider output.
 *  - Minimal context         -> the provider receives only { schemaVersion, date, timezone, text }.
 *  - Never applies changes   -> parse returns a preview only; all actions carry
 *                               confirmationRequired: true, and this class never accepts a
 *                               database handle, repository, transaction or connection.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  AIStatusSchema,
  ActionPreviewSchema,
  IsoDateTimeSchema,
  ParseInputSchema,
  TodayContextSchema,
  type AIStatus,
  type ActionPreview,
  type TodayContext,
} from '@everyday/contracts';
import { AIServiceError, isAIServiceError } from './errors.js';
import { DisabledProvider } from './disabled-provider.js';
import { PARSER_INSTRUCTION, minimizeContext, type PromptContext } from './context.js';
import type { AIProvider } from './provider.js';

export const AI_SERVICE_LIMITS = {
  /** Hard request timeout enforced by AIService itself. */
  requestTimeoutMs: 20_000,
  /** Maximum accepted user utterance length (contract ParseInputSchema max is 4000). */
  maxInputLength: 4_000,
  /** Maximum number of actions accepted in one provider response (contract max is 20). */
  maxActions: 20,
  /** Maximum serialized size of the provider output before it is parsed. */
  maxProviderOutputBytes: 32_768,
  /** Maximum number of embeddings inputs sent in one call. */
  maxEmbeddingInputs: 64,
} as const;

export interface AIServiceOptions {
  /** Request timeout budget in milliseconds (default AI_SERVICE_LIMITS.requestTimeoutMs). */
  readonly timeoutMs?: number;
  /** Maximum accepted utterance length (default AI_SERVICE_LIMITS.maxInputLength). */
  readonly maxInputLength?: number;
  /** Maximum number of actions accepted from a provider (default AI_SERVICE_LIMITS.maxActions). */
  readonly maxActions?: number;
  /**
   * Validate `context` against TodayContextSchema before reading it (default true).
   * Disable only when the caller has already validated the same value with the same schema.
   */
  readonly validateContext?: boolean;
}

export interface ParseCallOptions {
  /** Optional caller cancellation (e.g. the HTTP request was closed). */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Draft (provider-facing) schema.
//
// A provider supplies semantic content only: type, module, parameters, confidence and an
// optional occurredAt. The platform-owned fields (id, confirmationRequired) are added by
// AIService, so a provider cannot forge identity or skip confirmation. The draft schema is
// strict, therefore unknown action types or a module that does not match the action type are
// rejected outright instead of being silently normalized.
// ---------------------------------------------------------------------------

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const DESCRIPTION = z.string().trim().min(1).max(2_000);
const SHORT_TEXT = z.string().trim().min(1).max(200);

const draftActionBase = {
  confidence: z.number().min(0).max(1),
  occurredAt: IsoDateTimeSchema.nullable().optional(),
};

function createDraftPreviewSchema(maxActions: number) {
  return z
    .object({
      actions: z
        .array(
          z.discriminatedUnion('type', [
            z
              .object({
                ...draftActionBase,
                type: z.literal('add_meal'),
                module: z.literal('nutrition'),
                parameters: z.object({ description: DESCRIPTION, mealType: z.enum(MEAL_TYPES).nullable() }).strict(),
              })
              .strict(),
            z
              .object({
                ...draftActionBase,
                type: z.literal('add_activity'),
                module: z.literal('activity'),
                parameters: z.object({ description: DESCRIPTION }).strict(),
              })
              .strict(),
            z
              .object({
                ...draftActionBase,
                type: z.literal('create_event'),
                module: z.literal('events'),
                parameters: z.object({ title: SHORT_TEXT }).strict(),
              })
              .strict(),
            z
              .object({
                ...draftActionBase,
                type: z.literal('add_shopping_item'),
                module: z.literal('shopping'),
                parameters: z.object({ name: SHORT_TEXT }).strict(),
              })
              .strict(),
            z
              .object({
                ...draftActionBase,
                type: z.literal('update_day_note'),
                module: z.literal('context'),
                parameters: z.object({ dayNote: DESCRIPTION }).strict(),
              })
              .strict(),
          ]),
        )
        .max(maxActions),
      clarification: z.string().trim().min(1).max(2_000).nullable().optional(),
    })
    .strict();
}

function issueDetails(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.slice(0, 10).map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

function invalidOutput(message: string, details?: unknown): AIServiceError {
  return new AIServiceError('AI_INVALID_OUTPUT', message, 502, { details });
}

export class AIService {
  private readonly provider: AIProvider;
  private readonly timeoutMs: number;
  private readonly maxInputLength: number;
  private readonly maxActions: number;
  private readonly validateContext: boolean;

  constructor(provider: AIProvider = new DisabledProvider(), options: AIServiceOptions = {}) {
    this.provider = provider;
    this.timeoutMs = options.timeoutMs ?? AI_SERVICE_LIMITS.requestTimeoutMs;
    this.maxInputLength = options.maxInputLength ?? AI_SERVICE_LIMITS.maxInputLength;
    this.maxActions = options.maxActions ?? AI_SERVICE_LIMITS.maxActions;
    this.validateContext = options.validateContext ?? true;
  }

  /**
   * Provider status, validated against the shared AIStatusSchema so BACKEND can return it
   * directly from GET /api/v1/ai/status. Never throws for a disabled provider — a disabled
   * provider is a valid, honest state (configured: false).
   */
  getStatus(): AIStatus {
    const status = this.provider.status();
    const parsed = AIStatusSchema.safeParse({
      provider: status.provider,
      configured: status.configured,
      capabilities: [...status.capabilities],
    });
    if (!parsed.success) {
      throw new AIServiceError('AI_PROVIDER_INVALID', 'AI provider reported an invalid status', 500, {
        details: issueDetails(parsed.error),
      });
    }
    return parsed.data;
  }

  /**
   * Parse one utterance into a validated preview. Read-only: returns preview data and never
   * applies, persists or executes anything.
   */
  async parse(text: string, context: TodayContext, options: ParseCallOptions = {}): Promise<ActionPreview> {
    // 1. Honest capability gate: no configured provider -> 503 AI_UNAVAILABLE.
    const status = this.getStatus();
    if (!status.configured) {
      throw new AIServiceError('AI_UNAVAILABLE', 'No AI provider is configured', 503);
    }

    // 2. Input contract (also bounds the payload sent outward).
    const input = this.validateInput(text);

    // 3. Context contract, then the consent gate (read locally, never forwarded).
    const ctx = this.validateContextValue(context);
    if (ctx.preferences.aiConsent !== true) {
      throw new AIServiceError('AI_CONSENT_REQUIRED', 'AI consent has not been granted', 403);
    }

    // 4. Capability gate for the specific operation.
    if (!status.capabilities.includes('structured_output')) {
      throw new AIServiceError(
        'AI_CAPABILITY_UNSUPPORTED',
        'Configured AI provider does not support structured output',
        503,
        { details: { missingCapability: 'structured_output' } },
      );
    }

    // 5. Minimal payload: date + timezone + utterance only.
    const promptContext: PromptContext = minimizeContext(ctx, input);

    // 6. Bounded, cancellable provider call.
    const result = await this.callStructured(promptContext, options.signal);

    // 7. Strict output validation + platform-owned normalization.
    return this.toPreview(result);
  }

  // -------------------------------------------------------------------------
  // internals
  // -------------------------------------------------------------------------

  private validateInput(text: string): string {
    if (typeof text !== 'string') {
      throw new AIServiceError('AI_INVALID_INPUT', 'text must be a string', 400, { details: { field: 'text' } });
    }
    const parsed = ParseInputSchema.safeParse({ text });
    if (!parsed.success) {
      throw new AIServiceError('AI_INVALID_INPUT', 'text does not satisfy the parse input contract', 400, {
        details: issueDetails(parsed.error),
      });
    }
    if (parsed.data.text.length > this.maxInputLength) {
      throw new AIServiceError('AI_INVALID_INPUT', 'text exceeds the configured maximum length', 400, {
        details: { field: 'text', maxInputLength: this.maxInputLength },
      });
    }
    return parsed.data.text;
  }

  private validateContextValue(context: TodayContext): TodayContext {
    if (!this.validateContext) return context;
    const parsed = TodayContextSchema.safeParse(context);
    if (!parsed.success) {
      throw new AIServiceError('AI_INVALID_INPUT', 'context does not satisfy TodayContextSchema', 400, {
        details: issueDetails(parsed.error),
      });
    }
    return parsed.data;
  }

  private async callStructured(promptContext: PromptContext, callerSignal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const onCallerAbort = (): void => controller.abort();
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    if (callerSignal?.aborted === true) controller.abort();

    try {
      const result = await this.provider.structured({
        schemaName: 'ActionPreview',
        instruction: PARSER_INSTRUCTION,
        input: promptContext,
        maxOutputTokens: 2_048,
        timeoutMs: this.timeoutMs,
        signal: controller.signal,
      });
      return result.output;
    } catch (error) {
      if (isAIServiceError(error)) throw error;
      if (timedOut) {
        throw new AIServiceError('AI_TIMEOUT', `AI provider request exceeded ${this.timeoutMs} ms`, 504, {
          details: { timeoutMs: this.timeoutMs },
          providerCause: error,
        });
      }
      if (callerSignal?.aborted === true || controller.signal.aborted) {
        throw new AIServiceError('AI_ABORTED', 'AI provider request was aborted', 499, { providerCause: error });
      }
      throw new AIServiceError('AI_PROVIDER_FAILURE', 'AI provider request failed', 502, { providerCause: error });
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  }

  private toPreview(output: unknown): ActionPreview {
    if (typeof output !== 'object' || output === null) {
      throw invalidOutput('Provider output must be a JSON object');
    }

    let serialized: string;
    try {
      const json = JSON.stringify(output);
      if (json === undefined) throw new Error('not serializable');
      serialized = json;
    } catch (error) {
      throw invalidOutput('Provider output is not serializable', { providerCause: String(error) });
    }

    if (new TextEncoder().encode(serialized).length > AI_SERVICE_LIMITS.maxProviderOutputBytes) {
      throw invalidOutput('Provider output exceeds the maximum allowed size', {
        maxProviderOutputBytes: AI_SERVICE_LIMITS.maxProviderOutputBytes,
      });
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(serialized);
    } catch {
      throw invalidOutput('Provider output is not valid JSON');
    }

    const draft = createDraftPreviewSchema(this.maxActions).safeParse(candidate);
    if (!draft.success) {
      throw invalidOutput('Provider output failed schema validation', issueDetails(draft.error));
    }

    // Platform-owned normalization: identity, timestamp default and mandatory confirmation.
    const candidateActions = draft.data.actions.map((action) => ({
      ...action,
      id: randomUUID(),
      occurredAt: action.occurredAt ?? null,
      confirmationRequired: true,
    }));

    const preview = ActionPreviewSchema.safeParse({
      actions: candidateActions,
      clarification: draft.data.clarification ?? null,
    });
    if (!preview.success) {
      throw invalidOutput('Normalized preview failed ActionPreviewSchema validation', issueDetails(preview.error));
    }
    return preview.data;
  }
}
