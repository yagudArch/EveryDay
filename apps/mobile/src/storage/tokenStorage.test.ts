import { describe, expect, it } from 'vitest';

import {
  MemorySecureStorage,
  SESSION_TOKEN_KEY,
  TokenStorage,
  createTokenStorage,
  decodeSession,
  encodeSession,
  isNativePlatform,
} from './tokenStorage';

describe('encodeSession/decodeSession', () => {
  it('делает roundtrip', () => {
    const encoded = encodeSession({ token: 't-1', expiresAt: '2030-01-01T00:00:00.000Z' });
    expect(decodeSession(encoded)).toEqual({ token: 't-1', expiresAt: '2030-01-01T00:00:00.000Z' });
    expect(decodeSession(encodeSession({ token: 't-2', expiresAt: null }))).toEqual({ token: 't-2', expiresAt: null });
  });

  it('не принимает мусор вместо сессии', () => {
    expect(decodeSession(null)).toBeNull();
    expect(decodeSession('')).toBeNull();
    expect(decodeSession('plain-token')).toBeNull();
    expect(decodeSession('{"expiresAt":"2030-01-01T00:00:00.000Z"}')).toBeNull();
    expect(decodeSession('{"token":"t","expiresAt":42}')).toBeNull();
    expect(decodeSession('{"token":""}')).toBeNull();
  });
});

describe('TokenStorage', () => {
  it('пишет, читает и очищает сессию через адаптер', async () => {
    const adapter = new MemorySecureStorage();
    const storage = new TokenStorage(adapter, { kind: 'secure-store', persistent: true });

    expect(await storage.readSession()).toBeNull();
    await storage.writeSession({ token: 'secret', expiresAt: null });
    expect(await storage.readToken()).toBe('secret');
    expect(await adapter.getItemAsync(SESSION_TOKEN_KEY)).toBe(JSON.stringify({ token: 'secret', expiresAt: null }));

    await storage.clear();
    expect(await storage.readSession()).toBeNull();
  });
});

describe('createTokenStorage', () => {
  it('на native использует secure store', () => {
    const secureStore = new MemorySecureStorage();
    const storage = createTokenStorage({ platform: 'android', secureStore });

    expect(storage.kind).toBe('secure-store');
    expect(storage.persistent).toBe(true);
    expect(isNativePlatform('ios')).toBe(true);
  });

  it('на web держит токен только в памяти, даже если передан адаптер', async () => {
    const secureStore = new MemorySecureStorage();
    const storage = createTokenStorage({ platform: 'web', secureStore });

    expect(storage.kind).toBe('memory');
    expect(storage.persistent).toBe(false);

    await storage.writeSession({ token: 'web-token', expiresAt: null });
    expect(await storage.readToken()).toBe('web-token');
    expect(await secureStore.getItemAsync(SESSION_TOKEN_KEY)).toBeNull();
  });

  it('без secure store на native деградирует в память явно', () => {
    const storage = createTokenStorage({ platform: 'ios', secureStore: null });
    expect(storage.kind).toBe('memory');
    expect(storage.persistent).toBe(false);
  });
});
