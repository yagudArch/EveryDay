import { randomUUID } from 'node:crypto';
import { getRow, runStatement, type Db } from '../connection.js';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  email_verified: number;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    emailVerified: row.email_verified === 1,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  'SELECT id, email, display_name, password_hash, email_verified, email_verified_at, created_at, updated_at FROM users';

export const users = {
  newId(): string {
    return randomUUID();
  },

  insert(db: Db, record: UserRecord): void {
    runStatement(
      db,
      'INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [record.id, record.email, record.passwordHash, record.displayName, record.createdAt, record.updatedAt],
    );
  },

  findByEmail(db: Db, email: string): UserRecord | undefined {
    // Emails are normalised to lowercase by the register/login contract schemas;
    // lowercasing here keeps lookups correct regardless of caller.
    const row = getRow<UserRow>(db, `${SELECT_COLUMNS} WHERE email = ?`, [email.toLowerCase()]);
    return row ? toUser(row) : undefined;
  },

  findById(db: Db, id: string): UserRecord | undefined {
    const row = getRow<UserRow>(db, `${SELECT_COLUMNS} WHERE id = ?`, [id]);
    return row ? toUser(row) : undefined;
  },

  updateDisplayName(db: Db, id: string, displayName: string, updatedAt: string): boolean {
    return (
      runStatement(db, 'UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?', [displayName, updatedAt, id])
        .changes > 0
    );
  },

  /** Marks the account's email as verified. Idempotent: re-confirming keeps the first timestamp. */
  markEmailVerified(db: Db, id: string, atIso: string): boolean {
    return (
      runStatement(
        db,
        'UPDATE users SET email_verified = 1, email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?',
        [atIso, atIso, id],
      ).changes > 0
    );
  },

  /** Replaces the stored password hash. Callers hash outside any transaction (scrypt is slow). */
  updatePasswordHash(db: Db, id: string, passwordHash: string, updatedAt: string): boolean {
    return (
      runStatement(db, 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, updatedAt, id])
        .changes > 0
    );
  },

  count(db: Db): number {
    const row = getRow<{ total: number }>(db, 'SELECT COUNT(*) AS total FROM users');
    return row?.total ?? 0;
  },

  /**
   * Permanently removes the account row. With `PRAGMA foreign_keys = ON` every owned table
   * (sessions, preferences, preference values, goals, memory, daily context, subscriptions,
   * meals, nutrition goals, auth tokens) is defined `ON DELETE CASCADE`, so this single delete
   * erases all of the user's data and, by removing the session rows, revokes every session.
   * Irreversible: there is no soft-delete flag.
   */
  deleteById(db: Db, id: string): boolean {
    return runStatement(db, 'DELETE FROM users WHERE id = ?', [id]).changes > 0;
  },
};
