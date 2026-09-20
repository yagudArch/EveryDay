import { CreateMealSchema, UpdateNutritionGoalSchema, routes } from '@everyday/contracts';
import type { FastifyInstance } from 'fastify';
import { requirePrincipal } from '../auth/principal.js';
import type { AppContext } from '../context.js';
import { AppError } from '../errors.js';
import { addMeal, getGoal, getSummary, listMeals, setGoal } from '../nutrition/service.js';
import { parseBody } from '../validation.js';

/**
 * Reads an optional `date` query parameter. Only a single string is accepted; arrays or
 * other shapes are rejected as a 400. Calendar validation happens in the service.
 */
function readDateQuery(query: unknown): string | undefined {
  if (query === null || typeof query !== 'object') return undefined;
  const value = (query as Record<string, unknown>).date;
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new AppError('validation_error', 400, 'Invalid date');
  }
  return value;
}

/**
 * Nutrition endpoints. Ownership is always taken from the session principal; the client
 * cannot address another user's meals or goal, and the local day is computed server-side
 * from the profile timezone. Request DTOs are strict, so unknown fields are rejected.
 */
export function registerNutritionRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: context.requireAuth };

  app.get(routes.nutritionGoals, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    reply.status(200).send(getGoal(context.db, principal.userId));
  });

  app.put(routes.nutritionGoals, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const input = parseBody(UpdateNutritionGoalSchema, request.body);
    reply.status(200).send(setGoal(context.db, principal.userId, input, context.now()));
  });

  app.get(routes.nutritionMeals, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const date = readDateQuery(request.query);
    reply.status(200).send(listMeals(context.db, principal.userId, context.now(), { date }));
  });

  app.post(routes.nutritionMeals, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const input = parseBody(CreateMealSchema, request.body);
    reply.status(201).send(addMeal(context.db, principal.userId, input, context.now()));
  });

  app.get(routes.nutritionSummary, auth, async (request, reply) => {
    const principal = requirePrincipal(request);
    const date = readDateQuery(request.query);
    reply.status(200).send(getSummary(context.db, principal.userId, context.now(), { date }));
  });
}
