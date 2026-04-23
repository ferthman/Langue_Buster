import {
  authResponseSchema,
  reviewAnswerRequestSchema,
  reviewAnswerResponseSchema,
  reviewQueueResponseSchema,
  runAnswerRequestSchema,
  runAnswerResponseSchema,
  adminAuditLogEntrySchema,
  adminBulkUpdateVocabItemsRequestSchema,
  adminBulkUpdateVocabItemsResponseSchema,
  adminErrorSchema,
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
  runFinishResponseSchema,
  runMoveRequestSchema,
  runMoveResponseSchema,
  runResultResponseSchema,
  runStartRequestSchema,
  runStartResponseSchema,
  runStateResponseSchema,
  sessionPayloadSchema,
  sessionVerificationResponseSchema,
  telegramAuthRequestSchema,
  validatedTelegramAuthSchema,
} from '@langue-buster/shared';

import { createAuthModule, createAuthModuleFromEnvironment } from './auth/index.js';
import { createApiRequestHandler, createApiServer, startApiServer } from './server.js';

export const authApiSurface = {
  route: 'POST /auth/telegram',
  request: telegramAuthRequestSchema,
  response: authResponseSchema,
  validatedTelegramAuth: validatedTelegramAuthSchema,
  session: sessionPayloadSchema,
  sessionLookupRoute: 'GET /auth/session',
  sessionLookupResponse: sessionVerificationResponseSchema,
} as const;

export const runApiSurface = {
  startRoute: 'POST /runs/start',
  startRequest: runStartRequestSchema,
  startResponse: runStartResponseSchema,
  answerRoute: 'POST /runs/:runId/answer',
  answerRequest: runAnswerRequestSchema,
  answerResponse: runAnswerResponseSchema,
  moveRoute: 'POST /runs/:runId/move',
  moveRequest: runMoveRequestSchema,
  moveResponse: runMoveResponseSchema,
  finishRoute: 'POST /runs/:runId/finish',
  finishResponse: runFinishResponseSchema,
  stateRoute: 'GET /runs/:runId',
  stateResponse: runStateResponseSchema,
  resultRoute: 'GET /runs/:runId/result',
  resultResponse: runResultResponseSchema,
} as const;

export const reviewApiSurface = {
  queueRoute: 'GET /review/queue',
  queueResponse: reviewQueueResponseSchema,
  answerRoute: 'POST /review/answer',
  answerRequest: reviewAnswerRequestSchema,
  answerResponse: reviewAnswerResponseSchema,
} as const;

export const adminApiSurface = {
  vocabListRoute: 'GET /admin/vocab-items',
  vocabListQuery: adminVocabListQuerySchema,
  vocabListResponse: adminVocabListResponseSchema,
  vocabSaveRoute: 'POST /admin/vocab-items',
  vocabSaveRequest: adminVocabUpsertRequestSchema,
  vocabDetailRoute: 'GET /admin/vocab-items/:id',
  vocabDetailResponse: adminVocabDetailResponseSchema,
  topicListRoute: 'GET /admin/topics',
  topicListResponse: adminTopicListResponseSchema,
  topicSaveRoute: 'POST /admin/topics',
  topicSaveRequest: adminTopicUpsertRequestSchema,
  topicDetailResponse: adminTopicDetailResponseSchema,
  lessonListRoute: 'GET /admin/lessons',
  lessonListResponse: adminLessonListResponseSchema,
  lessonSaveRoute: 'POST /admin/lessons',
  lessonSaveRequest: adminLessonUpsertRequestSchema,
  lessonDetailResponse: adminLessonDetailResponseSchema,
  importRequest: adminImportRequestSchema,
  importValidateResponse: adminImportValidateResponseSchema,
  importApplyResponse: adminImportApplyResponseSchema,
  bulkUpdateRequest: adminBulkUpdateVocabItemsRequestSchema,
  bulkUpdateResponse: adminBulkUpdateVocabItemsResponseSchema,
  previewResponse: adminPreviewResponseSchema,
  qaFlagRequest: adminQaFlagRequestSchema,
  qaFlagResponse: adminQaFlagResponseSchema,
  historyQuery: adminHistoryQuerySchema,
  historyResponse: adminHistoryResponseSchema,
  auditLogEntry: adminAuditLogEntrySchema,
  error: adminErrorSchema,
} as const;

export { createAuthModule };
export { createAuthModuleFromEnvironment, createApiRequestHandler, createApiServer, startApiServer };
export * from './runs/index.js';
export * from './mastery/index.js';
export * from './content-admin/index.js';
export * from './analytics/index.js';
