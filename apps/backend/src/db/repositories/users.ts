import { randomUUID } from 'node:crypto';
import { getRow, runStatement, type Db } from '../connection.js';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = 'SELECT id, email, display_name, password_hash, created_at, updated_at FROM users';

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

  count(db: Db): number {
    const row = getRow<{ total: number }>(db, 'SELECT COUNT(*) AS total FROM users');
    return row?.total ?? 0;
  },
};
