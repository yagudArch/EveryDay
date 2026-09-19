import { describe, expect, it } from 'vitest';
import { ErrorResponseSchema, HealthSchema, routes } from '@everyday/contracts';
import { closeDatabase, openDatabase, runStatement, type Db } from '../src/db/connection.js';
import { bearer, createHarness, registerUser } from './helpers.js';

describe('error handling and sanitization', () => {
  it('answers health with a real database probe', async () => {
    const harness = await createHarness();
    try {
      const response = await harness.app.inject({ method: 'GET', url: routes.health });
      expect(response.statusCode).toBe(200);
      expect(HealthSchema.parse(response.json())).toEqual({ status: 'ok', database: 'ok' });
      expect(response.headers['x-request-id']).toBeDefined();
    } finally {
      await harness.cleanup();
    }
  });

  it('reports malformed JSON with the shared error envelope and a request id', async () => {
    const harness = await createHarness();
    try {
      const response = await harness.app.inject({
        method: 'POST',
        url: routes.login,
        payload: '{"email": "broken"',
        headers: { 'content-type': 'application/json' },
      });

      expect(response.statusCode).toBe(400);
      const body = ErrorResponseSchema.parse(response.json());
      expect(body.error.code).toBe('malformed_json');
      expect(body.error.requestId).toBe(response.headers['x-request-id']);
      expect(response.body).not.toContain('stack');
    } finally {
      await harness.cleanup();
    }
  });

  it('returns 415 for an unsupported content type', async () => {
    const harness = await createHarness();
    try {
      const response = await harness.app.inject({
        method: 'POST',
        url: routes.login,
        payload: 'email=test@example.test',
        headers: { 'content-type': 'text/plain' },
      });
      expect(response.statusCode).toBe(415);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe('unsupported_media_type');
    } finally {
      await harness.cleanup();
    }
  });

  it('returns 404 route_not_found for unknown routes and methods', async () => {
    const harness = await createHarness();
    try {
      const unknown = await harness.app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
      expect(unknown.statusCode).toBe(404);
      expect(ErrorResponseSchema.parse(unknown.json()).error.code).toBe('route_not_found');

      const wrongMethod = await harness.app.inject({ method: 'DELETE', url: routes.me });
      expect(wrongMethod.statusCode).toBe(404);
    } finally {
      await harness.cleanup();
    }
  });

  it('turns an unexpected storage failure into a generic 500 without internals', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);

      const inspector: Db = openDatabase(harness.databasePath);
      try {
        runStatement(inspector, 'DROP TABLE sessions');
      } finally {
        closeDatabase(inspector);
      }

      const response = await harness.app.inject({ method: 'GET', url: routes.me, headers: bearer(user.token) });
      expect(response.statusCode).toBe(500);
      const body = ErrorResponseSchema.parse(response.json());
      expect(body.error.code).toBe('internal_error');
      expect(body.error.message).toBe('Internal server error');
      expect(response.body).not.toContain('sessions');
      expect(response.body).not.toContain('SQL');
      expect(response.body).not.toContain('sqlite');
    } finally {
      await harness.cleanup();
    }
  });

  it('never echoes credentials in an error response', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const response = await harness.app.inject({
        method: 'POST',
        url: routes.login,
        payload: { email: user.email, password: 'wrong-but-secret-value' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.body).not.toContain('wrong-but-secret-value');
      expect(response.body).not.toContain(user.token);
      expect(ErrorResponseSchema.parse(response.json()).error).toMatchObject({ code: 'invalid_credentials' });
    } finally {
      await harness.cleanup();
    }
  });

  it('rejects an empty body on a strict endpoint', async () => {
    const harness = await createHarness();
    try {
      const user = await registerUser(harness.app);
      const response = await harness.app.inject({
        method: 'PATCH',
        url: routes.preferences,
        headers: bearer(user.token),
        payload: {},
      });
      expect(response.statusCode).toBe(400);
      expect(ErrorResponseSchema.parse(response.json()).error.code).toBe('validation_error');
    } finally {
      await harness.cleanup();
    }
  });
});
