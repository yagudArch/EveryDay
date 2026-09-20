import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { createRequireAuth } from './auth/principal.js';
import type { AppContext } from './context.js';
import { closeDatabase, openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { AppError, registerErrorHandling } from './errors.js';
import { readEnv, type Env } from './env.js';
import { InMemoryRateLimiter } from './rate-limiter.js';
import { buildOpenApi, registerOpenApiRoute } from './openapi.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerAiRoutes } from './routes/ai.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerNutritionRoutes } from './routes/nutrition.js';
import { createAiGateway, type AiGateway } from './services/ai-service.js';

/**
 * Options for {@link createApp}. The exact signature is part of the Foundation contract:
 *
 * ```ts
 * createApp({
 *   databasePath: string,                       // file path or ':memory:' (tests)
 *   migrationsDir?: string,                     // defaults to <repo>/database/migrations
 *   now?: () => Date,                           // injectable clock (defaults to real time)
 *   logger?: boolean,                           // false silences logs in tests
 *   env?: Partial<Env>,                         // config overrides for tests
 *   rateLimit?: { enabled; max; windowMs; authMax; maxEntries? } | false,
 *   ai?: AiGateway,                             // test/provider seam (defaults to disabled provider)
 * }): Promise<FastifyInstance>
 * ```
 *
 * The returned instance is a normal Fastify app: call `app.inject({...})` in tests and
 * `app.listen(...)` in production. The database connection it opened is closed by `app.close()`.
 */
export interface CreateAppOptions {
  databasePath: string;
  migrationsDir?: string;
  now?: () => Date;
  logger?: boolean;
  env?: Partial<Env>;
  rateLimit?: { enabled: boolean; max: number; windowMs: number; authMax: number; maxEntries?: number } | false;
  ai?: AiGateway;
}

/** Never log credentials, session tokens or free-form user text. */
const REDACTED_LOG_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.email',
  'req.body.text',
  'req.body.dayNote',
  'req.body.fact',
];

function resolveLogger(explicit: boolean | undefined, env: Env): FastifyServerOptions['logger'] {
  if (explicit !== undefined) return explicit;
  if (env.nodeEnv === 'test') return false;
  return {
    level: env.logLevel,
    redact: { paths: REDACTED_LOG_PATHS, censor: '[redacted]' },
  } as unknown as FastifyServerOptions['logger'];
}

export async function createApp(options: CreateAppOptions): Promise<FastifyInstance> {
  const env = readEnv(process.env, options.env ?? {});

  if (options.rateLimit === false) {
    env.rateLimit = { ...env.rateLimit, enabled: false };
  } else if (options.rateLimit) {
    const override = options.rateLimit;
    env.rateLimit = {
      enabled: override.enabled,
      max: override.max,
      authMax: override.authMax,
      windowMs: override.windowMs,
      maxEntries: override.maxEntries ?? env.rateLimit.maxEntries,
    };
  }

  const now = options.now ?? (() => new Date());

  // Migrations run before the server accepts traffic; the schema is never created implicitly.
  const db = openDatabase(options.databasePath);
  runMigrations(db, options.migrationsDir ?? env.migrationsDir, now);

  const app = Fastify({
    logger: resolveLogger(options.logger, env),
    genReqId: () => randomUUID(),
    trustProxy: env.trustProxy,
    bodyLimit: 64 * 1024,
  });

  registerErrorHandling(app);
  app.removeContentTypeParser('text/plain');

  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cors, {
    // Explicit allowlist from configuration. `*` only when the operator opts in.
    origin: env.allowAnyOrigin ? true : [...env.corsOrigins],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-request-id'],
    credentials: false,
    maxAge: 600,
  });

  const globalLimiter = new InMemoryRateLimiter({
    max: env.rateLimit.max,
    windowMs: env.rateLimit.windowMs,
    maxEntries: env.rateLimit.maxEntries,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    if (!env.rateLimit.enabled) return;
    const decision = globalLimiter.check(`global:${request.ip}`, now().getTime());
    if (!decision.allowed) {
      reply.header('retry-after', String(decision.retryAfterSeconds));
      throw new AppError('rate_limited', 429, 'Too many requests');
    }
  });

  const aiLoad = options.ai ? null : await createAiGateway();
  if (aiLoad?.warning) app.log.warn(aiLoad.warning);

  const context: AppContext = {
    db,
    now,
    env,
    ai: options.ai ?? aiLoad!.gateway,
    requireAuth: createRequireAuth(db, now),
  };

  registerHealthRoutes(app, context);
  registerAuthRoutes(app, context);
  registerAccountRoutes(app, context);
  registerAiRoutes(app, context);
  registerNutritionRoutes(app, context);
  registerOpenApiRoute(app);

  app.addHook('onClose', async () => {
    closeDatabase(db);
  });

  return app;
}

export { buildOpenApi };
export type { AiGateway };
