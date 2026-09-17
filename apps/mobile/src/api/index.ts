/**
 * Композиция API-клиента: env -> base URL, storage -> SecureStore (native) или память (web),
 * session -> bearer-токен и уведомление об истёкшей сессии.
 *
 * Если конфигурация API некорректна (production без EXPO_PUBLIC_API_URL и т.п.),
 * api === null, и AppShell показывает экран конфигурационной ошибки вместо
 * попыток работать с несуществующим backend.
 */
import { Platform } from 'react-native';

import { apiBaseResolution } from '../config/env';
import { createNativeSecureStore } from '../storage/secureStoreAdapter';
import { createTokenStorage } from '../storage/tokenStorage';
import { HttpClient } from './client';
import { createEverydayApi, type EverydayApi } from './endpoints';
import { getSessionToken, notifyUnauthorized } from './session';

export { apiBaseResolution };

export const tokenStorage = createTokenStorage({
  platform: Platform.OS,
  secureStore: createNativeSecureStore(),
});

export const apiClient: HttpClient | null = apiBaseResolution.ok
  ? new HttpClient({
      baseUrl: apiBaseResolution.baseUrl,
      fetchImpl: (input, init) => fetch(input, init),
      getToken: getSessionToken,
      onUnauthorized: () => {
        notifyUnauthorized();
      },
    })
  : null;

export const api: EverydayApi | null = apiClient === null ? null : createEverydayApi(apiClient);

/** Экраны вызывают это только внутри AppShell, где api === null уже отсечён. */
export function useApi(): EverydayApi {
  if (api === null) {
    throw new Error('API-клиент недоступен: задайте корректный EXPO_PUBLIC_API_URL.');
  }
  return api;
}

export { ApiError } from './client';
export type { EverydayApi } from './endpoints';
