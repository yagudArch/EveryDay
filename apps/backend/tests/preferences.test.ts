import { describe, expect, it } from 'vitest';
import { ErrorResponseSchema, PreferencesSchema, routes } from '@everyday/contracts';
import { bearer, createHarness, registerUser } from './helpers.js';

async function readPreferences(app: Parameters<typeof registerUser>[0], token: string) {
  const response = await app.inject({ method: 'GET', url: routes.preferences, headers: bearer(token) });
  expect(response.statusCode).toBe(200);
  return PreferencesSchema.parse(response.json());
}

describe('preferences', () => {
  it('creates honest defaults: no consent, memory off, no restrictions', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app, { timezone: 'Europe/Riga' });
      const preferences = await readPreferences(harness.app, user.token);

      expect(preferences).toEqual({
        timezone: 'Europe/Riga',
        locale: 'ru',
        theme: 'system',
        city: null,
        dietaryRestrictions: [],
        allergies: [],
        aiConsent: false,
        memoryEnabled: false,
      });
    } finally {
      await harness.cleanup();
    }
  });

  it('applies a partial patch without touching other fields', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const response = await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: { theme: 'dark' },
      });

      expect(response.statusCode).toBe(200);
      const preferences = PreferencesSchema.parse(response.json());
      expect(preferences.theme).toBe('dark');
      expect(preferences.timezone).toBe(user.timezone);
      expect(preferences.locale).toBe('ru');
      expect(preferences.city).toBeNull();
    } finally {
      await harness.cleanup();
    }
  });

  it('rejects an empty patch, unknown fields and an invalid timezone', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);

      const empty = await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: {},
      });
      expect(empty.statusCode).toBe(400);
      expect(ErrorResponseSchema.parse(empty.json()).error.code).toBe('validation_error');

      const unknownField = await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: { timezone: 'Europe/Riga', userId: 'other-user' },
      });
      expect(unknownField.statusCode).toBe(400);

      const badTimezone = await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: { timezone: 'Mars/Olympus_Mons' },
      });
      expect(badTimezone.statusCode).toBe(400);
    } finally {
      await harness.cleanup();
    }
  });

  it('stores list values relationally and round-trips them', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const patch = await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: { dietaryRestrictions: ['gluten-free', 'lactose-free'], allergies: ['peanut'], aiConsent: true },
      });
      expect(patch.statusCode).toBe(200);

      const reloaded = await readPreferences(harness.app, user.token);
      expect(reloaded.dietaryRestrictions).toEqual(['gluten-free', 'lactose-free']);
      expect(reloaded.allergies).toEqual(['peanut']);
      expect(reloaded.aiConsent).toBe(true);

      const cleared = await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: { allergies: [] },
      });
      expect(cleared.statusCode).toBe(200);
      expect(PreferencesSchema.parse(cleared.json()).allergies).toEqual([]);
      expect(PreferencesSchema.parse(cleared.json()).dietaryRestrictions).toEqual(['gluten-free', 'lactose-free']);
    } finally {
      await harness.cleanup();
    }
  });

  it('persists preferences across a reopen of the same database file', async () => {
    const first = await createHarness();
    let databasePath = '';
    try {
      databasePath = first.databasePath;
      const user = await registerUser(first.app, { email: 'persisted@example.test' });
      const patch = await first.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: { timezone: 'Asia/Tokyo', city: 'Tokyo', theme: 'light' },
      });
      expect(patch.statusCode).toBe(200);
    } finally {
      await first.cleanup();
    }

    const second = await createHarness({ databasePath });
    try {
      const login = await second.app.inject({
        method: 'POST',
        url: routes.login,
        payload: { email: 'persisted@example.test', password: 'correct-horse-battery-staple' },
      });
      expect(login.statusCode).toBe(200);
      const token = login.json().token as string;

      const preferences = await readPreferences(second.app, token);
      expect(preferences.timezone).toBe('Asia/Tokyo');
      expect(preferences.city).toBe('Tokyo');
      expect(preferences.theme).toBe('light');
    } finally {
      await second.cleanup();
    }
  });
});
