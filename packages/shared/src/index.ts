import { z } from 'zod';

export * from './auth.js';
export * from './analytics.js';
export * from './soft-launch.js';

export const cefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export type CefrLevelId = z.infer<typeof cefrLevelSchema>;

export const launchLevels = ['A1', 'A2'] as const satisfies readonly CefrLevelId[];

export const CLASSIC_RUN_BOARD_SIZE = 8;
export const CLASSIC_RUN_TRAY_SIZE = 3;
export const CLASSIC_RUN_DEFAULT_HEARTS = 5;
export const CLASSIC_RUN_DEFAULT_SHORT_CYCLE_GAP = 5;
export const CLASSIC_RUN_DEFAULT_SHORT_CYCLE_RECENT_WINDOW = 5;

export const cefrLevels = [
  { id: 'A1', label: 'A1 · Старт' },
  { id: 'A2', label: 'A2 · База' },
  { id: 'B1', label: 'B1 · Самостоятельность' },
  { id: 'B2', label: 'B2 · Свободное общение' },
  { id: 'C1', label: 'C1 · Продвинутый уровень' },
  { id: 'C2', label: 'C2 · Почти носитель' },
] as const satisfies ReadonlyArray<{ id: CefrLevelId; label: string }>;

export const languageCodeSchema = z.enum(['ru', 'fr']);
export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const contentStatusSchema = z.enum(['draft', 'on_review', 'approved', 'archived']);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const answerDirectionSchema = z.enum(['ru_to_fr', 'fr_to_ru']);
export type AnswerDirection = z.infer<typeof answerDirectionSchema>;

export const boardCellStateSchema = z.enum(['empty', 'filled']);
export type BoardCellState = z.infer<typeof boardCellStateSchema>;

export const coordinateSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});
export type Coordinate = z.infer<typeof coordinateSchema>;

export const pieceIdSchema = z.enum([
  'single_1',
  'bar_h_2',
  'bar_h_3',
  'bar_h_4',
  'bar_h_5',
  'bar_v_2',
  'bar_v_3',
  'bar_v_4',
  'bar_v_5',
  'square_2',
  'rect_2x3',
  'l3',
]);
export type PieceId = z.infer<typeof pieceIdSchema>;

export const pieceInstanceSchema = z.object({
  instanceId: z.string().min(1),
  pieceId: pieceIdSchema,
});
export type PieceInstance = z.infer<typeof pieceInstanceSchema>;

export const traySlotSchema = pieceInstanceSchema.nullable();
export type TraySlot = z.infer<typeof traySlotSchema>;

export const trayStateSchema = z.tuple([traySlotSchema, traySlotSchema, traySlotSchema]);
export type TrayState = z.infer<typeof trayStateSchema>;

export const boardStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  cells: z.array(boardCellStateSchema),
}).superRefine((value, context) => {
  if (value.cells.length !== value.width * value.height) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Board cell count must match width * height.',
      path: ['cells'],
    });
  }
});
export type BoardState = z.infer<typeof boardStateSchema>;

export const engineRngStateSchema = z.object({
  seed: z.number().int().nonnegative(),
  cursor: z.number().int().nonnegative(),
});
export type EngineRngState = z.infer<typeof engineRngStateSchema>;

export const engineStateSchema = z.object({
  board: boardStateSchema,
  tray: trayStateSchema,
  rng: engineRngStateSchema,
  score: z.number().int().nonnegative(),
  combo: z.number().int().nonnegative(),
  turn: z.number().int().nonnegative(),
  lastClearCount: z.number().int().nonnegative(),
  clearedLinesTotal: z.number().int().nonnegative(),
});
export type EngineState = z.infer<typeof engineStateSchema>;

export const questionCardTypeSchema = z.enum([
  'single_word_translation',
  'phrase_translation',
  'article_noun_selection',
]);
export type QuestionCardType = z.infer<typeof questionCardTypeSchema>;

export const questionOptionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  isCorrect: z.boolean(),
  linkedItemId: z.string().trim().min(1).optional(),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

