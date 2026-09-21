import type {
  Accepted,
  EmailVerificationStatus,
  RequestPasswordResetInput,
  ResetPasswordInput,
  RevokeAllSessions,
  VerifyEmailInput,
} from '@everyday/contracts';
import { withTransaction, type Db } from '../db/connection.js';
import { authTokens } from '../db/repositories/auth-tokens.js';
import { sessions } from '../db/repositories/sessions.js';
import { users } from '../db/repositories/users.js';
import { AppError } from '../errors.js';
import { generateAuthToken, hashAuthToken, hashPassword } from '../auth/crypto.js';
import type { TokenDeliverySink } from './token-delivery.js';

/** Out-of-band token lifetimes. Deliberately short: these authorise sensitive account changes. */
export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

const ACCEPTED: Accepted = { status: 'accepted' };

function verificationStatus(emailVerified: boolean, verificationSentAt: string | null): EmailVerificationStatus {
  return { emailVerified, verificationSentAt };
}

/**
 * Issues a fresh email-verification token for the authenticated user and delivers it out of
 * band. Any previous unconsumed verification tokens are invalidated first, so at most one is
 * ever live. An already-verified account is a no-op: no token is issued and none is sent.
 * The plaintext token is never persisted (only its hash) and never returned by the API.
 */
export async function requestEmailVerification(
  db: Db,
  delivery: TokenDeliverySink,
  userId: string,
  now: Date,
): Promise<EmailVerificationStatus> {
  const user = users.findById(db, userId);
  if (!user) {
    // The caller is authenticated, so this should not happen; treat a vanished user as 401.
    throw new AppError('invalid_session', 401, 'Session is invalid or expired');
  }
  if (user.emailVerified) {
    return verificationStatus(true, null);
  }

  const token = generateAuthToken();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFY_TTL_MS).toISOString();

  withTransaction(db, () => {
    authTokens.consumeAllForUser(db, user.id, 'email_verify', nowIso);
    authTokens.insert(db, {
      userId: user.id,
      purpose: 'email_verify',
      tokenHash: hashAuthToken(token),
      createdAt: nowIso,
      expiresAt,
    });
  });

  await delivery.deliver({ email: user.email, purpose: 'email_verify', token, expiresAt });
  return verificationStatus(false, nowIso);
}

/**
 * Confirms an email-verification token. The token must be unconsumed, unexpired and of the
 * right purpose; it is consumed atomically (single-use) before the account is marked verified.
 */
export function confirmEmailVerification(db: Db, input: VerifyEmailInput, now: Date): EmailVerificationStatus {
  const nowIso = now.toISOString();
  return withTransaction(db, () => {
    const record = authTokens.findRedeemable(db, 'email_verify', hashAuthToken(input.token), nowIso);
    if (!record || !authTokens.consume(db, record.id, nowIso)) {
      throw new AppError('invalid_token', 400, 'Token is invalid or expired');
    }
    users.markEmailVerified(db, record.userId, nowIso);
    const user = users.findById(db, record.userId);
    return verificationStatus(true, user?.emailVerifiedAt ?? nowIso);
  });
}

/**
 * Starts a password reset. Always returns an accepted-style result and never reveals whether
 * an account exists (no user enumeration): if the email is unknown, nothing is issued or sent,
 * but the response is identical. When the account exists, prior unconsumed reset tokens are
 * invalidated and a fresh one is delivered out of band.
 */
export async function requestPasswordReset(
  db: Db,
  delivery: TokenDeliverySink,
  input: RequestPasswordResetInput,
  now: Date,
): Promise<Accepted> {
  const user = users.findByEmail(db, input.email);
  if (!user) {
    return ACCEPTED;
  }

  const token = generateAuthToken();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS).toISOString();

  withTransaction(db, () => {
    authTokens.consumeAllForUser(db, user.id, 'password_reset', nowIso);
    authTokens.insert(db, {
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: hashAuthToken(token),
      createdAt: nowIso,
      expiresAt,
    });
  });

  await delivery.deliver({ email: user.email, purpose: 'password_reset', token, expiresAt });
  return ACCEPTED;
}

/**
 * Completes a password reset. The token is validated and consumed atomically; on success the
 * password hash is replaced and every session for the user is revoked, so a reset always logs
 * out existing sessions (an attacker's stolen session cannot survive the owner's reset).
 * Password hashing runs outside the transaction because scrypt is intentionally slow.
 */
export async function resetPassword(db: Db, input: ResetPasswordInput, now: Date): Promise<void> {
  const nowIso = now.toISOString();
  const passwordHash = await hashPassword(input.password);

  withTransaction(db, () => {
    const record = authTokens.findRedeemable(db, 'password_reset', hashAuthToken(input.token), nowIso);
    if (!record || !authTokens.consume(db, record.id, nowIso)) {
      throw new AppError('invalid_token', 400, 'Token is invalid or expired');
    }
    users.updatePasswordHash(db, record.userId, passwordHash, nowIso);
    // Any other outstanding reset tokens for this user are now moot.
    authTokens.consumeAllForUser(db, record.userId, 'password_reset', nowIso);
    sessions.revokeAllForUser(db, record.userId, nowIso);
  });
}

/** Revokes every active session for the user and reports how many were revoked. */
export function revokeAllSessions(db: Db, userId: string, now: Date): RevokeAllSessions {
  const revokedCount = withTransaction(db, () => sessions.revokeAllForUser(db, userId, now.toISOString()));
  return { revokedCount };
}
