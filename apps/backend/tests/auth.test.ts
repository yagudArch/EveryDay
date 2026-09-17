import { describe, expect, it } from 'vitest';
import { AuthResponseSchema, ErrorResponseSchema, routes } from '@everyday/contracts';
import { hashSessionToken } from '../src/auth/crypto.js';
import { getRow, getRows } from '../src/db/connection.js';
import { bearer, closeInspector, createHarness, openInspector, registerUser, TEST_PASSWORD } from './helpers.js';

describe('authentication', () => {
  it('registers an account and returns a contract-valid session', async () => {
    const harness = await createHarness();
    try {
      const response = await harness.app.inject({
        method: 'POST',
        url: routes.register,
        payload: {
          email: 'Mixed.Case@Example.COM',
          password: TEST_PASSWORD,
          displayName: '  Иван  ',
          timezone: 'Europe/Riga',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = AuthResponseSchema.parse(response.json());
      expect(body.user.email).toBe('mixed.case@example.com');
      expect(body.user.displayName).toBe('Иван');
      expect(body.token.length).toBeGreaterThanOrEqual(32);
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(harness.clock.now.getTime());
    } finally {
      await harness.cleanup();
    }
  });

  it('rejects a weak password and unknown fields with a sanitized 400', async () => {
    const harness = await createHarness();
    try {
      const weak = await harness.app.inject({
        method: 'POST',
        url: routes.register,
        payload: { email: 'a@example.test', password: 'short', displayName: 'A', timezone: 'Europe/Riga' },
      });
      expect(weak.statusCode).toBe(400);
      const weakBody = ErrorResponseSchema.parse(weak.json());
      expect(weakBody.error.code).toBe('validation_error');
      expect(weak.body).not.toContain('short');

      const injected = await harness.app.inject({
        method: 'POST',
        url: routes.register,
        payload: {
          email: 'b@example.test',
          password: TEST_PASSWORD,
          displayName: 'B',
          timezone: 'Europe/Riga',
          userId: 'attacker-supplied-id',
        },
      });
      expect(injected.statusCode).toBe(400);
      expect(ErrorResponseSchema.parse(injected.json()).error.code).toBe('validation_error');
    } finally {
      await harness.cleanup();
    }
  });

  it('reports a duplicate email as 409 without leaking credentials', async () => {
    const harness = await createHarness();
    try {
      const first = await registerUser(harness.app, { email: 'duplicate@example.test' });
      const response = await harness.app.inject({
        method: 'POST',
        url: routes.register,
        payload: {
          email: 'DUPLICATE@example.test',
          password: TEST_PASSWORD,
          displayName: 'Other',
          timezone: 'Europe/Riga',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe('email_taken');
      expect(response.body).not.toContain(first.token);
    } finally {
      await harness.cleanup();
    }
  });

  it('answers the same way for a wrong password and an unknown email', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);

      const wrongPassword = await harness.app.inject({
        method: 'POST',
        url: routes.login,
        payload: { email: user.email, password: 'definitely-not-the-password' },
      });
      const unknownEmail = await harness.app.inject({
        method: 'POST',
        url: routes.login,
        payload: { email: 'nobody@example.test', password: TEST_PASSWORD },
      });

      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownEmail.statusCode).toBe(401);
      expect(ErrorResponseSchema.parse(wrongPassword.json()).error.code).toBe('invalid_credentials');
      expect(ErrorResponseSchema.parse(unknownEmail.json()).error.code).toBe('invalid_credentials');
      expect(wrongPassword.body).not.toContain(user.token);
      expect(wrongPassword.body).not.toContain('definitely-not-the-password');
    } finally {
      await harness.cleanup();
    }
  });

  it('logs in with valid credentials and issues a different session token', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const response = await harness.app.inject({
        method: 'POST',
        url: routes.login,
        payload: { email: user.email.toUpperCase(), password: user.password },
      });

      expect(response.statusCode).toBe(200);
      const body = AuthResponseSchema.parse(response.json());
      expect(body.user.id).toBe(user.userId);
      expect(body.token).not.toBe(user.token);

      const me = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(body.token) });
      expect(me.statusCode).toBe(200);
      expect(me.json().id).toBe(user.userId);
    } finally {
      await harness.cleanup();
    }
  });

  it('revokes only the session used for logout', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const second = await harness.app.inject({
        method: 'POST',
        url: routes.login,
        payload: { email: user.email, password: user.password },
      });
      const secondToken = AuthResponseSchema.parse(second.json()).token;

      const logout = await harness.app.inject({ method: 'POST', url: routes.logout, headers: bearer(secondToken) });
      expect(logout.statusCode).toBe(204);

      const revoked = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(secondToken) });
      expect(revoked.statusCode).toBe(401);

      const stillValid = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) });
      expect(stillValid.statusCode).toBe(200);
    } finally {
      await harness.cleanup();
    }
  });

  it('stores only a scrypt hash of the password and a SHA-256 hash of the token', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const inspector = openInspector(harness.databasePath);
      try {
        const userRow = getRow<{ password_hash: string }>(
          inspector,
          'SELECT password_hash FROM users WHERE id = ?',
          [user.userId],
        );
        expect(userRow?.password_hash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$/);
        expect(userRow?.password_hash).not.toContain(user.password);

        const sessionRow = getRow<{ token_hash: string }>(
          inspector,
          'SELECT token_hash FROM sessions WHERE user_id = ?',
          [user.userId],
        );
        expect(sessionRow?.token_hash).toBe(hashSessionToken(user.token));
        expect(sessionRow?.token_hash).not.toBe(user.token);

        const sessionColumns = getRows<{ name: string }>(
          inspector,
          "SELECT name FROM pragma_table_info('sessions')",
        ).map((column) => column.name);
        expect(sessionColumns).not.toContain('token');
        expect(sessionColumns).not.toContain('password');
      } finally {
        closeInspector(inspector);
      }
    } finally {
      await harness.cleanup();
    }
  });
});
