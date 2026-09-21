import { describe, expect, it } from 'vitest';
import {
  AccountExportSchema,
  ErrorResponseSchema,
  MemoryDeleteAllSchema,
  MemoryFactSchema,
  MemoryListSchema,
  memoryFactById,
  routes,
} from '@everyday/contracts';
import { getRow } from '../src/db/connection.js';
import {
  bearer,
  closeInspector,
  createHarness,
  jsonHeaders,
  openInspector,
  registerUser,
  TEST_PASSWORD,
} from './helpers.js';

/**
 * BCK-002: memory CRUD/delete-all, account export and irreversible account deletion.
 *
 * Cross-cutting guarantees under test:
 *  - ownership is derived only from the session principal (no client-supplied userId);
 *  - memory delete/read never crosses users, even with a guessed id;
 *  - account deletion requires the current password, is irreversible, cascades to owned data
 *    and revokes every session;
 *  - export contains only real stored data (no fabricated domain modules).
 */
describe('memory & account privacy (BCK-002)', () => {
  describe('memory CRUD', () => {
    it('creates, lists and returns user-confirmed facts owned by the principal', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);

        const empty = await harness.app.inject({ method: 'GET', url: routes.memory, headers: bearer(user.token) });
        expect(empty.statusCode).toBe(200);
        expect(MemoryListSchema.parse(empty.json()).facts).toEqual([]);

        const created = await harness.app.inject({
          method: 'POST',
          url: routes.memory,
          headers: jsonHeaders(user.token),
          payload: { fact: 'Пользователь любит бег по утрам' },
        });
        expect(created.statusCode).toBe(201);
        const fact = MemoryFactSchema.parse(created.json());
        expect(fact.fact).toBe('Пользователь любит бег по утрам');
        expect(fact.source).toBe('user_confirmed');

        const listed = await harness.app.inject({ method: 'GET', url: routes.memory, headers: bearer(user.token) });
        const facts = MemoryListSchema.parse(listed.json()).facts;
        expect(facts).toHaveLength(1);
        expect(facts[0]?.id).toBe(fact.id);
      } finally {
        await harness.cleanup();
      }
    });

    it('rejects unknown fields and empty facts with a 400', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);

        const empty = await harness.app.inject({
          method: 'POST',
          url: routes.memory,
          headers: jsonHeaders(user.token),
          payload: { fact: '   ' },
        });
        expect(empty.statusCode).toBe(400);

        const stray = await harness.app.inject({
          method: 'POST',
          url: routes.memory,
          headers: jsonHeaders(user.token),
          payload: { fact: 'ok', userId: 'someone-else' },
        });
        expect(stray.statusCode).toBe(400);
      } finally {
        await harness.cleanup();
      }
    });

    it('deletes a single owned fact (204) and reports 404 afterwards', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        const created = await harness.app.inject({
          method: 'POST',
          url: routes.memory,
          headers: jsonHeaders(user.token),
          payload: { fact: 'temporary' },
        });
        const fact = MemoryFactSchema.parse(created.json());

        const deleted = await harness.app.inject({
          method: 'DELETE',
          url: memoryFactById(fact.id),
          headers: bearer(user.token),
        });
        expect(deleted.statusCode).toBe(204);
        expect(deleted.body).toBe('');

        const again = await harness.app.inject({
          method: 'DELETE',
          url: memoryFactById(fact.id),
          headers: bearer(user.token),
        });
        expect(again.statusCode).toBe(404);
        expect(ErrorResponseSchema.parse(again.json()).error.code).toBe('not_found');
      } finally {
        await harness.cleanup();
      }
    });

    it('delete-all removes every fact and returns the count', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        for (const text of ['a', 'b', 'c']) {
          await harness.app.inject({
            method: 'POST',
            url: routes.memory,
            headers: jsonHeaders(user.token),
            payload: { fact: text },
          });
        }

        const cleared = await harness.app.inject({ method: 'DELETE', url: routes.memory, headers: bearer(user.token) });
        expect(cleared.statusCode).toBe(200);
        expect(MemoryDeleteAllSchema.parse(cleared.json()).deletedCount).toBe(3);

        const listed = await harness.app.inject({ method: 'GET', url: routes.memory, headers: bearer(user.token) });
        expect(MemoryListSchema.parse(listed.json()).facts).toEqual([]);

        // Idempotent: deleting again removes nothing.
        const again = await harness.app.inject({ method: 'DELETE', url: routes.memory, headers: bearer(user.token) });
        expect(MemoryDeleteAllSchema.parse(again.json()).deletedCount).toBe(0);
      } finally {
        await harness.cleanup();
      }
    });

    it('requires authentication for every memory endpoint', async () => {
      const harness = await createHarness();
      try {
        for (const call of [
          harness.app.inject({ method: 'GET', url: routes.memory }),
          harness.app.inject({ method: 'POST', url: routes.memory, headers: jsonHeaders(), payload: { fact: 'x' } }),
          harness.app.inject({ method: 'DELETE', url: routes.memory }),
          harness.app.inject({ method: 'DELETE', url: memoryFactById('any') }),
        ]) {
          expect((await call).statusCode).toBe(401);
        }
      } finally {
        await harness.cleanup();
      }
    });
  });

  describe('memory ownership', () => {
    it('never lets one user read or delete another user\'s facts', async () => {
      const harness = await createHarness();
      try {
        const alice = await registerUser(harness.app, { email: 'alice@example.test' });
        const bob = await registerUser(harness.app, { email: 'bob@example.test' });

        const created = await harness.app.inject({
          method: 'POST',
          url: routes.memory,
          headers: jsonHeaders(alice.token),
          payload: { fact: 'секрет Алисы' },
        });
        const aliceFact = MemoryFactSchema.parse(created.json());

        // Bob cannot see Alice's facts.
        const bobList = await harness.app.inject({ method: 'GET', url: routes.memory, headers: bearer(bob.token) });
        expect(MemoryListSchema.parse(bobList.json()).facts).toEqual([]);

        // Bob cannot delete Alice's fact even with the exact id — it is a 404 for him.
        const bobDelete = await harness.app.inject({
          method: 'DELETE',
          url: memoryFactById(aliceFact.id),
          headers: bearer(bob.token),
        });
        expect(bobDelete.statusCode).toBe(404);

        // Bob's delete-all does not touch Alice's data.
        await harness.app.inject({ method: 'DELETE', url: routes.memory, headers: bearer(bob.token) });
        const aliceList = await harness.app.inject({ method: 'GET', url: routes.memory, headers: bearer(alice.token) });
        expect(MemoryListSchema.parse(aliceList.json()).facts).toHaveLength(1);
      } finally {
        await harness.cleanup();
      }
    });
  });

  describe('memory vs. the memoryEnabled preference', () => {
    it('stores and manages facts regardless of memoryEnabled, while the day context hides them when disabled', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        await harness.app.inject({
          method: 'POST',
          url: routes.memory,
          headers: jsonHeaders(user.token),
          payload: { fact: 'факт при выключенной памяти' },
        });

        // memoryEnabled defaults to false; the fact is still stored and listable via /memory.
        const listed = await harness.app.inject({ method: 'GET', url: routes.memory, headers: bearer(user.token) });
        expect(MemoryListSchema.parse(listed.json()).facts).toHaveLength(1);

        // ...but the surfaced day context does not include it while memory is disabled.
        const contextOff = await harness.app.inject({ method: 'GET', url: routes.today, headers: bearer(user.token) });
        expect(contextOff.json().memory).toEqual([]);

        // Enabling memory surfaces it in the context; the stored fact is unchanged.
        await harness.app.inject({
          method: 'PATCH',
          url: routes.preferences,
          headers: jsonHeaders(user.token),
          payload: { memoryEnabled: true },
        });
        const contextOn = await harness.app.inject({ method: 'GET', url: routes.today, headers: bearer(user.token) });
        expect(contextOn.json().memory).toHaveLength(1);
      } finally {
        await harness.cleanup();
      }
    });
  });

  describe('account export', () => {
    it('exports only real owned data and never fakes unimplemented modules', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        await harness.app.inject({
          method: 'POST',
          url: routes.memory,
          headers: jsonHeaders(user.token),
          payload: { fact: 'экспортируемый факт' },
        });

        const exported = await harness.app.inject({
          method: 'GET',
          url: routes.accountExport,
          headers: bearer(user.token),
        });
        expect(exported.statusCode).toBe(200);
        const data = AccountExportSchema.parse(exported.json());
        expect(data.profile.id).toBe(user.userId);
        expect(data.profile.email).toBe(user.email);
        // Memory is part of the user's own data export even though memoryEnabled defaults false.
        expect(data.memory).toHaveLength(1);
        // Nothing seeded: goals start empty and no invented modules are present.
        expect(data.goals).toEqual([]);
        expect(data.subscription.status).toBe('trial');
        expect(Object.keys(data)).toEqual(
          expect.arrayContaining(['generatedAt', 'profile', 'preferences', 'goals', 'memory', 'subscription']),
        );
        // The export shape is strict — no unavailable/faked domain module keys leaked in.
        expect(exported.body).not.toContain('not_implemented');
      } finally {
        await harness.cleanup();
      }
    });

    it('requires authentication', async () => {
      const harness = await createHarness();
      try {
        const anon = await harness.app.inject({ method: 'GET', url: routes.accountExport });
        expect(anon.statusCode).toBe(401);
      } finally {
        await harness.cleanup();
      }
    });
  });

  describe('account deletion', () => {
    it('rejects deletion with a wrong password and deletes nothing (401)', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);

        const denied = await harness.app.inject({
          method: 'DELETE',
          url: routes.account,
          headers: jsonHeaders(user.token),
          payload: { password: 'not-the-password' },
        });
        expect(denied.statusCode).toBe(401);
        expect(ErrorResponseSchema.parse(denied.json()).error.code).toBe('invalid_credentials');

        // The session and account still work.
        const me = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) });
        expect(me.statusCode).toBe(200);
      } finally {
        await harness.cleanup();
      }
    });

    it('deletes the account with the correct password, revokes sessions and cascades owned data', async () => {
      const harness = await createHarness();
      try {
        const user = await registerUser(harness.app);
        // Seed owned rows across several tables so cascade is meaningfully exercised.
        await harness.app.inject({
          method: 'POST',
          url: routes.memory,
          headers: jsonHeaders(user.token),
          payload: { fact: 'до удаления' },
        });
        await harness.app.inject({
          method: 'PATCH',
          url: routes.today,
          headers: jsonHeaders(user.token),
          payload: { dayNote: 'заметка дня' },
        });

        const deleted = await harness.app.inject({
          method: 'DELETE',
          url: routes.account,
          headers: jsonHeaders(user.token),
          payload: { password: TEST_PASSWORD },
        });
        expect(deleted.statusCode).toBe(204);
        expect(deleted.body).toBe('');

        // Session is revoked: the previously valid bearer token no longer authenticates.
        const afterMe = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) });
        expect(afterMe.statusCode).toBe(401);

        // Login is impossible: the account is gone (indistinguishable invalid_credentials).
        const login = await harness.app.inject({
          method: 'POST',
          url: routes.login,
          payload: { email: user.email, password: TEST_PASSWORD },
        });
        expect(login.statusCode).toBe(401);

        // Physically verify the cascade: no owned rows remain in any table.
        const inspector = openInspector(harness.databasePath);
        try {
          const tables = ['users', 'sessions', 'user_preferences', 'user_preference_values', 'user_memory', 'user_goals', 'daily_context', 'subscriptions'];
          for (const table of tables) {
            const row = getRow<{ total: number }>(
              inspector,
              `SELECT COUNT(*) AS total FROM ${table} WHERE ${table === 'users' ? 'id' : 'user_id'} = ?`,
              [user.userId],
            );
            expect(row?.total ?? 0).toBe(0);
          }
        } finally {
          closeInspector(inspector);
        }
      } finally {
        await harness.cleanup();
      }
    });

    it('deletes one account without affecting another user (isolation)', async () => {
      const harness = await createHarness();
      try {
        const alice = await registerUser(harness.app, { email: 'alice2@example.test' });
        const bob = await registerUser(harness.app, { email: 'bob2@example.test' });
        await harness.app.inject({
          method: 'POST',
          url: routes.memory,
          headers: jsonHeaders(bob.token),
          payload: { fact: 'факт Боба' },
        });

        const deleted = await harness.app.inject({
          method: 'DELETE',
          url: routes.account,
          headers: jsonHeaders(alice.token),
          payload: { password: TEST_PASSWORD },
        });
        expect(deleted.statusCode).toBe(204);

        // Bob is untouched: session works and his data survives.
        const bobMe = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(bob.token) });
        expect(bobMe.statusCode).toBe(200);
        const bobMemory = await harness.app.inject({ method: 'GET', url: routes.memory, headers: bearer(bob.token) });
        expect(MemoryListSchema.parse(bobMemory.json()).facts).toHaveLength(1);
      } finally {
        await harness.cleanup();
      }
    });

    it('requires authentication and a body', async () => {
      const harness = await createHarness();
      try {
        const anon = await harness.app.inject({
          method: 'DELETE',
          url: routes.account,
          headers: jsonHeaders(),
          payload: { password: TEST_PASSWORD },
        });
        expect(anon.statusCode).toBe(401);

        const user = await registerUser(harness.app);
        const noBody = await harness.app.inject({
          method: 'DELETE',
          url: routes.account,
          headers: jsonHeaders(user.token),
          payload: {},
        });
        expect(noBody.statusCode).toBe(400);
      } finally {
        await harness.cleanup();
      }
    });
  });
});
