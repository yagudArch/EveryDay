import { getRows, runStatement, type Db } from '../connection.js';

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

export interface InsertMemoryInput {
  id: string;
  userId: string;
  fact: string;
  createdAt: string;
}

export const memory = {
  listByUser(db: Db, userId: string): MemoryRecord[] {
    return getRows<MemoryRow>(
      db,
      'SELECT id, fact, source, created_at FROM user_memory WHERE user_id = ? ORDER BY created_at ASC',
      [userId],
    ).map((row) => ({ id: row.id, fact: row.fact, source: row.source, createdAt: row.created_at }));
  },

  /**
   * Inserts a user-confirmed memory fact. `source` is fixed to 'user_confirmed' — the only
   * value the schema and contract allow; the AI never writes here without explicit confirmation.
   */
  insert(db: Db, input: InsertMemoryInput): void {
    runStatement(
      db,
      "INSERT INTO user_memory (id, user_id, fact, source, created_at, updated_at) VALUES (?, ?, ?, 'user_confirmed', ?, ?)",
      [input.id, input.userId, input.fact, input.createdAt, input.createdAt],
    );
  },

  /**
   * Deletes a single fact, scoped to its owner. The `user_id` predicate guarantees a caller
   * can never remove another user's fact even if they guess the id. Returns whether a row
   * was actually removed (false ⇒ not found or not owned ⇒ 404).
   */
  deleteOwnedById(db: Db, userId: string, id: string): boolean {
    return runStatement(db, 'DELETE FROM user_memory WHERE id = ? AND user_id = ?', [id, userId]).changes > 0;
  },

  /** Deletes every fact for the user and reports how many rows were removed. */
  deleteAllForUser(db: Db, userId: string): number {
    return runStatement(db, 'DELETE FROM user_memory WHERE user_id = ?', [userId]).changes;
  },
};
