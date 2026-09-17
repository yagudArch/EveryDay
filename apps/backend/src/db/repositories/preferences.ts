import { randomUUID } from 'node:crypto';
import { getRow, runStatement, type Db, type SqlValue } from '../connection.js';

export type Locale = 'ru' | 'en';
export type Theme = 'system' | 'light' | 'dark';

/** Canonical settings shape used across the backend (mirrors the shared Preferences contract). */
export interface PreferencesData {
  timezone: string;
  locale: Locale;
  theme: Theme;
  city: string | null;
  dietaryRestrictions: string[];
  allergies: string[];
  aiConsent: boolean;
  memoryEnabled: boolean;
}

export type PreferencesPatch = Partial<PreferencesData>;

/** Keys used in `user_preference_values` for list-shaped preferences. */
export const PREFERENCE_VALUE_KEYS = {
  dietaryRestrictions: 'dietary_restrictions',
  allergies: 'allergies',
} as const;

interface PreferenceRow {
  timezone: string;
  locale: Locale;
  theme: Theme;
  city: string | null;
  ai_consent: number;
  memory_enabled: number;
}

function readList(db: Db, userId: string, key: string): string[] {
  const row = getRow<{ value: string }>(
    db,
    'SELECT value FROM user_preference_values WHERE user_id = ? AND key = ?',
    [userId, key],
  );
  if (!row) return [];
  try {
    const parsed: unknown = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

function writeList(db: Db, userId: string, key: string, values: string[], nowIso: string): void {
  runStatement(
    db,
    `INSERT INTO user_preference_values (id, user_id, key, value, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [randomUUID(), userId, key, JSON.stringify(values), nowIso, nowIso],
  );
}

export const preferences = {
  insertDefaults(db: Db, userId: string, data: PreferencesData, nowIso: string): void {
    runStatement(
      db,
      `INSERT INTO user_preferences
         (user_id, timezone, locale, theme, city, ai_consent, memory_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        data.timezone,
        data.locale,
        data.theme,
        data.city,
        data.aiConsent ? 1 : 0,
        data.memoryEnabled ? 1 : 0,
        nowIso,
        nowIso,
      ],
    );
    writeList(db, userId, PREFERENCE_VALUE_KEYS.dietaryRestrictions, data.dietaryRestrictions, nowIso);
    writeList(db, userId, PREFERENCE_VALUE_KEYS.allergies, data.allergies, nowIso);
  },

  findByUserId(db: Db, userId: string): PreferencesData | undefined {
    const row = getRow<PreferenceRow>(
      db,
      'SELECT timezone, locale, theme, city, ai_consent, memory_enabled FROM user_preferences WHERE user_id = ?',
      [userId],
    );
    if (!row) return undefined;
    return {
      timezone: row.timezone,
      locale: row.locale,
      theme: row.theme,
      city: row.city,
      dietaryRestrictions: readList(db, userId, PREFERENCE_VALUE_KEYS.dietaryRestrictions),
      allergies: readList(db, userId, PREFERENCE_VALUE_KEYS.allergies),
      aiConsent: row.ai_consent === 1,
      memoryEnabled: row.memory_enabled === 1,
    };
  },

  /**
   * Applies a partial update. Call inside a transaction: scalar columns and list values
   * must change atomically. Only keys present in the patch are touched.
   */
  update(db: Db, userId: string, patch: PreferencesPatch, nowIso: string): void {
    const assignments: string[] = [];
    const params: SqlValue[] = [];

    if (patch.timezone !== undefined) {
      assignments.push('timezone = ?');
      params.push(patch.timezone);
    }
    if (patch.locale !== undefined) {
      assignments.push('locale = ?');
      params.push(patch.locale);
    }
    if (patch.theme !== undefined) {
      assignments.push('theme = ?');
      params.push(patch.theme);
    }
    if (patch.city !== undefined) {
      assignments.push('city = ?');
      params.push(patch.city);
    }
    if (patch.aiConsent !== undefined) {
      assignments.push('ai_consent = ?');
      params.push(patch.aiConsent ? 1 : 0);
    }
    if (patch.memoryEnabled !== undefined) {
      assignments.push('memory_enabled = ?');
      params.push(patch.memoryEnabled ? 1 : 0);
    }

    if (assignments.length > 0) {
      assignments.push('updated_at = ?');
      params.push(nowIso);
      params.push(userId);
      runStatement(db, `UPDATE user_preferences SET ${assignments.join(', ')} WHERE user_id = ?`, params);
    }

    if (patch.dietaryRestrictions !== undefined) {
      writeList(db, userId, PREFERENCE_VALUE_KEYS.dietaryRestrictions, patch.dietaryRestrictions, nowIso);
    }
    if (patch.allergies !== undefined) {
      writeList(db, userId, PREFERENCE_VALUE_KEYS.allergies, patch.allergies, nowIso);
    }
  },
};
