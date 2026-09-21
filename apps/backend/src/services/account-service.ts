import type {
  AccountExport,
  DeleteAccountInput,
  Preferences,
  Profile,
  UpdatePreferencesInput,
  UpdateProfileSchema,
} from '@everyday/contracts';
import type { z } from 'zod';
import { verifyPassword } from '../auth/crypto.js';
import { withTransaction, type Db } from '../db/connection.js';
import { preferences, type PreferencesData } from '../db/repositories/preferences.js';
import { goals, memory } from '../db/repositories/profile-data.js';
import { users, type UserRecord } from '../db/repositories/users.js';
import { AppError } from '../errors.js';
import { readSubscription } from './context-service.js';
import { toGoalDto, toMemoryFactDto, toPreferencesDto, toProfileDto } from './dto.js';

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

/**
 * Full account data export (GDPR-style portability). Contains only real, stored data owned by
 * the principal: profile, preferences, user-authored goals, confirmed memory facts and the
 * computed subscription entitlement. Domain modules not yet implemented are omitted, never
 * faked. Memory is included regardless of the memoryEnabled flag — an export is the user's own
 * complete copy of their data, not the surfaced day context.
 */
export function exportAccount(db: Db, user: UserRecord, now: Date): AccountExport {
  const stored = preferences.findByUserId(db, user.id);
  if (!stored) {
    throw new AppError('preferences_not_found', 500, 'User preferences are missing');
  }
  return {
    generatedAt: now.toISOString(),
    profile: toProfileDto(user),
    preferences: toPreferencesDto(stored),
    goals: goals.listByUser(db, user.id).map(toGoalDto),
    memory: memory.listByUser(db, user.id).map(toMemoryFactDto),
    subscription: readSubscription(db, user, now),
  };
}

/**
 * Irreversibly deletes the account. The current password is required as an explicit
 * confirmation and verified against the stored hash before anything is removed; a wrong
 * password is a 401 and deletes nothing. On success the single `users` row delete cascades
 * (FK ON DELETE CASCADE) to every owned table, which also removes all session rows and thereby
 * revokes every session. Password verification runs outside the transaction (scrypt is slow).
 */
export async function deleteAccount(db: Db, user: UserRecord, input: DeleteAccountInput): Promise<void> {
  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('invalid_credentials', 401, 'Invalid password');
  }

  const removed = withTransaction(db, () => users.deleteById(db, user.id));
  if (!removed) {
    // The authenticated user's row vanished between auth and delete; treat as already gone.
    throw new AppError('not_found', 404, 'Account not found');
  }
}
