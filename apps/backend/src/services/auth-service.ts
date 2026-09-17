import { randomUUID } from 'node:crypto';
import type { AuthResponse, LoginInput, RegisterInput } from '@everyday/contracts';
import { isUniqueViolation, withTransaction, type Db } from '../db/connection.js';
import { preferences, type PreferencesData } from '../db/repositories/preferences.js';
import { sessions } from '../db/repositories/sessions.js';
import { users, type UserRecord } from '../db/repositories/users.js';
import { AppError } from '../errors.js';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  unknownAccountHash,
  verifyPassword,
} from '../auth/crypto.js';
import { ensureSubscription } from './subscription-service.js';
import { toProfileDto } from './dto.js';

/** Opaque session lifetime. Revocation and expiry are enforced on every authenticated request. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Account defaults. Nothing here is invented user data: goals and memory start empty. */
export const DEFAULT_PREFERENCES: Omit<PreferencesData, 'timezone'> = {
  locale: 'ru',
  theme: 'system',
  city: null,
  dietaryRestrictions: [],
  allergies: [],
  aiConsent: false,
  memoryEnabled: false,
};

export interface IssuedSession {
  token: string;
  expiresAt: string;
  sessionId: string;
}

export function createSession(db: Db, userId: string, now: Date): IssuedSession {
  const token = generateSessionToken();
  const sessionId = randomUUID();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  sessions.insert(db, {
    id: sessionId,
    userId,
    tokenHash: hashSessionToken(token),
    createdAt: now.toISOString(),
    expiresAt,
  });
  return { token, expiresAt, sessionId };
}

/**
 * Registers an account. The user row, default preferences and the 7-day trial are written in
 * a single transaction, together with the first session — either everything exists or nothing does.
 * Password hashing happens before the transaction so no lock is held during scrypt work.
 */
export async function register(db: Db, input: RegisterInput, now: Date): Promise<AuthResponse> {
  const email = input.email.toLowerCase();
  if (users.findByEmail(db, email)) {
    throw new AppError('email_taken', 409, 'Email is already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const createdAt = now.toISOString();

  try {
    return withTransaction(db, () => {
      const user: UserRecord = {
        id: users.newId(),
        email,
        displayName: input.displayName,
        passwordHash,
        createdAt,
        updatedAt: createdAt,
      };
      users.insert(db, user);

      preferences.insertDefaults(db, user.id, { ...DEFAULT_PREFERENCES, timezone: input.timezone }, createdAt);
      ensureSubscription(db, user, now);

      const session = createSession(db, user.id, now);
      return { token: session.token, expiresAt: session.expiresAt, user: toProfileDto(user) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('email_taken', 409, 'Email is already registered');
    }
    throw error;
  }
}

/**
 * Verifies credentials and issues a session. Failures are indistinguishable for unknown
 * email and wrong password (same code, same message, comparable work via the dummy hash).
 */
export async function login(db: Db, input: LoginInput, now: Date): Promise<AuthResponse> {
  const user = users.findByEmail(db, input.email);

  if (!user) {
    await verifyPassword(input.password, await unknownAccountHash());
    throw new AppError('invalid_credentials', 401, 'Invalid email or password');
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('invalid_credentials', 401, 'Invalid email or password');
  }

  const session = withTransaction(db, () => createSession(db, user.id, now));
  return { token: session.token, expiresAt: session.expiresAt, user: toProfileDto(user) };
}

/** Revokes only the current session. */
export function logout(db: Db, sessionId: string, now: Date): void {
  sessions.revoke(db, sessionId, now.toISOString());
}
