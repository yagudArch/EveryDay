-- 0003_auth_hardening.sql — Auth hardening for «Каждый день» (BCK-001, BACKEND).
--
-- Real relational schema (node:sqlite, file-backed, WAL). Same conventions as
-- 0001_foundation.sql / 0002_nutrition.sql: TEXT uuid ids, ISO-8601 TEXT timestamps,
-- ownership enforced by FOREIGN KEY ... ON DELETE CASCADE, CHECK constraints for enums.
-- The migration runner (src/db/migrate.ts) records version/name/checksum; nothing is seeded.
--
-- Adds email-verification state to users and a single-use opaque token store shared by
-- email verification and password reset. Only the SHA-256 hash of a token is stored — the
-- database never contains a usable token, exactly as sessions store only a hash.

-- Email verification state. Existing accounts default to unverified; verification is opt-in
-- and never fabricated. `email_verified_at` records when confirmation happened.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1));
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

-- Opaque, single-use tokens delivered out of band (email) for sensitive auth flows.
-- Only the SHA-256 hash is persisted. A token is valid while it is unconsumed and not expired;
-- `consumed_at` makes confirmation single-use and auditable.
CREATE TABLE auth_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('email_verify', 'password_reset')),
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX auth_tokens_user_purpose_idx ON auth_tokens (user_id, purpose);
CREATE INDEX auth_tokens_expires_at_idx ON auth_tokens (expires_at);
