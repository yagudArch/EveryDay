import { getRow, runStatement, type Db } from '../connection.js';

export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string;
}

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

const COLUMNS = 'SELECT id, user_id, created_at, expires_at, revoked_at, last_used_at FROM sessions';

export interface InsertSessionInput {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

export const sessions = {
  insert(db: Db, input: InsertSessionInput): void {
    runStatement(
      db,
      'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked_at, last_used_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
      [input.id, input.userId, input.tokenHash, input.createdAt, input.expiresAt, input.createdAt],
    );
  },

  /**
   * Resolves an active session by token hash. Timestamps are ISO-8601 UTC produced by
   * `toISOString()`, so lexicographic comparison is chronological here. The window is
   * half-open (`now < expires_at`): a session is invalid exactly at its expiry instant.
   */
  findActiveByTokenHash(db: Db, tokenHash: string, nowIso: string): SessionRecord | undefined {
    const row = getRow<SessionRow>(
      db,
      `${COLUMNS} WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
      [tokenHash, nowIso],
    );
    return row ? toSession(row) : undefined;
  },

  findById(db: Db, id: string): SessionRecord | undefined {
    const row = getRow<SessionRow>(db, `${COLUMNS} WHERE id = ?`, [id]);
    return row ? toSession(row) : undefined;
  },

  touch(db: Db, id: string, atIso: string): void {
    runStatement(db, 'UPDATE sessions SET last_used_at = ? WHERE id = ?', [atIso, id]);
  },

  revoke(db: Db, id: string, atIso: string): boolean {
    return (
      runStatement(db, 'UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [atIso, id]).changes > 0
    );
  },

  countActiveForUser(db: Db, userId: string, nowIso: string): number {
    const row = getRow<{ total: number }>(
      db,
      'SELECT COUNT(*) AS total FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?',
      [userId, nowIso],
    );
    return row?.total ?? 0;
  },
};
