import { describe, expect, it } from 'vitest';
import { ErrorResponseSchema, routes } from '@everyday/contracts';
import { InMemoryRateLimiter } from '../src/rate-limiter.js';
import { createHarness, registerUser } from './helpers.js';

describe('bounded in-memory rate limiting', () => {
  it('bounds tracked keys and sweeps expired entries', () => {
    const limiter = new InMemoryRateLimiter({ max: 10, windowMs: 1000, maxEntries: 3 });
    for (const key of ['a', 'b', 'c', 'd', 'e']) {
      limiter.check(key, 0);
    }
    expect(limiter.size).toBe(3);

    // After the window passes, previously tracked keys are swept on demand.
    limiter.check('f', 5000);
    expect(limiter.size).toBeLessThanOrEqual(3);
  });

  it('reports remaining budget and a retry delay', () => {
    const limiter = new InMemoryRateLimiter({ max: 2, windowMs: 60_000, maxEntries: 10 });
    expect(limiter.check('ip', 0)).toMatchObject({ allowed: true, remaining: 1, retryAfterSeconds: 0 });
    expect(limiter.check('ip', 1)).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = limiter.check('ip', 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('blocks a caller that exceeds the global limit and resets after the window', async () => {
    const harness = await createHarness({ rateLimit: true });
    try {
      for (let index = 0; index < 4; index += 1) {
        const response = await harness.app.inject({ method: 'GET', url: routes.health });
        expect(response.statusCode).toBe(200);
      }

      const blocked = await harness.app.inject({ method: 'GET', url: routes.health });
      expect(blocked.statusCode).toBe(429);
      expect(ErrorResponseSchema.parse(blocked.json()).error.code).toBe('rate_limited');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

      harness.clock.advance(61_000);
      const afterWindow = await harness.app.inject({ method: 'GET', url: routes.health });
      expect(afterWindow.statusCode).toBe(200);
    } finally {
      await harness.cleanup();
    }
  });

  it('applies a stricter limit to credential endpoints', async () => {
    const harness = await createHarness({ rateLimit: true });
    try {
      await registerUser(harness.app);
      await registerUser(harness.app);
      await registerUser(harness.app);

      const blocked = await harness.app.inject({
        method: 'POST',
        url: routes.register,
        payload: {
          email: 'fourth@example.test',
          password: 'correct-horse-battery-staple',
          displayName: 'Fourth',
          timezone: 'Europe/Riga',
        },
      });

      expect(blocked.statusCode).toBe(429);
      expect(ErrorResponseSchema.parse(blocked.json()).error.code).toBe('rate_limited');
    } finally {
      await harness.cleanup();
    }
  });
});
