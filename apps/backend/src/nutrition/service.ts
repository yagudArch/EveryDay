import { randomUUID } from 'node:crypto';
import type {
  CreateMealInput,
  Meal,
  MealList,
  NutritionGoal,
  NutritionSummary,
  UpdateNutritionGoalInput,
} from '@everyday/contracts';
import type { Db } from '../db/connection.js';
import { AppError } from '../errors.js';
import { loadPreferences, localDateFor } from '../services/context-service.js';
import { nutritionRepository, type GoalRecord, type MealRecord } from './repository.js';

/** Macros and calories are stored and returned rounded to a single decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round1Nullable(value: number | null): number | null {
  return value === null ? null : round1(value);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolves the local calendar day a request targets. An explicit ?date=YYYY-MM-DD is
 * validated for shape and calendar validity; otherwise the server computes today from the
 * profile timezone. The client can never move another user's day boundary.
 */
function resolveLocalDate(db: Db, userId: string, now: Date, requested: string | undefined): { localDate: string; timezone: string } {
  const timezone = loadPreferences(db, userId).timezone;
  if (requested === undefined) {
    return { localDate: localDateFor(now, timezone), timezone };
  }
  if (!ISO_DATE.test(requested)) {
    throw new AppError('validation_error', 400, 'Invalid date');
  }
  const parts = requested.split('-');
  const year = Number.parseInt(parts[0] ?? '', 10);
  const month = Number.parseInt(parts[1] ?? '', 10);
  const day = Number.parseInt(parts[2] ?? '', 10);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  if (
    asDate.getUTCFullYear() !== year ||
    asDate.getUTCMonth() !== month - 1 ||
    asDate.getUTCDate() !== day
  ) {
    throw new AppError('validation_error', 400, 'Invalid date');
  }
  return { localDate: requested, timezone };
}

function toMealDto(record: MealRecord): Meal {
  return {
    id: record.id,
    mealType: record.mealType,
    description: record.description,
    calories: round1(record.calories),
    protein: round1(record.protein),
    fat: round1(record.fat),
    carbs: round1(record.carbs),
    localDate: record.localDate,
    consumedAt: record.consumedAt,
    createdAt: record.createdAt,
  };
}

function toGoalDto(record: GoalRecord): NutritionGoal {
  return {
    type: record.type,
    calories: round1Nullable(record.calories),
    protein: round1Nullable(record.protein),
    fat: round1Nullable(record.fat),
    carbs: round1Nullable(record.carbs),
    updatedAt: record.updatedAt,
  };
}

/** Returns the stored goal for the user, or null when none was ever set. */
export function getGoal(db: Db, userId: string): NutritionGoal | null {
  const record = nutritionRepository.findGoal(db, userId);
  return record ? toGoalDto(record) : null;
}

/** Creates or replaces the single nutrition goal owned by the user. */
export function setGoal(db: Db, userId: string, input: UpdateNutritionGoalInput, now: Date): NutritionGoal {
  const nowIso = now.toISOString();
  nutritionRepository.upsertGoal(db, {
    userId,
    type: input.type,
    calories: round1Nullable(input.calories),
    protein: round1Nullable(input.protein),
    fat: round1Nullable(input.fat),
    carbs: round1Nullable(input.carbs),
    nowIso,
  });
  const stored = nutritionRepository.findGoal(db, userId);
  if (!stored) {
    throw new AppError('goal_persist_failed', 500, 'Nutrition goal could not be stored');
  }
  return toGoalDto(stored);
}

export interface MealListQuery {
  date?: string;
}

/** Lists the meals of the resolved local day (profile timezone by default). */
export function listMeals(db: Db, userId: string, now: Date, query: MealListQuery): MealList {
  const { localDate, timezone } = resolveLocalDate(db, userId, now, query.date);
  const meals = nutritionRepository.listMealsByDate(db, userId, localDate).map(toMealDto);
  return { date: localDate, timezone, meals };
}

/**
 * Records a meal. The local day is computed on the server from the consumed instant
 * (client-supplied when present, otherwise now) and the profile timezone; the client
 * never supplies the day directly.
 */
export function addMeal(db: Db, userId: string, input: CreateMealInput, now: Date): Meal {
  const timezone = loadPreferences(db, userId).timezone;
  const consumedAt = input.consumedAt ?? now.toISOString();
  const consumedDate = new Date(consumedAt);
  if (Number.isNaN(consumedDate.getTime())) {
    throw new AppError('validation_error', 400, 'Invalid consumedAt');
  }
  const localDate = localDateFor(consumedDate, timezone);
  const nowIso = now.toISOString();
  const record = {
    id: randomUUID(),
    userId,
    mealType: input.mealType,
    description: input.description,
    calories: round1(input.calories),
    protein: round1(input.protein),
    fat: round1(input.fat),
    carbs: round1(input.carbs),
    localDate,
    consumedAt,
    createdAt: nowIso,
  };
  nutritionRepository.insertMeal(db, record);
  const stored = nutritionRepository.findMealById(db, userId, record.id);
  if (!stored) {
    throw new AppError('meal_persist_failed', 500, 'Meal could not be stored');
  }
  return toMealDto(stored);
}

export interface SummaryQuery {
  date?: string;
}

/**
 * Computes the daily nutrition summary: consumed totals for the resolved local day, the
 * stored goal (or null), remaining = goal - consumed per macro when a goal exists, and the
 * number of meals. Totals are rounded to a single decimal place.
 */
export function getSummary(db: Db, userId: string, now: Date, query: SummaryQuery): NutritionSummary {
  const { localDate, timezone } = resolveLocalDate(db, userId, now, query.date);
  const meals = nutritionRepository.listMealsByDate(db, userId, localDate);

  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      fat: acc.fat + meal.fat,
      carbs: acc.carbs + meal.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );
  const consumed = {
    calories: round1(totals.calories),
    protein: round1(totals.protein),
    fat: round1(totals.fat),
    carbs: round1(totals.carbs),
  };

  const goalRecord = nutritionRepository.findGoal(db, userId);
  const goal = goalRecord ? toGoalDto(goalRecord) : null;

  const remaining =
    goal === null
      ? null
      : {
          calories: round1((goal.calories ?? 0) - consumed.calories),
          protein: round1((goal.protein ?? 0) - consumed.protein),
          fat: round1((goal.fat ?? 0) - consumed.fat),
          carbs: round1((goal.carbs ?? 0) - consumed.carbs),
        };

  return {
    date: localDate,
    timezone,
    goal,
    consumed,
    remaining,
    mealCount: meals.length,
  };
}
