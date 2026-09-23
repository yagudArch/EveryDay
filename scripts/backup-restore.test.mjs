// OPS-002 — verifiable self-test for the SQLite backup/restore scripts.
// Real end-to-end: migrate a temp DB, insert a row, back up (VACUUM INTO),
// wipe, restore, and assert the row is back. Also asserts checksum tamper is caught.
// Run: node --import tsx --test scripts/backup-restore.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const migrateCli = join(repoRoot, 'apps', 'backend', 'dist', 'cli', 'migrate.js');
const backupScript = join(repoRoot, 'scripts', 'backup-sqlite.mjs');
const restoreScript = join(repoRoot, 'scripts', 'restore-sqlite.mjs');

function node(script, env, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('backup + restore round-trip preserves data; tamper is rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ops002-backup-'));
  const dbPath = join(dir, 'live.db');
  const backupDir = join(dir, 'backups');
  try {
    // Migrate a real schema into the live DB via the compiled backend CLI.
    node(migrateCli, { DATABASE_PATH: dbPath });

    const now = new Date().toISOString();
    let db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare(
      'INSERT INTO users (id,email,password_hash,display_name,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    ).run('u1', 'a@b.test', 'hash', 'Alice', now, now);
    db.close();

    node(backupScript, { DATABASE_PATH: dbPath, BACKUP_DIR: backupDir });
    const backups = readdirSync(backupDir).filter((n) => /^everyday-.*\.db$/.test(n));
    assert.equal(backups.length, 1, 'exactly one backup produced');
    const backupPath = join(backupDir, backups[0]);

    // Wipe live data.
    db = new DatabaseSync(dbPath);
    db.exec('DELETE FROM users');
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM users').get().c, 0);
    db.close();

    // Restore and confirm data is back.
    node(restoreScript, { DATABASE_PATH: dbPath }, ['--from', backupPath]);
    db = new DatabaseSync(dbPath);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM users').get().c, 1);
    assert.equal(db.prepare('SELECT display_name AS n FROM users').get().n, 'Alice');
    db.close();

    // Tampered backup must be rejected by the checksum sidecar.
    appendFileSync(backupPath, 'x');
    assert.throws(
      () => node(restoreScript, { DATABASE_PATH: dbPath }, ['--from', backupPath]),
      /checksum mismatch|Command failed/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
