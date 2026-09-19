import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearSession,
  getActiveSession,
  getSessionExpiresAtMs,
  getSessionToken,
  isSessionExpired,
  notifyUnauthorized,
  persistSession,
  setSession,
  setUnauthorizedHandler,
} from './session';

afterEach(() => {
  clearSession();
  setUnauthorizedHandler(null);
});

describe('сессия в памяти', () => {
  it('не активирует сессию, если SecureStore отклонил запись', async () => {
    await expect(persistSession({ token: 'new', expiresAt: null }, async () => {
      throw new Error('SecureStore unavailable');
    })).rejects.toThrow('SecureStore unavailable');
    expect(getActiveSession()).toBeNull();
  });

  it('активирует сессию только после завершения записи', async () => {
    let finish!: () => void;
    const stored = { token: 'saved', expiresAt: '2030-01-01T00:00:00.000Z' };
    const write = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const pending = persistSession(stored, write);
    expect(getActiveSession()).toBeNull();
    expect(write).toHaveBeenCalledWith(stored);
    finish();
    await pending;
    expect(getActiveSession()).toEqual(stored);
  });

  it('сохраняет и отдаёт токен', () => {
    expect(getSessionToken()).toBeNull();
    setSession('token-1', '2030-01-01T00:00:00.000Z');

    expect(getSessionToken()).toBe('token-1');
    expect(getActiveSession()).toEqual({ token: 'token-1', expiresAt: '2030-01-01T00:00:00.000Z' });
  });

  it('считает сессию истёкшей по серверному expiresAt', () => {
    setSession('token-1', '2026-01-01T00:00:00.000Z');
    expect(isSessionExpired(Date.parse('2026-06-01T00:00:00.000Z'))).toBe(true);
    expect(isSessionExpired(Date.parse('2025-06-01T00:00:00.000Z'))).toBe(false);
  });

  it('не истекает локально, если expiresAt не разобран', () => {
    setSession('token-1', 'not-a-date');
    expect(getSessionExpiresAtMs()).toBeNull();
    expect(isSessionExpired(Date.now())).toBe(false);
  });

  it('после clearSession токен и expiry сброшены', () => {
    setSession('token-1', '2030-01-01T00:00:00.000Z');
    clearSession();

    expect(getSessionToken()).toBeNull();
    expect(getSessionExpiresAtMs()).toBeNull();
    expect(getActiveSession()).toBeNull();
    expect(isSessionExpired()).toBe(false);
  });
});

describe('уведомление об истёкшей сессии', () => {
  it('вызывает зарегистрированный обработчик', () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    notifyUnauthorized();
    notifyUnauthorized();

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('не падает без обработчика', () => {
    setUnauthorizedHandler(null);
    expect(() => notifyUnauthorized()).not.toThrow();
  });
});
