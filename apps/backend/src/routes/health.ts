import { routes } from '@everyday/contracts';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import { getRow } from '../db/connection.js';
import { errorEnvelope } from '../errors.js';

function databaseIsReachable(context: AppContext): boolean {
  try {
    getRow<{ ok: number }>(context.db, 'SELECT 1 AS ok');
    return true;
  } catch {
    return false;
  }
}

/** GET /api/v1/health — public liveness/readiness probe for server and database. */
export function registerHealthRoutes(app: FastifyInstance, context: AppContext): void {
  app.get(routes.health, async (request, reply) => {
    if (!databaseIsReachable(context)) {
      reply.status(503).send(errorEnvelope(request.id, 'database_unavailable', 'Database is not available'));
      return;
    }
    reply.status(200).send({ status: 'ok', database: 'ok' });
  });
}
