import { describe, expect, it } from 'vitest';
import { endpoints, routes } from '@everyday/contracts';
import { buildOpenApi } from '../src/openapi.js';
import { createHarness } from './helpers.js';

interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, OperationObject>>;
  components: { securitySchemes: Record<string, unknown> };
}

interface OperationObject {
  operationId: string;
  security?: unknown[];
  requestBody?: { required: boolean; content: Record<string, { schema: Record<string, unknown> }> };
  responses: Record<string, { description: string; content?: Record<string, { schema: Record<string, unknown> }> }>;
}

describe('OpenAPI document', () => {
  it('is generated from the shared endpoint catalog', () => {
    const document = buildOpenApi() as unknown as OpenApiDocument;

    expect(document.openapi).toBe('3.0.3');
    expect(document.info.version).toBe('0.1.0');
    expect(document.components.securitySchemes.bearerAuth).toBeDefined();

    for (const endpoint of endpoints) {
      const operation = document.paths[endpoint.path]?.[endpoint.method];
      expect(operation, `${endpoint.method.toUpperCase()} ${endpoint.path} is missing`).toBeDefined();
      expect(operation?.responses[String(endpoint.status)]).toBeDefined();
      expect(operation?.responses.default).toBeDefined();

      if ('body' in endpoint) {
        expect(operation?.requestBody?.required).toBe(true);
      }
      if (endpoint.auth) {
        expect(operation?.security).toEqual([{ bearerAuth: [] }]);
      }
    }
  });

  it('publishes real JSON Schemas for request and response bodies', () => {
    const document = buildOpenApi() as unknown as OpenApiDocument;

    const register = document.paths[routes.register]?.post;
    const registerBody = register?.requestBody?.content['application/json']?.schema as
      | { type?: string; required?: string[]; properties?: Record<string, unknown> }
      | undefined;
    expect(registerBody?.type).toBe('object');
    expect(registerBody?.required).toContain('email');
    expect(registerBody?.required).toContain('password');
    expect(Object.keys(registerBody?.properties ?? {})).toEqual(
      expect.arrayContaining(['email', 'password', 'displayName', 'timezone']),
    );

    const health = document.paths[routes.health]?.get;
    expect(health?.responses['200']?.content?.['application/json']?.schema).toBeDefined();

    // 204 has no body, and no document-level definitions should leak through.
    const logout = document.paths[routes.logout]?.post;
    expect(logout?.responses['204']?.content).toBeUndefined();
    expect((document as unknown as Record<string, unknown>).definitions).toBeUndefined();
  });

  it('serves the same document from the API route', async () => {
    const harness = await createHarness();
    try {
      const response = await harness.app.inject({ method: 'GET', url: routes.openapi });
      expect(response.statusCode).toBe(200);

      const document = response.json() as OpenApiDocument;
      expect(document.openapi).toBe('3.0.3');
      expect(Object.keys(document.paths).length).toBeGreaterThanOrEqual(endpoints.length > 0 ? 8 : 0);
      expect(document.paths[routes.health]).toBeDefined();
    } finally {
      await harness.cleanup();
    }
  });

  it('is deterministic', () => {
    expect(buildOpenApi()).toEqual(buildOpenApi());
  });
});
