/**
 * HTTP-клиент приложения: платформенно-независимый (без react-native), поэтому
 * полностью покрывается unit-тестами.
 *
 * Ответственность:
 * - контрактные routes (передаются вызывающей стороной из @everyday/contracts);
 * - bearer-токен и обработка 401 (истёкшая сессия);
 * - timeout и сетевые ошибки;
 * - разбор тела ответа через схему-парсер контракта (Zod .parse);
 * - предсказуемый ApiError для UI (loading/error/retry).
 */

export interface ResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>;

export type ResponseParser<T> = (input: unknown) => T;

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApiErrorOptions {
  code?: string;
  status?: number;
  requestId?: string | null;
  retryable?: boolean;
  detail?: string | null;
}

export class ApiError extends Error {
  readonly code: string;
  /** HTTP status; 0 для транспортных ошибок. */
  readonly status: number;
  readonly requestId: string | null;
  readonly retryable: boolean;
  readonly detail: string | null;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code ?? 'unknown_error';
    this.status = options.status ?? 0;
    this.requestId = options.requestId ?? null;
    this.retryable = options.retryable ?? false;
    this.detail = options.detail ?? null;
  }
}

export interface HttpClientOptions {
  baseUrl: string;
  fetchImpl: FetchLike;
  timeoutMs?: number;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
}

export interface RequestOptions<T> {
  method: HttpMethod;
  route: string;
  parse: ResponseParser<T>;
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
}

interface SendOptions {
  method: HttpMethod;
  route: string;
  auth: boolean;
  body?: unknown;
  timeoutMs?: number;
}

interface SendResult {
  status: number;
  text: string;
}

interface ParsedErrorBody {
  code: string;
  message: string;
  requestId: string | null;
}

const MAX_DETAIL_LENGTH = 400;

function truncate(value: string | null): string | null {
  if (value === null) return null;
  return value.length > MAX_DETAIL_LENGTH ? `${value.slice(0, MAX_DETAIL_LENGTH)}…` : value;
}

function defaultErrorCode(status: number): string {
  if (status === 400) return 'bad_request';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 408) return 'request_timeout';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'unavailable';
  if (status >= 500) return 'server_error';
  return 'http_error';
}

function defaultErrorMessage(status: number): string {
  if (status === 401) return 'Сессия истекла. Войдите снова.';
  if (status === 403) return 'Недостаточно прав для этого действия.';
  if (status === 404) return 'Запрошенные данные не найдены.';
  if (status === 429) return 'Слишком много запросов. Попробуйте позже.';
  if (status === 503) return 'Сервис временно недоступен.';
  if (status >= 500) return 'Ошибка на сервере. Попробуйте позже.';
  return `Сервер отклонил запрос (${status}).`;
}

/** Ожидаемый контрактом формат ошибки: { error: { code, message, requestId } }. */
export function parseErrorBody(raw: string): ParsedErrorBody | null {
  if (raw.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const error = (parsed as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const record = error as Record<string, unknown>;
  const code = record.code;
  const message = record.message;
  const requestId = record.requestId;
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  return {
    code,
    message,
    requestId: typeof requestId === 'string' ? requestId : null,
  };
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly getToken: () => string | null;
  private readonly onUnauthorized: () => void;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.getToken = options.getToken ?? (() => null);
    this.onUnauthorized = options.onUnauthorized ?? (() => undefined);
  }

  async get<T>(route: string, parse: ResponseParser<T>, options?: { auth?: boolean; timeoutMs?: number }): Promise<T> {
    return this.request({ method: 'GET', route, parse, auth: options?.auth, timeoutMs: options?.timeoutMs });
  }

  async post<T>(
    route: string,
    body: unknown,
    parse: ResponseParser<T>,
    options?: { auth?: boolean; timeoutMs?: number },
  ): Promise<T> {
    return this.request({ method: 'POST', route, parse, body, auth: options?.auth, timeoutMs: options?.timeoutMs });
  }

  async patch<T>(
    route: string,
    body: unknown,
    parse: ResponseParser<T>,
    options?: { auth?: boolean; timeoutMs?: number },
  ): Promise<T> {
    return this.request({ method: 'PATCH', route, parse, body, auth: options?.auth, timeoutMs: options?.timeoutMs });
  }

  /** Запросы без тела ответа (204), например logout. */
  async sendVoid(route: string, options?: { method?: HttpMethod; body?: unknown; auth?: boolean }): Promise<void> {
    await this.send({
      method: options?.method ?? 'POST',
      route,
      auth: options?.auth ?? true,
      body: options?.body,
    });
  }

  async request<T>(options: RequestOptions<T>): Promise<T> {
    const result = await this.send({
      method: options.method,
      route: options.route,
      auth: options.auth ?? true,
      body: options.body,
      timeoutMs: options.timeoutMs,
    });

    if (result.text.trim() === '') {
      throw new ApiError('Сервер вернул пустой ответ.', { code: 'invalid_response', status: result.status });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(result.text);
    } catch (error) {
      throw new ApiError('Сервер вернул ответ, который не является JSON.', {
        code: 'invalid_response',
        status: result.status,
        detail: truncate(error instanceof Error ? error.message : null),
      });
    }

    try {
      return options.parse(payload);
    } catch (error) {
      throw new ApiError('Ответ сервера не соответствует контракту API.', {
        code: 'invalid_response',
        status: result.status,
        detail: truncate(error instanceof Error ? error.message : null),
      });
    }
  }

  private async send(options: SendOptions): Promise<SendResult> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const headers: Record<string, string> = { Accept: 'application/json' };

    const requestToken = options.auth ? this.getToken() : null;
    if (options.auth) {
      const token = requestToken;
      if (token !== null && token !== '') {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      try {
        body = JSON.stringify(options.body);
      } catch {
        throw new ApiError('Не удалось подготовить тело запроса.', { code: 'invalid_request' });
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const sendOnce = async (): Promise<{ response: ResponseLike; text: string }> => {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}${options.route}`, {
          method: options.method,
          headers,
          body,
          signal: controller.signal,
        });
        const text = await response.text();
        return { response, text };
      } catch (error) {
        const aborted = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
        if (aborted) {
          throw new ApiError(`Превышено время ожидания ответа (${timeoutMs} мс).`, { code: 'timeout', retryable: true });
        }
        throw new ApiError('Нет соединения с сервером. Проверьте сеть и адрес API.', {
          code: 'network_error',
          retryable: true,
          detail: truncate(error instanceof Error ? error.message : null),
        });
      } finally {
        clearTimeout(timer);
      }
    };

    const { response, text } = await sendOnce();

    if (!response.ok) {
      const info = parseErrorBody(text);

      if (response.status === 401) {
        if (options.auth && requestToken === this.getToken()) this.onUnauthorized();
        throw new ApiError(info?.message ?? defaultErrorMessage(401), {
          code: info?.code ?? 'unauthorized',
          status: 401,
          requestId: info?.requestId ?? null,
        });
      }

      throw new ApiError(info?.message ?? defaultErrorMessage(response.status), {
        code: info?.code ?? defaultErrorCode(response.status),
        status: response.status,
        requestId: info?.requestId ?? null,
        retryable: response.status >= 500 || response.status === 429 || response.status === 408,
      });
    }

    if (options.auth && requestToken !== this.getToken()) {
      throw new ApiError('Сессия изменилась. Запросите данные снова.', { code: 'session_changed' });
    }
    return { status: response.status, text };
  }
}
