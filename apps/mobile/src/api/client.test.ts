import { describe, expect, it, vi } from 'vitest';

import { ApiError, DEFAULT_TIMEOUT_MS, HttpClient, parseErrorBody } from './client';
import type { FetchLike, ResponseLike } from './client';

function response(status: number, body: unknown): ResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function client(fetchImpl: FetchLike, overrides?: { getToken?: () => string | null; onUnauthorized?: () => void }): HttpClient {
  return new HttpClient({
    baseUrl: 'http://localhost:3000/',
    fetchImpl,
    timeoutMs: 50,
    getToken: overrides?.getToken,
    onUnauthorized: overrides?.onUnauthorized,
  });
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Ожидалась ошибка ApiError');
}

describe('parseErrorBody', () => {
  it('читает контрактный формат ошибки', () => {
    const parsed = parseErrorBody('{"error":{"code":"invalid_credentials","message":"bad","requestId":"req-1"}}');
    expect(parsed).toEqual({ code: 'invalid_credentials', message: 'bad', requestId: 'req-1' });
  });

  it('возвращает null для посторонних тел', () => {
    expect(parseErrorBody('')).toBeNull();
    expect(parseErrorBody('not json')).toBeNull();
    expect(parseErrorBody('{"message":"x"}')).toBeNull();
    expect(parseErrorBody('null')).toBeNull();
  });
});

describe('HttpClient', () => {
  it('формирует URL из base URL и контрактного route без авторизации', async () => {
    const fetchImpl = vi.fn(async () => response(200, { status: 'ok', database: 'ok' }));
    const api = client(fetchImpl as unknown as FetchLike);

    const result = await api.get('/api/v1/health', (input) => input as { status: string }, { auth: false });

    expect(result).toEqual({ status: 'ok', database: 'ok' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/health');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('добавляет bearer-токен и JSON-тело', async () => {
    const fetchImpl = vi.fn(async () => response(200, { ok: true }));
    const api = client(fetchImpl as unknown as FetchLike, { getToken: () => 'token-value' });

    await api.patch('/api/v1/preferences', { theme: 'dark' }, (input) => input);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-value');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ theme: 'dark' }));
  });

  it('на 401 вызывает onUnauthorized и не ретраит', async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = async () =>
      response(401, { error: { code: 'invalid_session', message: 'Сессия недействительна', requestId: 'req-9' } });
    const api = client(fetchImpl, { onUnauthorized });

    const error = await captureError(api.get('/api/v1/me', (input) => input));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(error.code).toBe('invalid_session');
    expect(error.status).toBe(401);
    expect(error.requestId).toBe('req-9');
    expect(error.retryable).toBe(false);
  });

  it('берёт code/message/requestId из контрактной ошибки сервера', async () => {
    const fetchImpl = async () =>
      response(422, { error: { code: 'validation_error', message: 'Некорректный timezone', requestId: 'req-22' } });
    const api = client(fetchImpl);

    const error = await captureError(api.post('/api/v1/auth/register', {}, (input) => input));

    expect(error.code).toBe('validation_error');
    expect(error.message).toBe('Некорректный timezone');
    expect(error.requestId).toBe('req-22');
    expect(error.status).toBe(422);
  });

  it('на 503 без тела отдаёт unavailable и retryable', async () => {
    const api = client(async () => response(503, ''));
    const error = await captureError(api.get('/api/v1/ai/status', (input) => input));

    expect(error.code).toBe('unavailable');
    expect(error.status).toBe(503);
    expect(error.retryable).toBe(true);
    expect(error.message).toBe('Сервис временно недоступен.');
  });

  it('на 500 с телом отдаёт код сервера', async () => {
    const api = client(async () => response(500, { error: { code: 'internal_error', message: 'Ошибка', requestId: 'r' } }));
    const error = await captureError(api.get('/api/v1/me', (input) => input));

    expect(error.code).toBe('internal_error');
    expect(error.retryable).toBe(true);
  });

  it('считает не-JSON и несоответствие схеме ошибкой invalid_response', async () => {
    const notJson = client(async () => response(200, 'ok'));
    expect((await captureError(notJson.get('/api/v1/me', (input) => input))).code).toBe('invalid_response');

    const empty = client(async () => response(200, ''));
    expect((await captureError(empty.get('/api/v1/me', (input) => input))).message).toBe('Сервер вернул пустой ответ.');

    const schemaMismatch = client(async () => response(200, { wrong: true }));
    const error = await captureError(
      schemaMismatch.get('/api/v1/me', () => {
        throw new Error('expected string');
      }),
    );
    expect(error.code).toBe('invalid_response');
    expect(error.detail).toContain('expected string');
  });

  it('превращает сетевую ошибку в retryable network_error', async () => {
    const api = client(async () => {
      throw new TypeError('Network request failed');
    });
    const error = await captureError(api.get('/api/v1/me', (input) => input));

    expect(error.code).toBe('network_error');
    expect(error.status).toBe(0);
    expect(error.retryable).toBe(true);
  });

  it('превращает AbortError в timeout', async () => {
    const api = client(async (_input, init) => {
      return await new Promise<ResponseLike>((_resolve, reject) => {
        const signal = init.signal;
        signal?.addEventListener('abort', () => {
          const abortError = new Error('Aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    const error = await captureError(api.get('/api/v1/me', (input) => input, { timeoutMs: 10 }));

    expect(error.code).toBe('timeout');
    expect(error.retryable).toBe(true);
  });

  it('sendVoid принимает 204 без тела', async () => {
    const fetchImpl = vi.fn(async () => response(204, ''));
    const api = client(fetchImpl as unknown as FetchLike, { getToken: () => 'token-value' });

    await expect(api.sendVoid('/api/v1/auth/logout')).resolves.toBeUndefined();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
  });
});
