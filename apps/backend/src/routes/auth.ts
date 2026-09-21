import {
  LoginSchema,
  RegisterSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  routes,
} from '@everyday/contracts';
import type { FastifyInstance } from 'fastify';
import { requirePrincipal } from '../auth/principal.js';
import type { AppContext } from '../context.js';
import { InMemoryRateLimiter, createRateLimitPreHandler } from '../rate-limiter.js';
import {
  confirmEmailVerification,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  revokeAllSessions,
} from '../services/auth-hardening-service.js';
import { login, logout, register } from '../services/auth-service.js';
import { parseBody } from '../validation.js';

/**
 * Authentication endpoints.
 *
 * Register/login and the sensitive hardening flows (email verification, password reset)
 * pass through a stricter credential limiter on top of the global one. Session tokens are
 * opaque and single-purpose; logout revokes only the session used for the request, while
 * revoke-all revokes every active session for the authenticated user.
 *
 * Out-of-band tokens (email verification, password reset) are opaque and single-use: only a
 * SHA-256 hash is stored, the plaintext is delivered through the injected TokenDelivery seam
 * and is never logged or echoed by the API. Request endpoints never reveal whether an account
 * or verification state exists (no user enumeration).
 */
export function registerAuthRoutes(app: FastifyInstance, context: AppContext): void {
  const credentialLimiter = new InMemoryRateLimiter({
    max: context.env.rateLimit.authMax,
    windowMs: context.env.rateLimit.windowMs,
    maxEntries: context.env.rateLimit.maxEntries,
  });
  const credentialGuard = createRateLimitPreHandler(
    credentialLimiter,
    context.now,
    'auth',
    context.env.rateLimit.enabled,
  );

  app.post(routes.register, { preHandler: credentialGuard }, async (request, reply) => {
    const input = parseBody(RegisterSchema, request.body);
    const result = await register(context.db, input, context.now());
    reply.header('cache-control', 'no-store');
    reply.status(201).send(result);
  });

  app.post(routes.login, { preHandler: credentialGuard }, async (request, reply) => {
    const input = parseBody(LoginSchema, request.body);
    const result = await login(context.db, input, context.now());
    reply.header('cache-control', 'no-store');
    reply.status(200).send(result);
  });

  app.post(routes.logout, { preHandler: context.requireAuth }, async (request, reply) => {
    const principal = requirePrincipal(request);
    logout(context.db, principal.sessionId, context.now());
    reply.status(204).send();
  });

  // --- Auth hardening (BCK-001) ---------------------------------------------------------

  // Authenticated: issue a fresh email-verification token to the current account. Guarded by
  // the credential limiter so it cannot be used to hammer the delivery seam.
  app.post(
    routes.emailVerifyRequest,
    { preHandler: [context.requireAuth, credentialGuard] },
    async (request, reply) => {
      const principal = requirePrincipal(request);
      const result = await requestEmailVerification(
        context.db,
        context.tokenDelivery,
        principal.userId,
        context.now(),
      );
      reply.header('cache-control', 'no-store');
      reply.status(202).send(result);
    },
  );

  // Public: confirm an email-verification token. Single-use; invalid/expired tokens are 400.
  app.post(routes.emailVerifyConfirm, { preHandler: credentialGuard }, async (request, reply) => {
    const input = parseBody(VerifyEmailSchema, request.body);
    const result = confirmEmailVerification(context.db, input, context.now());
    reply.header('cache-control', 'no-store');
    reply.status(200).send(result);
  });

  // Public: start a password reset. Always 202 accepted; never reveals account existence.
  app.post(routes.passwordResetRequest, { preHandler: credentialGuard }, async (request, reply) => {
    const input = parseBody(RequestPasswordResetSchema, request.body);
    const result = await requestPasswordReset(context.db, context.tokenDelivery, input, context.now());
    reply.header('cache-control', 'no-store');
    reply.status(202).send(result);
  });

  // Public: complete a password reset. Consumes the token, replaces the hash and revokes all
  // sessions for the account. Invalid/expired tokens are 400.
  app.post(routes.passwordResetConfirm, { preHandler: credentialGuard }, async (request, reply) => {
    const input = parseBody(ResetPasswordSchema, request.body);
    await resetPassword(context.db, input, context.now());
    reply.header('cache-control', 'no-store');
    reply.status(204).send();
  });

  // Authenticated: revoke every active session for the current user (including the caller's).
  app.post(routes.sessionsRevokeAll, { preHandler: context.requireAuth }, async (request, reply) => {
    const principal = requirePrincipal(request);
    const result = revokeAllSessions(context.db, principal.userId, context.now());
    reply.header('cache-control', 'no-store');
    reply.status(200).send(result);
  });
}
