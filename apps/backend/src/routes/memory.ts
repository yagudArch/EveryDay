import { CreateMemoryFactSchema, memoryFactById, routes } from '@everyday/contracts';
import type { FastifyInstance } from 'fastify';
import { requirePrincipal } from '../auth/principal.js';
import type { AppContext } from '../context.js';
import { AppError } from '../errors.js';
import {
  addMemoryFact,
  deleteAllMemory,
  deleteMemoryFact,
  listMemory,
} from '../services/memory-service.js';
import { parseBody } from '../validation.js';

/**
 * Reads the `id` path parameter for DELETE /memory/{id}. Only a single string is accepted.
 * The value is used solely with the principal's userId in an ownership-scoped query, so it
 * can never address another user's fact.
 */
function readIdParam(params: unknown): string {
  if (params === null || typeof params !== 'object') {
    throw new AppError('validation_error', 400, 'Invalid memory id');
  }
  const value = (params as Record<string, unknown>).id;
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError('validation_error', 400, 'Invalid memory id');
  }
  return value;
}

/**
 * Memory endpoints. Ownership is always taken from the session principal; the client cannot
 * address another user's facts. The published contract path is `/memory/{id}`; Fastify's
 * runtime param convention is `:id`, so the delete-one route is registered with `:id` while
 * the OpenAPI document (generated from the contract catalog) keeps `{id}`.
 *
 * `DELETE /memory` (delete-all) and `DELETE /memory/:id` (delete-one) are distinct Fastify
 * routes and do not collide.
 */
export function registerMemoryRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: context.requireAuth };

  app.get(routes.memory, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    reply.status(200).send(listMemory(context.db, principal.userId));
  });

  app.post(routes.memory, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const input = parseBody(CreateMemoryFactSchema, request.body);
    reply.status(201).send(addMemoryFact(context.db, principal.userId, input, context.now()));
  });

  app.delete(routes.memory, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    reply.status(200).send(deleteAllMemory(context.db, principal.userId));
  });

  app.delete(memoryFactById(':id'), auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const id = readIdParam(request.params);
    deleteMemoryFact(context.db, principal.userId, id);
    reply.status(204).send();
  });
}
