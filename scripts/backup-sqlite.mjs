#!/usr/bin/env node
// OPS-002 — consistent hot backup of the file-backed SQLite database.
//
// Uses SQLite `VACUUM INTO`, which produces a single transactionally-consistent
// backup file even while the source is in WAL mode (readers/writers active). It
// never copies raw -wal/-shm files (which can be torn) and never stops the server.
//
// Usage:
//   node scripts/backup-sqlite.mjs [--db <path>] [--out-dir <dir>] [--keep <N>]
// Defaults: db = $DATABASE_PATH or data/everyday.db (repo-root relative),
//           out-dir = $BACKUP_DIR or backups/, keep = $BACKUP_KEEP or 14.
//
// Output: <out-dir>/everyday-YYYYMMDDTHHMMSSZ.db plus a .sha256 sidecar.
// Exit code is non-zero on any failure; nothing is fabricated.

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && index + 1 < process.argv.length) return process.argv[index + 1];
  return fallback;
}

function resolveFromRoot(value) {
  return isAbsolute(value) ? value : resolve(repoRoot, value);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function main() {
  const dbPath = resolveFromRoot(arg('db', process.env.DATABASE_PATH || 'data/everyday.db'));
  const outDir = resolveFromRoot(arg('out-dir', process.env.BACKUP_DIR || 'backups'));
  const keep = Number.parseInt(arg('keep', process.env.BACKUP_KEEP || '14'), 10);

  if (dbPath === ':memory:' || !existsSync(dbPath)) {
    throw new Error(`source database not found: ${dbPath}`);
  }
  mkdirSync(outDir, { recursive: true });

  const target = join(outDir, `everyday-${timestamp()}.db`);
  if (existsSync(target)) throw new Error(`backup target already exists: ${target}`);

  // Open read-only-ish: VACUUM INTO takes a read lock and writes an independent file.
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    // VACUUM INTO requires a single quoted path; escape embedded quotes.
    const escaped = target.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${escaped}'`);
  } finally {
    db.close();
  }

  // Integrity check on the produced backup — a backup that fails integrity is not a backup.
  const verify = new DatabaseSync(target);
  let integrity = 'unknown';
  try {
    integrity = verify.prepare('PRAGMA integrity_check').get().integrity_check;
  } finally {
    verify.close();
  }
  if (integrity !== 'ok') {
    rmSync(target, { force: true });
    throw new Error(`backup failed integrity_check: ${integrity}`);
  }

  const bytes = readFileSync(target);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(`${target}.sha256`, `${sha256}  ${target}\n`);

  // Retention: keep the newest N .db backups, prune older ones with their sidecars.
  if (Number.isFinite(keep) && keep > 0) {
    const backups = readdirSync(outDir)
      .filter((name) => /^everyday-\d{8}T\d{6}Z\.db$/.test(name))
      .map((name) => ({ name, mtime: statSync(join(outDir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const stale of backups.slice(keep)) {
      rmSync(join(outDir, stale.name), { force: true });
      rmSync(join(outDir, `${stale.name}.sha256`), { force: true });
    }
  }

  process.stdout.write(
    `${JSON.stringify({ source: dbPath, backup: target, sizeBytes: bytes.length, sha256, integrity }, null, 2)}\n`,
  );
}

try {
  await main();
} catch (error) {
  process.stderr.write(`backup failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exit(1);
}
