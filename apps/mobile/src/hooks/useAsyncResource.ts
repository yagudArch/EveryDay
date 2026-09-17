import { useCallback, useEffect, useReducer, useRef } from 'react';

import { asyncReducer, errorMessage, initialAsyncState, type AsyncState } from '../utils/asyncState';

export interface AsyncResource<T> {
  state: AsyncState<T>;
  reload: () => void;
  refresh: () => void;
  setData: (data: T) => void;
  reset: () => void;
}

export interface UseAsyncResourceOptions {
  /** false — не грузить (например, пользователь не авторизован). */
  enabled?: boolean;
}

/**
 * Загрузка данных с честными состояниями loading/refreshing/error/retry.
 * Устаревшие ответы игнорируются (запросы нумеруются), поэтому быстрый pull-to-refresh
 * не подменяет свежие данные старыми.
 */
export function useAsyncResource<T>(
  loader: () => Promise<T>,
  options: UseAsyncResourceOptions = {},
): AsyncResource<T> {
  const enabled = options.enabled ?? true;
  const [state, dispatch] = useReducer(asyncReducer<T>, initialAsyncState<T>());

  const loaderRef = useRef<() => Promise<T>>(loader);
  loaderRef.current = loader;

  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (mode: 'load' | 'refresh') => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    dispatch(mode === 'load' ? { type: 'load' } : { type: 'refresh' });
    try {
      const data = await loaderRef.current();
      if (mountedRef.current && requestIdRef.current === requestId) {
        dispatch({ type: 'success', data });
      }
    } catch (error) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        dispatch({ type: 'error', message: errorMessage(error) });
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      dispatch({ type: 'reset' });
      return;
    }
    void run('load');
  }, [enabled, run]);

  const reload = useCallback(() => {
    void run('load');
  }, [run]);

  const refresh = useCallback(() => {
    void run('refresh');
  }, [run]);

  const setData = useCallback((data: T) => {
    dispatch({ type: 'success', data });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  return { state, reload, refresh, setData, reset };
}
