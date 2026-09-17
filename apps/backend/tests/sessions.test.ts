import { describe, expect, it } from 'vitest';
import { ErrorResponseSchema, ProfileSchema, routes } from '@everyday/contracts';
import { SESSION_TTL_MS } from '../src/services/auth-service.js';
import { bearer, createHarness, registerUser } from './helpers.js';

describe('session authentication and isolation', () => {
  it('rejects missing, malformed and unknown bearer tokens with 401', async () => {
    const harness = await createHarness();
    try {
      const missing = await harness.app.inject({ method: 'GET', url: routes.me });
      expect(missing.statusCode).toBe(401);
      expect(ErrorResponseSchema.parse(missing.json()).error.code).toBe('unauthorized');

      const malformed = await harness.app.inject({ method: 'GET', url: routes.me, headers: { authorization: 'Token abc' } });
      expect(malformed.statusCode).toBe(401);

      const unknown = await harness.app.inject({
        method: 'GET',
        url: routes.me,
        headers: { authorization: `Bearer ${'a'.repeat(43)}` },
      });
      expect(unknown.statusCode).toBe(401);
      expect(ErrorResponseSchema.parse(unknown.json()).error.code).toBe('invalid_session');
    } finally {
      await harness.cleanup();
    }
  });

  it('expires sessions at the exact half-open boundary', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);

      harness.clock.advance(SESSION_TTL_MS - 1);
      const beforeExpiry = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) });
      expect(beforeExpiry.statusCode).toBe(200);

      harness.clock.advance(1);
      const atExpiry = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) });
      expect(atExpiry.statusCode).toBe(401);

      harness.clock.advance(60_000);
      const afterExpiry = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) });
      expect(afterExpiry.statusCode).toBe(401);
    } finally {
      await harness.cleanup();
    }
  });

  it('ignores a client-supplied user id and rejects one inside a strict body', async () => {
    const harness = await createHarness();
    try {
      const victim = await registerUser(harness.app, { displayName: 'Victim' });
      const attacker = await registerUser(harness.app, { displayName: 'Attacker' });

      const queryAttempt = await harness.app.inject({
        method: 'GET',
        url: `${routes.me}?userId=${victim.userId}`,
        headers: bearer(attacker.token),
      });
      expect(queryAttempt.statusCode).toBe(200);
      const profile = ProfileSchema.parse(queryAttempt.json());
      expect(profile.id).toBe(attacker.userId);
      expect(profile.id).not.toBe(victim.userId);

      const bodyAttempt = await harness.app.inject({
        method: 'PATCH',
        url: routes.me,
        headers: bearer(attacker.token),
        payload: { displayName: 'Renamed', id: victim.userId },
      });
      expect(bodyAttempt.statusCode).toBe(400);

      const contextAttempt = await harness.app.inject({
        method: 'PATCH',
        url: routes.today,
        headers: bearer(attacker.token),
        payload: { dayNote: 'note', userId: victim.userId },
      });
      expect(contextAttempt.statusCode).toBe(400);

      const victimUnchanged = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(victim.token) });
      expect(ProfileSchema.parse(victimUnchanged.json()).displayName).toBe('Victim');
    } finally {
      await harness.cleanup();
    }
  });

  it('keeps two accounts fully isolated', async () => {
    const harness = await createHarness();
    try {
      const alpha = await registerUser(harness.app, { displayName: 'Alpha', timezone: 'Europe/Riga' });
      const beta = await registerUser(harness.app, { displayName: 'Beta', timezone: 'Asia/Tokyo' });

      const alphaPatch = await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(alpha.token),
        payload: { theme: 'dark', aiConsent: true, allergies: ['peanut'] },
      });
      expect(alphaPatch.statusCode).toBe(200);

      const betaPrefs = await harness.app.inject({ method: 'GET', url: routes.preferences, headers: bearer(beta.token) });
      expect(betaPrefs.statusCode).toBe(200);
      const betaBody = betaPrefs.json();
      expect(betaBody.theme).toBe('system');
      expect(betaBody.aiConsent).toBe(false);
      expect(betaBody.allergies).toEqual([]);
      expect(betaBody.timezone).toBe('Asia/Tokyo');
      expect(betaPrefs.body).not.toContain(alpha.userId);

      const alphaPrefs = await harness.app.inject({ method: 'GET', url: routes.preferences, headers: bearer(alpha.token) });
      expect(alphaPrefs.json().theme).toBe('dark');
      expect(alphaPrefs.json().allergies).toEqual(['peanut']);

      const betaLogout = await harness.app.inject({ method: 'POST', url: routes.logout, headers: bearer(beta.token) });
      expect(betaLogout.statusCode).toBe(204);

      const alphaStillValid = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(alpha.token) });
      expect(alphaStillValid.statusCode).toBe(200);
    } finally {
      await harness.cleanup();
    }
  });
});
