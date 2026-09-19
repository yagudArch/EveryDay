import type { TodayContext, Preferences, Profile } from '@everyday/contracts';
import type { PreferencesData } from '../db/repositories/preferences.js';
import type { GoalRecord, MemoryRecord } from '../db/repositories/profile-data.js';
import type { UserRecord } from '../db/repositories/users.js';

/** Maps persistence records to the shared contract DTOs. No field is invented or defaulted here. */
export function toProfileDto(user: UserRecord): Profile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

export function toPreferencesDto(data: PreferencesData): Preferences {
  return {
    timezone: data.timezone,
    locale: data.locale,
    theme: data.theme,
    city: data.city,
    dietaryRestrictions: [...data.dietaryRestrictions],
    allergies: [...data.allergies],
    aiConsent: data.aiConsent,
    memoryEnabled: data.memoryEnabled,
  };
}

export function toGoalDto(record: GoalRecord): TodayContext['goals'][number] {
  return {
    id: record.id,
    type: record.type,
    calories: record.calories,
    protein: record.protein,
    fat: record.fat,
    carbs: record.carbs,
  };
}

export function toMemoryFactDto(record: MemoryRecord): TodayContext['memory'][number] {
  return {
    id: record.id,
    fact: record.fact,
    source: record.source,
    createdAt: record.createdAt,
  };
}
