import { getRow, runStatement, type Db } from '../connection.js';

export interface DailyContextRecord {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  dayNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DailyContextRow {
  id: string;
  user_id: string;
  local_date: string;
  timezone: string;
  day_note: string | null;
  created_at: string;
  updated_at: string;
}

function toRecord(row: DailyContextRow): DailyContextRecord {
  return {
    id: row.id,
    userId: row.user_id,
    localDate: row.local_date,
    timezone: row.timezone,
    dayNote: row.day_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = `SELECT id, user_id, local_date, timezone, day_note, created_at, updated_at FROM daily_context`;

export interface UpsertDayNoteInput {
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  dayNote: string | null;
  nowIso: string;
}

export const dailyContext = {
  /**
   * Reads the stored context for the server-computed local date. The local date is never
   * taken from the client, so a device clock or timezone cannot address another day.
   */
  findByUserAndDate(db: Db, userId: string, localDate: string): DailyContextRecord | undefined {
    const row = getRow<DailyContextRow>(db, `${COLUMNS} WHERE user_id = ? AND local_date = ?`, [userId, localDate]);
    return row ? toRecord(row) : undefined;
  },

  upsertDayNote(db: Db, input: UpsertDayNoteInput): void {
    runStatement(
      db,
      `INSERT INTO daily_context (id, user_id, local_date, timezone, day_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, local_date) DO UPDATE SET
         day_note   = excluded.day_note,
         timezone   = excluded.timezone,
         updated_at = excluded.updated_at`,
      [input.id, input.userId, input.localDate, input.timezone, input.dayNote, input.nowIso, input.nowIso],
    );
  },
};
