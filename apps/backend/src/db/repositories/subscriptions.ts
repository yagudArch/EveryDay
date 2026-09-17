import { getRow, runStatement, type Db } from '../connection.js';

export type StoredSubscriptionStatus =
  | 'trial'
  | 'active'
  | 'expired_trial'
  | 'expired_subscription'
  | 'cancelled'
  | 'grace';

export interface SubscriptionRecord {
  id: string;
  userId: string;
  status: StoredSubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  status: StoredSubscriptionStatus;
  trial_started_at: string;
  trial_ends_at: string;
  current_period_ends_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

function toSubscription(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEndsAt: row.current_period_ends_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = `SELECT id, user_id, status, trial_started_at, trial_ends_at, current_period_ends_at,
                        cancelled_at, created_at, updated_at FROM subscriptions`;

export interface InsertSubscriptionInput {
  id: string;
  userId: string;
  status: StoredSubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodEndsAt?: string | null;
  cancelledAt?: string | null;
  nowIso: string;
}

export const subscriptions = {
  insert(db: Db, input: InsertSubscriptionInput): void {
    runStatement(
      db,
      `INSERT INTO subscriptions
         (id, user_id, status, trial_started_at, trial_ends_at, current_period_ends_at, cancelled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.status,
        input.trialStartedAt,
        input.trialEndsAt,
        input.currentPeriodEndsAt ?? null,
        input.cancelledAt ?? null,
        input.nowIso,
        input.nowIso,
      ],
    );
  },

  findByUserId(db: Db, userId: string): SubscriptionRecord | undefined {
    const row = getRow<SubscriptionRow>(db, `${COLUMNS} WHERE user_id = ?`, [userId]);
    return row ? toSubscription(row) : undefined;
  },
};
