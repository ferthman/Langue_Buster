import type {
  AnalyticsContentResponse,
  AnalyticsAdminQuery,
  AnalyticsFunnelsResponse,
  AnalyticsOverviewResponse,
  AnalyticsRetentionResponse,
  AntiCheatAnomalyListQuery,
  AntiCheatAnomalyListResponse,
  AdminBulkUpdateVocabItemsRequest,
  AdminBulkUpdateVocabItemsResponse,
  AdminHistoryQuery,
  AdminHistoryResponse,
  AdminImportApplyResponse,
  AdminImportRequest,
  AdminImportValidateResponse,
  AdminLessonDetailResponse,
  AdminLessonListResponse,
  AdminLessonUpsertRequest,
  AdminPreviewResponse,
  AdminQaFlagRequest,
  AdminQaFlagResponse,
  AdminTopicDetailResponse,
  AdminTopicListResponse,
  AdminTopicUpsertRequest,
  AdminVocabDetailResponse,
  AdminVocabListQuery,
  AdminVocabListResponse,
  AdminVocabUpsertRequest,
  AuthError,
  SessionVerificationResponse,
  SoftLaunchContentIssueReport,
  SoftLaunchLaunchReport,
  SoftLaunchReportQuery,
  SoftLaunchRetentionReport,
  SoftLaunchStatus,
  SoftLaunchTuningBacklogReport,
  SoftLaunchUpdateRequest,
} from '@langue-buster/shared';
import {
  adminBulkUpdateVocabItemsRequestSchema,
  adminBulkUpdateVocabItemsResponseSchema,
  adminErrorSchema,
  analyticsContentResponseSchema,
  analyticsAdminQuerySchema,
  analyticsFunnelsResponseSchema,
  analyticsOverviewResponseSchema,
  analyticsRetentionResponseSchema,
  antiCheatAnomalyListQuerySchema,
  antiCheatAnomalyListResponseSchema,
  adminHistoryQuerySchema,
  adminHistoryResponseSchema,
  adminImportApplyResponseSchema,
  adminImportRequestSchema,
  adminImportValidateResponseSchema,
  adminLessonDetailResponseSchema,
  adminLessonListResponseSchema,
  adminLessonUpsertRequestSchema,
  adminPreviewResponseSchema,
  adminQaFlagRequestSchema,
  adminQaFlagResponseSchema,
  adminTopicDetailResponseSchema,
  adminTopicListResponseSchema,
  adminTopicUpsertRequestSchema,
  adminVocabDetailResponseSchema,
  adminVocabListQuerySchema,
  adminVocabListResponseSchema,
  adminVocabUpsertRequestSchema,
  authErrorSchema,
  sessionVerificationResponseSchema,
  softLaunchContentIssueReportSchema,
  softLaunchLaunchReportSchema,
  softLaunchReportQuerySchema,
  softLaunchRetentionReportSchema,
  softLaunchStatusSchema,
  softLaunchTuningBacklogReportSchema,
  softLaunchUpdateRequestSchema,
} from '@langue-buster/shared';

type SchemaLike<T> = {
  parse(input: unknown): T;
  safeParse(input: unknown): { success: true; data: T } | { success: false };
};

type ApiErrorPayload = {
  code?: string;
  message?: string;
};

const apiBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

export class AdminApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, payload: ApiErrorPayload, fallbackMessage: string) {
    super(payload.message ?? fallbackMessage);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = payload.code;
  }
}

