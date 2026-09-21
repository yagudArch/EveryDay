import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Password and session-token cryptography.
 *
 * Passwords: async scrypt with a unique random salt per password. The stored string is
 *   `scrypt$N$r$p$<salt base64>$<derived key base64>`
 * so parameters travel with the hash and can be raised later without a migration.
 *
 * Sessions: opaque, cryptographically random bearer tokens (32 bytes, base64url). Only the
 * SHA-256 hash is persisted — the database never contains a usable token. This is a
 * deliberate Foundation decision to avoid JWT/refresh-token complexity.
 */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } satisfies ScryptOptions;
const DERIVED_KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PASSWORD_SCHEME = 'scrypt';

export const SESSION_TOKEN_BYTES = 32;

/**
 * Byte length of out-of-band auth tokens (email verification, password reset). 32 random
 * bytes encoded as base64url yield a 43-character opaque string, comfortably within the
 * contract's 32..512 bound. Like sessions, only the SHA-256 hash is ever persisted.
 */
export const AUTH_TOKEN_BYTES = 32;

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, DERIVED_KEY_LENGTH, SCRYPT_PARAMS);
  return [
    PASSWORD_SCHEME,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6) return false;
  const [scheme, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  if (scheme !== PASSWORD_SCHEME || !nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) return false;

  const N = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const expected = Buffer.from(hashRaw, 'base64');
  if (expected.length === 0) return false;

  const derived = await scryptAsync(password, Buffer.from(saltRaw, 'base64'), expected.length, {
    N,
    r,
    p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

let dummyHashPromise: Promise<string> | null = null;

/**
 * Hash used to equalise work when the submitted email does not exist, so login timing does
 * not reveal whether an account exists. Computed once per process.
 */
export function unknownAccountHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(24).toString('base64url'));
  return dummyHashPromise;
}

export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Generates an opaque, out-of-band auth token (email verification / password reset). */
export function generateAuthToken(): string {
  return randomBytes(AUTH_TOKEN_BYTES).toString('base64url');
}

/**
 * Hashes an out-of-band auth token for storage/lookup. Same SHA-256 construction as
 * session tokens: only the digest is persisted, never the token itself.
 */
export function hashAuthToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
