import { randomUUID } from 'node:crypto';
import { getRow, runStatement, type Db } from '../connection.js';

/** Out-of-band token purposes. Mirrors the CHECK constraint in migration 0003. */
export type AuthTokenPurpose = 'email_verify' | 'password_reset';

export interface AuthTokenRecord {
  id: string;
  userId: string;
  purpose: AuthTokenPurpose;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

interface AuthTokenRow {
  id: string;
  user_id: string;
  purpose: AuthTokenPurpose;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

function toRecord(row: AuthTokenRow): AuthTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

export interface InsertAuthTokenInput {
  userId: string;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Single-use, opaque token store shared by email verification and password reset.
 * Only the SHA-256 hash of a token is ever persisted; lookups happen by hash.
 */
export const authTokens = {
  newId(): string {
    return randomUUID();
  },

  insert(db: Db, input: InsertAuthTokenInput): string {
    const id = randomUUID();
    runStatement(
      db,
      'INSERT INTO auth_tokens (id, user_id, purpose, token_hash, created_at, expires_at, consumed_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
      [id, input.userId, input.purpose, input.tokenHash, input.createdAt, input.expiresAt],
    );
    return id;
  },

  /**
   * Resolves an unconsumed, unexpired token by hash and purpose. Timestamps are ISO-8601 UTC
   * from `toISOString()`, so lexicographic comparison is chronological. The window is
   * half-open (`now < expires_at`): a token is invalid exactly at its expiry instant.
   */
  findRedeemable(
    db: Db,
    purpose: AuthTokenPurpose,
    tokenHash: string,
    nowIso: string,
  ): AuthTokenRecord | undefined {
    const row = getRow<AuthTokenRow>(
      db,
      'SELECT id, user_id, purpose, created_at, expires_at, consumed_at FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?',
      [tokenHash, purpose, nowIso],
    );
    return row ? toRecord(row) : undefined;
  },

  /**
   * Marks a token consumed only if it is still unconsumed. Returns true when this call was the
   * one that consumed it, so confirmation is atomic and single-use even under concurrency.
   */
  consume(db: Db, id: string, atIso: string): boolean {
    return (
      runStatement(db, 'UPDATE auth_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL', [atIso, id])
        .changes > 0
    );
  },

  /**
   * Invalidates all outstanding (unconsumed) tokens of a purpose for a user. Called before
   * issuing a fresh token so at most one request token is ever live per purpose.
   */
  consumeAllForUser(db: Db, userId: string, purpose: AuthTokenPurpose, atIso: string): number {
    return runStatement(
      db,
      'UPDATE auth_tokens SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL',
      [atIso, userId, purpose],
    ).changes;
  },
};
