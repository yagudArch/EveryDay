import type { Preferences, Profile, UpdatePreferencesInput, UpdateProfileSchema } from '@everyday/contracts';
import type { z } from 'zod';
import { withTransaction, type Db } from '../db/connection.js';
import { preferences, type PreferencesData } from '../db/repositories/preferences.js';
import { users, type UserRecord } from '../db/repositories/users.js';
import { AppError } from '../errors.js';
import { toPreferencesDto, toProfileDto } from './dto.js';

export function getProfile(user: UserRecord): Profile {
  return toProfileDto(user);
}

export function updateProfile(db: Db, userId: string, input: z.infer<typeof UpdateProfileSchema>, now: Date): Profile {
  const updated = users.updateDisplayName(db, userId, input.displayName, now.toISOString());
  if (!updated) {
    throw new AppError('not_found', 404, 'Account not found');
  }
  const user = users.findById(db, userId);
  if (!user) {
    throw new AppError('not_found', 404, 'Account not found');
  }
  return toProfileDto(user);
}

export function getPreferences(db: Db, userId: string): Preferences {
  const stored = preferences.findByUserId(db, userId);
  if (!stored) {
    // Preferences are created with the account; a missing row means the account is broken.
    throw new AppError('preferences_not_found', 500, 'User preferences are missing');
  }
  return toPreferencesDto(stored);
}

/**
 * Applies a partial preferences update. Scalar settings and list values change in one
 * transaction; only the fields present in the request body are touched.
 */
export function updatePreferences(db: Db, userId: string, input: UpdatePreferencesInput, now: Date): Preferences {
  const current = preferences.findByUserId(db, userId);
  if (!current) {
    throw new AppError('preferences_not_found', 500, 'User preferences are missing');
  }

  const next: PreferencesData = { ...current };
  if (input.timezone !== undefined) next.timezone = input.timezone;
  if (input.locale !== undefined) next.locale = input.locale;
  if (input.theme !== undefined) next.theme = input.theme;
  if (input.city !== undefined) next.city = input.city;
  if (input.dietaryRestrictions !== undefined) next.dietaryRestrictions = [...input.dietaryRestrictions];
  if (input.allergies !== undefined) next.allergies = [...input.allergies];
  if (input.aiConsent !== undefined) next.aiConsent = input.aiConsent;
  if (input.memoryEnabled !== undefined) next.memoryEnabled = input.memoryEnabled;

  const nowIso = now.toISOString();
  withTransaction(db, () => {
    preferences.update(db, userId, input, nowIso);
  });

  return toPreferencesDto(next);
}
