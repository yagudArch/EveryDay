import { getRow, getRows, runStatement, type Db } from '../db/connection.js';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type GoalType = 'maintain' | 'lose' | 'gain' | 'custom';

export interface MealRecord {
  id: string;
  userId: string;
  mealType: MealType;
  description: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  localDate: string;
  consumedAt: string;
  createdAt: string;
}

export interface GoalRecord {
  userId: string;
  type: GoalType;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  createdAt: string;
  updatedAt: string;
}

interface MealRow {
  id: string;
  user_id: string;
  meal_type: MealType;
  description: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  local_date: string;
  consumed_at: string;
  created_at: string;
}

interface GoalRow {
  user_id: string;
  type: GoalType;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  created_at: string;
  updated_at: string;
}

function toMeal(row: MealRow): MealRecord {
  return {
    id: row.id,
    userId: row.user_id,
    mealType: row.meal_type,
    description: row.description,
    calories: row.calories,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    localDate: row.local_date,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

function toGoal(row: GoalRow): GoalRecord {
  return {
    userId: row.user_id,
    type: row.type,
    calories: row.calories,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const MEAL_COLUMNS =
  'SELECT id, user_id, meal_type, description, calories, protein, fat, carbs, local_date, consumed_at, created_at FROM meals';
const GOAL_COLUMNS =
  'SELECT user_id, type, calories, protein, fat, carbs, created_at, updated_at FROM nutrition_goals';

export interface InsertMealInput {
  id: string;
  userId: string;
  mealType: MealType;
  description: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  localDate: string;
  consumedAt: string;
  createdAt: string;
}

export interface UpsertGoalInput {
  userId: string;
  type: GoalType;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  nowIso: string;
}

export const nutritionRepository = {
  insertMeal(db: Db, input: InsertMealInput): void {
    runStatement(
      db,
      `INSERT INTO meals
         (id, user_id, meal_type, description, calories, protein, fat, carbs, local_date, consumed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.mealType,
        input.description,
        input.calories,
        input.protein,
        input.fat,
        input.carbs,
        input.localDate,
        input.consumedAt,
        input.createdAt,
      ],
    );
  },

  findMealById(db: Db, userId: string, id: string): MealRecord | undefined {
    const row = getRow<MealRow>(db, `${MEAL_COLUMNS} WHERE user_id = ? AND id = ?`, [userId, id]);
    return row ? toMeal(row) : undefined;
  },

  listMealsByDate(db: Db, userId: string, localDate: string): MealRecord[] {
    return getRows<MealRow>(
      db,
      `${MEAL_COLUMNS} WHERE user_id = ? AND local_date = ? ORDER BY consumed_at ASC, created_at ASC, id ASC`,
      [userId, localDate],
    ).map(toMeal);
  },

  findGoal(db: Db, userId: string): GoalRecord | undefined {
    const row = getRow<GoalRow>(db, `${GOAL_COLUMNS} WHERE user_id = ?`, [userId]);
    return row ? toGoal(row) : undefined;
  },

  upsertGoal(db: Db, input: UpsertGoalInput): void {
    runStatement(
      db,
      `INSERT INTO nutrition_goals (user_id, type, calories, protein, fat, carbs, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         type       = excluded.type,
         calories   = excluded.calories,
         protein    = excluded.protein,
         fat        = excluded.fat,
         carbs      = excluded.carbs,
         updated_at = excluded.updated_at`,
      [input.userId, input.type, input.calories, input.protein, input.fat, input.carbs, input.nowIso, input.nowIso],
    );
  },
};
