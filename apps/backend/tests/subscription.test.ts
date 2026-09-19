import { describe, expect, it } from 'vitest';
import { ErrorResponseSchema, SubscriptionSchema, routes } from '@everyday/contracts';
import { runStatement } from '../src/db/connection.js';
import { TRIAL_DURATION_MS } from '../src/services/subscription-service.js';
import { bearer, closeInspector, createHarness, openInspector, registerUser } from './helpers.js';

async function readSubscription(app: Parameters<typeof registerUser>[0], token: string) {
  const response = await app.inject({ method: 'GET', url: routes.subscription, headers: bearer(token) });
  expect(response.statusCode).toBe(200);
  return SubscriptionSchema.parse(response.json());
}

describe('subscription entitlement and 7-day trial', () => {
  it('does not grant premium before the trial starts', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      harness.clock.advance(-1);
      expect((await readSubscription(harness.app, user.token)).premium).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });

  it('grants a trial of exactly 7 x 24 hours at registration', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const subscription = await readSubscription(harness.app, user.token);

      expect(subscription.status).toBe('trial');
      expect(subscription.premium).toBe(true);
      expect(subscription.currentPeriodEndsAt).toBeNull();

      const start = Date.parse(subscription.trialStartedAt);
      const end = Date.parse(subscription.trialEndsAt);
      expect(end - start).toBe(TRIAL_DURATION_MS);
      expect(subscription.trialStartedAt).toBe(harness.clock.now.toISOString());
    } finally {
      await harness.cleanup();
    }
  });

  it('keeps the trial including the last millisecond and expires exactly at the boundary', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const initial = await readSubscription(harness.app, user.token);
      const trialEndsAt = Date.parse(initial.trialEndsAt);

      harness.clock.set(new Date(trialEndsAt - 1));
      const lastMillisecond = await readSubscription(harness.app, user.token);
      expect(lastMillisecond.status).toBe('trial');
      expect(lastMillisecond.premium).toBe(true);

      harness.clock.set(new Date(trialEndsAt));
      const atBoundary = await readSubscription(harness.app, user.token);
      expect(atBoundary.status).toBe('expired_trial');
      expect(atBoundary.premium).toBe(false);

      harness.clock.set(new Date(trialEndsAt + 24 * 60 * 60 * 1000));
      const afterBoundary = await readSubscription(harness.app, user.token);
      expect(afterBoundary.status).toBe('expired_trial');
      expect(afterBoundary.premium).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });

  it('expires an active period server-side without trusting the client', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const inspector = openInspector(harness.databasePath);
      try {
        runStatement(inspector, "UPDATE subscriptions SET status = 'active', current_period_ends_at = ? WHERE user_id = ?", [
          new Date(harness.clock.now.getTime() + 60 * 60 * 1000).toISOString(),
          user.userId,
        ]);
      } finally {
        closeInspector(inspector);
      }

      const active = await readSubscription(harness.app, user.token);
      expect(active.status).toBe('active');
      expect(active.premium).toBe(true);

      const inspector2 = openInspector(harness.databasePath);
      try {
        runStatement(inspector2, "UPDATE subscriptions SET current_period_ends_at = ? WHERE user_id = ?", [
          new Date(harness.clock.now.getTime() - 1000).toISOString(),
          user.userId,
        ]);
      } finally {
        closeInspector(inspector2);
      }

      const expired = await readSubscription(harness.app, user.token);
      expect(expired.status).toBe('expired_subscription');
      expect(expired.premium).toBe(false);

      // A cancelled subscription keeps access only until the paid period actually ends.
      const inspector3 = openInspector(harness.databasePath);
      try {
        runStatement(inspector3, "UPDATE subscriptions SET status = 'cancelled', current_period_ends_at = ? WHERE user_id = ?", [
          new Date(harness.clock.now.getTime() + 60 * 60 * 1000).toISOString(),
          user.userId,
        ]);
      } finally {
        closeInspector(inspector3);
      }
      const cancelled = await readSubscription(harness.app, user.token);
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.premium).toBe(true);

      harness.clock.advance(2 * 60 * 60 * 1000);
      const cancelledExpired = await readSubscription(harness.app, user.token);
      expect(cancelledExpired.status).toBe('expired_subscription');
      expect(cancelledExpired.premium).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });

  it('exposes no endpoint that lets a client change entitlement', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);

      const patch = await harness.app.inject({
        method: 'PATCH',
        url: routes.subscription,
        headers: bearer(user.token),
        payload: { status: 'active', premium: true },
      });
      expect(patch.statusCode).toBe(404);
      expect(ErrorResponseSchema.parse(patch.json()).error.code).toBe('route_not_found');

      const published = await readSubscription(harness.app, user.token);
      expect(published.status).toBe('trial');
    } finally {
      await harness.cleanup();
    }
  });
});
