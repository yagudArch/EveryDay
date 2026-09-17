import { describe, expect, it } from 'vitest';

import { daysUntil, describeSubscription } from './subscription';

const NOW = Date.parse('2026-09-17T12:00:00.000Z');

describe('daysUntil', () => {
  it('считает дни и округляет вверх', () => {
    expect(daysUntil('2026-09-20T12:00:00.000Z', NOW)).toBe(3);
    expect(daysUntil('2026-09-17T18:00:00.000Z', NOW)).toBe(1);
  });

  it('возвращает null для прошедшего времени и мусора', () => {
    expect(daysUntil('2026-09-01T12:00:00.000Z', NOW)).toBeNull();
    expect(daysUntil('not-a-date', NOW)).toBeNull();
    expect(daysUntil(null, NOW)).toBeNull();
  });
});

describe('describeSubscription', () => {
  it('показывает остаток trial', () => {
    const summary = describeSubscription(
      {
        status: 'trial',
        trialEndsAt: '2026-09-24T12:00:00.000Z',
        currentPeriodEndsAt: null,
        premium: true,
      },
      NOW,
    );

    expect(summary.label).toBe('Пробный период');
    expect(summary.daysLeft).toBe(7);
    expect(summary.premium).toBe(true);
    expect(summary.requiresSubscription).toBe(false);
  });

  it('честно сообщает о завершённом trial', () => {
    const summary = describeSubscription(
      {
        status: 'expired_trial',
        trialEndsAt: '2026-09-01T12:00:00.000Z',
        currentPeriodEndsAt: null,
        premium: false,
      },
      NOW,
    );

    expect(summary.daysLeft).toBeNull();
    expect(summary.requiresSubscription).toBe(true);
    expect(summary.detail).toContain('Premium-функции недоступны');
  });

  it('показывает активную подписку без даты окончания периода', () => {
    const summary = describeSubscription(
      {
        status: 'active',
        trialEndsAt: '2026-09-01T12:00:00.000Z',
        currentPeriodEndsAt: null,
        premium: true,
      },
      NOW,
    );

    expect(summary.label).toBe('Подписка активна');
    expect(summary.detail).toBe('Период оплачен.');
  });

  it('grace считается premium, но показывает остаток периода', () => {
    const summary = describeSubscription(
      {
        status: 'grace',
        trialEndsAt: '2026-09-01T12:00:00.000Z',
        currentPeriodEndsAt: '2026-09-19T12:00:00.000Z',
        premium: true,
      },
      NOW,
    );

    expect(summary.daysLeft).toBe(2);
    expect(summary.requiresSubscription).toBe(false);
  });
});
