const DEFAULT_TIMEOUT_MS = 12_000;

type ApiErrorPayload = {
  code?: unknown;
  error?: unknown;
  message?: unknown;
  description?: unknown;
};

export class ApiResponseError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.code = code;
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new Error('A consulta demorou mais que o esperado. Tente novamente.');
    }
    throw error;
  }
}

function isJsonContentType(contentType: string | null) {
  return Boolean(
    contentType &&
      /\bapplication\/(?:[\w.+-]*\+)?json\b/i.test(contentType),
  );
}

function getErrorDetails(payload: unknown, status: number) {
  if (!payload || typeof payload !== 'object') {
    return {
      message: `A solicitação falhou (HTTP ${status}).`,
      code: undefined,
    };
  }

  const value = payload as ApiErrorPayload;
  const message = [value.message, value.error, value.description].find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );
  const code =
    typeof value.code === 'string'
      ? value.code
      : typeof value.error === 'string' && value.error !== message
        ? value.error
        : undefined;

  return {
    message: message ?? `A solicitação falhou (HTTP ${status}).`,
    code,
  };
}

export async function readJsonResponse<T>(
  response: Response,
): Promise<T | undefined> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type');
  if (!isJsonContentType(contentType)) {
    throw new ApiResponseError(
      response.status,
      response.ok
        ? 'A API retornou uma resposta em formato inesperado.'
        : `A solicitação falhou (HTTP ${response.status}).`,
      'invalid_content_type',
    );
  }

  const body = await response.text();
  if (!body.trim()) {
    throw new ApiResponseError(
      response.status,
      response.ok
        ? 'A API retornou uma resposta vazia.'
        : `A solicitação falhou (HTTP ${response.status}).`,
      'empty_response',
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new ApiResponseError(
      response.status,
      'A API retornou um JSON inválido.',
      'invalid_json',
    );
  }

  if (!response.ok) {
    const { message, code } = getErrorDetails(payload, response.status);
    throw new ApiResponseError(response.status, message, code);
  }

  return payload as T;
}

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T | undefined> {
  const response = await fetchWithTimeout(input, init, timeoutMs);
  return readJsonResponse<T>(response);
}