export const adminApi = {
  verifySession(token: string) {
    return request<SessionVerificationResponse>({
      path: '/auth/session',
      method: 'GET',
      token,
      responseSchema: sessionVerificationResponseSchema,
      errorSchemas: [authErrorSchema],
      fallbackErrorMessage: 'Не удалось проверить сессию.',
    });
  },

  listVocabItems(token: string, query: Partial<AdminVocabListQuery>) {
    const parsed = adminVocabListQuerySchema.parse(query);
    const search = new URLSearchParams();
    if (parsed.search) {
      search.set('search', parsed.search);
    }
    if (parsed.levelId) {
      search.set('levelId', parsed.levelId);
    }
    if (parsed.topicId) {
      search.set('topicId', parsed.topicId);
    }
    if (parsed.status) {
      search.set('status', parsed.status);
    }
    search.set('sortBy', parsed.sortBy);
    search.set('sortDirection', parsed.sortDirection);
    search.set('page', String(parsed.page));
    search.set('pageSize', String(parsed.pageSize));

    return request<AdminVocabListResponse>({
      path: `/admin/vocab-items?${search.toString()}`,
      method: 'GET',
      token,
      responseSchema: adminVocabListResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить список слов.',
    });
  },

  getVocabItem(token: string, id: string) {
    return request<AdminVocabDetailResponse>({
      path: `/admin/vocab-items/${id}`,
      method: 'GET',
      token,
      responseSchema: adminVocabDetailResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить карточку слова.',
    });
  },

  saveVocabItem(token: string, payload: AdminVocabUpsertRequest) {
    const parsed = adminVocabUpsertRequestSchema.parse(payload);
    const id = extractEntityId(parsed.item);
    return request<AdminVocabDetailResponse>({
      path: id ? `/admin/vocab-items/${id}` : '/admin/vocab-items',
      method: id ? 'PATCH' : 'POST',
      token,
      body: parsed,
      responseSchema: adminVocabDetailResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось сохранить слово.',
    });
  },

  listTopics(token: string) {
    return request<AdminTopicListResponse>({
      path: '/admin/topics',
      method: 'GET',
      token,
      responseSchema: adminTopicListResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить темы.',
    });
  },

  getTopic(token: string, id: string) {
    return request<AdminTopicDetailResponse>({
      path: `/admin/topics/${id}`,
      method: 'GET',
      token,
      responseSchema: adminTopicDetailResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить тему.',
    });
  },

  saveTopic(token: string, payload: AdminTopicUpsertRequest) {
    const parsed = adminTopicUpsertRequestSchema.parse(payload);
    const id = extractEntityId(parsed.item);
    return request<AdminTopicDetailResponse>({
      path: id ? `/admin/topics/${id}` : '/admin/topics',
      method: id ? 'PATCH' : 'POST',
      token,
      body: parsed,
      responseSchema: adminTopicDetailResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось сохранить тему.',
    });
  },

  listLessons(token: string) {
    return request<AdminLessonListResponse>({
      path: '/admin/lessons',
      method: 'GET',
      token,
      responseSchema: adminLessonListResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить уроки.',
    });
  },

  getLesson(token: string, id: string) {
    return request<AdminLessonDetailResponse>({
      path: `/admin/lessons/${id}`,
      method: 'GET',
      token,
      responseSchema: adminLessonDetailResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить урок.',
    });
  },

  saveLesson(token: string, payload: AdminLessonUpsertRequest) {
    const parsed = adminLessonUpsertRequestSchema.parse(payload);
    const id = extractEntityId(parsed.item);
    return request<AdminLessonDetailResponse>({
      path: id ? `/admin/lessons/${id}` : '/admin/lessons',
      method: id ? 'PATCH' : 'POST',
      token,
      body: parsed,
      responseSchema: adminLessonDetailResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось сохранить урок.',
    });
  },

  validateImport(token: string, payload: AdminImportRequest) {
    return request<AdminImportValidateResponse>({
      path: '/admin/import/validate',
      method: 'POST',
      token,
      body: adminImportRequestSchema.parse(payload),
      responseSchema: adminImportValidateResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось проверить импорт.',
    });
  },

  applyImport(token: string, payload: AdminImportRequest) {
    return request<AdminImportApplyResponse>({
      path: '/admin/import/apply',
      method: 'POST',
      token,
      body: adminImportRequestSchema.parse(payload),
      responseSchema: adminImportApplyResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось применить импорт.',
    });
  },

  bulkUpdateVocabItems(token: string, payload: AdminBulkUpdateVocabItemsRequest) {
    return request<AdminBulkUpdateVocabItemsResponse>({
      path: '/admin/vocab-items/bulk-update',
      method: 'POST',
      token,
      body: adminBulkUpdateVocabItemsRequestSchema.parse(payload),
      responseSchema: adminBulkUpdateVocabItemsResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось выполнить массовое изменение.',
    });
  },

  previewVocabItem(token: string, id: string) {
    return request<AdminPreviewResponse>({
      path: `/admin/preview/vocab-items/${id}`,
      method: 'GET',
      token,
      responseSchema: adminPreviewResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось построить превью.',
    });
  },

  createQaFlag(token: string, payload: AdminQaFlagRequest) {
    return request<AdminQaFlagResponse>({
      path: '/admin/qa-flags',
      method: 'POST',
      token,
      body: adminQaFlagRequestSchema.parse(payload),
      responseSchema: adminQaFlagResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось добавить QA-флаг.',
    });
  },

  resolveQaFlag(token: string, flagId: string) {
    return request<{ success: true }>({
      path: `/admin/qa-flags/${flagId}/resolve`,
      method: 'POST',
      token,
      responseSchema: {
        parse(input) {
          if (
            typeof input === 'object' &&
            input !== null &&
            'success' in input &&
            (input as { success?: unknown }).success === true
          ) {
            return { success: true as const };
          }

          throw new Error('Expected a success payload.');
        },
        safeParse(input) {
          try {
            return { success: true as const, data: this.parse(input) };
          } catch {
            return { success: false as const };
          }
        },
      },
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось закрыть QA-флаг.',
    });
  },

  getHistory(token: string, query: Partial<AdminHistoryQuery>) {
    const parsed = adminHistoryQuerySchema.parse(query);
    const search = new URLSearchParams();
    if (parsed.entityType) {
      search.set('entityType', parsed.entityType);
    }
    if (parsed.entityId) {
      search.set('entityId', parsed.entityId);
    }
    search.set('limit', String(parsed.limit));

    return request<AdminHistoryResponse>({
      path: `/admin/history?${search.toString()}`,
      method: 'GET',
      token,
      responseSchema: adminHistoryResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить историю изменений.',
    });
  },

  getAnalyticsOverview(token: string, query: Partial<AnalyticsAdminQuery> = {}) {
    return request<AnalyticsOverviewResponse>({
      path: `/admin/analytics/overview${buildAnalyticsSearch(query)}`,
      method: 'GET',
      token,
      responseSchema: analyticsOverviewResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить обзор аналитики.',
    });
  },

  getAnalyticsFunnels(token: string, query: Partial<AnalyticsAdminQuery> = {}) {
    return request<AnalyticsFunnelsResponse>({
      path: `/admin/analytics/funnels${buildAnalyticsSearch(query)}`,
      method: 'GET',
      token,
      responseSchema: analyticsFunnelsResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить воронку аналитики.',
    });
  },

  getAnalyticsContent(token: string, query: Partial<AnalyticsAdminQuery> = {}) {
    return request<AnalyticsContentResponse>({
      path: `/admin/analytics/content${buildAnalyticsSearch(query)}`,
      method: 'GET',
      token,
      responseSchema: analyticsContentResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить контентную аналитику.',
    });
  },

  getAnalyticsRetention(token: string, query: Partial<AnalyticsAdminQuery> = {}) {
    return request<AnalyticsRetentionResponse>({
      path: `/admin/analytics/retention${buildAnalyticsSearch(query)}`,
      method: 'GET',
      token,
      responseSchema: analyticsRetentionResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить retention.',
    });
  },

  listAntiCheatAnomalies(token: string, query: Partial<AntiCheatAnomalyListQuery>) {
    const parsed = antiCheatAnomalyListQuerySchema.parse(query);
    const search = new URLSearchParams();
    if (parsed.userId) {
      search.set('userId', parsed.userId);
    }
    if (parsed.runId) {
      search.set('runId', parsed.runId);
    }
    if (parsed.type) {
      search.set('type', parsed.type);
    }
    if (parsed.severity) {
      search.set('severity', parsed.severity);
    }
    search.set('limit', String(parsed.limit));

    return request<AntiCheatAnomalyListResponse>({
      path: `/admin/anti-cheat/anomalies?${search.toString()}`,
      method: 'GET',
      token,
      responseSchema: antiCheatAnomalyListResponseSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить anti-cheat события.',
    });
  },

  getSoftLaunchStatus(token: string) {
    return request<SoftLaunchStatus>({
      path: '/admin/soft-launch',
      method: 'GET',
      token,
      responseSchema: softLaunchStatusSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить soft-launch статус.',
    });
  },

  updateSoftLaunchSettings(token: string, payload: SoftLaunchUpdateRequest) {
    return request<SoftLaunchStatus>({
      path: '/admin/soft-launch',
      method: 'PATCH',
      token,
      body: softLaunchUpdateRequestSchema.parse(payload),
      responseSchema: softLaunchStatusSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось обновить soft-launch настройки.',
    });
  },

  getSoftLaunchLaunchReport(token: string, query: Partial<SoftLaunchReportQuery> = {}) {
    return request<SoftLaunchLaunchReport>({
      path: `/admin/soft-launch/reports/launch${buildSoftLaunchSearch(query)}`,
      method: 'GET',
      token,
      responseSchema: softLaunchLaunchReportSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить launch report.',
    });
  },

  getSoftLaunchRetentionReport(token: string, query: Partial<SoftLaunchReportQuery> = {}) {
    return request<SoftLaunchRetentionReport>({
      path: `/admin/soft-launch/reports/retention${buildSoftLaunchSearch(query)}`,
      method: 'GET',
      token,
      responseSchema: softLaunchRetentionReportSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить retention report.',
    });
  },

  getSoftLaunchContentReport(token: string, query: Partial<SoftLaunchReportQuery> = {}) {
    return request<SoftLaunchContentIssueReport>({
      path: `/admin/soft-launch/reports/content${buildSoftLaunchSearch(query)}`,
      method: 'GET',
      token,
      responseSchema: softLaunchContentIssueReportSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить content issue report.',
    });
  },

  getSoftLaunchTuningReport(token: string, query: Partial<SoftLaunchReportQuery> = {}) {
    return request<SoftLaunchTuningBacklogReport>({
      path: `/admin/soft-launch/reports/tuning${buildSoftLaunchSearch(query)}`,
      method: 'GET',
      token,
      responseSchema: softLaunchTuningBacklogReportSchema,
      errorSchemas: [adminErrorSchema, authErrorSchema],
      fallbackErrorMessage: 'Не удалось загрузить tuning backlog.',
    });
  },
};

