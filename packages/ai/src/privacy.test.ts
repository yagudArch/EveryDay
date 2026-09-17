import { describe, expect, it } from 'vitest';
import type { AICapability, TodayContext } from '@everyday/contracts';
import { AIService, AIServiceError, PARSER_INSTRUCTION, PROMPT_CONTEXT_FIELDS, buildPromptContext, minimizeContext } from './index.js';
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

// Test-only capture provider (see service.test.ts for the rationale: fakes live only in *.test.ts).

class CapturingProvider implements AIProvider {
  readonly name = 'capture-test-adapter';
  input: unknown;
  instruction = '';

  status(): AIProviderStatus {
    return { provider: this.name, configured: true, capabilities: ['structured_output'] as AICapability[] };
  }

  async text(_request: TextRequest): Promise<never> {
    throw new Error('not used');
  }

  async vision(_request: VisionRequest): Promise<never> {
    throw new Error('not used');
  }

  async speechToText(_request: SpeechToTextRequest): Promise<never> {
    throw new Error('not used');
  }

  async embeddings(_request: EmbeddingsRequest): Promise<never> {
    throw new Error('not used');
  }

  async tools(_request: ToolCallRequest): Promise<never> {
    throw new Error('not used');
  }

  async structured(request: StructuredRequest): Promise<StructuredResult> {
    this.input = request.input;
    this.instruction = request.instruction;
    return { output: { actions: [], clarification: null } };
  }
}

const SENSITIVE_MARKERS = [
  'user@example.com',
  'private memory fact',
  'private day note',
  'peanut',
  'vegetarian',
  'Test User',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'trial',
  'aiConsent',
  'memoryEnabled',
  'allergies',
  'goals',
];

const contextFixture: TodayContext = {
  schemaVersion: 1,
  date: '2026-09-17',
  timezone: 'Europe/Riga',
  generatedAt: '2026-09-17T06:00:00+03:00',
  profile: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
    displayName: 'Test User',
    createdAt: '2026-01-01T00:00:00+03:00',
  },
  preferences: {
    timezone: 'Europe/Riga',
    locale: 'ru',
    theme: 'dark',
    city: 'Riga',
    dietaryRestrictions: ['vegetarian'],
    allergies: ['peanut'],
    aiConsent: true,
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
    nutrition: { status: 'unavailable', reason: 'not_implemented', data: null },
    weather: { status: 'unavailable', reason: 'not_implemented', data: null },
    wardrobe: { status: 'unavailable', reason: 'not_implemented', data: null },
    activity: { status: 'unavailable', reason: 'not_implemented', data: null },
    inventory: { status: 'unavailable', reason: 'not_implemented', data: null },
    shopping: { status: 'unavailable', reason: 'not_implemented', data: null },
    events: { status: 'unavailable', reason: 'not_implemented', data: null },
    changes: { status: 'unavailable', reason: 'not_implemented', data: null },
  },
};

describe('prompt context minimization', () => {
  it('builds exactly the whitelisted payload', () => {
    const context = buildPromptContext({ date: '2026-09-17', timezone: 'Europe/Riga', text: '  курица 200 г  ' });
    expect(context).toEqual({
      schemaVersion: 1,
      date: '2026-09-17',
      timezone: 'Europe/Riga',
      text: 'курица 200 г',
    });
    expect(Object.keys(context).sort()).toEqual([...PROMPT_CONTEXT_FIELDS].sort());
  });

  it('drops every personal field of TodayContext', () => {
    const minimized = minimizeContext(contextFixture, 'съел овсянку');
    expect(Object.keys(minimized).sort()).toEqual(['date', 'schemaVersion', 'text', 'timezone']);
    expect(minimized.date).toBe(contextFixture.date);
    expect(minimized.timezone).toBe(contextFixture.timezone);
  });

  it.each([
    ['an invalid date', { date: '17.09.2026', timezone: 'Europe/Riga', text: 'x' }],
    ['an empty timezone', { date: '2026-09-17', timezone: '   ', text: 'x' }],
    ['an empty text', { date: '2026-09-17', timezone: 'Europe/Riga', text: '  ' }],
  ])('rejects %s with AI_INVALID_INPUT', (_label, input) => {
    let caught: unknown;
    try {
      buildPromptContext(input);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AIServiceError);
    expect((caught as AIServiceError).code).toBe('AI_INVALID_INPUT');
    expect((caught as AIServiceError).statusCode).toBe(400);
  });
});

describe('what leaves the process during parse', () => {
  it('sends only date, timezone and the utterance to the provider', async () => {
    const provider = new CapturingProvider();
    await new AIService(provider).parse('добавь яйца в покупки', contextFixture);

    expect(provider.input).toEqual({
      schemaVersion: 1,
      date: '2026-09-17',
      timezone: 'Europe/Riga',
      text: 'добавь яйца в покупки',
    });
  });

  it('never leaks profile, allergies, health, memory, subscription or day note data', async () => {
    const provider = new CapturingProvider();
    await new AIService(provider).parse('добавь яйца в покупки', contextFixture);

    const serialized = JSON.stringify(provider.input);
    for (const marker of SENSITIVE_MARKERS) {
      expect(serialized, `payload must not contain "${marker}"`).not.toContain(marker);
    }
  });

  it('uses a vendor-neutral parser instruction covering only the contracted actions', () => {
    const instruction = PARSER_INSTRUCTION.toLowerCase();
    for (const actionType of ['add_meal', 'add_activity', 'create_event', 'add_shopping_item', 'update_day_note']) {
      expect(instruction).toContain(actionType);
    }
    for (const moduleName of ['nutrition', 'activity', 'events', 'shopping', 'context']) {
      expect(instruction).toContain(moduleName);
    }
    for (const vendor of ['gpt', 'openai', 'gemini', 'anthropic', 'claude', 'llama', 'mistral', 'gemma']) {
      expect(instruction).not.toContain(vendor);
    }
    expect(instruction).toContain('never invent');
    // The platform, not the provider, owns identity and confirmation flags.
    expect(instruction).toContain('do not output ids, confirmation flags');
  });
});
