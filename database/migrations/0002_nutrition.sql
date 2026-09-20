-- 0002_nutrition.sql — Nutrition module for «Каждый день» (NUT-001, BACKEND).
--
-- Real relational schema (node:sqlite, file-backed, WAL). Same conventions as
-- 0001_foundation.sql: TEXT uuid ids, ISO-8601 TEXT timestamps, REAL macros with
-- non-negative CHECKs, ownership enforced by FOREIGN KEY ... ON DELETE CASCADE.
-- The migration runner (src/db/migrate.ts) records version/name/checksum; nothing
-- is seeded here — meals and goals are only ever user-authored.

CREATE TABLE meals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  meal_type   TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  description TEXT NOT NULL,
  calories    REAL NOT NULL CHECK (calories >= 0),
  protein     REAL NOT NULL CHECK (protein >= 0),
  fat         REAL NOT NULL CHECK (fat >= 0),
  carbs       REAL NOT NULL CHECK (carbs >= 0),
  local_date  TEXT NOT NULL,
  consumed_at TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX meals_user_date_idx ON meals (user_id, local_date);

-- One nutrition goal row per user. type is required; macros/calories are nullable.
CREATE TABLE nutrition_goals (
  user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('maintain', 'lose', 'gain', 'custom')),
  calories   REAL CHECK (calories IS NULL OR calories >= 0),
  protein    REAL CHECK (protein IS NULL OR protein >= 0),
  fat        REAL CHECK (fat IS NULL OR fat >= 0),
  carbs      REAL CHECK (carbs IS NULL OR carbs >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
