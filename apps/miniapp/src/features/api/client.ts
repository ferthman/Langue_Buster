import type {
  AnalyticsEventEnvelope,
  AnalyticsIngestResponse,
  AuthResponse,
  ReviewAnswerRequest,
  ReviewAnswerResponse,
  ReviewQueueResponse,
  RunAnswerRequest,
  RunAnswerResponse,
  RunFinishResponse,
  RunMoveRequest,
  RunMoveResponse,
  RunResultResponse,
  RunStartRequest,
  RunStartResponse,
  RunStateResponse,
  SessionVerificationResponse,
  TelegramAuthRequest,
} from '@langue-buster/shared';
import {
  authErrorSchema,
  authResponseSchema,
  reviewAnswerRequestSchema,
  reviewAnswerResponseSchema,
  reviewErrorSchema,
  reviewQueueQuerySchema,
  reviewQueueResponseSchema,
  runAnswerRequestSchema,
  runAnswerResponseSchema,
  runErrorSchema,
  runFinishResponseSchema,
  runMoveRequestSchema,
  runMoveResponseSchema,
  runResultResponseSchema,
  runStartRequestSchema,
  runStartResponseSchema,
  runStateResponseSchema,
  sessionVerificationResponseSchema,
  telegramAuthRequestSchema,
  analyticsErrorSchema,
  analyticsIngestRequestSchema,
  analyticsIngestResponseSchema,
} from '@langue-buster/shared';

type ApiErrorPayload = {
  code?: string;
  message?: string;
};

type SchemaLike<T> = {
  parse(input: unknown): T;
  safeParse(input: unknown): { success: true; data: T } | { success: false };
};

const apiBaseUrl = normalizeBaseUrl(
  (import.meta as ImportMeta & { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL,
);

const networkFailureMessage =
  'Не удалось связаться с сервером. Проверьте, что API доступен по HTTPS и открыт извне Telegram.';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, payload: ApiErrorPayload, fallbackMessage: string) {
    super(payload.message ?? fallbackMessage);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = payload.code;
  }
}

