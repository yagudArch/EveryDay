import { ActionPreviewSchema, AIStatusSchema, type ActionPreview, type AIStatus, type TodayContext } from '@everyday/contracts';
import { AppError } from '../errors.js';

/**
 * Backend-side seam in front of the AI provider port (`@everyday/ai`, owned by the AI role).
 *
 * The gateway keeps the provider out of the HTTP layer and guarantees three things:
 *  - provider output is re-validated against the shared structured-output schema before it
 *    reaches the client (a provider can never widen the contract);
 *  - provider failures are mapped to sanitized application errors;
 *  - the approved surface is exactly `getStatus(): AIStatus` and
 *    `parse(text, context): Promise<ActionPreview>`.
 */
export interface AiGateway {
  getStatus(): AIStatus;
  parse(text: string, context: TodayContext): Promise<ActionPreview>;
}

/** Structural view of the provider-port surface this backend consumes. */
interface AiServiceLike {
  getStatus(): unknown;
  parse(text: string, context: TodayContext): Promise<unknown>;
}

interface AiPackageLike {
  AIService: new (provider: unknown) => AiServiceLike;
  DisabledProvider: new () => unknown;
}

/**
 * The specifier is held as a plain `string` on purpose: it keeps this package compiling and
 * booting while the sibling AI package is not built yet, without ever faking an AI result.
 * Once `@everyday/ai` is available the approved API is used verbatim:
 * `new AIService(new DisabledProvider())`.
 */
const AI_PACKAGE_SPECIFIER: string = '@everyday/ai';

const UNAVAILABLE_STATUS: AIStatus = { provider: 'unavailable', configured: false, capabilities: [] };

/** Honest degradation: without the provider port there is simply no AI capability. */
const UNAVAILABLE_SERVICE: AiServiceLike = {
  getStatus: () => UNAVAILABLE_STATUS,
  parse: async () => {
    throw new AppError('ai_unavailable', 503, 'No AI provider is configured for this server');
  },
};

export interface AiGatewayLoad {
  gateway: AiGateway;
  /** Non-null when the provider port could not be loaded; surfaced as a startup warning. */
  warning: string | null;
}

export async function createAiGateway(): Promise<AiGatewayLoad> {
  let service: AiServiceLike = UNAVAILABLE_SERVICE;
  let warning: string | null = null;

  try {
    const aiPackage = (await import(AI_PACKAGE_SPECIFIER)) as unknown as AiPackageLike;
    service = new aiPackage.AIService(new aiPackage.DisabledProvider());
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    warning = `AI provider port (@everyday/ai) is unavailable in this runtime: ${reason}`;
  }

  return { gateway: createGatewayFor(service), warning };
}

function createGatewayFor(service: AiServiceLike): AiGateway {
  return {
    getStatus(): AIStatus {
      const parsed = AIStatusSchema.safeParse(service.getStatus());
      // A provider that cannot describe itself is reported as not configured instead of lying.
      return parsed.success ? parsed.data : UNAVAILABLE_STATUS;
    },

    async parse(text: string, context: TodayContext): Promise<ActionPreview> {
      const raw = await service.parse(text, context);
      const parsed = ActionPreviewSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AppError('ai_invalid_output', 502, 'AI provider returned an unexpected response shape');
      }
      return parsed.data;
    },
  };
}

/**
 * Maps any provider error to a sanitized application error. `AIServiceError` carries
 * `code`/`statusCode`; they are read structurally so the contract holds across module
 * instances, and unknown failures always become an explicit 503.
 */
export function toAiAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const candidate = (error ?? {}) as { code?: unknown; statusCode?: unknown };
  const code = typeof candidate.code === 'string' && candidate.code.length > 0 ? candidate.code : 'ai_unavailable';
  const rawStatus = typeof candidate.statusCode === 'number' ? candidate.statusCode : 503;
  const statusCode = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 503;
  return new AppError(code, statusCode, 'AI processing is unavailable');
}
