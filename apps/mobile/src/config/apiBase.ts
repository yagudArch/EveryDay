/**
 * Чистое (без react-native) определение base URL backend.
 *
 * Приложение никогда не «угадывает» production backend:
 * - development: допускается fallback на localhost / 10.0.2.2 (Android emulator);
 * - production (__DEV__ === false): EXPO_PUBLIC_API_URL обязателен и должен быть HTTPS;
 * - HTTP разрешён только для loopback и адресов эмулятора.
 */

export type ApiBasePlatform = 'android' | 'ios' | 'web' | 'windows' | 'macos' | 'unknown';

export type ApiBaseSource = 'explicit-env' | 'development-fallback';

export type ApiBaseFailureReason =
  | 'missing-production-url'
  | 'invalid-url'
  | 'insecure-transport'
  | 'path-not-allowed';

export interface ApiBaseResolved {
  ok: true;
  baseUrl: string;
  source: ApiBaseSource;
  warnings: string[];
}

export interface ApiBaseFailure {
  ok: false;
  reason: ApiBaseFailureReason;
  message: string;
}

export type ApiBaseResolution = ApiBaseResolved | ApiBaseFailure;

/** Совпадает с dev-портом backend (apps/backend DEFAULT_PORT). */
export const DEFAULT_DEVELOPMENT_PORT = 3000;

const LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '10.0.2.2', // Android emulator -> хост-машина
  '10.0.3.2', // Genymotion -> хост-машина
]);

export interface ParsedApiUrl {
  /** Схема без двоеточия: 'http' | 'https'. */
  protocol: 'http' | 'https';
  /** host[:port] без userinfo */
  host: string;
  hostname: string;
  hasPath: boolean;
  hasQueryOrHash: boolean;
  hasCredentials: boolean;
}

/** Единая точка сборки origin: `${protocol}://${host}`. */
export function buildOrigin(parsed: Pick<ParsedApiUrl, 'protocol' | 'host'>): string {
  return `${parsed.protocol}://${parsed.host}`;
}

export function isLoopbackHost(hostname: string): boolean {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  if (host === '') return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  return LOOPBACK_HOSTS.has(host);
}

/**
 * Разбор абсолютного http(s) URL без зависимости от URL-polyfill:
 * Hermes/RN реализует URL не полностью, поэтому используем явный шаблон.
 */
export function parseApiUrl(raw: string): ParsedApiUrl | null {
  const match = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?([?#].*)?$/i.exec(raw.trim());
  if (match === null) return null;

  const scheme = (match[1] ?? '').toLowerCase();
  const protocol: 'http' | 'https' | null = scheme === 'https' ? 'https' : scheme === 'http' ? 'http' : null;
  if (protocol === null) return null;

  const hostPart = match[2] ?? '';
  if (hostPart === '') return null;

  const hasCredentials = hostPart.includes('@');
  const host = hasCredentials ? hostPart.slice(hostPart.lastIndexOf('@') + 1) : hostPart;
  if (host === '') return null;

  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : (host.split(':')[0] ?? '');
  if (hostname === '') return null;

  const path = (match[3] ?? '').replace(/\/+$/, '');

  return {
    protocol,
    host,
    hostname,
    hasPath: path !== '',
    hasQueryOrHash: (match[4] ?? '') !== '',
    hasCredentials,
  };
}

export function developmentFallbackBaseUrl(platform: ApiBasePlatform): string {
  const host = platform === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:${DEFAULT_DEVELOPMENT_PORT}`;
}

export interface ResolveApiBaseInput {
  rawUrl: string | undefined;
  platform: ApiBasePlatform;
  isDev: boolean;
}

export function resolveApiBaseUrl(input: ResolveApiBaseInput): ApiBaseResolution {
  const raw = input.rawUrl?.trim() ?? '';

  if (raw === '') {
    if (!input.isDev) {
      return {
        ok: false,
        reason: 'missing-production-url',
        message:
          'EXPO_PUBLIC_API_URL не задан. Production сборка не может подключаться к неизвестному backend: укажите явный HTTPS адрес.',
      };
    }
    const baseUrl = developmentFallbackBaseUrl(input.platform);
    return {
      ok: true,
      baseUrl,
      source: 'development-fallback',
      warnings: [
        `EXPO_PUBLIC_API_URL не задан, используется development fallback ${baseUrl}. Для физического устройства укажите адрес backend явно.`,
      ],
    };
  }

  const parsed = parseApiUrl(raw);
  if (parsed === null) {
    return {
      ok: false,
      reason: 'invalid-url',
      message: 'EXPO_PUBLIC_API_URL должен быть абсолютным URL вида https://api.example.com или http://10.0.2.2:3000.',
    };
  }

  if (parsed.hasCredentials) {
    return {
      ok: false,
      reason: 'invalid-url',
      message: 'EXPO_PUBLIC_API_URL не должен содержать логин/пароль.',
    };
  }

  if (parsed.hasPath || parsed.hasQueryOrHash) {
    return {
      ok: false,
      reason: 'path-not-allowed',
      message:
        'EXPO_PUBLIC_API_URL должен содержать только origin (scheme://host:port): пути и query не поддерживаются, /api/v1 уже включён в контрактные routes.',
    };
  }

  // parsed.protocol хранится без двоеточия ('http' | 'https').
  if (parsed.protocol === 'http' && !isLoopbackHost(parsed.hostname)) {
    return {
      ok: false,
      reason: 'insecure-transport',
      message: `HTTP допустим только для локального backend (localhost, 10.0.2.2). Для ${parsed.hostname} требуется HTTPS.`,
    };
  }

  if (!input.isDev && parsed.protocol !== 'https') {
    return {
      ok: false,
      reason: 'insecure-transport',
      message: 'Production сборка требует HTTPS для EXPO_PUBLIC_API_URL.',
    };
  }

  const warnings: string[] = [];
  if (!input.isDev && isLoopbackHost(parsed.hostname)) {
    warnings.push('Production сборка указывает на локальный backend: это допустимо только для локальной проверки.');
  }

  return {
    ok: true,
    baseUrl: buildOrigin(parsed),
    source: 'explicit-env',
    warnings,
  };
}
