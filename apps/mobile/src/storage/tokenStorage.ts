/**
 * Хранение сессии (токен + серверный expiresAt).
 *
 * Правила (см. .ai/ARCHITECTURE.md, раздел Auth):
 * - native (ios/android): expo-secure-store;
 * - web preview: только память процесса — никакого localStorage fallback и никакой
 *   имитации secure storage;
 * - если secure store на native недоступен, тоже используется память, но это явно
 *   видно через `kind`/`persistent` в диагностике приложения.
 *
 * Модуль не импортирует react-native и покрыт unit-тестами.
 */

export interface SecureStorageAdapter {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export class MemorySecureStorage implements SecureStorageAdapter {
  private readonly values = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export const SESSION_TOKEN_KEY = 'everyday.session.token';

export interface StoredSession {
  token: string;
  expiresAt: string | null;
}

export function encodeSession(session: StoredSession): string {
  return JSON.stringify({ token: session.token, expiresAt: session.expiresAt });
}

/** Возвращает null, если запись отсутствует или повреждена: повреждённая сессия не «угадывается». */
export function decodeSession(raw: string | null): StoredSession | null {
  if (raw === null || raw.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const token = record.token;
  if (typeof token !== 'string' || token === '') return null;
  const expiresAt = record.expiresAt;
  if (expiresAt !== undefined && expiresAt !== null && typeof expiresAt !== 'string') return null;
  return { token, expiresAt: typeof expiresAt === 'string' ? expiresAt : null };
}

export type TokenStorageKind = 'secure-store' | 'memory';

export interface TokenStorageOptions {
  key?: string;
  kind?: TokenStorageKind;
  persistent?: boolean;
}

export class TokenStorage {
  readonly kind: TokenStorageKind;
  readonly persistent: boolean;

  private readonly adapter: SecureStorageAdapter;
  private readonly key: string;

  constructor(adapter: SecureStorageAdapter, options: TokenStorageOptions = {}) {
    this.adapter = adapter;
    this.key = options.key ?? SESSION_TOKEN_KEY;
    this.kind = options.kind ?? 'memory';
    this.persistent = options.persistent ?? false;
  }

  async readSession(): Promise<StoredSession | null> {
    const raw = await this.adapter.getItemAsync(this.key);
    return decodeSession(raw);
  }

  async writeSession(session: StoredSession): Promise<void> {
    await this.adapter.setItemAsync(this.key, encodeSession(session));
  }

  async readToken(): Promise<string | null> {
    const session = await this.readSession();
    return session === null ? null : session.token;
  }

  async clear(): Promise<void> {
    await this.adapter.deleteItemAsync(this.key);
  }
}

export interface CreateTokenStorageInput {
  /** Platform.OS */
  platform: string;
  secureStore: SecureStorageAdapter | null;
}

export function isNativePlatform(platform: string): boolean {
  return platform === 'android' || platform === 'ios';
}

export function createTokenStorage(input: CreateTokenStorageInput): TokenStorage {
  if (isNativePlatform(input.platform) && input.secureStore !== null) {
    return new TokenStorage(input.secureStore, { kind: 'secure-store', persistent: true });
  }
  return new TokenStorage(new MemorySecureStorage(), { kind: 'memory', persistent: false });
}
