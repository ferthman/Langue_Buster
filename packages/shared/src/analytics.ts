import { z } from 'zod';

const analyticsCefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const analyticsEventNameSchema = z.enum([
  'app_bootstrap_started',
  'app_bootstrap_succeeded',
  'app_bootstrap_failed',
  'auth_bootstrap_succeeded',
  'auth_bootstrap_failed',
  'onboarding_started',
  'onboarding_completed',
  'onboarding_skipped',
  'placement_started',
  'placement_completed',
  'home_opened',
  'run_screen_opened',
  'review_screen_opened',
  'profile_opened',
  'level_selected',
  'lesson_selected',
  'lesson_completed',
  'run_started',
  'question_shown',
  'answer_submitted',
  'answer_correct',
  'answer_wrong',
  'move_submitted',
  'move_rejected',
  'move_accepted',
  'run_completed',
  'run_abandoned',
  'review_queue_opened',
  'review_answer_submitted',
  'review_answer_correct',
  'review_answer_wrong',
  'retry_clicked',
  'user_visible_failure',
  'admin_import_validated',
  'admin_import_applied',
]);
export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;

export const analyticsEventSourceSchema = z.enum(['frontend', 'backend']);
export type AnalyticsEventSource = z.infer<typeof analyticsEventSourceSchema>;

const analyticsEnvelopeBaseSchema = z.object({
  eventName: analyticsEventNameSchema,
  source: analyticsEventSourceSchema,
  occurredAt: z.string().datetime(),
  userId: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1).optional(),
  runId: z.string().trim().min(1).optional(),
  reviewItemId: z.string().trim().min(1).optional(),
  sourceItemId: z.string().trim().min(1).optional(),
  levelId: analyticsCefrLevelSchema.optional(),
  topicId: z.string().trim().min(1).optional(),
  lessonId: z.string().trim().min(1).optional(),
});

export const analyticsBootstrapPayloadSchema = z.object({
  method: z.enum(['stored_session', 'telegram_auth', 'none']),
  route: z.string().trim().min(1).optional(),
  isTelegram: z.boolean().optional(),
  reasonCode: z.string().trim().min(1).optional(),
});
export type AnalyticsBootstrapPayload = z.infer<typeof analyticsBootstrapPayloadSchema>;

export const analyticsPlacementPayloadSchema = z.object({
  selectedLevelId: analyticsCefrLevelSchema.optional(),
  recommendedLevelId: analyticsCefrLevelSchema.optional(),
});
export type AnalyticsPlacementPayload = z.infer<typeof analyticsPlacementPayloadSchema>;

export const analyticsScreenPayloadSchema = z.object({
  route: z.string().trim().min(1),
  focusLevel: analyticsCefrLevelSchema.optional(),
});
export type AnalyticsScreenPayload = z.infer<typeof analyticsScreenPayloadSchema>;

export const analyticsSelectionPayloadSchema = z.object({
  selectedLevelId: analyticsCefrLevelSchema.optional(),
  topicId: z.string().trim().min(1).optional(),
  lessonId: z.string().trim().min(1).optional(),
  route: z.string().trim().min(1).optional(),
});
export type AnalyticsSelectionPayload = z.infer<typeof analyticsSelectionPayloadSchema>;

export const analyticsQuestionPayloadSchema = z.object({
  questionId: z.string().trim().min(1),
  sequence: z.number().int().nonnegative().optional(),
  cardType: z.string().trim().min(1),
  answerState: z.string().trim().min(1).optional(),
});
export type AnalyticsQuestionPayload = z.infer<typeof analyticsQuestionPayloadSchema>;

export const analyticsAnswerPayloadSchema = z.object({
  questionId: z.string().trim().min(1),
  selectedOptionId: z.string().trim().min(1),
  correctOptionId: z.string().trim().min(1).optional(),
  cardType: z.string().trim().min(1).optional(),
  timingMs: z.number().int().nonnegative().optional(),
  moveUnlocked: z.boolean().optional(),
  correctness: z.boolean().optional(),
});
export type AnalyticsAnswerPayload = z.infer<typeof analyticsAnswerPayloadSchema>;

export const analyticsMovePayloadSchema = z.object({
  trayIndex: z.number().int().min(0).max(2).optional(),
  originX: z.number().int().nonnegative().optional(),
  originY: z.number().int().nonnegative().optional(),
  pieceId: z.string().trim().min(1).optional(),
  pieceInstanceId: z.string().trim().min(1).optional(),
  engineTurn: z.number().int().nonnegative().optional(),
  clearedLineCount: z.number().int().nonnegative().optional(),
  scoreDelta: z.number().int().nonnegative().optional(),
  reasonCode: z.string().trim().min(1).optional(),
});
export type AnalyticsMovePayload = z.infer<typeof analyticsMovePayloadSchema>;

