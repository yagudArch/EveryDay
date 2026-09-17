import { randomUUID } from 'node:crypto';
import type { TodayContext } from '@everyday/contracts';
import type { Db } from '../db/connection.js';
import { dailyContext } from '../db/repositories/daily-context.js';
import { preferences, type PreferencesData } from '../db/repositories/preferences.js';
import { goals, memory } from '../db/repositories/profile-data.js';
import type { UserRecord } from '../db/repositories/users.js';
import { AppError } from '../errors.js';
import { toGoalDto, toMemoryFactDto, toPreferencesDto, toProfileDto } from './dto.js';
import { computeEntitlement, ensureSubscription, type Entitlement } from './subscription-service.js';

/**
 * Domain modules that exist in the product plan but not in Foundation. They are reported
 * explicitly as unavailable — never as zeroed nutrition, invented weather or empty-but-real data.
 */
export const UNAVAILABLE_MODULE = { status: 'unavailable', reason: 'not_implemented', data: null } as const;

const DATE_PARTS_FORMAT = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;

/**
 * Computes the local calendar date (YYYY-MM-DD) for the user's IANA timezone on the server.
 * The client never sends the day, so a device clock or timezone cannot shift the day boundary.
 */
export function localDateFor(now: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, ...DATE_PARTS_FORMAT }).formatToParts(now);
    const valueOf = (type: 'year' | 'month' | 'day'): string =>
      parts.find((part) => part.type === type)?.value ?? '';
    const year = valueOf('year');
    const month = valueOf('month');
    const day = valueOf('day');
    if (!year || !month || !day) {
      throw new AppError('timezone_resolution_failed', 500, 'Could not resolve the local date');
    }
    return `${year}-${month}-${day}`;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('timezone_resolution_failed', 500, 'Could not resolve the local date');
  }
}

export function loadPreferences(db: Db, userId: string): PreferencesData {
  const stored = preferences.findByUserId(db, userId);
  if (!stored) {
    throw new AppError('preferences_not_found', 500, 'User preferences are missing');
  }
  return stored;
}

export function readSubscription(db: Db, user: UserRecord, now: Date): Entitlement {
  return computeEntitlement(ensureSubscription(db, user, now), now);
}

/**
 * Assembles the single "day context" object. It contains only real, stored data:
 * profile, preferences, user-authored goals, confirmed memory facts (only when the user
 * enabled memory), the computed entitlement, the stored note of the local day, and the
 * explicit unavailability of every module that Foundation does not implement yet.
 */
export function buildTodayContext(db: Db, user: UserRecord, now: Date): TodayContext {
  const stored = loadPreferences(db, user.id);
  const date = localDateFor(now, stored.timezone);
  const dayContext = dailyContext.findByUserAndDate(db, user.id, date);
  const subscription = readSubscription(db, user, now);

  return {
    schemaVersion: 1,
    date,
    timezone: stored.timezone,
    generatedAt: now.toISOString(),
    profile: toProfileDto(user),
    preferences: toPreferencesDto(stored),
    goals: goals.listByUser(db, user.id).map(toGoalDto),
    memory: stored.memoryEnabled ? memory.listByUser(db, user.id).map(toMemoryFactDto) : [],
    subscription,
    dayNote: dayContext?.dayNote ?? null,
    modules: {
      nutrition: UNAVAILABLE_MODULE,
      weather: UNAVAILABLE_MODULE,
      wardrobe: UNAVAILABLE_MODULE,
      activity: UNAVAILABLE_MODULE,
      inventory: UNAVAILABLE_MODULE,
      shopping: UNAVAILABLE_MODULE,
      events: UNAVAILABLE_MODULE,
      changes: UNAVAILABLE_MODULE,
    },
  };
}

/** Stores the explicit day note for the server-computed local date. */
export function updateDayNote(db: Db, user: UserRecord, dayNote: string | null, now: Date): TodayContext {
  const stored = loadPreferences(db, user.id);
  const localDate = localDateFor(now, stored.timezone);
  dailyContext.upsertDayNote(db, {
    id: randomUUID(),
    userId: user.id,
    localDate,
    timezone: stored.timezone,
    dayNote,
    nowIso: now.toISOString(),
  });
  return buildTodayContext(db, user, now);
}
