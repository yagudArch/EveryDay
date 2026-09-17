import { describe, expect, it, vi } from 'vitest';
import {
  ActionPreviewSchema,
  AIStatusSchema,
  ErrorResponseSchema,
  routes,
  type ActionPreview,
  type AIStatus,
  type TodayContext,
} from '@everyday/contracts';
import type { AiGateway } from '../src/services/ai-service.js';
import { bearer, createHarness, registerUser } from './helpers.js';

const VALID_PREVIEW: ActionPreview = {
  actions: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      occurredAt: null,
      confidence: 0.9,
      confirmationRequired: true,
      type: 'update_day_note',
      module: 'context',
      parameters: { dayNote: 'После работы — зал' },
    },
  ],
  clarification: null,
};

const CONFIGURED_STATUS: AIStatus = {
  provider: 'test-double',
  configured: true,
  capabilities: ['structured_output'],
};

interface FakeGateway {
  gateway: AiGateway;
  parse: ReturnType<typeof vi.fn>;
}

function fakeGateway(overrides: { status?: AIStatus; parse?: (text: string, context: TodayContext) => Promise<unknown> } = {}): FakeGateway {
  const parse = vi.fn(async (text: string, context: TodayContext) => {
    if (overrides.parse) return overrides.parse(text, context);
    return VALID_PREVIEW;
  });
  return {
    parse,
    gateway: {
      getStatus: () => overrides.status ?? CONFIGURED_STATUS,
      parse: parse as unknown as AiGateway['parse'],
    },
  };
}

async function setConsent(app: Parameters<typeof registerUser>[0], token: string, aiConsent: boolean): Promise<void> {
  const response = await app.inject({
    method: 'PATCH',
    url: routes.preferences,
    headers: bearer(token),
    payload: { aiConsent },
  });
  expect(response.statusCode).toBe(200);
}

describe('AI endpoints without a provider', () => {
  it('reports the disabled provider honestly', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const response = await harness.app.inject({ method: 'GET', url: routes.aiStatus, headers: bearer(user.token) });

      expect(response.statusCode).toBe(200);
      const status = AIStatusSchema.parse(response.json());
      expect(status.configured).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });

  it('answers parse with an explicit 503 instead of a fabricated preview', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const response = await harness.app.inject({
        method: 'POST',
        url: routes.aiParse,
        headers: bearer(user.token),
        payload: { text: 'Сегодня утром съел овсянку и два яйца' },
      });

      expect(response.statusCode).toBe(503);
      const body = ErrorResponseSchema.parse(response.json());
      expect(body.error.code).toBe('ai_unavailable');
      expect(response.body).not.toContain('actions');
      expect(response.body).not.toContain('clarification');
    } finally {
      await harness.cleanup();
    }
  });

  it('requires an authenticated session for both AI endpoints', async () => {
    const harness = await createHarness();
    try {
      const status = await harness.app.inject({ method: 'GET', url: routes.aiStatus });
      expect(status.statusCode).toBe(401);

      const parse = await harness.app.inject({ method: 'POST', url: routes.aiParse, payload: { text: 'hello' } });
      expect(parse.statusCode).toBe(401);
    } finally {
      await harness.cleanup();
    }
  });
});

