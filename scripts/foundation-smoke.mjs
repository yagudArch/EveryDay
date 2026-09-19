// Foundation integration smoke: real HTTP, compiled backend/AI, mobile client, temporary SQLite.
// Run after npm run build: node --import tsx --test scripts/foundation-smoke.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from '../apps/backend/dist/app.js';
import { createAiGateway } from '../apps/backend/dist/services/ai-service.js';
import { AIService, DisabledProvider } from '@everyday/ai';
import { HttpClient } from '../apps/mobile/src/api/client.ts';
import { createEverydayApi } from '../apps/mobile/src/api/endpoints.ts';

function client(baseUrl) {
  let token = null;
  return {
    setToken(value) { token = value; },
    api: createEverydayApi(new HttpClient({
      baseUrl, fetchImpl: fetch, getToken: () => token,
      onUnauthorized: () => { token = null; },
    })),
  };
}

async function withServer(ai, work) {
  const directory = mkdtempSync(join(tmpdir(), 'everyday-foundation-smoke-'));
  const databasePath = join(directory, 'smoke.db');
  let app;
  const start = async () => {
    app = await createApp({ databasePath, ai, logger: false, env: { nodeEnv: 'test' }, rateLimit: false });
    return app.listen({ host: '127.0.0.1', port: 0 });
  };
  try {
    await work(await start(), async () => { await app.close(); return start(); });
  } finally {
    try { await app?.close(); } finally { rmSync(directory, { recursive: true, force: true }); }
  }
}

const credentials = (name) => ({ email: `${name}@example.test`, password: 'smoke-test-password-only' });
const register = (api, name) => api.register({ ...credentials(name), displayName: name, timezone: 'Europe/Riga' });

test('compiled default AI + mobile HTTP auth, isolation, persistence and health', async () => {
  const loaded = await createAiGateway();
  assert.equal(loaded.warning, null, 'AI package must load, not silently degrade to unavailable');
  assert.equal(loaded.gateway.getStatus().provider, 'disabled');
  await withServer(undefined, async (baseUrl, restart) => {
    const a = client(baseUrl);
    const b = client(baseUrl);
    assert.deepEqual(await a.api.health(), { status: 'ok', database: 'ok' });
    await assert.rejects(a.api.me(), { status: 401 });
    const alice = await register(a.api, 'qa-alice');
    a.setToken(alice.token);
    const bob = await register(b.api, 'qa-bob');
    b.setToken(bob.token);
    assert.notEqual(alice.user.id, bob.user.id);
    await a.api.updateDayNote({ dayNote: 'QA private note' });
    await a.api.updatePreferences({ city: 'Riga', aiConsent: true });
    assert.equal((await b.api.todayContext()).dayNote, null);
    assert.equal((await b.api.preferences()).aiConsent, false);
    assert.equal((await a.api.aiStatus()).provider, 'disabled');
    await assert.rejects(a.api.aiParse('QA explicit input'), { status: 503, code: 'ai_unavailable' });
    const context = await a.api.todayContext();
    assert.equal(context.dayNote, 'QA private note');
    assert.deepEqual(Object.keys(context.modules).sort(),
      ['activity', 'changes', 'events', 'inventory', 'nutrition', 'shopping', 'wardrobe', 'weather']);
    for (const value of Object.values(context.modules)) assert.equal(value.status, 'unavailable');
    assert.equal((await a.api.subscription()).status, 'trial');
    const reopened = client(await restart());
    reopened.setToken(alice.token);
    assert.equal((await reopened.api.me()).id, alice.user.id);
    assert.equal((await reopened.api.todayContext()).dayNote, 'QA private note');
    assert.equal((await reopened.api.preferences()).city, 'Riga');
    await reopened.api.logout();
    await assert.rejects(reopened.api.me(), { status: 401 });
    reopened.setToken((await reopened.api.login(credentials('qa-alice'))).token);
    assert.equal((await reopened.api.todayContext()).dayNote, 'QA private note');
  });
});

test('mobile HTTP -> backend -> real AIService: consent, preview-only, invalid output', async () => {
  // Test-only provider seam, never installed as a production provider.
  let calls = 0;
  let invalid = false;
  let outbound;
  class ProbeProvider extends DisabledProvider {
    status() { return { provider: 'qa-test-only', configured: true, capabilities: ['structured_output'] }; }
    async structured(request) {
      calls++;
      outbound = request.input;
      return { output: invalid ? { actions: [{ type: 'unknown' }] } : {
        actions: [{ type: 'update_day_note', module: 'context', confidence: 0.5,
          parameters: { dayNote: 'Unconfirmed test-only draft' } }], clarification: null,
      } };
    }
  }
  const service = new AIService(new ProbeProvider());
  await withServer(service, async (baseUrl) => {
    const a = client(baseUrl);
    a.setToken((await register(a.api, 'qa-ai')).token);
    await assert.rejects(a.api.aiParse('Explicit QA input'), { status: 403, code: 'ai_consent_required' });
    assert.equal(calls, 0);
    await a.api.updatePreferences({ aiConsent: true });
    const preview = await a.api.aiParse('Explicit QA input');
    assert.equal(calls, 1);
    assert.equal(preview.actions.length, 1);
    assert.equal(preview.actions[0].type, 'update_day_note');
    assert.deepEqual(preview.actions[0].parameters, { dayNote: 'Unconfirmed test-only draft' });
    assert.equal(preview.actions[0].confirmationRequired, true);
    assert.deepEqual(Object.keys(outbound).sort(), ['date', 'schemaVersion', 'text', 'timezone']);
    assert.equal(outbound.text, 'Explicit QA input');
    assert.equal((await a.api.todayContext()).dayNote, null, 'preview must not persist');
    invalid = true;
    await assert.rejects(a.api.aiParse('Explicit QA input'), { status: 502, code: 'AI_INVALID_OUTPUT' });
    assert.equal((await a.api.todayContext()).dayNote, null);
  });
});
