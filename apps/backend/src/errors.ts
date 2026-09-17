import type { FastifyInstance } from 'fastify';

/**
 * Application error with an HTTP status and a stable machine-readable code.
 * Only `code` and `message` are exposed to clients; internal causes are logged server-side.
 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, statusCode: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Fastify/plugin errors we translate into the project error envelope. */
const FRAMEWORK_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  FST_ERR_CTP_INVALID_JSON_BODY: {
    status: 400,
    code: 'malformed_json',
    message: 'Request body is not valid JSON',
  },
  FST_ERR_CTP_EMPTY_JSON_BODY: {
    status: 400,
    code: 'malformed_json',
    message: 'Request body must not be empty',
  },
  FST_ERR_CTP_INVALID_MEDIA_TYPE: {
    status: 415,
    code: 'unsupported_media_type',
    message: 'Unsupported content type',
  },
  FST_ERR_CTP_BODY_TOO_LARGE: {
    status: 413,
    code: 'payload_too_large',
    message: 'Request body is too large',
  },
  FST_ERR_VALIDATION: {
    status: 400,
    code: 'validation_error',
    message: 'Request validation failed',
  },
};

export interface ErrorEnvelope {
  error: { code: string; message: string; requestId: string };
}

/**
 * Builds the single error shape used by every endpoint: {error:{code,message,requestId}}.
 * Messages are always generic; no user input, SQL text or stack traces are returned.
 */
export function errorEnvelope(requestId: string, code: string, message: string): ErrorEnvelope {
  return { error: { code, message, requestId } };
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(errorEnvelope(request.id, 'route_not_found', 'Route not found'));
  });

  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;

    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ requestId, code: error.code, statusCode: error.statusCode }, 'request failed');
      } else {
        request.log.warn({ requestId, code: error.code, statusCode: error.statusCode }, 'request rejected');
      }
      reply.status(error.statusCode).send(errorEnvelope(requestId, error.code, error.message));
      return;
    }

    const candidate = error as { code?: unknown; statusCode?: unknown };
    const frameworkCode = typeof candidate.code === 'string' ? candidate.code : undefined;
    const mapped = frameworkCode ? FRAMEWORK_ERRORS[frameworkCode] : undefined;
    if (mapped) {
      request.log.warn({ requestId, code: mapped.code, statusCode: mapped.status }, 'request rejected');
      reply.status(mapped.status).send(errorEnvelope(requestId, mapped.code, mapped.message));
      return;
    }

    const status = typeof candidate.statusCode === 'number' ? candidate.statusCode : 500;
    if (status >= 400 && status < 500) {
      const known =
        status === 404
          ? { code: 'route_not_found', message: 'Route not found' }
          : status === 415
            ? { code: 'unsupported_media_type', message: 'Unsupported content type' }
            : { code: 'bad_request', message: 'Request could not be processed' };
      request.log.warn({ requestId, statusCode: status }, 'request rejected');
      reply.status(status).send(errorEnvelope(requestId, known.code, known.message));
      return;
    }

    // Unexpected failure: log the real cause (never sent to the client). The logger
    // redacts authorization headers, credentials and free-form user text.
    request.log.error({ requestId, err: error }, 'unhandled request error');
    reply.status(500).send(errorEnvelope(requestId, 'internal_error', 'Internal server error'));
  });
}