export const apiClient = {
  authenticateTelegram(initData: string) {
    const body: TelegramAuthRequest = telegramAuthRequestSchema.parse({ initData });
    return request<AuthResponse>({
      path: '/auth/telegram',
      method: 'POST',
      body,
      responseSchema: authResponseSchema,
      errorSchemas: [authErrorSchema],
      fallbackErrorMessage: 'Не удалось пройти авторизацию Telegram.',
    });
  },

  verifySession(token: string) {
    return request<SessionVerificationResponse>({
      path: '/auth/session',
      method: 'GET',
      token,
      responseSchema: sessionVerificationResponseSchema,
      errorSchemas: [authErrorSchema],
      fallbackErrorMessage: 'Не удалось восстановить сессию.',
    });
  },

  startRun(token: string, payload: RunStartRequest) {
    return request<RunStartResponse>({
      path: '/runs/start',
      method: 'POST',
      token,
      body: runStartRequestSchema.parse(payload),
      responseSchema: runStartResponseSchema,
      errorSchemas: [runErrorSchema],
      fallbackErrorMessage: 'Не удалось начать ран.',
    });
  },

  getRun(token: string, runId: string) {
    return request<RunStateResponse>({
      path: `/runs/${runId}`,
      method: 'GET',
      token,
      responseSchema: runStateResponseSchema,
      errorSchemas: [runErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить ран.',
    });
  },

  answerRun(token: string, runId: string, payload: RunAnswerRequest) {
    return request<RunAnswerResponse>({
      path: `/runs/${runId}/answer`,
      method: 'POST',
      token,
      body: runAnswerRequestSchema.parse(payload),
      responseSchema: runAnswerResponseSchema,
      errorSchemas: [runErrorSchema],
      fallbackErrorMessage: 'Не удалось отправить ответ.',
    });
  },

  moveRun(token: string, runId: string, payload: RunMoveRequest) {
    return request<RunMoveResponse>({
      path: `/runs/${runId}/move`,
      method: 'POST',
      token,
      body: runMoveRequestSchema.parse(payload),
      responseSchema: runMoveResponseSchema,
      errorSchemas: [runErrorSchema],
      fallbackErrorMessage: 'Не удалось отправить ход.',
    });
  },

  finishRun(token: string, runId: string) {
    return request<RunFinishResponse>({
      path: `/runs/${runId}/finish`,
      method: 'POST',
      token,
      responseSchema: runFinishResponseSchema,
      errorSchemas: [runErrorSchema],
      fallbackErrorMessage: 'Не удалось завершить ран.',
    });
  },

  getRunResult(token: string, runId: string) {
    return request<RunResultResponse>({
      path: `/runs/${runId}/result`,
      method: 'GET',
      token,
      responseSchema: runResultResponseSchema,
      errorSchemas: [runErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить итог рана.',
    });
  },

  getReviewQueue(
    token: string,
    query: Parameters<typeof reviewQueueQuerySchema.parse>[0],
  ) {
    const parsed = reviewQueueQuerySchema.parse(query);
    const search = new URLSearchParams();
    search.set('limit', String(parsed.limit));
    if (parsed.levelId) {
      search.set('levelId', parsed.levelId);
    }
    search.set('direction', parsed.direction);

    return request<ReviewQueueResponse>({
      path: `/review/queue?${search.toString()}`,
      method: 'GET',
      token,
      responseSchema: reviewQueueResponseSchema,
      errorSchemas: [reviewErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить очередь повторения.',
    });
  },

  answerReview(token: string, payload: ReviewAnswerRequest) {
    return request<ReviewAnswerResponse>({
      path: '/review/answer',
      method: 'POST',
      token,
      body: reviewAnswerRequestSchema.parse(payload),
      responseSchema: reviewAnswerResponseSchema,
      errorSchemas: [reviewErrorSchema],
      fallbackErrorMessage: 'Не удалось отправить ответ на повторение.',
    });
  },

  ingestAnalyticsEvents(token: string, events: readonly AnalyticsEventEnvelope[]) {
    return request<AnalyticsIngestResponse>({
      path: '/analytics/events',
      method: 'POST',
      token,
      body: analyticsIngestRequestSchema.parse({ events }),
      responseSchema: analyticsIngestResponseSchema,
      errorSchemas: [analyticsErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось отправить аналитические события.',
    });
  },
};

async function request<T>(input: {
  path: string;
  method: 'GET' | 'POST';
  token?: string;
  body?: unknown;
  responseSchema: SchemaLike<T>;
  errorSchemas: readonly SchemaLike<ApiErrorPayload>[];
  fallbackErrorMessage: string;
}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildUrl(input.path), {
      method: input.method,
      headers: {
        Accept: 'application/json',
        ...(input.body ? { 'Content-Type': 'application/json' } : {}),
        ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, {}, networkFailureMessage);
  }

  const payload: unknown = await parseJson(response);
  if (!response.ok) {
    throw buildApiError(response.status, payload, input.errorSchemas, input.fallbackErrorMessage);
  }

  return input.responseSchema.parse(payload);
}

function buildUrl(path: string) {
  if (!apiBaseUrl) {
    return path;
  }

  return new URL(path, apiBaseUrl).toString();
}

function normalizeBaseUrl(value: string | undefined) {
  if (!value) {
    return '';
  }

  return value.endsWith('/') ? value : `${value}/`;
}

async function parseJson(response: Response) {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return null;
  }
}

function buildApiError(
  status: number,
  payload: unknown,
  errorSchemas: readonly SchemaLike<ApiErrorPayload>[],
  fallbackMessage: string,
) {
  for (const schema of errorSchemas) {
    const parsed = schema.safeParse(payload);
    if (parsed.success) {
      return new ApiClientError(status, parsed.data, fallbackMessage);
    }
  }

  return new ApiClientError(status, {}, fallbackMessage);
}
