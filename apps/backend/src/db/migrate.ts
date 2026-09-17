import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppError } from '../errors.js';
import { getRows, runStatement, withTransaction, type Db } from './connection.js';

/**
 * Versioned SQL migration runner.
 *
 * - Migration files live in `database/migrations` and are named `<version>_<name>.sql`
 *   (e.g. `0001_foundation.sql`). Versions are applied in ascending order.
 * - `schema_migrations` records version, name, checksum and timestamp. Re-running the
 *   runner is idempotent; a changed checksum for an applied version is a hard failure.
 * - Each migration runs in its own transaction, so a failed migration leaves no partial schema.
 */
const MIGRATION_FILE_PATTERN = /^(\d{4,})_([A-Za-z0-9_-]+)\.sql$/;

export interface Migration {
  version: string;
  name: string;
  filePath: string;
  sql: string;
  checksum: string;
}

export interface MigrationSummary {
  applied: string[];
  skipped: string[];
  total: number;
}

interface AppliedRow {
  version: string;
  checksum: string;
}

function checksumOf(contents: string): string {
  return createHash('sha256').update(contents, 'utf8').digest('hex');
}

export function ensureMigrationTable(db: Db): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    TEXT PRIMARY KEY,
       name       TEXT NOT NULL,
       checksum   TEXT NOT NULL,
       applied_at TEXT NOT NULL
     )`,
  );
}

export function loadMigrations(migrationsDir: string): Migration[] {
  if (!existsSync(migrationsDir)) {
    throw new AppError('migrations_dir_missing', 500, 'Database migrations directory was not found');
  }

  const migrations: Migration[] = [];
  for (const file of readdirSync(migrationsDir)) {
    const match = MIGRATION_FILE_PATTERN.exec(file);
    if (!match) continue;
    const version = match[1];
    const name = match[2];
    if (!version || !name) continue;
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf8');
    migrations.push({ version, name, filePath, sql, checksum: checksumOf(sql) });
  }

  migrations.sort((left, right) => left.version.localeCompare(right.version) || left.name.localeCompare(right.name));

  const seen = new Set<string>();
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new AppError('duplicate_migration_version', 500, `Duplicate migration version ${migration.version}`);
    }
    seen.add(migration.version);
  }

  if (migrations.length === 0) {
    throw new AppError('no_migrations_found', 500, 'No database migrations were found');
  }

  return migrations;
}

export function runMigrations(db: Db, migrationsDir: string, now: () => Date = () => new Date()): MigrationSummary {
  ensureMigrationTable(db);

  const appliedRows = getRows<AppliedRow>(db, 'SELECT version, checksum FROM schema_migrations');
  const appliedByVersion = new Map<string, string>(appliedRows.map((row) => [row.version, row.checksum]));

  const migrations = loadMigrations(migrationsDir);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    const existingChecksum = appliedByVersion.get(migration.version);
    if (existingChecksum !== undefined) {
      if (existingChecksum !== migration.checksum) {
        throw new AppError(
          'migration_checksum_mismatch',
          500,
          `Migration ${migration.version} changed after it was applied`,
        );
      }
      skipped.push(migration.version);
      continue;
    }

    withTransaction(db, () => {
      db.exec(migration.sql);
      runStatement(
        db,
        'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
        [migration.version, migration.name, migration.checksum, now().toISOString()],
      );
    });
    applied.push(migration.version);
  }

  return { applied, skipped, total: migrations.length };
}
