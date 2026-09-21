import type { AuthTokenPurpose } from '../db/repositories/auth-tokens.js';

/**
 * A single out-of-band delivery of an opaque auth token (email verification, password reset).
 * The plaintext token exists only in memory for the duration of this call — it is never
 * persisted (only its SHA-256 hash is) and never returned by the HTTP API.
 */
export interface TokenDelivery {
  email: string;
  purpose: AuthTokenPurpose;
  token: string;
  expiresAt: string;
}

/**
 * Seam for sending auth tokens to the user out of band. Foundation has no email transport
 * configured, so the default sink deliberately does nothing with the token: it must never be
 * logged or echoed. Production wires a real email sender here; tests inject a capturing double
 * to assert on the delivered token without it ever crossing the API boundary.
 */
export interface TokenDeliverySink {
  deliver(delivery: TokenDelivery): Promise<void> | void;
}

/**
 * Default sink: intentionally silent. It does NOT log the token (logging a credential would
 * defeat the point of hashing it at rest). When no email transport is configured, requests
 * still succeed with an accepted-style response so the API never reveals delivery state.
 */
export const noopTokenDelivery: TokenDeliverySink = {
  deliver(): void {
    // Intentionally empty: no transport configured, and the token must never be logged.
  },
};
