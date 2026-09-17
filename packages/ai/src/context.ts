/**
 * Context minimization (privacy by design — MASTER_PROMPT §33).
 *
 * The intent parser needs the utterance plus the calendar date and the IANA timezone to
 * resolve "today / tomorrow / at 19:30". It needs nothing else. Everything that is not
 * required to parse an utterance is dropped BEFORE the provider port is called:
 *
 *   dropped from TodayContext: profile (id, email, displayName), goals, memory facts,
 *   subscription, dayNote, module payloads, preferences.allergies, dietaryRestrictions,
 *   memoryEnabled, locale, theme, city.
 *
 * `preferences.aiConsent` is read locally by AIService as a gate and never included in the
 * payload sent to a provider.
 */

import type { TodayContext } from '@everyday/contracts';
import { AIServiceError } from './errors.js';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The exact field set that may leave the process for intent parsing. */
export const PROMPT_CONTEXT_FIELDS = ['schemaVersion', 'date', 'timezone', 'text'] as const;

export interface PromptContext {
  readonly schemaVersion: 1;
  readonly date: string;
  readonly timezone: string;
  readonly text: string;
}

export interface PromptContextInput {
  readonly date: string;
  readonly timezone: string;
  readonly text: string;
}

/**
 * Build the minimal parser payload from pre-validated primitives.
 * Throws AI_INVALID_INPUT (400) when a field is unusable.
 */
export function buildPromptContext(input: PromptContextInput): PromptContext {
  if (!DATE_PATTERN.test(input.date)) {
    throw new AIServiceError('AI_INVALID_INPUT', 'date must use the YYYY-MM-DD format', 400, {
      details: { field: 'date' },
    });
  }
  const timezone = input.timezone.trim();
  if (timezone.length === 0) {
    throw new AIServiceError('AI_INVALID_INPUT', 'timezone must not be empty', 400, {
      details: { field: 'timezone' },
    });
  }
  const text = input.text.trim();
  if (text.length === 0) {
    throw new AIServiceError('AI_INVALID_INPUT', 'text must not be empty', 400, {
      details: { field: 'text' },
    });
  }
  return { schemaVersion: 1, date: input.date, timezone, text };
}

/**
 * Reduce a validated TodayContext to the minimal parser payload.
 * Whitelist-only: no spread of the source object, so new contract fields cannot leak.
 */
export function minimizeContext(context: TodayContext, text: string): PromptContext {
  return buildPromptContext({ date: context.date, timezone: context.timezone, text });
}

/** Instruction sent alongside the payload. Contains no vendor or model identifiers. */
export const PARSER_INSTRUCTION = [
  'You are the intent parser of the personal assistant "Every day".',
  'Input: one user utterance, the calendar date (YYYY-MM-DD) and the IANA timezone.',
  '',
  'Return ONLY a JSON object, without markdown fences and without commentary:',
  '{ "actions": [ ... ], "clarification": string | null }',
  '',
  'Allowed actions, each with "type", "module", "parameters", "confidence" and optional "occurredAt" (ISO-8601 with offset or null):',
  '- "add_meal" / "nutrition" / { "description": string(1-2000), "mealType": "breakfast"|"lunch"|"dinner"|"snack"|null }',
  '- "add_activity" / "activity" / { "description": string(1-2000) }',
  '- "create_event" / "events" / { "title": string(1-200) }',
  '- "add_shopping_item" / "shopping" / { "name": string(1-200) }',
  '- "update_day_note" / "context" / { "dayNote": string(1-2000) }',
  '',
  'Rules:',
  '1. Extract only what the user actually said. Never invent missing facts, quantities, times or meals.',
  '2. Use no action type or module other than those listed above.',
  '3. Never change the "module" that belongs to a "type"; the mapping above is fixed.',
  '4. One utterance may map to several actions across different modules; return at most 20 actions.',
  '5. "confidence" is your real certainty in 0..1; keep it low when the utterance is ambiguous.',
  '6. If something important is missing or ambiguous, set "clarification" to one short question instead of guessing.',
  '7. Do not output ids, confirmation flags or any field not listed above.',
  '8. Never include personal data in your output that was not present in the utterance.',
].join('\n');
