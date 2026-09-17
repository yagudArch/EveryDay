import { randomUUID } from 'node:crypto';
import { isUniqueViolation, type Db } from '../db/connection.js';
import { subscriptions, type SubscriptionRecord, type StoredSubscriptionStatus } from '../db/repositories/subscriptions.js';
import type { UserRecord } from '../db/repositories/users.js';

/** Trial length is exactly 7 x 24 hours from the server-side registration timestamp. */
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type SubscriptionStatus = StoredSubscriptionStatus;

export interface Entitlement {
  status: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  premium: boolean;
}

/** Half-open window: `start <= now < end`. Called once at registration. */
export function trialWindow(startedAt: Date): { startedAt: string; endsAt: string } {
  const start = startedAt.getTime();
  return { startedAt: new Date(start).toISOString(), endsAt: new Date(start + TRIAL_DURATION_MS).toISOString() };
}

function hasTimeLeft(endsAt: string | null, now: Date): boolean {
  if (!endsAt) return false;
  const parsed = Date.parse(endsAt);
  return Number.isFinite(parsed) && now.getTime() < parsed;
}

/**
 * Effective entitlement is always recomputed from the stored state and *server* time:
 * the client can never assert premium access, and an expired window is reported as expired.
 */
export function computeEntitlement(record: SubscriptionRecord, now: Date): Entitlement {
  const base = {
    trialStartedAt: record.trialStartedAt,
    trialEndsAt: record.trialEndsAt,
    currentPeriodEndsAt: record.currentPeriodEndsAt,
  };

  switch (record.status) {
    case 'trial':
      return now.getTime() < Date.parse(record.trialEndsAt)
        ? { ...base, status: 'trial', premium: true }
        : { ...base, status: 'expired_trial', premium: false };
    case 'active':
      return hasTimeLeft(record.currentPeriodEndsAt, now)
        ? { ...base, status: 'active', premium: true }
        : { ...base, status: 'expired_subscription', premium: false };
    case 'grace':
      return hasTimeLeft(record.currentPeriodEndsAt, now)
        ? { ...base, status: 'grace', premium: true }
        : { ...base, status: 'expired_subscription', premium: false };
    case 'cancelled':
      return hasTimeLeft(record.currentPeriodEndsAt, now)
        ? { ...base, status: 'cancelled', premium: true }
        : { ...base, status: 'expired_subscription', premium: false };
    case 'expired_trial':
      return { ...base, status: 'expired_trial', premium: false };
    case 'expired_subscription':
    default:
      return { ...base, status: 'expired_subscription', premium: false };
  }
}

/**
 * Returns the subscription row for a user, creating the 7-day trial derived from the
 * account creation timestamp if it is missing. Idempotent and self-healing; it invents no
 * new entitlement (the trial window is a pure function of the real registration time).
 */
export function ensureSubscription(db: Db, user: UserRecord, now: Date): SubscriptionRecord {
  const existing = subscriptions.findByUserId(db, user.id);
  if (existing) return existing;

  const window = trialWindow(new Date(user.createdAt));
  const nowIso = now.toISOString();
  const record: SubscriptionRecord = {
    id: randomUUID(),
    userId: user.id,
    status: 'trial',
    trialStartedAt: window.startedAt,
    trialEndsAt: window.endsAt,
    currentPeriodEndsAt: null,
    cancelledAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    subscriptions.insert(db, {
      id: record.id,
      userId: record.userId,
      status: record.status,
      trialStartedAt: record.trialStartedAt,
      trialEndsAt: record.trialEndsAt,
      currentPeriodEndsAt: null,
      cancelledAt: null,
      nowIso,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Another writer created the row first; fall through to the stored state.
  }

  return subscriptions.findByUserId(db, user.id) ?? record;
}
