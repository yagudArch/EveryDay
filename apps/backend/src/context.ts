import type { FastifyRequest } from 'fastify';
import type { Db } from './db/connection.js';
import type { Env } from './env.js';
import type { AiGateway } from './services/ai-service.js';

/** Explicit dependencies handed to every route module. No module reaches for globals. */
export interface AppContext {
  db: Db;
  /** Injectable clock: replayable in tests, authoritative for sessions, trial and the local day. */
  now: () => Date;
  env: Env;
  ai: AiGateway;
  /** Session authentication hook; attaches `request.principal` or throws 401. */
  requireAuth: (request: FastifyRequest) => Promise<void>;
}