export const analyticsRunPayloadSchema = z.object({
  status: z.string().trim().min(1).optional(),
  score: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  correctCount: z.number().int().nonnegative().optional(),
  wrongCount: z.number().int().nonnegative().optional(),
  moveCount: z.number().int().nonnegative().optional(),
});
export type AnalyticsRunPayload = z.infer<typeof analyticsRunPayloadSchema>;

export const analyticsReviewPayloadSchema = z.object({
  questionId: z.string().trim().min(1).optional(),
  selectedOptionId: z.string().trim().min(1).optional(),
  correctOptionId: z.string().trim().min(1).optional(),
  masteryStateBefore: z.string().trim().min(1).optional(),
  masteryStateAfter: z.string().trim().min(1).optional(),
  timingMs: z.number().int().nonnegative().optional(),
  correctness: z.boolean().optional(),
  queueLength: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(1).optional(),
});
export type AnalyticsReviewPayload = z.infer<typeof analyticsReviewPayloadSchema>;

export const analyticsFailurePayloadSchema = z.object({
  route: z.string().trim().min(1).optional(),
  screen: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  requestPath: z.string().trim().min(1).optional(),
});
export type AnalyticsFailurePayload = z.infer<typeof analyticsFailurePayloadSchema>;

export const analyticsRetryPayloadSchema = z.object({
  route: z.string().trim().min(1).optional(),
  screen: z.string().trim().min(1).optional(),
  target: z.string().trim().min(1).optional(),
});
export type AnalyticsRetryPayload = z.infer<typeof analyticsRetryPayloadSchema>;

export const analyticsAdminImportPayloadSchema = z.object({
  success: z.boolean(),
  levelsCount: z.number().int().nonnegative().optional(),
  topicsCount: z.number().int().nonnegative().optional(),
  lessonsCount: z.number().int().nonnegative().optional(),
  vocabItemsCount: z.number().int().nonnegative().optional(),
  distractorSetsCount: z.number().int().nonnegative().optional(),
  issueCount: z.number().int().nonnegative().optional(),
});
export type AnalyticsAdminImportPayload = z.infer<typeof analyticsAdminImportPayloadSchema>;

export const analyticsEventEnvelopeSchema = z.discriminatedUnion('eventName', [
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('app_bootstrap_started'),
    payload: analyticsBootstrapPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('app_bootstrap_succeeded'),
    payload: analyticsBootstrapPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('app_bootstrap_failed'),
    payload: analyticsFailurePayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('auth_bootstrap_succeeded'),
    payload: analyticsBootstrapPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('auth_bootstrap_failed'),
    payload: analyticsFailurePayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('onboarding_started'),
    payload: analyticsScreenPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('onboarding_completed'),
    payload: analyticsScreenPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('onboarding_skipped'),
    payload: analyticsScreenPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('placement_started'),
    payload: analyticsScreenPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('placement_completed'),
    payload: analyticsPlacementPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('home_opened'),
    payload: analyticsScreenPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('run_screen_opened'),
    payload: analyticsScreenPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('review_screen_opened'),
    payload: analyticsScreenPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('profile_opened'),
    payload: analyticsScreenPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('level_selected'),
    payload: analyticsSelectionPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('lesson_selected'),
    payload: analyticsSelectionPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('lesson_completed'),
    payload: analyticsSelectionPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('run_started'),
    payload: analyticsRunPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('question_shown'),
    payload: analyticsQuestionPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('answer_submitted'),
    payload: analyticsAnswerPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('answer_correct'),
    payload: analyticsAnswerPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('answer_wrong'),
    payload: analyticsAnswerPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('move_submitted'),
    payload: analyticsMovePayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('move_rejected'),
    payload: analyticsMovePayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('move_accepted'),
    payload: analyticsMovePayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('run_completed'),
    payload: analyticsRunPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('run_abandoned'),
    payload: analyticsRunPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('review_queue_opened'),
    payload: analyticsReviewPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('review_answer_submitted'),
    payload: analyticsReviewPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('review_answer_correct'),
    payload: analyticsReviewPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('review_answer_wrong'),
    payload: analyticsReviewPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('retry_clicked'),
    payload: analyticsRetryPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('user_visible_failure'),
    payload: analyticsFailurePayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('admin_import_validated'),
    payload: analyticsAdminImportPayloadSchema,
  }),
  analyticsEnvelopeBaseSchema.extend({
    eventName: z.literal('admin_import_applied'),
    payload: analyticsAdminImportPayloadSchema,
  }),
]);
export type AnalyticsEventEnvelope = z.infer<typeof analyticsEventEnvelopeSchema>;

export const analyticsIngestRequestSchema = z.object({
  events: z.array(analyticsEventEnvelopeSchema).min(1),
});
export type AnalyticsIngestRequest = z.infer<typeof analyticsIngestRequestSchema>;

