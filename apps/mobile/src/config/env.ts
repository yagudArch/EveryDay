/**
 * Единственное место, где мобильный клиент читает переменные окружения.
 *
 * Metro/babel-preset-expo инлайнят только прямые обращения вида
 * process.env.EXPO_PUBLIC_*, поэтому переменная читается именно так
 * (деструктуризация process.env не поддерживается).
 */
import { Platform } from 'react-native';

import { resolveApiBaseUrl, type ApiBasePlatform, type ApiBaseResolution } from './apiBase';

declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };
// Объявляется локально, потому что tsconfig не подключает @types/node и авто-globals.
// В runtime __DEV__ всегда определяет Metro/babel-preset-expo.
declare const __DEV__: boolean;

const isDevBuild = __DEV__;

function toApiBasePlatform(value: string): ApiBasePlatform {
  switch (value) {
    case 'android':
    case 'ios':
    case 'web':
    case 'windows':
    case 'macos':
      return value;
    default:
      return 'unknown';
  }
}

export const appEnvironment = {
  isDev: isDevBuild,
  platform: toApiBasePlatform(Platform.OS),
} as const;

export const apiBaseResolution: ApiBaseResolution = resolveApiBaseUrl({
  rawUrl: process.env.EXPO_PUBLIC_API_URL,
  platform: appEnvironment.platform,
  isDev: appEnvironment.isDev,
});
