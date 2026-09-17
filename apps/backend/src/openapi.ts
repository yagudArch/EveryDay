import { ErrorResponseSchema, endpoints, routes } from '@everyday/contracts';
import type { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * OpenAPI document generated from the shared contract catalog (`endpoints` in
 * `@everyday/contracts`). Nothing is hand-written twice: schemas come from the very Zod
 * schemas the server validates against, so the document cannot silently drift.
 */
const OPENAPI_VERSION = '3.0.3';
const JSON_SCHEMA_OPTIONS = { target: 'openApi3', $refStrategy: 'none' } as const;

function schemaOf(schema: unknown): Record<string, unknown> {
  const produced = zodToJsonSchema(schema as never, JSON_SCHEMA_OPTIONS) as Record<string, unknown>;
  // Inlined schemas need no document-level $schema/definitions entries for OpenAPI 3.0.
  const { $schema, definitions, ...rest } = produced;
  void $schema;
  void definitions;
  return rest;
}

function tagFor(path: string): string {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  return segments[2] ?? 'api';
}

function operationIdFor(method: string, path: string): string {
  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== 'api' && segment !== 'v1')
    .map((segment) => segment.replace(/[^A-Za-z0-9]/g, ''));
  const name = segments
    .map((segment, index) => (index === 0 ? segment : segment.replace(/^./, (character) => character.toUpperCase())))
    .join('');
  return `${method}${name.replace(/^./, (character) => character.toUpperCase())}`;
}

export function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of endpoints) {
    const pathItem = paths[endpoint.path] ?? {};
    const success: Record<string, unknown> = {
      description: endpoint.status === 204 ? 'No content' : 'Success',
    };
    if ('response' in endpoint) {
      success.content = { 'application/json': { schema: schemaOf(endpoint.response) } };
    }

    const operation: Record<string, unknown> = {
      operationId: operationIdFor(endpoint.method, endpoint.path),
      tags: [tagFor(endpoint.path)],
      responses: {
        [String(endpoint.status)]: success,
        default: {
          description: 'Error',
          content: { 'application/json': { schema: schemaOf(ErrorResponseSchema) } },
        },
      },
    };

    if ('body' in endpoint) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: schemaOf(endpoint.body) } },
      };
    }
    if (endpoint.auth) {
      operation.security = [{ bearerAuth: [] }];
    }

    pathItem[endpoint.method] = operation;
    paths[endpoint.path] = pathItem;
  }

  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: '«Каждый день» API',
      version: '0.1.0',
      description:
        'Foundation API. Private endpoints authenticate with an opaque bearer session token and never accept a client-supplied user id. Responses that are not implemented yet are reported as unavailable instead of being faked.',
    },
    servers: [{ url: '/' }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Opaque session token issued by POST /api/v1/auth/register or /api/v1/auth/login.',
        },
      },
    },
  };
}

export function registerOpenApiRoute(app: FastifyInstance): void {
  app.get(routes.openapi, async (_request, reply) => {
    reply.status(200).send(buildOpenApi());
  });
}