export const analyticsIngestResponseSchema = z.object({
  acceptedCount: z.number().int().nonnegative(),
  ids: z.array(z.string().trim().min(1)),
});
export type AnalyticsIngestResponse = z.infer<typeof analyticsIngestResponseSchema>;

export const analyticsAdminQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  levelId: analyticsCefrLevelSchema.optional(),
});
export type AnalyticsAdminQuery = z.infer<typeof analyticsAdminQuerySchema>;

export const analyticsOverviewSchema = z.object({
  onboardingCompletionCount: z.number().int().nonnegative(),
  onboardingCompletionRate: z.number().min(0).max(1),
  firstRunStartCount: z.number().int().nonnegative(),
  firstRunFinishCount: z.number().int().nonnegative(),
  reviewAdoptionCount: z.number().int().nonnegative(),
  reviewAdoptionRate: z.number().min(0).max(1),
  runCompletionCount: z.number().int().nonnegative(),
  runAbandonCount: z.number().int().nonnegative(),
  averageRunLengthSeconds: z.number().nonnegative(),
  answerAccuracy: z.number().min(0).max(1),
  lessonCompletionCount: z.number().int().nonnegative(),
});
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;

export const analyticsOverviewResponseSchema = z.object({
  overview: analyticsOverviewSchema,
});
export type AnalyticsOverviewResponse = z.infer<typeof analyticsOverviewResponseSchema>;

export const analyticsFunnelStepSchema = z.object({
  step: z.string().trim().min(1),
  users: z.number().int().nonnegative(),
});
export type AnalyticsFunnelStep = z.infer<typeof analyticsFunnelStepSchema>;

export const analyticsFunnelsResponseSchema = z.object({
  steps: z.array(analyticsFunnelStepSchema),
});
export type AnalyticsFunnelsResponse = z.infer<typeof analyticsFunnelsResponseSchema>;

export const analyticsContentItemSchema = z.object({
  sourceItemId: z.string().trim().min(1),
  topicId: z.string().trim().min(1).optional(),
  lessonIds: z.array(z.string().trim().min(1)),
  wrongAnswerCount: z.number().int().nonnegative(),
  reviewWrongCount: z.number().int().nonnegative(),
  weakMasteryCount: z.number().int().nonnegative(),
  resurfacingCount: z.number().int().nonnegative(),
});
export type AnalyticsContentItem = z.infer<typeof analyticsContentItemSchema>;

export const analyticsTopicPerformanceSchema = z.object({
  topicId: z.string().trim().min(1),
  answerCount: z.number().int().nonnegative(),
  wrongAnswerCount: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});
export type AnalyticsTopicPerformance = z.infer<typeof analyticsTopicPerformanceSchema>;

export const analyticsLessonPerformanceSchema = z.object({
  lessonId: z.string().trim().min(1),
  answerCount: z.number().int().nonnegative(),
  wrongAnswerCount: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});
export type AnalyticsLessonPerformance = z.infer<typeof analyticsLessonPerformanceSchema>;

export const analyticsContentResponseSchema = z.object({
  frequentlyFailedItems: z.array(analyticsContentItemSchema),
  topicPerformance: z.array(analyticsTopicPerformanceSchema),
  lessonPerformance: z.array(analyticsLessonPerformanceSchema),
});
export type AnalyticsContentResponse = z.infer<typeof analyticsContentResponseSchema>;

export const analyticsRetentionResponseSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  d1RetainedUsers: z.number().int().nonnegative(),
  d7RetainedUsers: z.number().int().nonnegative(),
  d1Rate: z.number().min(0).max(1),
  d7Rate: z.number().min(0).max(1),
});
export type AnalyticsRetentionResponse = z.infer<typeof analyticsRetentionResponseSchema>;

export const analyticsErrorCodeSchema = z.enum([
  'analytics_invalid_event',
  'analytics_forbidden',
  'soft_launch_unavailable',
  'analytics_unavailable',
]);
export type AnalyticsErrorCode = z.infer<typeof analyticsErrorCodeSchema>;

export const analyticsErrorSchema = z.object({
  code: analyticsErrorCodeSchema,
  message: z.string().trim().min(1),
});
export type AnalyticsError = z.infer<typeof analyticsErrorSchema>;

export const structuredLogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export type StructuredLogLevel = z.infer<typeof structuredLogLevelSchema>;

export const structuredLogEntrySchema = z.object({
  level: structuredLogLevelSchema,
  message: z.string().trim().min(1),
  timestamp: z.string().datetime(),
  domain: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
  requestId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  runId: z.string().trim().min(1).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});
export type StructuredLogEntry = z.infer<typeof structuredLogEntrySchema>;
