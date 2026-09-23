#!/usr/bin/env node
// OPS-002 — restore a SQLite backup produced by backup-sqlite.mjs.
//
// Verifies the backup's SHA-256 (against its .sha256 sidecar when present) and
// runs PRAGMA integrity_check BEFORE overwriting the live database. The current
// live database is preserved as <db>.pre-restore-<ts> unless --no-safety-copy.
// Nothing is overwritten if verification fails.
//
// Usage:
//   node scripts/restore-sqlite.mjs --from <backup.db> [--db <path>] [--no-safety-copy]

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && index + 1 < process.argv.length) return process.argv[index + 1];
  return fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);
const resolveFromRoot = (value) => (isAbsolute(value) ? value : resolve(repoRoot, value));

function main() {
  const from = arg('from', undefined);
  if (!from) throw new Error('missing --from <backup.db>');
  const source = resolveFromRoot(from);
  const dbPath = resolveFromRoot(arg('db', process.env.DATABASE_PATH || 'data/everyday.db'));

  if (!existsSync(source)) throw new Error(`backup not found: ${source}`);
  if (dbPath === ':memory:') throw new Error('cannot restore into :memory:');

  const bytes = readFileSync(source);
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  const sidecar = `${source}.sha256`;
  if (existsSync(sidecar)) {
    const expected = readFileSync(sidecar, 'utf8').trim().split(/\s+/)[0];
    if (expected !== sha256) {
      throw new Error(`checksum mismatch: sidecar ${expected} != computed ${sha256}`);
    }
  }

  // Integrity check the backup before touching the live database.
  const verify = new DatabaseSync(source);
  let integrity = 'unknown';
  try {
    integrity = verify.prepare('PRAGMA integrity_check').get().integrity_check;
  } finally {
    verify.close();
  }
  if (integrity !== 'ok') throw new Error(`backup failed integrity_check: ${integrity}`);

  let safetyCopy = null;
  if (existsSync(dbPath) && !hasFlag('no-safety-copy')) {
    safetyCopy = `${dbPath}.pre-restore-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`;
    copyFileSync(dbPath, safetyCopy);
  }

  // Atomic-enough on the same filesystem: copy the verified backup over the live path.
  copyFileSync(source, dbPath);

  process.stdout.write(
    `${JSON.stringify({ restoredFrom: source, into: dbPath, sha256, integrity, safetyCopy }, null, 2)}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`restore failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exit(1);
}