describe('AI consent gate and provider seam', () => {
  it('does not call a configured provider without explicit consent', async () => {
    const fake = fakeGateway();
    const harness = await createHarness({ ai: fake.gateway });
    try {
      const user = await registerUser(harness.app);
      const response = await harness.app.inject({
        method: 'POST',
        url: routes.aiParse,
        headers: bearer(user.token),
        payload: { text: 'Сегодня тренировка в 19:30' },
      });

      expect(response.statusCode).toBe(403);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe('ai_consent_required');
      expect(fake.parse).not.toHaveBeenCalled();
    } finally {
      await harness.cleanup();
    }
  });

  it('returns a validated preview with the real day context once consent is recorded', async () => {
    const fake = fakeGateway();
    const harness = await createHarness({ ai: fake.gateway });
    try {
      const user = await registerUser(harness.app, { timezone: 'Europe/Riga' });
      await setConsent(harness.app, user.token, true);

      const response = await harness.app.inject({
        method: 'POST',
        url: routes.aiParse,
        headers: bearer(user.token),
        payload: { text: 'Сегодня тренировка в 19:30' },
      });

      expect(response.statusCode).toBe(200);
      const preview = ActionPreviewSchema.parse(response.json());
      expect(preview.actions).toHaveLength(1);
      expect(preview.actions[0]?.confirmationRequired).toBe(true);

      expect(fake.parse).toHaveBeenCalledTimes(1);
      const call = fake.parse.mock.calls[0] as [string, TodayContext];
      expect(call[0]).toBe('Сегодня тренировка в 19:30');
      expect(call[1].date).toBe('2026-09-17');
      expect(call[1].profile.id).toBe(user.userId);
      expect(call[1].modules.nutrition.status).toBe('unavailable');
    } finally {
      await harness.cleanup();
    }
  });

  it('rejects provider output that violates the structured contract', async () => {
    const fake = fakeGateway({
      parse: async () => ({
        actions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            occurredAt: null,
            confidence: 0.9,
            confirmationRequired: false,
            type: 'update_day_note',
            module: 'context',
            parameters: { dayNote: 'unconfirmed write' },
          },
        ],
        clarification: null,
      }),
    });
    const harness = await createHarness({ ai: fake.gateway });
    try {
      const user = await registerUser(harness.app);
      await setConsent(harness.app, user.token, true);

      const response = await harness.app.inject({
        method: 'POST',
        url: routes.aiParse,
        headers: bearer(user.token),
        payload: { text: 'запиши заметку' },
      });

      expect(response.statusCode).toBe(502);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe('ai_invalid_output');
    } finally {
      await harness.cleanup();
    }
  });

  it('maps provider failures to sanitized errors', async () => {
    const timeout = fakeGateway({
      parse: async () => {
        throw Object.assign(new Error('upstream exploded with the user text'), {
          code: 'provider_timeout',
          statusCode: 504,
        });
      },
    });
    const timeoutHarness = await createHarness({ ai: timeout.gateway });
    try {
      const user = await registerUser(timeoutHarness.app);
      await setConsent(timeoutHarness.app, user.token, true);

      const response = await timeoutHarness.app.inject({
        method: 'POST',
        url: routes.aiParse,
        headers: bearer(user.token),
        payload: { text: 'секретный пользовательский текст' },
      });

      expect(response.statusCode).toBe(504);
      const body = ErrorResponseSchema.parse(response.json());
      expect(body.error.code).toBe('provider_timeout');
      expect(response.body).not.toContain('exploded');
      expect(response.body).not.toContain('секретный');
    } finally {
      await timeoutHarness.cleanup();
    }
  });

  it('falls back to 503 for an unrecognisable provider failure', async () => {
    const broken = fakeGateway({
      parse: async () => {
        throw new Error('plain failure');
      },
    });
    const harness = await createHarness({ ai: broken.gateway });
    try {
      const user = await registerUser(harness.app);
      await setConsent(harness.app, user.token, true);

      const response = await harness.app.inject({
        method: 'POST',
        url: routes.aiParse,
        headers: bearer(user.token),
        payload: { text: 'привет' },
      });

      expect(response.statusCode).toBe(503);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe('ai_unavailable');
    } finally {
      await harness.cleanup();
    }
  });

  it('validates the parse request DTO strictly', async () => {
    const fake = fakeGateway();
    const harness = await createHarness({ ai: fake.gateway });
    try {
      const user = await registerUser(harness.app);
      await setConsent(harness.app, user.token, true);

      const empty = await harness.app.inject({
        method: 'POST',
        url: routes.aiParse,
        headers: bearer(user.token),
        payload: { text: '   ' },
      });
      expect(empty.statusCode).toBe(400);

      const tooLong = await harness.app.inject({
        method: 'POST',
        url: routes.aiParse,
        headers: bearer(user.token),
        payload: { text: 'x'.repeat(4001) },
      });
      expect(tooLong.statusCode).toBe(400);

      const unknownField = await harness.app.inject({
        method: 'POST',
        url: routes.aiParse,
        headers: bearer(user.token),
        payload: { text: 'привет', userId: user.userId },
      });
      expect(unknownField.statusCode).toBe(400);
      expect(fake.parse).not.toHaveBeenCalled();
    } finally {
      await harness.cleanup();
    }
  });
});
