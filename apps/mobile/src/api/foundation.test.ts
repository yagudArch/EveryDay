import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';

import { HttpClient } from './client';
import { createEverydayApi } from './endpoints';
import { MemorySecureStorage, TokenStorage } from '../storage/tokenStorage';

it('mobile API проходит auth/preferences/context/logout через HTTP и файловую SQLite', async () => {
  // Compiled backend: npm run build is the prerequisite, as in npm run check.
  // Dynamic path keeps server-only sources outside the mobile TypeScript program.
  const backendModule = '../../../backend/dist/app.js';
  const { createApp } = await import(backendModule);
  const directory = mkdtempSync(join(tmpdir(), 'everyday-mobile-contract-'));
  const app = await createApp({
    databasePath: join(directory, 'test.db'), logger: false,
    env: { nodeEnv: 'test' }, rateLimit: false,
  });
  try {
    const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
    let token: string | null = null;
    const onUnauthorized = vi.fn(() => { token = null; });
    const api = createEverydayApi(new HttpClient({
      baseUrl, fetchImpl: fetch, getToken: () => token, onUnauthorized,
    }));
    const credentials = { email: 'mobile@example.test', password: 'mobile-test-password-only' };
    const registered = await api.register({ ...credentials, displayName: 'Mobile Test', timezone: 'Europe/Riga' });
    const storage = new TokenStorage(new MemorySecureStorage());
    await storage.writeSession({ token: registered.token, expiresAt: registered.expiresAt });
    token = await storage.readToken();
    expect((await api.me()).id).toBe(registered.user.id);
    expect(await api.preferences()).toMatchObject({ aiConsent: false, memoryEnabled: false });
    expect(await api.updatePreferences({ theme: 'dark', city: 'Riga' })).toMatchObject({ theme: 'dark', city: 'Riga' });
    expect(await api.updateDayNote({ dayNote: 'Integration test note' })).toMatchObject({ dayNote: 'Integration test note' });
    expect(await api.todayContext()).toMatchObject({
      dayNote: 'Integration test note', preferences: { city: 'Riga' },
      modules: { nutrition: { status: 'unavailable' } },
    });
    expect((await api.subscription()).status).toBe('trial');
    await expect(api.login({ ...credentials, password: 'incorrect-password' })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
    await api.logout();
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await storage.clear();
    expect(await storage.readSession()).toBeNull();
    token = (await api.login(credentials)).token;
    expect(await api.preferences()).toMatchObject({ theme: 'dark', city: 'Riga' });
    expect((await api.todayContext()).dayNote).toBe('Integration test note');
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
