import { createApp } from './app.js';
import { readEnv } from './env.js';

/**
 * Backend entrypoint: `npm run dev -w @everyday/backend` (tsx) or
 * `npm run start -w @everyday/backend` (compiled dist).
 *
 * Binds to loopback by default; HTTPS termination, staging secrets and multi-instance
 * deployment are explicitly out of Foundation scope.
 */
async function main(): Promise<void> {
  const env = readEnv();
  const app = await createApp({ databasePath: env.databasePath });

  const shutdown = (signal: string): void => {
    app.log.info({ signal }, 'shutting down');
    app
      .close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await app.listen({ host: env.host, port: env.port });
  app.log.info({ host: env.host, port: env.port, databasePath: env.databasePath }, 'backend listening');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown startup error';
  process.stderr.write(`backend failed to start: ${message}\n`);
  process.exit(1);
});
