import { LoginSchema, RegisterSchema, routes } from '@everyday/contracts';
import type { FastifyInstance } from 'fastify';
import { requirePrincipal } from '../auth/principal.js';
import type { AppContext } from '../context.js';
import { InMemoryRateLimiter, createRateLimitPreHandler } from '../rate-limiter.js';
import { login, logout, register } from '../services/auth-service.js';
import { parseBody } from '../validation.js';

/**
 * Authentication endpoints.
 *
 * Register/login additionally pass through a stricter credential limiter on top of the
 * global one. Session tokens are opaque and single-purpose; logout revokes only the
 * session used for the request.
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
}
