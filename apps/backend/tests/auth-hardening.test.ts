import { describe, expect, it } from 'vitest';
import {
  AcceptedSchema,
  AuthResponseSchema,
  EmailVerificationStatusSchema,
  ErrorResponseSchema,
  RevokeAllSessionsSchema,
  routes,
} from '@everyday/contracts';
import { getRow, getRows } from '../src/db/connection.js';
import {
  bearer,
  closeInspector,
  createHarness,
  jsonHeaders,
  openInspector,
  registerUser,
  TEST_PASSWORD,
} from './helpers.js';

/**
 * Auth hardening (BCK-001): email verification, password reset, revoke-all sessions.
 *
 * The opaque out-of-band token is captured through the injected TokenDelivery double, exactly
 * as production email would receive it — it must never appear in any HTTP response body, and
 * only its SHA-256 hash may be persisted.
 */
describe('auth hardening', () => {
  describe('email verification', () => {
    it('issues a token out of band, never echoing it, and confirms the account once', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);

        const requested = await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyRequest,
          headers: bearer(user.token),
        });
        expect(requested.statusCode).toBe(202);
        const status = EmailVerificationStatusSchema.parse(requested.json());
        expect(status.emailVerified).toBe(false);
        expect(status.verificationSentAt).not.toBeNull();

        // The delivery seam captured exactly one token; the API body never contains it.
        expect(harness.delivery.deliveries).toHaveLength(1);
        const delivered = harness.delivery.last()!;
        expect(delivered.purpose).toBe('email_verify');
        expect(delivered.email).toBe(user.email);
        expect(requested.body).not.toContain(delivered.token);

        // Only the hash is stored — the plaintext token is not in the database.
        const inspector = openInspector(harness.databasePath);
        try {
          const rows = getRows<{ token_hash: string }>(inspector, 'SELECT token_hash FROM auth_tokens', []);
          expect(rows).toHaveLength(1);
          expect(rows[0]?.token_hash).not.toBe(delivered.token);
        } finally {
          closeInspector(inspector);
        }

        const confirmed = await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyConfirm,
          headers: jsonHeaders(),
          payload: { token: delivered.token },
        });
        expect(confirmed.statusCode).toBe(200);
        expect(EmailVerificationStatusSchema.parse(confirmed.json()).emailVerified).toBe(true);

        // Single-use: the same token cannot be redeemed twice.
        const replay = await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyConfirm,
          headers: jsonHeaders(),
          payload: { token: delivered.token },
        });
        expect(replay.statusCode).toBe(400);
        expect(ErrorResponseSchema.parse(replay.json()).error.code).toBe('invalid_token');
      } finally {
        await harness.cleanup();
      }
    });

    it('rejects an expired verification token', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyRequest,
          headers: bearer(user.token),
        });
        const token = harness.delivery.last()!.token;

        // Advance beyond the 24h verification TTL.
        harness.clock.advance(24 * 60 * 60 * 1000 + 1000);

        const confirmed = await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyConfirm,
          headers: jsonHeaders(),
          payload: { token },
        });
        expect(confirmed.statusCode).toBe(400);
        expect(ErrorResponseSchema.parse(confirmed.json()).error.code).toBe('invalid_token');
      } finally {
        await harness.cleanup();
      }
    });

    it('is a no-op for an already-verified account and issues no new token', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        await harness.app.inject({ method: 'POST', url: routes.emailVerifyRequest, headers: bearer(user.token) });
        const token = harness.delivery.last()!.token;
        await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyConfirm,
          headers: jsonHeaders(),
          payload: { token },
        });

        harness.delivery.reset();
        const again = await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyRequest,
          headers: bearer(user.token),
        });
        expect(again.statusCode).toBe(202);
        const status = EmailVerificationStatusSchema.parse(again.json());
        expect(status.emailVerified).toBe(true);
        expect(status.verificationSentAt).toBeNull();
        expect(harness.delivery.deliveries).toHaveLength(0);
      } finally {
        await harness.cleanup();
      }
    });

    it('requires authentication to request verification', async () => {
      const harness = await createHarness();
      try {
        const response = await harness.app.inject({ method: 'POST', url: routes.emailVerifyRequest });
        expect(response.statusCode).toBe(401);
      } finally {
        await harness.cleanup();
      }
    });

    it('invalidates a prior unconsumed token when a new one is requested', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        await harness.app.inject({ method: 'POST', url: routes.emailVerifyRequest, headers: bearer(user.token) });
        const firstToken = harness.delivery.last()!.token;
        await harness.app.inject({ method: 'POST', url: routes.emailVerifyRequest, headers: bearer(user.token) });
        const secondToken = harness.delivery.last()!.token;
        expect(secondToken).not.toBe(firstToken);

        const stale = await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyConfirm,
          headers: jsonHeaders(),
          payload: { token: firstToken },
        });
        expect(stale.statusCode).toBe(400);

        const fresh = await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyConfirm,
          headers: jsonHeaders(),
          payload: { token: secondToken },
        });
        expect(fresh.statusCode).toBe(200);
      } finally {
        await harness.cleanup();
      }
    });
  });

  describe('password reset', () => {
    it('does not reveal whether an account exists (no user enumeration)', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);

        const known = await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetRequest,
          headers: jsonHeaders(),
          payload: { email: user.email },
        });
        const unknown = await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetRequest,
          headers: jsonHeaders(),
          payload: { email: 'nobody@example.test' },
        });

        expect(known.statusCode).toBe(202);
        expect(unknown.statusCode).toBe(202);
        expect(AcceptedSchema.parse(known.json())).toEqual({ status: 'accepted' });
        expect(unknown.json()).toEqual(known.json());

        // A token was issued only for the real account; none for the unknown email.
        expect(harness.delivery.deliveries).toHaveLength(1);
        expect(harness.delivery.last()!.purpose).toBe('password_reset');
        expect(known.body).not.toContain(harness.delivery.last()!.token);
      } finally {
        await harness.cleanup();
      }
    });

    it('resets the password, revokes existing sessions and rejects the old password', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        // A second live session that must not survive the reset.
        const second = await harness.app.inject({
          method: 'POST',
          url: routes.login,
          headers: jsonHeaders(),
          payload: { email: user.email, password: user.password },
        });
        const secondToken = AuthResponseSchema.parse(second.json()).token;

        await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetRequest,
          headers: jsonHeaders(),
          payload: { email: user.email },
        });
        const token = harness.delivery.last()!.token;

        const newPassword = 'brand-new-password-123';
        const confirmed = await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetConfirm,
          headers: jsonHeaders(),
          payload: { token, password: newPassword },
        });
        expect(confirmed.statusCode).toBe(204);

        // Both pre-reset sessions are revoked.
        expect((await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) })).statusCode).toBe(401);
        expect((await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(secondToken) })).statusCode).toBe(401);

        // The old password no longer works; the new one does.
        const oldLogin = await harness.app.inject({
          method: 'POST',
          url: routes.login,
          headers: jsonHeaders(),
          payload: { email: user.email, password: user.password },
        });
        expect(oldLogin.statusCode).toBe(401);

        const newLogin = await harness.app.inject({
          method: 'POST',
          url: routes.login,
          headers: jsonHeaders(),
          payload: { email: user.email, password: newPassword },
        });
        expect(newLogin.statusCode).toBe(200);
      } finally {
        await harness.cleanup();
      }
    });

    it('rejects an invalid or already-used reset token', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetRequest,
          headers: jsonHeaders(),
          payload: { email: user.email },
        });
        const token = harness.delivery.last()!.token;

        const first = await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetConfirm,
          headers: jsonHeaders(),
          payload: { token, password: 'first-new-password-1' },
        });
        expect(first.statusCode).toBe(204);

        const replay = await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetConfirm,
          headers: jsonHeaders(),
          payload: { token, password: 'second-new-password-2' },
        });
        expect(replay.statusCode).toBe(400);
        expect(ErrorResponseSchema.parse(replay.json()).error.code).toBe('invalid_token');
      } finally {
        await harness.cleanup();
      }
    });

    it('rejects an expired reset token', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetRequest,
          headers: jsonHeaders(),
          payload: { email: user.email },
        });
        const token = harness.delivery.last()!.token;

        // Advance beyond the 1h reset TTL.
        harness.clock.advance(60 * 60 * 1000 + 1000);

        const confirmed = await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetConfirm,
          headers: jsonHeaders(),
          payload: { token, password: 'brand-new-password-123' },
        });
        expect(confirmed.statusCode).toBe(400);
        expect(ErrorResponseSchema.parse(confirmed.json()).error.code).toBe('invalid_token');
      } finally {
        await harness.cleanup();
      }
    });
  });

  describe('revoke all sessions', () => {
    it('revokes every active session including the caller and reports the count', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        const second = await harness.app.inject({
          method: 'POST',
          url: routes.login,
          headers: jsonHeaders(),
          payload: { email: user.email, password: user.password },
        });
        const secondToken = AuthResponseSchema.parse(second.json()).token;

        const revoked = await harness.app.inject({
          method: 'POST',
          url: routes.sessionsRevokeAll,
          headers: bearer(user.token),
        });
        expect(revoked.statusCode).toBe(200);
        expect(RevokeAllSessionsSchema.parse(revoked.json()).revokedCount).toBe(2);

        // Every token, including the one that issued the request, is now invalid.
        expect((await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) })).statusCode).toBe(401);
        expect((await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(secondToken) })).statusCode).toBe(401);
      } finally {
        await harness.cleanup();
      }
    });

    it('only affects the current user, not other accounts', async () => {
      const harness = await createHarness();
      try {
        const alpha = await registerUser(harness.app);
        const beta = await registerUser(harness.app);

        const revoked = await harness.app.inject({
          method: 'POST',
          url: routes.sessionsRevokeAll,
          headers: bearer(alpha.token),
        });
        expect(revoked.statusCode).toBe(200);
        expect(RevokeAllSessionsSchema.parse(revoked.json()).revokedCount).toBe(1);

        // Beta's session is untouched.
        expect((await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(beta.token) })).statusCode).toBe(200);
      } finally {
        await harness.cleanup();
      }
    });

    it('requires authentication', async () => {
      const harness = await createHarness();
      try {
        const response = await harness.app.inject({ method: 'POST', url: routes.sessionsRevokeAll });
        expect(response.statusCode).toBe(401);
      } finally {
        await harness.cleanup();
      }
    });
  });

  describe('token storage integrity', () => {
    it('stores only auth-token hashes, never the plaintext, and marks them consumed', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        await harness.app.inject({ method: 'POST', url: routes.emailVerifyRequest, headers: bearer(user.token) });
        const delivered = harness.delivery.last()!;
        await harness.app.inject({
          method: 'POST',
          url: routes.emailVerifyConfirm,
          headers: jsonHeaders(),
          payload: { token: delivered.token },
        });

        const inspector = openInspector(harness.databasePath);
        try {
          const row = getRow<{ token_hash: string; consumed_at: string | null }>(
            inspector,
            'SELECT token_hash, consumed_at FROM auth_tokens WHERE user_id = ? AND purpose = ?',
            [user.userId, 'email_verify'],
          );
          expect(row?.token_hash).not.toBe(delivered.token);
          expect(row?.consumed_at).not.toBeNull();

          const columns = getRows<{ name: string }>(inspector, "SELECT name FROM pragma_table_info('auth_tokens')", []).map(
            (column) => column.name,
          );
          expect(columns).not.toContain('token');
          expect(columns).toContain('token_hash');
        } finally {
          closeInspector(inspector);
        }
      } finally {
        await harness.cleanup();
      }
    });
  });

  describe('rate limiting on sensitive endpoints', () => {
    it('applies the stricter credential limit to password reset requests', async () => {
      const harness = await createHarness({ rateLimit: true });
      try {
        // authMax is 3 with rateLimit enabled in the harness.
        for (let index = 0; index < 3; index += 1) {
          const ok = await harness.app.inject({
            method: 'POST',
            url: routes.passwordResetRequest,
            headers: jsonHeaders(),
            payload: { email: 'someone@example.test' },
          });
          expect(ok.statusCode).toBe(202);
        }
        const blocked = await harness.app.inject({
          method: 'POST',
          url: routes.passwordResetRequest,
          headers: jsonHeaders(),
          payload: { email: 'someone@example.test' },
        });
        expect(blocked.statusCode).toBe(429);
        expect(ErrorResponseSchema.parse(blocked.json()).error.code).toBe('rate_limited');
      } finally {
        await harness.cleanup();
      }
    });
  });
});
