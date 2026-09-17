import { resolveDatabasePath, resolveMigrationsDir } from './db/paths.js';

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface RateLimitSettings {
  enabled: boolean;
  /** Requests per window for all routes. */
  max: number;
  /** Stricter limit for the unauthenticated credential endpoints (register/login). */
  authMax: number;
  windowMs: number;
  /** Hard cap on tracked keys, so memory cannot grow without bound. */
  maxEntries: number;
}

export interface AiSettings {
  /** Configured provider name. `disabled` means no external AI is available. */
  provider: string;
}

export interface Env {
  nodeEnv: NodeEnvironment;
  /** Loopback by default: the Foundation API is not exposed on the network. */
  host: string;
  port: number;
  databasePath: string;
  migrationsDir: string;
  corsOrigins: string[];
  allowAnyOrigin: boolean;
  trustProxy: boolean;
  logLevel: string;
  rateLimit: RateLimitSettings;
  ai: AiSettings;
}

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3000;
export const DEFAULT_CORS_ORIGINS = ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:19000'];

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalised = value.trim().toLowerCase();
  if (normalised === 'true' || normalised === '1' || normalised === 'yes') return true;
  if (normalised === 'false' || normalised === '0' || normalised === 'no') return false;
  return fallback;
}

function parseNodeEnv(value: string | undefined): NodeEnvironment {
  return value === 'test' || value === 'production' || value === 'development' ? value : 'development';
}

/**
 * Reads configuration from the environment. Every value has a safe default, so the server
 * starts without a .env file; secrets are never read from the repository.
 */
export function readEnv(source: NodeJS.ProcessEnv = process.env, overrides: Partial<Env> = {}): Env {
  const nodeEnv = parseNodeEnv(source.NODE_ENV);
  const corsOrigins = (source.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const base: Env = {
    nodeEnv,
    host: source.HOST?.trim() || DEFAULT_HOST,
    port: parseInteger(source.PORT, DEFAULT_PORT, 1, 65535),
    databasePath: resolveDatabasePath(source.DATABASE_PATH),
    migrationsDir: resolveMigrationsDir(source.MIGRATIONS_DIR),
    corsOrigins: corsOrigins.length > 0 ? corsOrigins : [...DEFAULT_CORS_ORIGINS],
    allowAnyOrigin: corsOrigins.includes('*'),
    trustProxy: parseBoolean(source.TRUST_PROXY, false),
    logLevel: source.LOG_LEVEL?.trim() || (nodeEnv === 'production' ? 'info' : 'debug'),
    rateLimit: {
      enabled: parseBoolean(source.RATE_LIMIT_ENABLED, true),
      max: parseInteger(source.RATE_LIMIT_MAX, 300, 1, 1_000_000),
      authMax: parseInteger(source.RATE_LIMIT_AUTH_MAX, 20, 1, 1_000_000),
      windowMs: parseInteger(source.RATE_LIMIT_WINDOW_MS, 60_000, 1_000, 3_600_000),
      maxEntries: parseInteger(source.RATE_LIMIT_MAX_ENTRIES, 10_000, 1, 1_000_000),
    },
    ai: {
      provider: source.AI_PROVIDER?.trim() || 'disabled',
    },
  };

  const merged: Env = { ...base, ...overrides };
  if (overrides.rateLimit) {
    merged.rateLimit = { ...base.rateLimit, ...overrides.rateLimit };
  }
  if (overrides.ai) {
    merged.ai = { ...base.ai, ...overrides.ai };
  }
  return merged;
}
