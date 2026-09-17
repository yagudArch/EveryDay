/**
 * Хранение текущей сессии в памяти процесса + уведомление об истёкшей сессии.
 *
 * Токен не передаётся между модулями вручную: HttpClient читает его отсюда,
 * а AuthContext подписывается на событие 401, чтобы очистить контекст пользователя.
 * Никаких react-native импортов — модуль покрыт unit-тестами.
 */

let currentToken: string | null = null;
let expiresAtMs: number | null = null;
let unauthorizedHandler: (() => void) | null = null;

export interface ActiveSession {
  token: string;
  expiresAt: string | null;
}

function toEpochMs(isoTimestamp: string | null): number | null {
  if (isoTimestamp === null) return null;
  const parsed = Date.parse(isoTimestamp);
  return Number.isNaN(parsed) ? null : parsed;
}

export function setSession(token: string, expiresAt: string | null): void {
  currentToken = token;
  expiresAtMs = toEpochMs(expiresAt);
}

export function getSessionToken(): string | null {
  return currentToken;
}

export function getSessionExpiresAtMs(): number | null {
  return expiresAtMs;
}

export function getActiveSession(): ActiveSession | null {
  if (currentToken === null) return null;
  return { token: currentToken, expiresAt: expiresAtMs === null ? null : new Date(expiresAtMs).toISOString() };
}

/** true, если серверный expiresAt уже прошёл (клиентская проверка до сети). */
export function isSessionExpired(now: number = Date.now()): boolean {
  return currentToken !== null && expiresAtMs !== null && expiresAtMs <= now;
}

export function clearSession(): void {
  currentToken = null;
  expiresAtMs = null;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  if (unauthorizedHandler !== null) {
    unauthorizedHandler();
  }
}
