import { getRows, type Db } from '../connection.js';

/**
 * Read-only access to Foundation profile data that is not yet writable through the API.
 * Nutrition goals are user-authored (nothing seeded); memory rows may only originate from
 * explicit user confirmation and are only exposed when the user enabled memory.
 */
export type GoalType = 'maintain' | 'lose' | 'gain' | 'custom';

export interface GoalRecord {
  id: string;
  type: GoalType;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

export interface MemoryRecord {
  id: string;
  fact: string;
  source: 'user_confirmed';
  createdAt: string;
}

interface GoalRow {
  id: string;
  type: GoalType;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

interface MemoryRow {
  id: string;
  fact: string;
  source: 'user_confirmed';
  created_at: string;
}

export const goals = {
  listByUser(db: Db, userId: string): GoalRecord[] {
    return getRows<GoalRow>(
      db,
      'SELECT id, type, calories, protein, fat, carbs FROM user_goals WHERE user_id = ? ORDER BY created_at ASC',
      [userId],
    ).map((row) => ({
      id: row.id,
      type: row.type,
      calories: row.calories,
      protein: row.protein,
      fat: row.fat,
      carbs: row.carbs,
    }));
  },
};

export const memory = {
  listByUser(db: Db, userId: string): MemoryRecord[] {
    return getRows<MemoryRow>(
      db,
      'SELECT id, fact, source, created_at FROM user_memory WHERE user_id = ? ORDER BY created_at ASC',
      [userId],
    ).map((row) => ({ id: row.id, fact: row.fact, source: row.source, createdAt: row.created_at }));
  },
};
