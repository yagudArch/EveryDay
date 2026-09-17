import { AppError } from './errors.js';

/**
 * Minimal structural view of a Zod schema. Using the structural shape (instead of the
 * concrete `ZodType` generic) keeps request validation independent of Zod's internal
 * type parameters while still giving fully typed parsed output.
 */
export interface SchemaLike<TOutput> {
  safeParse(value: unknown): { success: true; data: TOutput } | { success: false };
}

/**
 * Strict request DTO validation. Unknown fields are rejected because every contract
 * schema is `.strict()`; failures are reported as a generic 400 without echoing input.
 */
export function parseBody<TOutput>(schema: SchemaLike<TOutput>, body: unknown): TOutput {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError('validation_error', 400, 'Request validation failed');
  }
  return result.data;
}

/** Validates a value a service produced against its contract schema (defence in depth). */
export function parseContract<TOutput>(schema: SchemaLike<TOutput>, value: unknown, code = 'contract_violation'): TOutput {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(code, 500, 'Internal response violated the API contract');
  }
  return result.data;
}
