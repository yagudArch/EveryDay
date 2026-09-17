/**
 * Представление entitlement для UI.
 *
 * Важно: право доступа вычисляет сервер (GET /api/v1/subscription, поле premium).
 * Клиент только показывает серверные timestamps и не меняет entitlement.
 */

export type SubscriptionStatus = 'trial' | 'active' | 'expired_trial' | 'expired_subscription' | 'cancelled' | 'grace';

export interface SubscriptionSummaryInput {
  status: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  premium: boolean;
}

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  premium: boolean;
  label: string;
  detail: string;
  /** Полных дней до конца периода (>= 0); null, если период неизвестен или уже прошёл. */
  daysLeft: number | null;
  requiresSubscription: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  trial: 'Пробный период',
  active: 'Подписка активна',
  expired_trial: 'Пробный период завершён',
  expired_subscription: 'Подписка истекла',
  cancelled: 'Подписка отменена',
  grace: 'Льготный период',
};

function parseIso(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function daysUntil(isoTimestamp: string | null, now: number = Date.now()): number | null {
  const target = parseIso(isoTimestamp);
  if (target === null) return null;
  const diff = target - now;
  if (diff <= 0) return null;
  return Math.ceil(diff / DAY_MS);
}

export function describeSubscription(input: SubscriptionSummaryInput, now: number = Date.now()): SubscriptionSummary {
  const label = SUBSCRIPTION_LABELS[input.status];
  const requiresSubscription = !input.premium;

  if (input.status === 'trial') {
    const daysLeft = daysUntil(input.trialEndsAt, now);
    return {
      status: input.status,
      premium: input.premium,
      label,
      detail:
        daysLeft === null
          ? 'Пробный период истёк.'
          : `До конца пробного периода: ${daysLeft} дн. Оформление подписки появится позже.`,
      daysLeft,
      requiresSubscription,
    };
  }

  if (input.status === 'active' || input.status === 'grace') {
    const daysLeft = daysUntil(input.currentPeriodEndsAt, now);
    return {
      status: input.status,
      premium: input.premium,
      label,
      detail: daysLeft === null ? 'Период оплачен.' : `До конца периода: ${daysLeft} дн.`,
      daysLeft,
      requiresSubscription,
    };
  }

  return {
    status: input.status,
    premium: input.premium,
    label,
    detail: 'Premium-функции недоступны. Платёжный сценарий ещё не реализован.',
    daysLeft: null,
    requiresSubscription,
  };
}
