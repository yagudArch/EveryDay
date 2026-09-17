import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routes } from '@everyday/contracts';
import { AppError } from '../src/errors.js';
import { getRow, getRows, openDatabase, runStatement, closeDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { defaultMigrationsDir, projectRoot } from '../src/db/paths.js';
import { bearer, createHarness, registerUser } from './helpers.js';

const EXPECTED_TABLES = [
  'daily_context',
  'sessions',
  'subscriptions',
  'user_goals',
  'user_memory',
  'user_preference_values',
  'user_preferences',
  'users',
];

function withTempDir<T>(work: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'everyday-migrations-'));
  try {
    return work(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('database migrations', () => {
  it('resolves stable repository paths from import.meta.url', () => {
    expect(projectRoot.endsWith('EveryDay')).toBe(true);
    expect(defaultMigrationsDir).toBe(join(projectRoot, 'database', 'migrations'));
  });

  it('applies migrations once and is idempotent afterwards', () => {
    withTempDir((dir) => {
      const db = openDatabase(join(dir, 'idempotent.db'));
      try {
        const first = runMigrations(db, defaultMigrationsDir);
        expect(first.applied).toEqual(['0001']);
        expect(first.skipped).toEqual([]);
        expect(first.total).toBe(1);

        const second = runMigrations(db, defaultMigrationsDir);
        expect(second.applied).toEqual([]);
        expect(second.skipped).toEqual(['0001']);

        const recorded = getRow<{ total: number }>(db, 'SELECT COUNT(*) AS total FROM schema_migrations');
        expect(recorded?.total).toBe(1);

        const tables = getRows<{ name: string }>(
          db,
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        ).map((row) => row.name);
        for (const table of EXPECTED_TABLES) {
          expect(tables).toContain(table);
        }
      } finally {
        closeDatabase(db);
      }
    });
  });

  it('runs versioned migrations in order and ignores non-migration files', () => {
    withTempDir((dir) => {
      const migrationsDir = join(dir, 'migrations');
      mkdirSync(migrationsDir, { recursive: true });
      copyFileSync(join(defaultMigrationsDir, '0001_foundation.sql'), join(migrationsDir, '0001_foundation.sql'));
      writeFileSync(join(migrationsDir, '0003_third.sql'), 'CREATE TABLE third_probe (id TEXT PRIMARY KEY);\n', 'utf8');
      writeFileSync(join(migrationsDir, '0002_second.sql'), 'CREATE TABLE second_probe (id TEXT PRIMARY KEY);\n', 'utf8');
      writeFileSync(join(migrationsDir, 'README.md'), 'not a migration', 'utf8');

      const db = openDatabase(join(dir, 'ordered.db'));
      try {
        const summary = runMigrations(db, migrationsDir);
        expect(summary.applied).toEqual(['0001', '0002', '0003']);
        expect(summary.total).toBe(3);

        const probes = getRows<{ name: string }>(
          db,
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%_probe' ORDER BY name",
        ).map((row) => row.name);
        expect(probes).toEqual(['second_probe', 'third_probe']);
      } finally {
        closeDatabase(db);
      }
    });
  });

  it('refuses to run when a migration changed after being applied', () => {
    withTempDir((dir) => {
      const db = openDatabase(join(dir, 'checksum.db'));
      try {
        runMigrations(db, defaultMigrationsDir);
        runStatement(db, "UPDATE schema_migrations SET checksum = 'tampered' WHERE version = '0001'");

        let thrown: unknown;
        try {
          runMigrations(db, defaultMigrationsDir);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(AppError);
        expect((thrown as AppError).code).toBe('migration_checksum_mismatch');
      } finally {
        closeDatabase(db);
      }
    });
  });

  it('fails loudly when the migrations directory is missing', () => {
    withTempDir((dir) => {
      const db = openDatabase(join(dir, 'missing-dir.db'));
      try {
        expect(() => runMigrations(db, join(dir, 'nope'))).toThrowError(/migrations directory/);
      } finally {
        closeDatabase(db);
      }
    });
  });

  it('enforces foreign keys and constraints in the running database', () => {
    withTempDir((dir) => {
      const db = openDatabase(join(dir, 'constraints.db'));
      try {
        runMigrations(db, defaultMigrationsDir);
        const nowIso = new Date().toISOString();

        expect(() =>
          runStatement(db, 'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)', [
            's1',
            'ghost-user',
            'hash',
            nowIso,
            nowIso,
            nowIso,
          ]),
        ).toThrowError(/FOREIGN KEY/);

        expect(() =>
          runStatement(
            db,
            `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
            ['u1', 'ok@example.test', 'hash', 'A', nowIso, nowIso],
          ),
        ).not.toThrow();

        expect(() =>
          runStatement(
            db,
            `INSERT INTO subscriptions (id, user_id, status, trial_started_at, trial_ends_at, current_period_ends_at, cancelled_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
            ['sub1', 'u1', 'not-a-status', nowIso, nowIso, nowIso, nowIso],
          ),
        ).toThrowError(/CHECK constraint/);
      } finally {
        closeDatabase(db);
      }
    });
  });

  it('keeps data and migration state across a restart of the server', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'everyday-restart-'));
    const databasePath = join(tempDir, 'restart.db');
    try {
      const first = await createHarness({ databasePath });
      try {
        const user = await registerUser(first.app, { email: 'restart@example.test' });
        await first.app.inject({
          method: 'PATCH',
          url: routes.today,
          headers: bearer(user.token),
          payload: { dayNote: 'переживает рестарт' },
        });
      } finally {
        await first.cleanup();
      }

      const inspector = openDatabase(databasePath);
      try {
        const summary = runMigrations(inspector, defaultMigrationsDir);
        expect(summary.applied).toEqual([]);
        expect(summary.skipped).toEqual(['0001']);
      } finally {
        closeDatabase(inspector);
      }

      const second = await createHarness({ databasePath });
      try {
        const login = await second.app.inject({
          method: 'POST',
          url: routes.login,
          payload: { email: 'restart@example.test', password: 'correct-horse-battery-staple' },
        });
        expect(login.statusCode).toBe(200);
        const token = login.json().token as string;

        const today = await second.app.inject({ method: 'GET', url: routes.today, headers: bearer(token) });
        expect(today.statusCode).toBe(200);
        expect(today.json().dayNote).toBe('переживает рестарт');
      } finally {
        await second.cleanup();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('boots an in-memory database for isolated runs', async () => {
    const harness = await createHarness({ databasePath: ':memory:' });
    try {
      const user = await registerUser(harness.app);
      const me = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) });
      expect(me.statusCode).toBe(200);
      expect(me.json().id).toBe(user.userId);
    } finally {
      await harness.cleanup();
    }
  });
});
