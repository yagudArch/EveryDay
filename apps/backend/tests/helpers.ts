import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { AuthResponseSchema, routes } from '@everyday/contracts';
import { createApp, type CreateAppOptions } from '../src/app.js';
import { closeDatabase, openDatabase, type Db } from '../src/db/connection.js';
import type { AiGateway } from '../src/services/ai-service.js';

export const TEST_NOW = '2026-09-17T12:00:00.000Z';
export const TEST_PASSWORD = 'correct-horse-battery-staple';

export interface TestClock {
  readonly now: Date;
  set(value: string | Date): void;
  advance(ms: number): void;
}

function createClock(startAt: string): TestClock {
  let current = new Date(startAt);
  return {
    get now(): Date {
      return current;
    },
    set(value: string | Date): void {
      current = typeof value === 'string' ? new Date(value) : value;
    },
    advance(ms: number): void {
      current = new Date(current.getTime() + ms);
    },
  };
}

export interface Harness {
  app: FastifyInstance;
  clock: TestClock;
  databasePath: string;
  tempDir: string | null;
  cleanup(): Promise<void>;
}

export interface HarnessOptions {
  /** Reuse an existing database file to test persistence across restarts. */
  databasePath?: string;
  /** Enable the bounded rate limiter (off by default so tests are not order-dependent). */
  rateLimit?: boolean;
  /** Test double for the AI provider port. */
  ai?: AiGateway;
  startAt?: string;
}

export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const clock = createClock(options.startAt ?? TEST_NOW);
  let tempDir: string | null = null;
  let databasePath = options.databasePath;

  if (!databasePath) {
    tempDir = mkdtempSync(join(tmpdir(), 'everyday-backend-'));
    databasePath = join(tempDir, 'everyday-test.db');
  }

  const appOptions: CreateAppOptions = {
    databasePath,
    now: () => clock.now,
    logger: false,
    env: { nodeEnv: 'test' },
    rateLimit: options.rateLimit
      ? { enabled: true, max: 4, windowMs: 60_000, authMax: 3, maxEntries: 50 }
      : false,
    ai: options.ai,
  };

  const app = await createApp(appOptions);

  return {
    app,
    clock,
    databasePath,
    tempDir,
    async cleanup(): Promise<void> {
      await app.close();
      if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

/** Second connection for assertions about what is physically stored. */
export function openInspector(databasePath: string): Db {
  return openDatabase(databasePath);
}

export function closeInspector(db: Db): void {
  closeDatabase(db);
}

export interface RegisteredUser {
  token: string;
  userId: string;
  email: string;
  password: string;
  timezone: string;
}

export interface RegisterOverrides {
  email?: string;
  password?: string;
  displayName?: string;
  timezone?: string;
}

export async function registerUser(app: FastifyInstance, overrides: RegisterOverrides = {}): Promise<RegisteredUser> {
  const payload = {
    email: overrides.email ?? `user-${randomUUID()}@example.test`,
    password: overrides.password ?? TEST_PASSWORD,
    displayName: overrides.displayName ?? 'Тестовый Пользователь',
    timezone: overrides.timezone ?? 'Europe/Riga',
  };

  const response = await app.inject({ method: 'POST', url: routes.register, payload });
  if (response.statusCode !== 201) {
    throw new Error(`register helper failed: ${response.statusCode} ${response.body}`);
  }

  const parsed = AuthResponseSchema.parse(response.json());
  return {
    token: parsed.token,
    userId: parsed.user.id,
    email: parsed.user.email,
    password: payload.password,
    timezone: payload.timezone,
  };
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export function jsonHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}
