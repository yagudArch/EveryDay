import { describe, expect, it } from 'vitest';
import type { AICapability, TodayContext } from '@everyday/contracts';
import { AIService, AIServiceError } from './index.js';
import type {
  AIProvider,
  AIProviderStatus,
  EmbeddingsRequest,
  SpeechToTextRequest,
  StructuredRequest,
  StructuredResult,
  TextRequest,
  ToolCallRequest,
  VisionRequest,
} from './provider.js';

// ---------------------------------------------------------------------------
// Test-only fake provider. It lives in a *.test.ts file on purpose: no test double is ever
// compiled into dist/ and no production module imports it.
// ---------------------------------------------------------------------------

interface FakeProviderOptions {
  configured?: boolean;
  capabilities?: readonly AICapability[];
  output?: unknown;
  error?: unknown;
  /** Resolve only when the signal aborts, to exercise the timeout/abort boundary. */
  hang?: boolean;
}

class FakeProvider implements AIProvider {
  readonly name = 'fake-test-adapter';
  structuredCalls = 0;
  lastInput: unknown;
  lastRequest: StructuredRequest | undefined;

  constructor(private readonly options: FakeProviderOptions = {}) {}

  status(): AIProviderStatus {
    return {
      provider: this.name,
      configured: this.options.configured ?? true,
      capabilities: this.options.capabilities ?? ['structured_output'],
    };
  }

  private notImplemented(method: string): never {
    throw new Error(`fake provider does not implement ${method}`);
  }

  async text(_request: TextRequest) {
    return this.notImplemented('text');
  }

  async vision(_request: VisionRequest) {
    return this.notImplemented('vision');
  }

  async speechToText(_request: SpeechToTextRequest) {
    return this.notImplemented('speech_to_text');
  }

  async embeddings(_request: EmbeddingsRequest) {
    return this.notImplemented('embeddings');
  }

  async tools(_request: ToolCallRequest) {
    return this.notImplemented('tools');
  }

  async structured(request: StructuredRequest): Promise<StructuredResult> {
    this.structuredCalls += 1;
    this.lastRequest = request;
    this.lastInput = request.input;
    if (this.options.hang === true) {
      return new Promise<never>((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    }
    if ('error' in this.options) return Promise.reject(this.options.error);
    return { output: this.options.output };
  }
}

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';

function contextFixture(overrides: { aiConsent?: boolean } = {}): TodayContext {
  const unavailable = { status: 'unavailable', reason: 'not_implemented', data: null } as const;
  return {
    schemaVersion: 1,
    date: '2026-09-17',
    timezone: 'Europe/Riga',
    generatedAt: '2026-09-17T06:00:00+03:00',
    profile: {
      id: PROFILE_ID,
      email: 'user@example.com',
      displayName: 'Test User',
      createdAt: '2026-01-01T00:00:00+03:00',
    },
    preferences: {
      timezone: 'Europe/Riga',
      locale: 'ru',
      theme: 'system',
      city: 'Riga',
      dietaryRestrictions: ['vegetarian'],
      allergies: ['peanut'],
      aiConsent: overrides.aiConsent ?? true,
      memoryEnabled: true,
    },
    goals: [],
    memory: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        fact: 'private memory fact',
        source: 'user_confirmed',
        createdAt: '2026-02-01T00:00:00+03:00',
      },
    ],
    subscription: {
      status: 'trial',
      trialStartedAt: '2026-09-01T00:00:00+03:00',
      trialEndsAt: '2026-09-15T00:00:00+03:00',
      currentPeriodEndsAt: null,
      premium: false,
    },
    dayNote: 'private day note',
    modules: {
      nutrition: unavailable,
      weather: unavailable,
      wardrobe: unavailable,
      activity: unavailable,
      inventory: unavailable,
      shopping: unavailable,
      events: unavailable,
      changes: unavailable,
    },
  };
}

const TEXT = 'Съел овсянку на завтрак и иду в спортзал вечером';

function mealAction(overrides: Record<string, unknown> = {}) {
  return {
    type: 'add_meal',
    module: 'nutrition',
    parameters: { description: 'овсянка', mealType: 'breakfast' },
    confidence: 0.9,
    ...overrides,
  };
}

async function captureError(promise: Promise<unknown>): Promise<AIServiceError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AIServiceError) return error;
    throw error;
  }
  throw new Error('expected the promise to reject, but it resolved');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---------------------------------------------------------------------------
// unavailable / disabled
// ---------------------------------------------------------------------------

