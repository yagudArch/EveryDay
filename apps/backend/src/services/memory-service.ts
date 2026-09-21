import { randomUUID } from 'node:crypto';
import type { CreateMemoryFactInput, MemoryDeleteAll, MemoryFact, MemoryList } from '@everyday/contracts';
import { withTransaction, type Db } from '../db/connection.js';
import { memory } from '../db/repositories/profile-data.js';
import { AppError } from '../errors.js';
import { toMemoryFactDto } from './dto.js';

/**
 * Controlled AI memory. Every operation is scoped to the session principal's userId — the
 * caller can never address another user's facts. Facts are always `source: 'user_confirmed'`
 * (the AI never writes memory without explicit confirmation).
 *
 * Storing/reading facts is independent of the `memoryEnabled` preference: that flag governs
 * whether memory is *surfaced* into the day context, not whether the user can manage their
 * own stored facts. Turning memory off does not erase facts — that is DELETE /memory.
 */
export function listMemory(db: Db, userId: string): MemoryList {
  return { facts: memory.listByUser(db, userId).map(toMemoryFactDto) };
}

/** Stores a new user-confirmed fact and returns it. */
export function addMemoryFact(db: Db, userId: string, input: CreateMemoryFactInput, now: Date): MemoryFact {
  const id = randomUUID();
  const createdAt = now.toISOString();
  withTransaction(db, () => {
    memory.insert(db, { id, userId, fact: input.fact, createdAt });
  });
  return { id, fact: input.fact, source: 'user_confirmed', createdAt };
}

/**
 * Deletes one owned fact. A fact that does not exist or belongs to another user is a 404 —
 * the ownership predicate is in the SQL, so cross-user deletion is impossible.
 */
export function deleteMemoryFact(db: Db, userId: string, id: string): void {
  const removed = withTransaction(db, () => memory.deleteOwnedById(db, userId, id));
  if (!removed) {
    throw new AppError('not_found', 404, 'Memory fact not found');
  }
}

/** Erases every fact for the user and reports how many were removed. */
export function deleteAllMemory(db: Db, userId: string): MemoryDeleteAll {
  const deletedCount = withTransaction(db, () => memory.deleteAllForUser(db, userId));
  return { deletedCount };
}
