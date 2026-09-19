import { ActionPreviewSchema, ParseInputSchema, routes } from '@everyday/contracts';
import type { FastifyInstance } from 'fastify';
import { requirePrincipal } from '../auth/principal.js';
import type { AppContext } from '../context.js';
import { AppError, errorEnvelope } from '../errors.js';
import { buildTodayContext, loadPreferences } from '../services/context-service.js';
import { toAiAppError } from '../services/ai-service.js';
import { parseBody } from '../validation.js';

/**
 * AI endpoints.
 *
 * Pipeline: explicit user input -> capability check -> consent check -> provider -> strict
 * structured-output validation -> preview that still requires confirmation. The provider never
 * receives a database handle, and Foundation does not apply any AI action.
 *
 * Without a configured provider every parse request is answered with an honest 503 — there is
 * no mock-success path that could look like a real AI result.
 */
export function registerAiRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: context.requireAuth };

  app.get(routes.aiStatus, auth, async (request, reply) => {
    requirePrincipal(request);
    reply.status(200).send(context.ai.getStatus());
  });

  app.post(routes.aiParse, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const input = parseBody(ParseInputSchema, request.body);

    const status = context.ai.getStatus();
    if (!status.configured) {
      reply
        .status(503)
        .send(errorEnvelope(request.id, 'ai_unavailable', 'No AI provider is configured for this server'));
      return;
    }

    const preferences = loadPreferences(context.db, principal.userId);
    if (!preferences.aiConsent) {
      // Sending user text to an external provider requires recorded, explicit consent.
      throw new AppError('ai_consent_required', 403, 'AI processing requires explicit consent');
    }

    const today = buildTodayContext(context.db, principal.user, context.now());
    try {
      const preview = await context.ai.parse(input.text, today);
      const parsed = ActionPreviewSchema.safeParse(preview);
      if (!parsed.success) {
        throw new AppError('ai_invalid_output', 502, 'AI provider returned an unexpected response shape');
      }
      reply.status(200).send(parsed.data);
    } catch (error) {
      // Sanitized: provider internals and the user's text never reach the response or the log.
      throw toAiAppError(error);
    }
  });
}
