import type {
  AdminBulkUpdateVocabItemsResponse,
  AdminError,
  AdminHistoryResponse,
  AdminImportApplyResponse,
  AdminImportValidateResponse,
  AdminLessonDetailResponse,
  AdminLessonListResponse,
  AdminPreviewResponse,
  AdminQaFlagResponse,
  AdminTopicDetailResponse,
  AdminTopicListResponse,
  AdminVocabDetailResponse,
  AdminVocabListResponse,
} from '@langue-buster/shared';
import {
  adminBulkUpdateVocabItemsRequestSchema,
  adminHistoryQuerySchema,
  adminImportRequestSchema,
  adminLessonUpsertRequestSchema,
  adminQaFlagRequestSchema,
  adminTopicUpsertRequestSchema,
  adminVocabListQuerySchema,
  adminVocabUpsertRequestSchema,
} from '@langue-buster/shared';

import { normalizeAuthError } from '../auth/service.js';
import { ContentAdminDomainError } from './errors.js';
import type { ContentAdminService } from './service.js';

type AdminVerifier = {
  verify(authorizationHeader: string | undefined): Promise<{
    user: {
      id: string;
      telegramUserId: string;
    };
  }>;
};

export type ContentAdminHttpResult = {
  status: number;
  body:
    | AdminVocabListResponse
    | AdminVocabDetailResponse
    | AdminTopicListResponse
    | AdminTopicDetailResponse
    | AdminLessonListResponse
    | AdminLessonDetailResponse
    | AdminImportValidateResponse
    | AdminImportApplyResponse
    | AdminBulkUpdateVocabItemsResponse
    | AdminPreviewResponse
    | AdminQaFlagResponse
    | AdminHistoryResponse
    | { success: true }
    | AdminError;
};

export type ContentAdminController = ReturnType<typeof createContentAdminController>;

export function createContentAdminController(service: ContentAdminService, verifier: AdminVerifier) {
  return {
    async handleListVocabItems(query: unknown, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        await verifier.verify(authorizationHeader);
        const payload = adminVocabListQuerySchema.parse(query);
        return {
          status: 200,
          body: await service.listVocabItems(payload),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleGetVocabItem(id: string, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        await verifier.verify(authorizationHeader);
        return {
          status: 200,
          body: await service.getVocabItem(id),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleSaveVocabItem(body: unknown, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        const session = await verifier.verify(authorizationHeader);
        const payload = adminVocabUpsertRequestSchema.parse(body);
        return {
          status: 200,
          body: await service.saveVocabItem(payload, {
            userId: session.user.id,
            telegramUserId: session.user.telegramUserId,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleListTopics(authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        await verifier.verify(authorizationHeader);
        return {
          status: 200,
          body: await service.listTopics(),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleGetTopic(id: string, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        await verifier.verify(authorizationHeader);
        return {
          status: 200,
          body: await service.getTopic(id),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleSaveTopic(body: unknown, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        const session = await verifier.verify(authorizationHeader);
        const payload = adminTopicUpsertRequestSchema.parse(body);
        return {
          status: 200,
          body: await service.saveTopic(payload, {
            userId: session.user.id,
            telegramUserId: session.user.telegramUserId,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleListLessons(authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        await verifier.verify(authorizationHeader);
        return {
          status: 200,
          body: await service.listLessons(),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleGetLesson(id: string, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        await verifier.verify(authorizationHeader);
        return {
          status: 200,
          body: await service.getLesson(id),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleSaveLesson(body: unknown, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        const session = await verifier.verify(authorizationHeader);
        const payload = adminLessonUpsertRequestSchema.parse(body);
        return {
          status: 200,
          body: await service.saveLesson(payload, {
            userId: session.user.id,
            telegramUserId: session.user.telegramUserId,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleValidateImport(body: unknown, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        await verifier.verify(authorizationHeader);
        const payload = adminImportRequestSchema.parse(body);
        return {
          status: 200,
          body: service.validateImport(payload.bundle),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleApplyImport(body: unknown, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        const session = await verifier.verify(authorizationHeader);
        const payload = adminImportRequestSchema.parse(body);
        return {
          status: 200,
          body: await service.applyImport(payload.bundle, {
            userId: session.user.id,
            telegramUserId: session.user.telegramUserId,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleBulkUpdateVocabItems(body: unknown, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        const session = await verifier.verify(authorizationHeader);
        const payload = adminBulkUpdateVocabItemsRequestSchema.parse(body);
        return {
          status: 200,
          body: await service.bulkUpdateVocabItems(payload, {
            userId: session.user.id,
            telegramUserId: session.user.telegramUserId,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handlePreviewVocabItem(id: string, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        await verifier.verify(authorizationHeader);
        return {
          status: 200,
          body: await service.previewVocabItem(id),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleCreateQaFlag(body: unknown, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        const session = await verifier.verify(authorizationHeader);
        const payload = adminQaFlagRequestSchema.parse(body);
        return {
          status: 200,
          body: await service.addQaFlag(payload, {
            userId: session.user.id,
            telegramUserId: session.user.telegramUserId,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleResolveQaFlag(flagId: string, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        const session = await verifier.verify(authorizationHeader);
        return {
          status: 200,
          body: { ...(await service.resolveQaFlag(flagId, {
            userId: session.user.id,
            telegramUserId: session.user.telegramUserId,
          })) },
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleGetHistory(query: unknown, authorizationHeader: string | undefined): Promise<ContentAdminHttpResult> {
      try {
        await verifier.verify(authorizationHeader);
        const payload = adminHistoryQuerySchema.parse(query);
        return {
          status: 200,
          body: await service.getHistory(payload),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },
  };
}

export function createUnavailableContentAdminController(message: string) {
  const body: AdminError = {
    code: 'admin_unavailable',
    message,
  };

  return {
    handleListVocabItems(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleGetVocabItem(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleSaveVocabItem(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleListTopics(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleGetTopic(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleSaveTopic(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleListLessons(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleGetLesson(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleSaveLesson(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleValidateImport(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleApplyImport(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleBulkUpdateVocabItems(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handlePreviewVocabItem(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleCreateQaFlag(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleResolveQaFlag(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleGetHistory(): Promise<ContentAdminHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
  };
}

function toErrorResult(error: unknown): ContentAdminHttpResult {
  if (error instanceof ContentAdminDomainError) {
    return {
      status: mapContentAdminErrorStatus(error.code),
      body: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (isValidationError(error)) {
    return {
      status: 400,
      body: {
        code: 'content_validation_failed',
        message: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' | '),
      },
    };
  }

  const normalizedAuthError = normalizeAuthError(error);
  if (normalizedAuthError.code === 'missing_session' || normalizedAuthError.code === 'invalid_session') {
    return {
      status: 401,
      body: {
        code: 'admin_unavailable',
        message: normalizedAuthError.message,
      },
    };
  }

  return {
    status: 400,
    body: {
      code: 'admin_unavailable',
      message: normalizedAuthError.message,
    },
  };
}

function isValidationError(
  error: unknown,
): error is Readonly<{ issues: ReadonlyArray<Readonly<{ path: readonly (string | number)[]; message: string }>> }> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

function mapContentAdminErrorStatus(code: AdminError['code']) {
  switch (code) {
    case 'admin_forbidden':
      return 403;
    case 'content_not_found':
      return 404;
    case 'content_publish_blocked':
    case 'content_validation_failed':
    case 'content_conflict':
      return 409;
    case 'content_import_invalid':
      return 400;
    case 'admin_unavailable':
      return 503;
    default:
      return 400;
  }
}