export const generatedQuestionMetaSchema = z.object({
  sourceItemId: z.string().trim().min(1),
  topicId: z.string().trim().min(1),
  distractorSource: z.enum(['linked_set', 'fallback_pool']),
  generatorVersion: z.string().trim().min(1),
});
export type GeneratedQuestionMeta = z.infer<typeof generatedQuestionMetaSchema>;

export const generatedQuestionSchema = z.object({
  id: z.string().trim().min(1),
  cardType: questionCardTypeSchema,
  promptLanguage: languageCodeSchema,
  answerLanguage: languageCodeSchema,
  promptText: z.string().trim().min(1),
  options: z.array(questionOptionSchema).min(2),
  correctOptionId: z.string().trim().min(1),
  sourceItemIds: z.array(z.string().trim().min(1)).min(1),
  cefrLevel: cefrLevelSchema,
  meta: generatedQuestionMetaSchema,
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const answerPenaltySchema = z.object({
  applies: z.literal(true),
  penaltyType: z.literal('heart_loss'),
  amount: z.number().int().positive(),
});
export type AnswerPenalty = z.infer<typeof answerPenaltySchema>;

export const answerEvaluationSchema = z.object({
  questionId: z.string().trim().min(1),
  selectedOptionId: z.string().trim().min(1),
  correctOptionId: z.string().trim().min(1),
  isCorrect: z.boolean(),
  moveUnlocked: z.boolean(),
  penalty: answerPenaltySchema.nullable(),
  cardType: questionCardTypeSchema,
  sourceItemId: z.string().trim().min(1),
  cefrLevel: cefrLevelSchema,
  timingMs: z.number().int().nonnegative().optional(),
});
export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>;

export const runStatusSchema = z.enum(['active', 'awaiting_move', 'completed', 'failed', 'abandoned']);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runQuestionAnswerStateSchema = z.enum(['awaiting_answer', 'answered_correct', 'answered_wrong']);
export type RunQuestionAnswerState = z.infer<typeof runQuestionAnswerStateSchema>;

export const runQuestionStateSchema = z.object({
  sequence: z.number().int().nonnegative(),
  shownAt: z.string().datetime(),
  answeredAt: z.string().datetime().optional(),
  answerState: runQuestionAnswerStateSchema,
  selectedOptionId: z.string().trim().min(1).optional(),
  question: generatedQuestionSchema,
});
export type RunQuestionState = z.infer<typeof runQuestionStateSchema>;

export const scoreBreakdownSchema = z.object({
  placementPoints: z.number().int().nonnegative(),
  lineClearPoints: z.number().int().nonnegative(),
  multiLineBonus: z.number().int().nonnegative(),
  comboBonus: z.number().int().nonnegative(),
  totalPoints: z.number().int().nonnegative(),
  clearedRowCount: z.number().int().nonnegative(),
  clearedColumnCount: z.number().int().nonnegative(),
});
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export const runRecoveryEntrySchema = z.object({
  sourceItemId: z.string().trim().min(1),
  availableAfterSequence: z.number().int().nonnegative(),
  failureCount: z.number().int().positive(),
});
export type RunRecoveryEntry = z.infer<typeof runRecoveryEntrySchema>;

export const runRecoveryStateSchema = z.object({
  pending: z.array(runRecoveryEntrySchema).default([]),
  recentSourceItemIds: z.array(z.string().trim().min(1)).default([]),
  resurfacingGap: z.number().int().positive().default(CLASSIC_RUN_DEFAULT_SHORT_CYCLE_GAP),
});
export type RunRecoveryState = z.infer<typeof runRecoveryStateSchema>;

export const moveValidationResultSchema = z.enum(['accepted', 'rejected']);
export type MoveValidationResult = z.infer<typeof moveValidationResultSchema>;

export const runSessionSchema = z.object({
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  levelId: cefrLevelSchema,
  direction: answerDirectionSchema,
  status: runStatusSchema,
  heartsRemaining: z.number().int().nonnegative(),
  score: z.number().int().nonnegative(),
  combo: z.number().int().nonnegative(),
  seed: z.number().int().nonnegative(),
  engineState: engineStateSchema,
  recoveryState: runRecoveryStateSchema.optional(),
  currentQuestionState: runQuestionStateSchema.nullable(),
  answerCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  moveCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
});
export type RunSession = z.infer<typeof runSessionSchema>;

export const answerEventSchema = z.object({
  id: z.string().trim().min(1),
  runId: z.string().trim().min(1),
  questionId: z.string().trim().min(1),
  sourceItemId: z.string().trim().min(1),
  selectedOptionId: z.string().trim().min(1),
  correctOptionId: z.string().trim().min(1),
  correctness: z.boolean(),
  timingMs: z.number().int().nonnegative().optional(),
  penalty: answerPenaltySchema.nullable(),
  occurredAt: z.string().datetime(),
});
export type AnswerEvent = z.infer<typeof answerEventSchema>;

export const moveEventSchema = z.object({
  id: z.string().trim().min(1),
  runId: z.string().trim().min(1),
  engineTurn: z.number().int().nonnegative(),
  trayIndex: z.number().int().min(0).max(2),
  pieceInstanceId: z.string().trim().min(1),
  pieceId: pieceIdSchema,
  origin: coordinateSchema,
  validationResult: moveValidationResultSchema,
  clearedLineCount: z.number().int().nonnegative(),
  scoreBreakdown: scoreBreakdownSchema,
  resultingScore: z.number().int().nonnegative(),
  resultingCombo: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
});
export type MoveEvent = z.infer<typeof moveEventSchema>;

export const runResultSchema = z.object({
  runId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  levelId: cefrLevelSchema,
  direction: answerDirectionSchema,
  status: runStatusSchema,
  finalScore: z.number().int().nonnegative(),
  clearedLinesTotal: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  masteryAppliedAt: z.string().datetime().optional(),
});
export type RunResult = z.infer<typeof runResultSchema>;

export const masteryStateSchema = z.enum(['new', 'learning', 'weak', 'stable', 'mastered']);
export type MasteryState = z.infer<typeof masteryStateSchema>;

export const reviewResurfacingReasonSchema = z.enum([
  'new_item',
  'recent_failure',
  'weak_item',
  'scheduled_review',
  'streak_recovery',
]);
export type ReviewResurfacingReason = z.infer<typeof reviewResurfacingReasonSchema>;

export const masteryOutcomeSchema = z.enum(['correct', 'wrong']);
export type MasteryOutcome = z.infer<typeof masteryOutcomeSchema>;

export const userMasterySchema = z.object({
  userId: z.string().trim().min(1),
  sourceItemId: z.string().trim().min(1),
  cefrLevel: cefrLevelSchema,
  masteryState: masteryStateSchema,
  seenCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  successStreak: z.number().int().nonnegative(),
  failureStreak: z.number().int().nonnegative(),
  lastSeenAt: z.string().datetime(),
  lastOutcome: masteryOutcomeSchema,
  lastTimingMs: z.number().int().nonnegative().optional(),
  averageTimingMs: z.number().int().nonnegative().optional(),
  nextReviewAt: z.string().datetime(),
  resurfacingReason: reviewResurfacingReasonSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserMastery = z.infer<typeof userMasterySchema>;

export const reviewQueueItemSchema = z.object({
  userId: z.string().trim().min(1),
  sourceItemId: z.string().trim().min(1),
  cefrLevel: cefrLevelSchema,
  masteryState: masteryStateSchema,
  nextReviewAt: z.string().datetime(),
  priority: z.number().int().nonnegative(),
  reason: reviewResurfacingReasonSchema,
  topicId: z.string().trim().min(1).optional(),
  question: generatedQuestionSchema.optional(),
  lastSeenAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;

export const reviewAnswerEventSchema = z.object({
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  sourceItemId: z.string().trim().min(1),
  questionId: z.string().trim().min(1),
  selectedOptionId: z.string().trim().min(1),
  correctOptionId: z.string().trim().min(1),
  correctness: z.boolean(),
  timingMs: z.number().int().nonnegative().optional(),
  masteryStateBefore: masteryStateSchema,
  masteryStateAfter: masteryStateSchema,
  occurredAt: z.string().datetime(),
});
export type ReviewAnswerEvent = z.infer<typeof reviewAnswerEventSchema>;

export const launchLevelSchema = z.enum(launchLevels);
export type LaunchLevelId = z.infer<typeof launchLevelSchema>;

export const runStartRequestSchema = z.object({
  levelId: launchLevelSchema,
  direction: answerDirectionSchema.default('ru_to_fr'),
});
export type RunStartRequest = z.infer<typeof runStartRequestSchema>;

export const runStartResponseSchema = z.object({
  run: runSessionSchema,
});
export type RunStartResponse = z.infer<typeof runStartResponseSchema>;

export const runAnswerRequestSchema = z.object({
  selectedOptionId: z.string().trim().min(1),
  answeredAt: z.string().datetime().optional(),
});
export type RunAnswerRequest = z.infer<typeof runAnswerRequestSchema>;

export const runAnswerResponseSchema = z.object({
  run: runSessionSchema,
  evaluation: answerEvaluationSchema,
  result: runResultSchema.optional(),
});
export type RunAnswerResponse = z.infer<typeof runAnswerResponseSchema>;

export const runMoveRequestSchema = z.object({
  trayIndex: z.number().int().min(0).max(2),
  origin: coordinateSchema,
});
export type RunMoveRequest = z.infer<typeof runMoveRequestSchema>;

export const runMoveResponseSchema = z.object({
  run: runSessionSchema,
  moveEvent: moveEventSchema,
  result: runResultSchema.optional(),
});
export type RunMoveResponse = z.infer<typeof runMoveResponseSchema>;

export const runFinishResponseSchema = z.object({
  run: runSessionSchema,
  result: runResultSchema,
});
export type RunFinishResponse = z.infer<typeof runFinishResponseSchema>;

export const runStateResponseSchema = z.object({
  run: runSessionSchema,
});
export type RunStateResponse = z.infer<typeof runStateResponseSchema>;

export const runResultResponseSchema = z.object({
  result: runResultSchema,
});
export type RunResultResponse = z.infer<typeof runResultResponseSchema>;

export const reviewQueueQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  levelId: launchLevelSchema.optional(),
  direction: answerDirectionSchema.default('ru_to_fr'),
});
export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema>;

export const reviewQueueResponseSchema = z.object({
  items: z.array(reviewQueueItemSchema),
});
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;

export const reviewAnswerRequestSchema = z.object({
  sourceItemId: z.string().trim().min(1),
  questionId: z.string().trim().min(1),
  selectedOptionId: z.string().trim().min(1),
  answeredAt: z.string().datetime().optional(),
  direction: answerDirectionSchema.default('ru_to_fr'),
});
export type ReviewAnswerRequest = z.infer<typeof reviewAnswerRequestSchema>;

export const reviewAnswerResponseSchema = z.object({
  evaluation: answerEvaluationSchema,
  mastery: userMasterySchema,
  reviewQueueItem: reviewQueueItemSchema,
});
export type ReviewAnswerResponse = z.infer<typeof reviewAnswerResponseSchema>;

export const runErrorCodeSchema = z.enum([
  'run_not_found',
  'run_forbidden',
  'run_invalid_state',
  'run_invalid_move',
  'run_invalid_answer',
  'run_result_unavailable',
  'run_integrity_error',
  'soft_launch_unavailable',
  'run_unavailable',
]);
export type RunErrorCode = z.infer<typeof runErrorCodeSchema>;

export const runErrorSchema = z.object({
  code: runErrorCodeSchema,
  message: z.string().min(1),
});
export type RunError = z.infer<typeof runErrorSchema>;

export const reviewErrorCodeSchema = z.enum([
  'review_item_not_found',
  'review_question_mismatch',
  'review_invalid_answer',
  'soft_launch_unavailable',
  'review_unavailable',
]);
export type ReviewErrorCode = z.infer<typeof reviewErrorCodeSchema>;

export const reviewErrorSchema = z.object({
  code: reviewErrorCodeSchema,
  message: z.string().min(1),
});
export type ReviewError = z.infer<typeof reviewErrorSchema>;

export const adminEntityTypeSchema = z.enum(['vocab_item', 'topic', 'lesson', 'distractor_set', 'level']);
export type AdminEntityType = z.infer<typeof adminEntityTypeSchema>;

export const adminQaFlagTypeSchema = z.enum([
  'ambiguous',
  'broken_distractors',
  'wrong_translation',
  'invalid_grammar',
  'needs_review',
]);
export type AdminQaFlagType = z.infer<typeof adminQaFlagTypeSchema>;

export const adminQaFlagStatusSchema = z.enum(['active', 'resolved']);
export type AdminQaFlagStatus = z.infer<typeof adminQaFlagStatusSchema>;

export const adminValidationIssueSchema = z.object({
  path: z.string().min(1),
  message: z.string().min(1),
});
export type AdminValidationIssue = z.infer<typeof adminValidationIssueSchema>;

export const adminContentPayloadSchema = z.record(z.string(), z.unknown());
export type AdminContentPayload = z.infer<typeof adminContentPayloadSchema>;

export const adminVocabListSortSchema = z.enum(['updatedAt', 'lemma', 'frequencyScore', 'status']);
export type AdminVocabListSort = z.infer<typeof adminVocabListSortSchema>;

export const adminSortDirectionSchema = z.enum(['asc', 'desc']).default('desc');
export type AdminSortDirection = z.infer<typeof adminSortDirectionSchema>;

export const adminVocabListQuerySchema = z.object({
  search: z.string().trim().optional(),
  levelId: cefrLevelSchema.optional(),
  topicId: z.string().trim().min(1).optional(),
  status: contentStatusSchema.optional(),
  sortBy: adminVocabListSortSchema.default('updatedAt'),
  sortDirection: adminSortDirectionSchema,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminVocabListQuery = z.infer<typeof adminVocabListQuerySchema>;

export const adminVocabListItemSchema = z.object({
  id: z.string().trim().min(1),
  lemma: z.string().trim().min(1),
  surfaceForm: z.string().trim().min(1),
  cefrLevel: cefrLevelSchema,
  topicId: z.string().trim().min(1),
  status: contentStatusSchema,
  frequencyScore: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  openQaFlagCount: z.number().int().nonnegative(),
});
export type AdminVocabListItem = z.infer<typeof adminVocabListItemSchema>;

export const adminVocabListResponseSchema = z.object({
  items: z.array(adminVocabListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type AdminVocabListResponse = z.infer<typeof adminVocabListResponseSchema>;

export const adminQaFlagSchema = z.object({
  id: z.string().trim().min(1),
  entityType: adminEntityTypeSchema,
  entityId: z.string().trim().min(1),
  flagType: adminQaFlagTypeSchema,
  note: z.string().trim().min(1).optional(),
  status: adminQaFlagStatusSchema,
  createdAt: z.string().datetime(),
  createdByUserId: z.string().trim().min(1),
  createdByTelegramUserId: z.string().trim().min(1),
  resolvedAt: z.string().datetime().optional(),
  resolvedByUserId: z.string().trim().min(1).optional(),
  resolvedByTelegramUserId: z.string().trim().min(1).optional(),
});
export type AdminQaFlag = z.infer<typeof adminQaFlagSchema>;

export const adminAuditLogEntrySchema = z.object({
  id: z.string().trim().min(1),
  entityType: adminEntityTypeSchema,
  entityId: z.string().trim().min(1),
  actionType: z.string().trim().min(1),
  actorUserId: z.string().trim().min(1),
  actorTelegramUserId: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  meta: z.unknown().optional(),
  occurredAt: z.string().datetime(),
});
export type AdminAuditLogEntry = z.infer<typeof adminAuditLogEntrySchema>;

export const adminVocabDetailResponseSchema = z.object({
  item: adminContentPayloadSchema,
  qaFlags: z.array(adminQaFlagSchema),
  history: z.array(adminAuditLogEntrySchema),
  validationIssues: z.array(adminValidationIssueSchema),
});
export type AdminVocabDetailResponse = z.infer<typeof adminVocabDetailResponseSchema>;

export const adminTopicListItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  status: contentStatusSchema,
  cefrLevels: z.array(cefrLevelSchema),
  updatedAt: z.string().datetime(),
});
export type AdminTopicListItem = z.infer<typeof adminTopicListItemSchema>;

export const adminTopicListResponseSchema = z.object({
  items: z.array(adminTopicListItemSchema),
});
export type AdminTopicListResponse = z.infer<typeof adminTopicListResponseSchema>;

export const adminTopicDetailResponseSchema = z.object({
  item: adminContentPayloadSchema,
  qaFlags: z.array(adminQaFlagSchema),
  history: z.array(adminAuditLogEntrySchema),
  validationIssues: z.array(adminValidationIssueSchema),
});
export type AdminTopicDetailResponse = z.infer<typeof adminTopicDetailResponseSchema>;

export const adminLessonListItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  cefrLevel: cefrLevelSchema,
  status: contentStatusSchema,
  topicIds: z.array(z.string().trim().min(1)),
  updatedAt: z.string().datetime(),
});
export type AdminLessonListItem = z.infer<typeof adminLessonListItemSchema>;

export const adminLessonListResponseSchema = z.object({
  items: z.array(adminLessonListItemSchema),
});
export type AdminLessonListResponse = z.infer<typeof adminLessonListResponseSchema>;

export const adminLessonDetailResponseSchema = z.object({
  item: adminContentPayloadSchema,
  qaFlags: z.array(adminQaFlagSchema),
  history: z.array(adminAuditLogEntrySchema),
  validationIssues: z.array(adminValidationIssueSchema),
});
export type AdminLessonDetailResponse = z.infer<typeof adminLessonDetailResponseSchema>;

export const adminVocabUpsertRequestSchema = z.object({
  item: adminContentPayloadSchema,
});
export type AdminVocabUpsertRequest = z.infer<typeof adminVocabUpsertRequestSchema>;

export const adminTopicUpsertRequestSchema = z.object({
  item: adminContentPayloadSchema,
});
export type AdminTopicUpsertRequest = z.infer<typeof adminTopicUpsertRequestSchema>;

export const adminLessonUpsertRequestSchema = z.object({
  item: adminContentPayloadSchema,
});
export type AdminLessonUpsertRequest = z.infer<typeof adminLessonUpsertRequestSchema>;

export const adminImportRequestSchema = z.object({
  bundle: z.unknown(),
});
export type AdminImportRequest = z.infer<typeof adminImportRequestSchema>;

export const adminImportValidateResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.unknown(),
  }),
  z.object({
    success: z.literal(false),
    issues: z.array(adminValidationIssueSchema),
  }),
]);
export type AdminImportValidateResponse = z.infer<typeof adminImportValidateResponseSchema>;

export const adminImportApplyResponseSchema = z.object({
  counts: z.object({
    levels: z.number().int().nonnegative(),
    topics: z.number().int().nonnegative(),
    lessons: z.number().int().nonnegative(),
    vocabItems: z.number().int().nonnegative(),
    distractorSets: z.number().int().nonnegative(),
  }),
});
export type AdminImportApplyResponse = z.infer<typeof adminImportApplyResponseSchema>;

export const adminBulkUpdateVocabItemsRequestSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1),
  status: contentStatusSchema.optional(),
  topicId: z.string().trim().min(1).optional(),
  levelId: cefrLevelSchema.optional(),
  archive: z.boolean().optional(),
});
export type AdminBulkUpdateVocabItemsRequest = z.infer<typeof adminBulkUpdateVocabItemsRequestSchema>;

