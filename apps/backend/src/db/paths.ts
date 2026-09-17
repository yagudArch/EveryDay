import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Stable filesystem locations for the backend.
 *
 * `import.meta.url` is used instead of `process.cwd()` so that `tsx src/server.ts`,
 * `node dist/server.js` and vitest runs all resolve the same repository paths.
 *
 * The sibling layout is intentionally identical for source and build output
 * (`apps/backend/src/<dir>/paths.ts` and `apps/backend/dist/<dir>/paths.js` both sit
 * two levels below the package root), so relative traversal stays valid after `tsc`.
 */
const moduleDir = fileURLToPath(new URL('.', import.meta.url));

/** `<repo>/apps/backend` */
export const backendRoot = resolve(moduleDir, '..', '..');
/** `<repo>` */
export const projectRoot = resolve(backendRoot, '..', '..');
/** `<repo>/database/migrations` */
export const defaultMigrationsDir = resolve(projectRoot, 'database', 'migrations');
/** `<repo>/data` — created on demand, git-ignored, never committed. */
export const defaultDataDir = resolve(projectRoot, 'data');
/** `<repo>/data/everyday.db` */
export const defaultDatabasePath = resolve(defaultDataDir, 'everyday.db');

/**
 * Resolves a configured database path. Relative paths are anchored to the repository
 * root (not the shell working directory); `:memory:` is passed through for tests.
 * Parent directories are created by {@link openDatabase}.
 */
export function resolveDatabasePath(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return defaultDatabasePath;
  if (trimmed === ':memory:') return trimmed;
  return isAbsolute(trimmed) ? resolve(trimmed) : resolve(projectRoot, trimmed);
}

/** Resolves the migrations directory the same way {@link resolveDatabasePath} resolves the DB. */
export function resolveMigrationsDir(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return defaultMigrationsDir;
  return isAbsolute(trimmed) ? resolve(trimmed) : resolve(projectRoot, trimmed);
}