export function isSessionError(error: unknown): error is AdminApiError & { code: AuthError['code'] } {
  return error instanceof AdminApiError && (error.code === 'missing_session' || error.code === 'invalid_session');
}

async function request<T>(input: {
  path: string;
  method: 'GET' | 'POST' | 'PATCH';
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
    throw new AdminApiError(0, {}, 'Не удалось связаться с API CMS.');
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    throw buildApiError(response.status, payload, input.errorSchemas, input.fallbackErrorMessage);
  }

  return input.responseSchema.parse(payload);
}

function buildApiError(
  status: number,
  payload: unknown,
  schemas: readonly SchemaLike<ApiErrorPayload>[],
  fallbackMessage: string,
) {
  for (const schema of schemas) {
    const parsed = schema.safeParse(payload);
    if (parsed.success) {
      return new AdminApiError(status, parsed.data, fallbackMessage);
    }
  }

  return new AdminApiError(status, {}, fallbackMessage);
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

function extractEntityId(item: unknown) {
  if (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof (item as { id?: unknown }).id === 'string'
  ) {
    return (item as { id: string }).id;
  }

  return '';
}

function buildAnalyticsSearch(query: Partial<AnalyticsAdminQuery>) {
  const parsed = analyticsAdminQuerySchema.parse(query);
  const search = new URLSearchParams();
  if (parsed.from) {
    search.set('from', parsed.from);
  }
  if (parsed.to) {
    search.set('to', parsed.to);
  }
  if (parsed.levelId) {
    search.set('levelId', parsed.levelId);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

function buildSoftLaunchSearch(query: Partial<SoftLaunchReportQuery>) {
  const parsed = softLaunchReportQuerySchema.parse(query);
  const search = new URLSearchParams();
  if (parsed.from) {
    search.set('from', parsed.from);
  }
  if (parsed.to) {
    search.set('to', parsed.to);
  }
  if (parsed.levelId) {
    search.set('levelId', parsed.levelId);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}
