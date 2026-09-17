import { closeDatabase, openDatabase } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { readEnv } from '../env.js';

/**
 * `npm run db:migrate -w @everyday/backend` (after build, via the root db:migrate script).
 * Applies pending versioned SQL migrations and prints a machine-readable summary.
 */
function migrate(): void {
  const env = readEnv();
  const db = openDatabase(env.databasePath);
  try {
    const summary = runMigrations(db, env.migrationsDir);
    process.stdout.write(
      `${JSON.stringify(
        {
          databasePath: env.databasePath,
          migrationsDir: env.migrationsDir,
          applied: summary.applied,
          skipped: summary.skipped,
          total: summary.total,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    closeDatabase(db);
  }
}

try {
  migrate();
} catch (error) {
  const message = error instanceof Error ? error.message : 'unknown migration error';
  process.stderr.write(`migration failed: ${message}\n`);
  process.exit(1);
}
