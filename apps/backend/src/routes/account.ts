import { UpdateDayContextSchema, UpdatePreferencesSchema, UpdateProfileSchema, routes } from '@everyday/contracts';
import type { FastifyInstance } from 'fastify';
import { requirePrincipal } from '../auth/principal.js';
import type { AppContext } from '../context.js';
import { getPreferences, getProfile, updatePreferences, updateProfile } from '../services/account-service.js';
import { buildTodayContext, readSubscription, updateDayNote } from '../services/context-service.js';
import { parseBody } from '../validation.js';

/**
 * Private account endpoints. Every handler takes its identity from the session principal,
 * never from the request body, query string or headers — there is no way to address another
 * user's data. Request DTOs are strict, so unknown fields (including a stray `userId`) are rejected.
 */
export function registerAccountRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: context.requireAuth };

  app.get(routes.me, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    reply.status(200).send(getProfile(principal.user));
  });

  app.patch(routes.me, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const input = parseBody(UpdateProfileSchema, request.body);
    reply.status(200).send(updateProfile(context.db, principal.userId, input, context.now()));
  });

  app.get(routes.preferences, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    reply.status(200).send(getPreferences(context.db, principal.userId));
  });

  app.patch(routes.preferences, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const input = parseBody(UpdatePreferencesSchema, request.body);
    reply.status(200).send(updatePreferences(context.db, principal.userId, input, context.now()));
  });

  app.get(routes.today, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    reply.status(200).send(buildTodayContext(context.db, principal.user, context.now()));
  });

  app.patch(routes.today, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const input = parseBody(UpdateDayContextSchema, request.body);
    reply.status(200).send(updateDayNote(context.db, principal.user, input.dayNote, context.now()));
  });

  app.get(routes.subscription, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    reply.status(200).send(readSubscription(context.db, principal.user, context.now()));
  });
}
