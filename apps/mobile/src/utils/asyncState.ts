/**
 * Состояние загрузки данных: loading / error / empty / retry.
 * Чистые функции без react-native — покрыты unit-тестами.
 */
import { ApiError } from '../api/client';

export type AsyncStatus = 'idle' | 'loading' | 'refreshing' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
}

export type AsyncAction<T> =
  | { type: 'load' }
  | { type: 'refresh' }
  | { type: 'success'; data: T }
  | { type: 'error'; message: string }
  | { type: 'reset' };

export function initialAsyncState<T>(): AsyncState<T> {
  return { status: 'idle', data: null, error: null };
}

export function asyncReducer<T>(state: AsyncState<T>, action: AsyncAction<T>): AsyncState<T> {
  switch (action.type) {
    case 'load':
      return { status: 'loading', data: state.data, error: null };
    case 'refresh':
      return { status: 'refreshing', data: state.data, error: null };
    case 'success':
      return { status: 'success', data: action.data, error: null };
    case 'error':
      // Данные не подменяются: при ошибке показывается ошибка, а не прошлый успех как «актуальный».
      return { status: 'error', data: state.data, error: action.message };
    case 'reset':
      return initialAsyncState<T>();
    default:
      return state;
  }
}

export function isLoadingState(state: AsyncState<unknown>): boolean {
  return state.status === 'loading' && state.data === null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка.';
}

/** Можно ли предлагать повтор: сетевые и 5xx ошибки. */
export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError ? error.retryable : true;
}