describe('AIService with a disabled provider', () => {
  it('reports an honest unconfigured status on the default constructor', () => {
    const status = new AIService().getStatus();
    expect(status.configured).toBe(false);
    expect(status.capabilities).toEqual([]);
    expect(status.provider).toBe('disabled');
  });

  it('rejects parse with 503 AI_UNAVAILABLE', async () => {
    const error = await captureError(new AIService().parse(TEXT, contextFixture()));
    expect(error).toBeInstanceOf(AIServiceError);
    expect(error.code).toBe('AI_UNAVAILABLE');
    expect(error.statusCode).toBe(503);
  });

  it('rejects parse with 503 AI_UNAVAILABLE when the provider reports configured: false', async () => {
    const provider = new FakeProvider({ configured: false, output: { actions: [], clarification: null } });
    const service = new AIService(provider);
    const error = await captureError(service.parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_UNAVAILABLE');
    expect(error.statusCode).toBe(503);
    expect(provider.structuredCalls).toBe(0);
  });

  it('reports an invalid provider status instead of trusting it', () => {
    const provider = new FakeProvider();
    provider.status = () => ({ provider: 'broken', configured: true, capabilities: ['telepathy' as AICapability] });
    const error = (() => {
      try {
        return new AIService(provider).getStatus();
      } catch (thrown) {
        return thrown as AIServiceError;
      }
    })();
    expect(error).toBeInstanceOf(AIServiceError);
    expect(error.code).toBe('AI_PROVIDER_INVALID');
    expect(error.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// consent + capability gates
// ---------------------------------------------------------------------------

describe('AIService consent and capability gates', () => {
  it('requires aiConsent before any provider call', async () => {
    const provider = new FakeProvider({ output: { actions: [], clarification: null } });
    const service = new AIService(provider);
    const error = await captureError(service.parse(TEXT, contextFixture({ aiConsent: false })));
    expect(error.code).toBe('AI_CONSENT_REQUIRED');
    expect(error.statusCode).toBe(403);
    expect(provider.structuredCalls).toBe(0);
  });

  it('rejects when the provider lacks the structured_output capability', async () => {
    const provider = new FakeProvider({ capabilities: ['text'] });
    const service = new AIService(provider);
    const error = await captureError(service.parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_CAPABILITY_UNSUPPORTED');
    expect(error.statusCode).toBe(503);
    expect(provider.structuredCalls).toBe(0);
  });

  it('does not forward aiConsent or any preference to the provider', async () => {
    const provider = new FakeProvider({ output: { actions: [], clarification: null } });
    await new AIService(provider).parse(TEXT, contextFixture());
    expect(JSON.stringify(provider.lastInput)).not.toContain('aiConsent');
  });
});

// ---------------------------------------------------------------------------
// input validation
// ---------------------------------------------------------------------------

describe('AIService input validation', () => {
  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['too long', 'a'.repeat(4001)],
  ])('rejects %s text with 400 AI_INVALID_INPUT', async (_label, text) => {
    const provider = new FakeProvider({ output: { actions: [], clarification: null } });
    const error = await captureError(new AIService(provider).parse(text, contextFixture()));
    expect(error.code).toBe('AI_INVALID_INPUT');
    expect(error.statusCode).toBe(400);
    expect(provider.structuredCalls).toBe(0);
  });

  it('honours a stricter maxInputLength', async () => {
    const provider = new FakeProvider({ output: { actions: [], clarification: null } });
    const service = new AIService(provider, { maxInputLength: 10 });
    const error = await captureError(service.parse('a'.repeat(11), contextFixture()));
    expect(error.code).toBe('AI_INVALID_INPUT');
  });

  it('rejects a context that violates TodayContextSchema', async () => {
    const provider = new FakeProvider({ output: { actions: [], clarification: null } });
    const broken = { ...contextFixture(), date: '17.09.2026' } as unknown as TodayContext;
    const error = await captureError(new AIService(provider).parse(TEXT, broken));
    expect(error.code).toBe('AI_INVALID_INPUT');
    expect(error.statusCode).toBe(400);
    expect(provider.structuredCalls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// successful parsing
// ---------------------------------------------------------------------------

describe('AIService.parse with a configured provider', () => {
  it('maps several actions of one utterance into one preview', async () => {
    const provider = new FakeProvider({
      output: {
        actions: [
          mealAction(),
          { type: 'add_activity', module: 'activity', parameters: { description: 'спортзал вечером' }, confidence: 0.91 },
          { type: 'update_day_note', module: 'context', parameters: { dayNote: 'тренировка вечером' }, confidence: 0.8 },
        ],
        clarification: null,
      },
    });
    const preview = await new AIService(provider).parse(TEXT, contextFixture());

    expect(preview.actions).toHaveLength(3);
    expect(preview.actions.map((action) => action.type)).toEqual(['add_meal', 'add_activity', 'update_day_note']);
    expect(preview.actions.map((action) => action.module)).toEqual(['nutrition', 'activity', 'context']);
    expect(preview.clarification).toBeNull();
    for (const action of preview.actions) {
      expect(action.id).toMatch(UUID_PATTERN);
      expect(action.confirmationRequired).toBe(true);
      expect(action.occurredAt).toBeNull();
    }
    expect(new Set(preview.actions.map((action) => action.id)).size).toBe(3);
  });

  it('keeps provider timestamps and clarifications when they are valid', async () => {
    const provider = new FakeProvider({
      output: {
        actions: [mealAction({ occurredAt: '2026-09-17T08:30:00+03:00' })],
        clarification: 'Уточните количество?',
      },
    });
    const preview = await new AIService(provider).parse(TEXT, contextFixture());
    expect(preview.actions[0]?.occurredAt).toBe('2026-09-17T08:30:00+03:00');
    expect(preview.clarification).toBe('Уточните количество?');
  });

  it('preserves low confidence as an uncertainty signal while still requiring confirmation', async () => {
    const provider = new FakeProvider({
      output: {
        actions: [mealAction({ confidence: 0.21 }), mealAction({ confidence: 0.55 })],
        clarification: 'Я не уверен, что это завтрак. Подтвердите.',
      },
    });
    const preview = await new AIService(provider).parse(TEXT, contextFixture());
    expect(preview.actions.map((action) => action.confidence)).toEqual([0.21, 0.55]);
    expect(preview.actions.every((action) => action.confirmationRequired)).toBe(true);
    expect(preview.clarification).toContain('Подтвердите');
  });

  it('accepts exactly the maximum number of actions and rejects one more', async () => {
    const action = (): unknown => ({
      type: 'add_shopping_item',
      module: 'shopping',
      parameters: { name: 'огурцы' },
      confidence: 0.7,
    });
    const providerOk = new FakeProvider({
      output: { actions: Array.from({ length: 20 }, action), clarification: null },
    });
    const preview = await new AIService(providerOk).parse(TEXT, contextFixture());
    expect(preview.actions).toHaveLength(20);

    const providerTooMany = new FakeProvider({
      output: { actions: Array.from({ length: 21 }, action), clarification: null },
    });
    const error = await captureError(new AIService(providerTooMany).parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_INVALID_OUTPUT');
    expect(error.statusCode).toBe(502);
  });

  it('honours a stricter maxActions limit', async () => {
    const provider = new FakeProvider({
      output: {
        actions: [
          { type: 'add_shopping_item', module: 'shopping', parameters: { name: 'огурцы' }, confidence: 0.7 },
          { type: 'add_shopping_item', module: 'shopping', parameters: { name: 'йогурт' }, confidence: 0.7 },
        ],
        clarification: null,
      },
    });
    const error = await captureError(new AIService(provider, { maxActions: 1 }).parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_INVALID_OUTPUT');
  });

  it('accepts an empty action list when the provider asks for clarification', async () => {
    const provider = new FakeProvider({ output: { actions: [], clarification: 'Что именно добавить?' } });
    const preview = await new AIService(provider).parse(TEXT, contextFixture());
    expect(preview.actions).toEqual([]);
    expect(preview.clarification).toBe('Что именно добавить?');
  });
});

// ---------------------------------------------------------------------------
// strict output validation
// ---------------------------------------------------------------------------

describe('AIService strict provider output validation', () => {
  it.each<[string, unknown]>([
    ['a JSON array instead of an object', []],
    ['a plain string', '{"actions":[]}'],
    ['null', null],
    ['a missing actions field', { clarification: null }],
    ['a non-array actions field', { actions: 'nope', clarification: null }],
    ['an unknown extra field', { actions: [], clarification: null, notes: 'extra' }],
    ['a missing confidence', { actions: [{ type: 'add_meal', module: 'nutrition', parameters: { description: 'x', mealType: null } }], clarification: null }],
    ['an out-of-range confidence', { actions: [mealAction({ confidence: 1.5 })], clarification: null }],
    ['a client-generated id', { actions: [{ ...mealAction(), id: PROFILE_ID }], clarification: null }],
    ['a forged confirmation flag', { actions: [{ ...mealAction(), confirmationRequired: false }], clarification: null }],
    ['an empty description', { actions: [mealAction({ parameters: { description: '', mealType: null } })], clarification: null }],
    ['an unknown meal type', { actions: [mealAction({ parameters: { description: 'x', mealType: 'brunch' } })], clarification: null }],
  ])('rejects %s with 502 AI_INVALID_OUTPUT', async (_label, output) => {
    const provider = new FakeProvider({ output });
    const error = await captureError(new AIService(provider).parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_INVALID_OUTPUT');
    expect(error.statusCode).toBe(502);
  });

  it('rejects an unknown action type', async () => {
    const provider = new FakeProvider({
      output: {
        actions: [{ type: 'delete_all_meals', module: 'nutrition', parameters: { description: 'x' }, confidence: 0.9 }],
        clarification: null,
      },
    });
    const error = await captureError(new AIService(provider).parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_INVALID_OUTPUT');
  });

  it('rejects an action whose module does not match its type', async () => {
    const provider = new FakeProvider({
      output: { actions: [mealAction({ module: 'activity' })], clarification: null },
    });
    const error = await captureError(new AIService(provider).parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_INVALID_OUTPUT');
    expect(error.details).toBeTruthy();
  });

  it('rejects an oversized provider output', async () => {
    const provider = new FakeProvider({
      output: {
        actions: [
          {
            type: 'add_meal',
            module: 'nutrition',
            parameters: { description: 'x'.repeat(30_000), mealType: null },
            confidence: 0.5,
          },
        ],
        clarification: 'y'.repeat(30_000),
      },
    });
    const error = await captureError(new AIService(provider).parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_INVALID_OUTPUT');
  });

  it('rejects a non-serializable provider output', async () => {
    const cyclic: Record<string, unknown> = { actions: [] };
    cyclic.self = cyclic;
    const provider = new FakeProvider({ output: cyclic });
    const error = await captureError(new AIService(provider).parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_INVALID_OUTPUT');
  });
});

// ---------------------------------------------------------------------------
// failure handling: timeout, abort, provider errors
// ---------------------------------------------------------------------------

describe('AIService failure handling', () => {
  it('aborts a hanging provider call with 504 AI_TIMEOUT', async () => {
    const provider = new FakeProvider({ hang: true });
    const service = new AIService(provider, { timeoutMs: 20 });
    const error = await captureError(service.parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_TIMEOUT');
    expect(error.statusCode).toBe(504);
    expect(provider.structuredCalls).toBe(1);
  });

  it('maps an untyped provider failure to 502 AI_PROVIDER_FAILURE', async () => {
    const provider = new FakeProvider({ error: new Error('socket reset') });
    const error = await captureError(new AIService(provider).parse(TEXT, contextFixture()));
    expect(error.code).toBe('AI_PROVIDER_FAILURE');
    expect(error.statusCode).toBe(502);
  });

  it('propagates a typed provider failure unchanged', async () => {
    const typed = new AIServiceError('AI_UNAVAILABLE', 'adapter not ready', 503);
    const provider = new FakeProvider({ error: typed });
    const error = await captureError(new AIService(provider).parse(TEXT, contextFixture()));
    expect(error).toBe(typed);
  });

  it('honours caller cancellation with 499 AI_ABORTED', async () => {
    const provider = new FakeProvider({ hang: true });
    const service = new AIService(provider, { timeoutMs: 5_000 });
    const controller = new AbortController();
    const promise = service.parse(TEXT, contextFixture(), { signal: controller.signal });
    controller.abort();
    const error = await captureError(promise);
    expect(error.code).toBe('AI_ABORTED');
    expect(error.statusCode).toBe(499);
  });
});

// ---------------------------------------------------------------------------
// no side effects
// ---------------------------------------------------------------------------

describe('AIService never applies changes', () => {
  it('leaves the caller context untouched and returns preview data only', async () => {
    const context = contextFixture();
    const before = JSON.stringify(context);
    const provider = new FakeProvider({
      output: { actions: [mealAction(), mealAction({ parameters: { description: 'яйца', mealType: null } })], clarification: null },
    });
    const service = new AIService(provider);
    const preview = await service.parse(TEXT, context);

    expect(JSON.stringify(context)).toBe(before);
    expect(preview.actions.every((action) => action.confirmationRequired === true)).toBe(true);
    expect(Object.keys(preview).sort()).toEqual(['actions', 'clarification']);
    // No provider, and no preview, was ever handed anything mutating such as a repository.
    expect(provider.lastInput).toEqual({
      schemaVersion: 1,
      date: context.date,
      timezone: context.timezone,
      text: TEXT,
    });
    expect(provider.lastRequest?.schemaName).toBe('ActionPreview');
  });

  it('does not mutate the context when validation fails', async () => {
    const context = contextFixture();
    const before = JSON.stringify(context);
    const provider = new FakeProvider({ output: { actions: [mealAction({ module: 'activity' })], clarification: null } });
    await captureError(new AIService(provider).parse(TEXT, context));
    expect(JSON.stringify(context)).toBe(before);
  });
});
