import type { FastifyRequest } from 'fastify';
import type { Db } from '../db/connection.js';
import { users, type UserRecord } from '../db/repositories/users.js';
import { sessions } from '../db/repositories/sessions.js';
import { AppError } from '../errors.js';
import { hashSessionToken } from './crypto.js';

export interface Principal {
  userId: string;
  sessionId: string;
  user: UserRecord;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set only by the session authentication hook. Never derived from request input. */
    principal?: Principal;
  }
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer[ \t]+(\S+)$/i.exec(header.trim());
  const token = match?.[1];
  return token && token.length > 0 ? token : null;
}

/**
 * Resolves the request principal exclusively from the session bearer token.
 * A missing, unknown, revoked or expired session is a 401 — the client cannot
 * supply or override a user id anywhere.
 */
export function authenticate(db: Db, authorization: string | undefined, now: Date): Principal {
  const token = extractBearerToken(authorization);
  if (!token) {
    throw new AppError('unauthorized', 401, 'Authentication required');
  }

  const nowIso = now.toISOString();
  const session = sessions.findActiveByTokenHash(db, hashSessionToken(token), nowIso);
  if (!session) {
    throw new AppError('invalid_session', 401, 'Session is invalid or expired');
  }

  const user = users.findById(db, session.userId);
  if (!user) {
    // Session outlived its user row; treat as an invalid session rather than a server error.
    throw new AppError('invalid_session', 401, 'Session is invalid or expired');
  }

  sessions.touch(db, session.id, nowIso);
  return { userId: user.id, sessionId: session.id, user };
}

/** Hook factory used as a route `preHandler`; throws 401 through the error envelope. */
export function createRequireAuth(db: Db, now: () => Date): (request: FastifyRequest) => void {
  return (request) => {
    request.principal = authenticate(db, request.headers.authorization, now());
  };
}

/** Reads the principal set by the auth hook. */
export function requirePrincipal(request: FastifyRequest): Principal {
  const principal = request.principal;
  if (!principal) {
    throw new AppError('unauthorized', 401, 'Authentication required');
  }
  return principal;
}