export const adminBulkUpdateVocabItemsResponseSchema = z.object({
  updatedIds: z.array(z.string().trim().min(1)),
  skipped: z.array(z.object({
    id: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  })),
});
export type AdminBulkUpdateVocabItemsResponse = z.infer<typeof adminBulkUpdateVocabItemsResponseSchema>;

export const adminPreviewResponseSchema = z.object({
  item: adminContentPayloadSchema,
  question: generatedQuestionSchema,
});
export type AdminPreviewResponse = z.infer<typeof adminPreviewResponseSchema>;

export const adminQaFlagRequestSchema = z.object({
  entityType: z.enum(['vocab_item', 'topic', 'lesson']),
  entityId: z.string().trim().min(1),
  flagType: adminQaFlagTypeSchema,
  note: z.string().trim().min(1).optional(),
});
export type AdminQaFlagRequest = z.infer<typeof adminQaFlagRequestSchema>;

export const adminQaFlagResponseSchema = z.object({
  flag: adminQaFlagSchema,
});
export type AdminQaFlagResponse = z.infer<typeof adminQaFlagResponseSchema>;

export const adminHistoryQuerySchema = z.object({
  entityType: adminEntityTypeSchema.optional(),
  entityId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
export type AdminHistoryQuery = z.infer<typeof adminHistoryQuerySchema>;

export const adminHistoryResponseSchema = z.object({
  entries: z.array(adminAuditLogEntrySchema),
});
export type AdminHistoryResponse = z.infer<typeof adminHistoryResponseSchema>;

export const adminErrorCodeSchema = z.enum([
  'admin_forbidden',
  'content_not_found',
  'content_validation_failed',
  'content_import_invalid',
  'content_publish_blocked',
  'content_conflict',
  'soft_launch_unavailable',
  'admin_unavailable',
]);
export type AdminErrorCode = z.infer<typeof adminErrorCodeSchema>;

export const adminErrorSchema = z.object({
  code: adminErrorCodeSchema,
  message: z.string().min(1),
});
export type AdminError = z.infer<typeof adminErrorSchema>;

export const antiCheatAnomalyTypeSchema = z.enum([
  'rate_limit_exceeded',
  'impossible_answer_timing',
  'impossible_move_cadence',
  'ultra_fast_correct_streak',
  'suspicious_perfect_run',
  'invalid_move_attempt',
  'run_integrity_mismatch',
]);
export type AntiCheatAnomalyType = z.infer<typeof antiCheatAnomalyTypeSchema>;

export const antiCheatSeveritySchema = z.enum(['low', 'medium', 'high']);
export type AntiCheatSeverity = z.infer<typeof antiCheatSeveritySchema>;

export const antiCheatAnomalySchema = z.object({
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1).optional(),
  runId: z.string().trim().min(1).optional(),
  sourceItemId: z.string().trim().min(1).optional(),
  type: antiCheatAnomalyTypeSchema,
  severity: antiCheatSeveritySchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.string().datetime(),
});
export type AntiCheatAnomaly = z.infer<typeof antiCheatAnomalySchema>;

export const antiCheatAnomalyListQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  runId: z.string().trim().min(1).optional(),
  type: antiCheatAnomalyTypeSchema.optional(),
  severity: antiCheatSeveritySchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
export type AntiCheatAnomalyListQuery = z.infer<typeof antiCheatAnomalyListQuerySchema>;

export const antiCheatAnomalyListResponseSchema = z.object({
  anomalies: z.array(antiCheatAnomalySchema),
});
export type AntiCheatAnomalyListResponse = z.infer<typeof antiCheatAnomalyListResponseSchema>;

export const rateLimitedErrorSchema = z.object({
  code: z.literal('rate_limited'),
  message: z.string().trim().min(1),
  retryAfterSeconds: z.number().int().positive(),
});
export type RateLimitedError = z.infer<typeof rateLimitedErrorSchema>;
