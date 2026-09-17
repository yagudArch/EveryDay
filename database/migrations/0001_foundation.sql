-- 0001_foundation.sql — Foundation schema for «Каждый день» (FND-002, BACKEND).
--
-- Real relational schema (node:sqlite, file-backed, WAL). This is NOT a JSON blob store:
-- every attribute below is a typed column and ownership is enforced with FOREIGN KEYs.
--
-- Scope: Foundation only. Domain modules from MASTER_PROMPT §37 (daily_snapshots, changes,
-- wardrobe_items, outfits, outfit_feedback, food_items, food_inventory, recipes, meals,
-- nutrition_entries, shopping_lists, shopping_items, activities, events, ai_conversations,
-- ai_messages, ai_actions) are added by later migrations. None of them are imitated here,
-- and no fake products, goals or nutrition rows are seeded.
--
-- `schema_migrations` is created by the migration runner (src/db/migrate.ts), not here.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Opaque bearer sessions. Only the SHA-256 hash of the token is stored.
CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT,
  last_used_at TEXT NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- One canonical settings row per user.
CREATE TABLE user_preferences (
  user_id        TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  timezone       TEXT NOT NULL,
  locale         TEXT NOT NULL CHECK (locale IN ('ru', 'en')),
  theme          TEXT NOT NULL CHECK (theme IN ('system', 'light', 'dark')),
  city           TEXT,
  ai_consent     INTEGER NOT NULL DEFAULT 0 CHECK (ai_consent IN (0, 1)),
  memory_enabled INTEGER NOT NULL DEFAULT 0 CHECK (memory_enabled IN (0, 1)),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

-- Extensible, still relational preference entries (currently JSON-encoded list values such as
-- dietary_restrictions and allergies), one row per (user, key).
CREATE TABLE user_preference_values (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, key)
);
CREATE INDEX user_preference_values_user_idx ON user_preference_values (user_id);

-- Nutrition goals are user-authored. Nothing is seeded at registration.
CREATE TABLE user_goals (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('maintain', 'lose', 'gain', 'custom')),
  calories   REAL CHECK (calories IS NULL OR calories >= 0),
  protein    REAL CHECK (protein IS NULL OR protein >= 0),
  fat        REAL CHECK (fat IS NULL OR fat >= 0),
  carbs      REAL CHECK (carbs IS NULL OR carbs >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX user_goals_user_idx ON user_goals (user_id);

-- Controlled AI memory. Only explicitly user-confirmed facts may be stored; AI never writes here directly.
CREATE TABLE user_memory (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  fact       TEXT NOT NULL,
  source     TEXT NOT NULL CHECK (source IN ('user_confirmed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX user_memory_user_idx ON user_memory (user_id);

-- One row per (user, local calendar date). The local date is computed server-side
-- from the profile timezone; it is never supplied by the client.
CREATE TABLE daily_context (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  timezone   TEXT NOT NULL,
  day_note   TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, local_date)
);
CREATE INDEX daily_context_user_date_idx ON daily_context (user_id, local_date);

-- Entitlement source of truth. Status is stored, but the effective status/premium flag is
-- always recomputed against server time (start <= now < end), never taken from the client.
CREATE TABLE subscriptions (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  status                 TEXT NOT NULL CHECK (
                           status IN ('trial', 'active', 'expired_trial', 'expired_subscription', 'cancelled', 'grace')
                         ),
  trial_started_at       TEXT NOT NULL,
  trial_ends_at          TEXT NOT NULL,
  current_period_ends_at TEXT,
  cancelled_at           TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
