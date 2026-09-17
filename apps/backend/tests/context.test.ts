import { describe, expect, it } from 'vitest';
import { TodayContextSchema, routes } from '@everyday/contracts';
import { bearer, createHarness, registerUser } from './helpers.js';

async function readToday(app: Parameters<typeof registerUser>[0], token: string) {
  const response = await app.inject({ method: 'GET', url: routes.today, headers: bearer(token) });
  expect(response.statusCode).toBe(200);
  return TodayContextSchema.parse(response.json());
}

describe('day context', () => {
  it('derives the local date from the profile timezone, not from the client', async () => {
    // 2026-09-17T22:30Z is already 2026-09-18 in Tokyo but still 2026-09-17 in Los Angeles.
    const harness = await createHarness({ startAt: '2026-09-17T22:30:00.000Z' });
    try {
      const user = await registerUser(harness.app, { timezone: 'Asia/Tokyo' });
      const tokyo = await readToday(harness.app, user.token);
      expect(tokyo.date).toBe('2026-09-18');
      expect(tokyo.timezone).toBe('Asia/Tokyo');

      const moved = await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: { timezone: 'America/Los_Angeles' },
      });
      expect(moved.statusCode).toBe(200);

      const losAngeles = await readToday(harness.app, user.token);
      expect(losAngeles.date).toBe('2026-09-17');
      expect(losAngeles.timezone).toBe('America/Los_Angeles');
    } finally {
      await harness.cleanup();
    }
  });

  it('reports unimplemented modules as unavailable instead of zeroed data', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const context = await readToday(harness.app, user.token);

      expect(context.schemaVersion).toBe(1);
      expect(context.generatedAt).toBe(harness.clock.now.toISOString());
      expect(context.dayNote).toBeNull();
      expect(context.goals).toEqual([]);
      expect(context.memory).toEqual([]);
      expect(context.profile.id).toBe(user.userId);

      for (const module of Object.values(context.modules)) {
        expect(module).toEqual({ status: 'unavailable', reason: 'not_implemented', data: null });
      }
    } finally {
      await harness.cleanup();
    }
  });

  it('never fabricates memory facts, even when memory is enabled', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: { memoryEnabled: true },
      });

      const context = await readToday(harness.app, user.token);
      expect(context.preferences.memoryEnabled).toBe(true);
      expect(context.memory).toEqual([]);
      expect(context.goals).toEqual([]);
    } finally {
      await harness.cleanup();
    }
  });

  it('stores, returns and clears the explicit day note for the server-computed day', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app, { timezone: 'Europe/Riga' });

      const set = await harness.app.inject({
        method: 'PATCH',
        url: routes.today,
        headers: bearer(user.token),
        payload: { dayNote: 'После работы — зал, вечером встреча с друзьями' },
      });
      expect(set.statusCode).toBe(200);
      const setBody = TodayContextSchema.parse(set.json());
      expect(setBody.dayNote).toBe('После работы — зал, вечером встреча с друзьями');
      expect(setBody.date).toBe('2026-09-17');

      const cleared = await harness.app.inject({
        method: 'PATCH',
        url: routes.today,
        headers: bearer(user.token),
        payload: { dayNote: null },
      });
      expect(cleared.statusCode).toBe(200);
      expect(TodayContextSchema.parse(cleared.json()).dayNote).toBeNull();
    } finally {
      await harness.cleanup();
    }
  });

  it('validates the day note length and rejects unknown fields', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);

      const tooLong = await harness.app.inject({
        method: 'PATCH',
        url: routes.today,
        headers: bearer(user.token),
        payload: { dayNote: 'x'.repeat(2001) },
      });
      expect(tooLong.statusCode).toBe(400);

      const unknown = await harness.app.inject({
        method: 'PATCH',
        url: routes.today,
        headers: bearer(user.token),
        payload: { dayNote: 'ok', date: '1999-01-01' },
      });
      expect(unknown.statusCode).toBe(400);
    } finally {
      await harness.cleanup();
    }
  });

  it('keeps the day note per local date and per user', async () => {
    const harness = await createHarness();
    try {
      const alpha = await registerUser(harness.app, { timezone: 'Europe/Riga' });
      const beta = await registerUser(harness.app, { timezone: 'Europe/Riga' });

      await harness.app.inject({
        method: 'PATCH',
        url: routes.today,
        headers: bearer(alpha.token),
        payload: { dayNote: 'alpha note' },
      });

      const betaContext = await readToday(harness.app, beta.token);
      expect(betaContext.dayNote).toBeNull();

      // Crossing into the next local day by time does not move the previous day's note.
      harness.clock.advance(24 * 60 * 60 * 1000);
      const nextDay = await readToday(harness.app, alpha.token);
      expect(nextDay.date).toBe('2026-09-18');
      expect(nextDay.dayNote).toBeNull();
    } finally {
      await harness.cleanup();
    }
  });
});
