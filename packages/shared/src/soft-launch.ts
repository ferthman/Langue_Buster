import { z } from 'zod';

const softLaunchLevelSchema = z.enum(['A1', 'A2']);

export const softLaunchSettingsSchema = z.object({
  startingHearts: z.number().int().positive(),
  wrongAnswerHeartLoss: z.number().int().positive(),
  learningToStableSuccessStreak: z.number().int().positive(),
  stableToMasteredSuccessStreak: z.number().int().positive(),
  learningRequiresCorrectOverWrong: z.boolean(),
  masteredMaxWrongCount: z.number().int().nonnegative(),
  weakReviewHours: z.number().positive(),
  learningReviewHours: z.number().positive(),
  stableReviewDays: z.number().positive(),
  masteredReviewDays: z.number().positive(),
  weakResurfaceWindowHours: z.number().positive(),
});
export type SoftLaunchSettings = z.infer<typeof softLaunchSettingsSchema>;

export const softLaunchSettingsSnapshotSchema = z.object({
  id: z.string().trim().min(1),
  settings: softLaunchSettingsSchema,
  note: z.string().trim().min(1).optional(),
  createdAt: z.string().datetime(),
  createdByUserId: z.string().trim().min(1).optional(),
  createdByTelegramUserId: z.string().trim().min(1).optional(),
  isActive: z.boolean(),
});
export type SoftLaunchSettingsSnapshot = z.infer<typeof softLaunchSettingsSnapshotSchema>;

export const softLaunchStatusSchema = z.object({
  enabled: z.boolean(),
  launchLevels: z.array(softLaunchLevelSchema).length(2),
  allowedUserIdsCount: z.number().int().nonnegative(),
  allowedTelegramUserIdsCount: z.number().int().nonnegative(),
  activeSettings: softLaunchSettingsSnapshotSchema,
});
export type SoftLaunchStatus = z.infer<typeof softLaunchStatusSchema>;

export const softLaunchReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  levelId: softLaunchLevelSchema.optional(),
});
export type SoftLaunchReportQuery = z.infer<typeof softLaunchReportQuerySchema>;

export const softLaunchKpiSchema = z.object({
  onboardingCompletionCount: z.number().int().nonnegative(),
  onboardingCompletionRate: z.number().min(0).max(1),
  firstRunStartCount: z.number().int().nonnegative(),
  firstRunFinishCount: z.number().int().nonnegative(),
  runCompletionCount: z.number().int().nonnegative(),
  runAbandonCount: z.number().int().nonnegative(),
  reviewAdoptionCount: z.number().int().nonnegative(),
  reviewAdoptionRate: z.number().min(0).max(1),
  answerAccuracy: z.number().min(0).max(1),
  averageRunLengthSeconds: z.number().nonnegative(),
  runtimeFailureCount: z.number().int().nonnegative(),
});
export type SoftLaunchKpi = z.infer<typeof softLaunchKpiSchema>;

export const softLaunchAnomalySummarySchema = z.object({
  type: z.string().trim().min(1),
  severity: z.enum(['low', 'medium', 'high']),
  count: z.number().int().nonnegative(),
});
export type SoftLaunchAnomalySummary = z.infer<typeof softLaunchAnomalySummarySchema>;

export const softLaunchRecentFailureSchema = z.object({
  eventName: z.string().trim().min(1),
  occurredAt: z.string().datetime(),
  code: z.string().trim().min(1).optional(),
  route: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
});
export type SoftLaunchRecentFailure = z.infer<typeof softLaunchRecentFailureSchema>;

export const softLaunchLaunchReportSchema = z.object({
  generatedAt: z.string().datetime(),
  query: softLaunchReportQuerySchema,
  kpis: softLaunchKpiSchema,
  runtimeFailures: z.object({
    count: z.number().int().nonnegative(),
    recent: z.array(softLaunchRecentFailureSchema),
  }),
  antiCheat: z.object({
    totalCount: z.number().int().nonnegative(),
    byType: z.array(softLaunchAnomalySummarySchema),
  }),
  markdownSummary: z.string().trim().min(1),
});
export type SoftLaunchLaunchReport = z.infer<typeof softLaunchLaunchReportSchema>;

export const softLaunchRetentionReportSchema = z.object({
  generatedAt: z.string().datetime(),
  query: softLaunchReportQuerySchema,
  cohortSize: z.number().int().nonnegative(),
  d1RetainedUsers: z.number().int().nonnegative(),
  d7RetainedUsers: z.number().int().nonnegative(),
  d1Rate: z.number().min(0).max(1),
  d7Rate: z.number().min(0).max(1),
  replayUsers: z.number().int().nonnegative(),
  replayRate: z.number().min(0).max(1),
  markdownSummary: z.string().trim().min(1),
});
export type SoftLaunchRetentionReport = z.infer<typeof softLaunchRetentionReportSchema>;

export const softLaunchContentIssueItemSchema = z.object({
  sourceItemId: z.string().trim().min(1),
  topicId: z.string().trim().min(1).optional(),
  lessonIds: z.array(z.string().trim().min(1)),
  wrongAnswerCount: z.number().int().nonnegative(),
  reviewWrongCount: z.number().int().nonnegative(),
  weakMasteryCount: z.number().int().nonnegative(),
  resurfacingCount: z.number().int().nonnegative(),
  issueScore: z.number().nonnegative(),
});
export type SoftLaunchContentIssueItem = z.infer<typeof softLaunchContentIssueItemSchema>;

export const softLaunchClusterSchema = z.object({
  id: z.string().trim().min(1),
  answerCount: z.number().int().nonnegative(),
  wrongAnswerCount: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});
export type SoftLaunchCluster = z.infer<typeof softLaunchClusterSchema>;

export const softLaunchContentIssueReportSchema = z.object({
  generatedAt: z.string().datetime(),
  query: softLaunchReportQuerySchema,
  topFailedItems: z.array(softLaunchContentIssueItemSchema),
  weakTopicClusters: z.array(softLaunchClusterSchema),
  weakLessonClusters: z.array(softLaunchClusterSchema),
  markdownSummary: z.string().trim().min(1),
});
export type SoftLaunchContentIssueReport = z.infer<typeof softLaunchContentIssueReportSchema>;

export const softLaunchTuningBacklogSignalSchema = z.object({
  key: z.string().trim().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  note: z.string().trim().min(1),
});
export type SoftLaunchTuningBacklogSignal = z.infer<typeof softLaunchTuningBacklogSignalSchema>;

export const softLaunchTuningBacklogReportSchema = z.object({
  generatedAt: z.string().datetime(),
  query: softLaunchReportQuerySchema,
  activeSettings: softLaunchSettingsSnapshotSchema,
  observedSignals: z.array(softLaunchTuningBacklogSignalSchema),
  recommendedAdjustments: z.array(z.string().trim().min(1)),
  openRisks: z.array(z.string().trim().min(1)),
  markdownSummary: z.string().trim().min(1),
});
export type SoftLaunchTuningBacklogReport = z.infer<typeof softLaunchTuningBacklogReportSchema>;

export const softLaunchUpdateRequestSchema = z.object({
  settings: softLaunchSettingsSchema,
  note: z.string().trim().min(1).optional(),
});
export type SoftLaunchUpdateRequest = z.infer<typeof softLaunchUpdateRequestSchema>;

