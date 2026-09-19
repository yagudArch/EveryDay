import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProfileSchema, TodayContextSchema, routes } from '@everyday/contracts';
import { closeDatabase, getRow, openDatabase, runStatement } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { bearer, createHarness, openInspector, registerUser, TEST_PASSWORD } from './helpers.js';

 describe('Foundation audit', () => {
  it('persists profile, session, preferences and trial across reopening the database', async () => {
    const first = await createHarness();
    try {
      const user = await registerUser(first.app);
      const patch = await first.app.inject({ method: 'PATCH', url: routes.me, headers: bearer(user.token), payload: { displayName: '  Updated  ' } });
      expect(patch.statusCode).toBe(200);
      expect(ProfileSchema.parse(patch.json()).displayName).toBe('Updated');
      const subscription = await first.app.inject({ method: 'GET', url: routes.subscription, headers: bearer(user.token) });
      await first.app.close();
      const second = await createHarness({ databasePath: first.databasePath });
      try {
        const me = await second.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) });
        expect(me.statusCode).toBe(200);
        expect(ProfileSchema.parse(me.json()).displayName).toBe('Updated');
        const after = await second.app.inject({ method: 'GET', url: routes.subscription, headers: bearer(user.token) });
        expect(after.json()).toEqual(subscription.json());
        for (const payload of [{ displayName: '' }, { displayName: 'x'.repeat(81) }, { displayName: 'Valid', email: 'changed@example.test' }]) {
          expect((await second.app.inject({ method: 'PATCH', url: routes.me, headers: bearer(user.token), payload })).statusCode).toBe(400);
        }
      } finally {
        await second.cleanup();
      }
    } finally {
      await first.cleanup();
    }
  });

  it('rolls back schema and migration bookkeeping after invalid SQL', () => {
    const dir = mkdtempSync(join(tmpdir(), 'everyday-rollback-'));
    const db = openDatabase(':memory:');
    try {
      writeFileSync(join(dir, '0001_failure.sql'), 'CREATE TABLE partial (id TEXT); INVALID SQL;');
      expect(() => runMigrations(db, dir)).toThrow();
      expect(getRow(db, "SELECT name FROM sqlite_master WHERE name = 'partial'")).toBeUndefined();
      expect(getRow(db, 'SELECT COUNT(*) AS n FROM schema_migrations')).toMatchObject({ n: 0 });
    } finally {
      closeDatabase(db);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rolls back registration if subscription creation fails', async () => {
    const harness = await createHarness();
    const db = openInspector(harness.databasePath);
    try {
      db.exec("CREATE TRIGGER fail_subscription BEFORE INSERT ON subscriptions BEGIN SELECT RAISE(ABORT, 'test failure'); END");
      const response = await harness.app.inject({ method: 'POST', url: routes.register, payload: { email: 'rollback@example.test', password: TEST_PASSWORD, displayName: 'Rollback', timezone: 'UTC' } });
      expect(response.statusCode).toBe(500);
      for (const table of ['users', 'user_preferences', 'user_preference_values', 'subscriptions', 'sessions']) {
        expect(getRow(db, `SELECT COUNT(*) AS n FROM ${table}`)).toMatchObject({ n: 0 });
      }
    } finally {
      closeDatabase(db);
      await harness.cleanup();
    }
  });

  it('isolates stored goals and memory and respects the memory opt-in', async () => {
    const harness = await createHarness();
    const db = openInspector(harness.databasePath);
    try {
      const alpha = await registerUser(harness.app);
      const beta = await registerUser(harness.app);
      const at = harness.clock.now.toISOString();
      runStatement(db, 'INSERT INTO user_goals (id,user_id,type,created_at,updated_at) VALUES (?,?,?,?,?)', [randomUUID(), alpha.userId, 'maintain', at, at]);
      runStatement(db, 'INSERT INTO user_memory (id,user_id,fact,source,created_at,updated_at) VALUES (?,?,?,?,?,?)', [randomUUID(), alpha.userId, 'User confirmed test fact', 'user_confirmed', at, at]);
      const today = async (token: string) => {
        const response = await harness.app.inject({ method: 'GET', url: routes.today, headers: bearer(token) });
        expect(response.statusCode).toBe(200);
        return TodayContextSchema.parse(response.json());
      };
      expect((await today(alpha.token)).memory).toEqual([]);
      expect((await today(alpha.token)).goals).toHaveLength(1);
      expect((await today(beta.token)).goals).toEqual([]);
      for (const user of [alpha, beta]) {
        expect((await harness.app.inject({ method: 'PATCH', url: routes.preferences, headers: bearer(user.token), payload: { memoryEnabled: true } })).statusCode).toBe(200);
      }
      expect((await today(alpha.token)).memory).toHaveLength(1);
      expect((await today(beta.token)).memory).toEqual([]);
    } finally {
      closeDatabase(db);
      await harness.cleanup();
    }
  });

  it.each(['active', 'grace', 'cancelled'])('expires %s at the exact paid-period boundary', async (status) => {
    const harness = await createHarness();
    const db = openInspector(harness.databasePath);
    try {
      const user = await registerUser(harness.app);
      const end = new Date(harness.clock.now.getTime() + 1000).toISOString();
      runStatement(db, 'UPDATE subscriptions SET status = ?, current_period_ends_at = ? WHERE user_id = ?', [status, end, user.userId]);
      const subscription = async () => {
        const response = await harness.app.inject({ method: 'GET', url: routes.subscription, headers: bearer(user.token) });
        expect(response.statusCode).toBe(200);
        return response.json();
      };
      harness.clock.advance(999);
      expect(await subscription()).toMatchObject({ status, premium: true });
      harness.clock.advance(1);
      expect(await subscription()).toMatchObject({ status: 'expired_subscription', premium: false });
    } finally {
      closeDatabase(db);
      await harness.cleanup();
    }
  });
});
