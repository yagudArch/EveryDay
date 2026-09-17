import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Thin, synchronous data-access layer over Node 22's built-in `node:sqlite`.
 * This is a real file-backed relational database (WAL, foreign keys, transactions),
 * not an in-memory substitute for the runtime.
 */
export type Db = DatabaseSync;
export type SqlValue = string | number | bigint | Uint8Array | null;

const DEFAULT_BUSY_TIMEOUT_MS = 5000;
const transactionDepth = new WeakMap<object, number>();

export interface OpenDatabaseOptions {
  busyTimeoutMs?: number;
}

/**
 * Opens (creating parent directories if needed) and configures a database connection.
 * The pragmas below are the durability/concurrency contract for Foundation:
 * - `foreign_keys = ON` so ownership relations are enforced by the engine, not only by code;
 * - `journal_mode = WAL` for concurrent readers (file databases only);
 * - `busy_timeout` so a second connection waits instead of failing immediately;
 * - `synchronous = NORMAL` (safe with WAL, faster than FULL).
 */
export function openDatabase(location: string, options: OpenDatabaseOptions = {}): Db {
  const busyTimeoutMs = options.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS;
  const target = location === ':memory:' ? location : isAbsolute(location) ? location : resolve(location);
  if (target !== ':memory:') {
    mkdirSync(dirname(target), { recursive: true });
  }

  const db = new DatabaseSync(target);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`PRAGMA busy_timeout = ${Math.trunc(busyTimeoutMs)}`);
  try {
    // `journal_mode` returns a row; preparing it works for file and memory databases
    // alike ('memory' is reported and WAL is simply not applicable for :memory:).
    db.prepare('PRAGMA journal_mode = WAL').get();
  } catch {
    // In-memory databases cannot switch journal mode; nothing to recover from.
  }
  db.exec('PRAGMA synchronous = NORMAL');
  return db;
}

export function closeDatabase(db: Db): void {
  try {
    db.close();
  } catch {
    // Already closed.
  }
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/** Runs a single statement with bound parameters. `undefined` is never bound (SQLite cannot bind it). */
export function runStatement(db: Db, sql: string, params: SqlValue[] = []): RunResult {
  const result = db.prepare(sql).run(...params) as unknown as {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
  return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
}

export function getRow<T>(db: Db, sql: string, params: SqlValue[] = []): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

export function getRows<T>(db: Db, sql: string, params: SqlValue[] = []): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

/**
 * Runs `work` inside a transaction. Nested calls use SAVEPOINTs so that
 * repositories can be composed without leaking partial writes.
 */
export function withTransaction<T>(db: Db, work: () => T): T {
  const depth = transactionDepth.get(db) ?? 0;

  if (depth === 0) {
    db.exec('BEGIN IMMEDIATE');
    transactionDepth.set(db, 1);
    try {
      const result = work();
      db.exec('COMMIT');
      transactionDepth.set(db, 0);
      return result;
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // Transaction already rolled back by SQLite.
      }
      transactionDepth.set(db, 0);
      throw error;
    }
  }

  const savepoint = `sp_${depth}`;
  db.exec(`SAVEPOINT ${savepoint}`);
  transactionDepth.set(db, depth + 1);
  try {
    const result = work();
    db.exec(`RELEASE ${savepoint}`);
    transactionDepth.set(db, depth);
    return result;
  } catch (error) {
    try {
      db.exec(`ROLLBACK TO ${savepoint}`);
      db.exec(`RELEASE ${savepoint}`);
    } catch {
      // Savepoint already unwound.
    }
    transactionDepth.set(db, depth);
    throw error;
  }
}

/** True when the error is a SQLite unique/primary-key violation (used to map conflicts to 409). */
export function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(message);
}
