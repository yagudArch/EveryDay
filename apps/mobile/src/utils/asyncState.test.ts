import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/client';
import { asyncReducer, errorMessage, initialAsyncState, isLoadingState, isRetryable } from './asyncState';

describe('asyncReducer', () => {
  it('идёт по циклу idle -> loading -> success', () => {
    const initial = initialAsyncState<string>();
    expect(initial).toEqual({ status: 'idle', data: null, error: null });

    const loading = asyncReducer(initial, { type: 'load' });
    expect(loading.status).toBe('loading');

    const success = asyncReducer(loading, { type: 'success', data: 'ok' });
    expect(success).toEqual({ status: 'success', data: 'ok', error: null });
  });

  it('при ошибке не выдаёт прошлые данные за актуальные', () => {
    const loaded = { status: 'success' as const, data: 'stale', error: null };
    const failed = asyncReducer(loaded, { type: 'error', message: 'Нет соединения' });

    expect(failed.status).toBe('error');
    expect(failed.error).toBe('Нет соединения');
    expect(failed.data).toBe('stale');
  });

  it('refresh сохраняет данные и не сбрасывает их в loading', () => {
    const state = { status: 'success' as const, data: 1, error: null };
    const refreshing = asyncReducer(state, { type: 'refresh' });

    expect(refreshing.status).toBe('refreshing');
    expect(refreshing.data).toBe(1);

    const done = asyncReducer(refreshing, { type: 'success', data: 2 });
    expect(done).toEqual({ status: 'success', data: 2, error: null });
  });

  it('reset возвращает исходное состояние', () => {
    expect(asyncReducer({ status: 'error' as const, data: 'x', error: 'e' }, { type: 'reset' })).toEqual({
      status: 'idle',
      data: null,
      error: null,
    });
  });
});

describe('хелперы состояния', () => {
  it('isLoadingState только для первой загрузки', () => {
    expect(isLoadingState({ status: 'loading', data: null, error: null })).toBe(true);
    expect(isLoadingState({ status: 'loading', data: 'x', error: null })).toBe(false);
    expect(isLoadingState({ status: 'success', data: 'x', error: null })).toBe(false);
  });

  it('errorMessage достаёт сообщение из ApiError', () => {
    expect(errorMessage(new ApiError('Сервис недоступен', { code: 'unavailable', status: 503 }))).toBe('Сервис недоступен');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('строка')).toBe('Неизвестная ошибка.');
  });

  it('isRetryable зависит от типа ошибки', () => {
    expect(isRetryable(new ApiError('x', { code: 'timeout', retryable: true }))).toBe(true);
    expect(isRetryable(new ApiError('x', { code: 'invalid_session', status: 401 }))).toBe(false);
    expect(isRetryable(new Error('boom'))).toBe(true);
  });
});
