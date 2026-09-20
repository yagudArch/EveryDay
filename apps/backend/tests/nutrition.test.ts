import { describe, expect, it } from 'vitest';
import {
  MealListSchema,
  MealSchema,
  NutritionGoalSchema,
  NutritionSummarySchema,
  routes,
} from '@everyday/contracts';
import { bearer, createHarness, registerUser } from './helpers.js';

const meal = (overrides: Record<string, unknown> = {}) => ({
  mealType: 'lunch',
  description: 'Куриная грудка с рисом',
  calories: 520.44,
  protein: 42.06,
  fat: 12.5,
  carbs: 60.2,
  consumedAt: null,
  ...overrides,
});

describe('nutrition', () => {
  it('runs the full slice: set goal, add meals, list meals, summary', async () => {
    const harness = await createHarness({ startAt: '2026-09-17T09:00:00.000Z' });
    try {
      const user = await registerUser(harness.app, { timezone: 'Europe/Riga' });

      // No goal yet.
      const emptyGoal = await harness.app.inject({ method: 'GET', url: routes.nutritionGoals, headers: bearer(user.token) });
      expect(emptyGoal.statusCode).toBe(200);
      expect(emptyGoal.json()).toBeNull();

      // Set a goal (macros rounded to 1 decimal place).
      const putGoal = await harness.app.inject({
        method: 'PUT',
        url: routes.nutritionGoals,
        headers: bearer(user.token),
        payload: { type: 'maintain', calories: 2000.05, protein: 150.24, fat: 60.5, carbs: 220.16 },
      });
      expect(putGoal.statusCode).toBe(200);
      const goal = NutritionGoalSchema.parse(putGoal.json());
      expect(goal.type).toBe('maintain');
      expect(goal.calories).toBe(2000.1);
      expect(goal.protein).toBe(150.2);

      // Goal persists on GET.
      const readGoal = await harness.app.inject({ method: 'GET', url: routes.nutritionGoals, headers: bearer(user.token) });
      expect(NutritionGoalSchema.parse(readGoal.json()).calories).toBe(2000.1);

      // Add two meals.
      const first = await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(user.token),
        payload: meal({ mealType: 'breakfast', consumedAt: '2026-09-17T07:00:00.000Z', calories: 300.44, protein: 20.06, fat: 10.02, carbs: 30.08 }),
      });
      expect(first.statusCode).toBe(201);
      const firstMeal = MealSchema.parse(first.json());
      expect(firstMeal.calories).toBe(300.4);
      expect(firstMeal.localDate).toBe('2026-09-17');

      const second = await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(user.token),
        payload: meal({ mealType: 'lunch', consumedAt: '2026-09-17T12:00:00.000Z', calories: 500.0, protein: 40.0, fat: 15.0, carbs: 55.0 }),
      });
      expect(second.statusCode).toBe(201);

      // List meals for today.
      const list = await harness.app.inject({ method: 'GET', url: routes.nutritionMeals, headers: bearer(user.token) });
      expect(list.statusCode).toBe(200);
      const mealList = MealListSchema.parse(list.json());
      expect(mealList.date).toBe('2026-09-17');
      expect(mealList.timezone).toBe('Europe/Riga');
      expect(mealList.meals).toHaveLength(2);
      expect(mealList.meals[0]?.mealType).toBe('breakfast');

      // Summary totals and remaining.
      const summary = await harness.app.inject({ method: 'GET', url: routes.nutritionSummary, headers: bearer(user.token) });
      expect(summary.statusCode).toBe(200);
      const parsed = NutritionSummarySchema.parse(summary.json());
      expect(parsed.mealCount).toBe(2);
      expect(parsed.consumed.calories).toBe(800.4);
      expect(parsed.consumed.protein).toBe(60.1);
      expect(parsed.goal?.calories).toBe(2000.1);
      expect(parsed.remaining?.calories).toBe(1199.7);
      expect(parsed.remaining?.protein).toBe(90.1);
    } finally {
      await harness.cleanup();
    }
  });

  it('summary reports null remaining when no goal is set', async () => {
    const harness = await createHarness({ startAt: '2026-09-17T09:00:00.000Z' });
    try {
      const user = await registerUser(harness.app, { timezone: 'Europe/Riga' });
      await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(user.token),
        payload: meal({ calories: 250.0, protein: 10.0, fat: 5.0, carbs: 40.0 }),
      });
      const summary = await harness.app.inject({ method: 'GET', url: routes.nutritionSummary, headers: bearer(user.token) });
      const parsed = NutritionSummarySchema.parse(summary.json());
      expect(parsed.goal).toBeNull();
      expect(parsed.remaining).toBeNull();
      expect(parsed.consumed.calories).toBe(250.0);
      expect(parsed.mealCount).toBe(1);
    } finally {
      await harness.cleanup();
    }
  });

  it('isolates meals between users: A cannot see B meals', async () => {
    const harness = await createHarness({ startAt: '2026-09-17T09:00:00.000Z' });
    try {
      const alpha = await registerUser(harness.app, { timezone: 'Europe/Riga' });
      const beta = await registerUser(harness.app, { timezone: 'Europe/Riga' });

      await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(alpha.token),
        payload: meal({ description: 'alpha meal' }),
      });

      const betaList = await harness.app.inject({ method: 'GET', url: routes.nutritionMeals, headers: bearer(beta.token) });
      expect(MealListSchema.parse(betaList.json()).meals).toHaveLength(0);

      const betaSummary = await harness.app.inject({ method: 'GET', url: routes.nutritionSummary, headers: bearer(beta.token) });
      expect(NutritionSummarySchema.parse(betaSummary.json()).mealCount).toBe(0);

      // Beta's goal is independent of alpha's.
      await harness.app.inject({
        method: 'PUT',
        url: routes.nutritionGoals,
        headers: bearer(alpha.token),
        payload: { type: 'lose', calories: 1800, protein: 140, fat: 50, carbs: 180 },
      });
      const betaGoal = await harness.app.inject({ method: 'GET', url: routes.nutritionGoals, headers: bearer(beta.token) });
      expect(betaGoal.json()).toBeNull();
    } finally {
      await harness.cleanup();
    }
  });

  it('computes the local day from the profile timezone at the day boundary', async () => {
    // 2026-09-17T22:30Z is 2026-09-18 in Tokyo but still 2026-09-17 in Los Angeles.
    const harness = await createHarness({ startAt: '2026-09-17T22:30:00.000Z' });
    try {
      const user = await registerUser(harness.app, { timezone: 'Asia/Tokyo' });
      const created = await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(user.token),
        payload: meal({ consumedAt: null }),
      });
      expect(created.statusCode).toBe(201);
      expect(MealSchema.parse(created.json()).localDate).toBe('2026-09-18');

      // The meal counts toward the Tokyo day, not the UTC day.
      const tokyoToday = await harness.app.inject({ method: 'GET', url: routes.nutritionMeals, headers: bearer(user.token) });
      const tokyoList = MealListSchema.parse(tokyoToday.json());
      expect(tokyoList.date).toBe('2026-09-18');
      expect(tokyoList.meals).toHaveLength(1);

      // Explicit ?date for the previous local day is empty.
      const prevDay = await harness.app.inject({
        method: 'GET',
        url: `${routes.nutritionMeals}?date=2026-09-17`,
        headers: bearer(user.token),
      });
      expect(MealListSchema.parse(prevDay.json()).meals).toHaveLength(0);

      // A client instant on the previous UTC day still resolves via the profile timezone.
      const explicit = await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(user.token),
        payload: meal({ consumedAt: '2026-09-17T10:00:00.000Z' }),
      });
      expect(MealSchema.parse(explicit.json()).localDate).toBe('2026-09-17');
      const explicitList = await harness.app.inject({
        method: 'GET',
        url: `${routes.nutritionMeals}?date=2026-09-17`,
        headers: bearer(user.token),
      });
      expect(MealListSchema.parse(explicitList.json()).meals).toHaveLength(1);
    } finally {
      await harness.cleanup();
    }
  });

  it('rejects unknown fields, invalid values and a client-supplied userId', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);

      // Unknown field on the meal body.
      const unknownField = await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(user.token),
        payload: meal({ userId: 'someone-else' }),
      });
      expect(unknownField.statusCode).toBe(400);

      // Negative macro.
      const negative = await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(user.token),
        payload: meal({ protein: -1 }),
      });
      expect(negative.statusCode).toBe(400);

      // Invalid meal type.
      const badType = await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(user.token),
        payload: meal({ mealType: 'brunch' }),
      });
      expect(badType.statusCode).toBe(400);

      // Empty description.
      const emptyDescription = await harness.app.inject({
        method: 'POST',
        url: routes.nutritionMeals,
        headers: bearer(user.token),
        payload: meal({ description: '   ' }),
      });
      expect(emptyDescription.statusCode).toBe(400);

      // Invalid goal type.
      const badGoal = await harness.app.inject({
        method: 'PUT',
        url: routes.nutritionGoals,
        headers: bearer(user.token),
        payload: { type: 'bulk', calories: 2000, protein: null, fat: null, carbs: null },
      });
      expect(badGoal.statusCode).toBe(400);

      // Invalid ?date query.
      const badDate = await harness.app.inject({
        method: 'GET',
        url: `${routes.nutritionMeals}?date=2026-13-40`,
        headers: bearer(user.token),
      });
      expect(badDate.statusCode).toBe(400);
    } finally {
      await harness.cleanup();
    }
  });

  it('requires authentication for every nutrition endpoint', async () => {
    const harness = await createHarness();
    try {
      const goals = await harness.app.inject({ method: 'GET', url: routes.nutritionGoals });
      expect(goals.statusCode).toBe(401);
      const meals = await harness.app.inject({ method: 'GET', url: routes.nutritionMeals });
      expect(meals.statusCode).toBe(401);
      const summary = await harness.app.inject({ method: 'GET', url: routes.nutritionSummary });
      expect(summary.statusCode).toBe(401);
    } finally {
      await harness.cleanup();
    }
  });

  it('replaces the goal on a second PUT (upsert, one row per user)', async () => {
    const harness = await createHarness({ startAt: '2026-09-17T09:00:00.000Z' });
    try {
      const user = await registerUser(harness.app);
      await harness.app.inject({
        method: 'PUT',
        url: routes.nutritionGoals,
        headers: bearer(user.token),
        payload: { type: 'lose', calories: 1800, protein: 140, fat: 50, carbs: 180 },
      });
      harness.clock.advance(60_000);
      const second = await harness.app.inject({
        method: 'PUT',
        url: routes.nutritionGoals,
        headers: bearer(user.token),
        payload: { type: 'gain', calories: 2600, protein: 180, fat: 80, carbs: 300 },
      });
      const goal = NutritionGoalSchema.parse(second.json());
      expect(goal.type).toBe('gain');
      expect(goal.calories).toBe(2600);
      const read = await harness.app.inject({ method: 'GET', url: routes.nutritionGoals, headers: bearer(user.token) });
      expect(NutritionGoalSchema.parse(read.json()).type).toBe('gain');
    } finally {
      await harness.cleanup();
    }
  });
})
;
