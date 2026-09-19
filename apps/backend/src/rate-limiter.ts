import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './errors.js';

export interface RateLimiterOptions {
  max: number;
  windowMs: number;
  maxEntries: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window, per-key, in-memory limiter.
 *
 * SINGLE-PROCESS BOUNDARY (explicit): state lives in this Node process only. It resets on
 * restart and is not shared between instances, so a multi-instance deployment must move the
 * counter to a shared store. Foundation is deliberately single-process.
 *
 * Memory is bounded: expired entries are swept and, if the map is still at capacity, the
 * oldest keys are evicted, so the tracked-key count can never exceed `maxEntries`.
 */
export class InMemoryRateLimiter {
  readonly #max: number;
  readonly #windowMs: number;
  readonly #maxEntries: number;
  readonly #entries = new Map<string, { count: number; resetAt: number }>();

  constructor(options: RateLimiterOptions) {
    this.#max = options.max;
    this.#windowMs = options.windowMs;
    this.#maxEntries = options.maxEntries;
  }

  get size(): number {
    return this.#entries.size;
  }

  check(key: string, nowMs: number): RateLimitDecision {
    let entry = this.#entries.get(key);
    if (!entry || entry.resetAt <= nowMs) {
      entry = { count: 0, resetAt: nowMs + this.#windowMs };
      this.#entries.set(key, entry);
    }
    entry.count += 1;

    if (this.#entries.size > this.#maxEntries) {
      this.#evict(nowMs);
    }

    const allowed = entry.count <= this.#max;
    return {
      allowed,
      limit: this.#max,
      remaining: Math.max(0, this.#max - entry.count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((entry.resetAt - nowMs) / 1000)),
    };
  }

  #evict(nowMs: number): void {
    for (const [key, entry] of this.#entries) {
      if (entry.resetAt <= nowMs) this.#entries.delete(key);
    }
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next();
      if (oldest.done) break;
      this.#entries.delete(oldest.value);
    }
  }
}

/** Route `preHandler` that enforces a limiter and answers 429 with a Retry-After header. */
export function createRateLimitPreHandler(
  limiter: InMemoryRateLimiter,
  now: () => Date,
  keyPrefix: string,
  enabled = true,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request, reply) => {
    if (!enabled) return;
    const decision = limiter.check(`${keyPrefix}:${request.ip}`, now().getTime());
    if (!decision.allowed) {
      reply.header('retry-after', String(decision.retryAfterSeconds));
      throw new AppError('rate_limited', 429, 'Too many requests');
    }
  };
}
