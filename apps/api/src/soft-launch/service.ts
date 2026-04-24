import type {
  AnalyticsAdminQuery,
  SessionVerificationResponse,
  SoftLaunchContentIssueReport,
  SoftLaunchKpi,
  SoftLaunchLaunchReport,
  SoftLaunchRetentionReport,
  SoftLaunchSettings,
  SoftLaunchSettingsSnapshot,
  SoftLaunchStatus,
  SoftLaunchTuningBacklogReport,
  SoftLaunchUpdateRequest,
  UserMastery,
} from '@langue-buster/shared';
import {
  analyticsAdminQuerySchema,
  launchLevels,
  softLaunchContentIssueReportSchema,
  softLaunchLaunchReportSchema,
  softLaunchRetentionReportSchema,
  softLaunchSettingsSchema,
  softLaunchSettingsSnapshotSchema,
  softLaunchStatusSchema,
  softLaunchTuningBacklogReportSchema,
  softLaunchUpdateRequestSchema,
} from '@langue-buster/shared';
import { phase11LaunchBundle } from '@langue-buster/content-core/phase11-launch-pack';

import { AuthDomainError } from '../auth/errors.js';
import type { SessionVerifier } from '../auth/session-verifier.js';
import { getBearerToken } from '../auth/session-verifier.js';
import { parseCommaSeparatedEnv } from '../content-admin/auth.js';
import type { StoredAnalyticsEvent } from '../analytics/repository.js';
import type { PostgresAnalyticsEventRepository } from '../analytics/repository.js';
import type { AntiCheatAnomalyRepository } from '../anti-cheat/repository.js';
import type { UserMasteryRepository } from '../mastery/repositories.js';
import type { SoftLaunchSettingsRepository } from './repository.js';

type SoftLaunchServiceDependencies = {
  settingsRepository: SoftLaunchSettingsRepository;
  analyticsRepository: PostgresAnalyticsEventRepository;
  antiCheatAnomalyRepository: AntiCheatAnomalyRepository;
  userMasteryRepository: UserMasteryRepository;
  sessionVerifier: SessionVerifier;
  env: Record<string, string | undefined>;
  now?: () => Date;
};

const runtimeFailureEventNames = new Set<string>([
  'app_bootstrap_failed',
  'auth_bootstrap_failed',
  'user_visible_failure',
] as const);

const runOrReviewEventNames = new Set<string>([
  'run_started',
  'run_completed',
  'run_abandoned',
  'review_queue_opened',
  'review_answer_submitted',
] as const);

export type SoftLaunchService = ReturnType<typeof createSoftLaunchService>;

export function createSoftLaunchService(dependencies: SoftLaunchServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const accessPolicy = createSoftLaunchAccessPolicy(dependencies.env);
  const softLaunchAllowedUserIds = parseCommaSeparatedEnv(dependencies.env.SOFT_LAUNCH_ALLOWED_USER_IDS);
  const softLaunchAllowedTelegramUserIds = parseCommaSeparatedEnv(dependencies.env.SOFT_LAUNCH_ALLOWED_TELEGRAM_USER_IDS);
  const defaultSettings = resolveDefaultSoftLaunchSettings(dependencies.env);

  async function getActiveSettings(): Promise<SoftLaunchSettings> {
    const active = await dependencies.settingsRepository.findActive();
    return active?.settings ?? defaultSettings;
  }

  async function getActiveSettingsSnapshot(): Promise<SoftLaunchSettingsSnapshot> {
    const active = await dependencies.settingsRepository.findActive();
    if (active) {
      return active;
    }

    return softLaunchSettingsSnapshotSchema.parse({
      id: 'soft_env_default',
      settings: defaultSettings,
      note: 'Environment default snapshot.',
      createdAt: now().toISOString(),
      isActive: true,
    });
  }

  async function getStatus(): Promise<SoftLaunchStatus> {
    return softLaunchStatusSchema.parse({
      enabled: isSoftLaunchEnabled(dependencies.env),
      launchLevels,
      allowedUserIdsCount: softLaunchAllowedUserIds.size,
      allowedTelegramUserIdsCount: softLaunchAllowedTelegramUserIds.size,
      activeSettings: await getActiveSettingsSnapshot(),
    });
  }

  async function getLaunchReport(rawQuery: unknown): Promise<SoftLaunchLaunchReport> {
    const query = analyticsAdminQuerySchema.parse(rawQuery ?? {});
    const events = filterEvents(await dependencies.analyticsRepository.listAll(), query);
    const anomalies = filterAnomalies(
      await dependencies.antiCheatAnomalyRepository.list({ limit: 200 }),
      query,
    );
    const kpis = buildKpis(events);
    const runtimeFailures = buildRuntimeFailures(events);

    return softLaunchLaunchReportSchema.parse({
      generatedAt: now().toISOString(),
      query,
      kpis,
      runtimeFailures,
      antiCheat: {
        totalCount: anomalies.length,
        byType: aggregateAnomalies(anomalies),
      },
      markdownSummary: [
        '# Launch report',
        `- Onboarding completion: ${kpis.onboardingCompletionCount} (${formatPercent(kpis.onboardingCompletionRate)})`,
        `- First run start / finish: ${kpis.firstRunStartCount} / ${kpis.firstRunFinishCount}`,
        `- Review adoption: ${kpis.reviewAdoptionCount} (${formatPercent(kpis.reviewAdoptionRate)})`,
        `- Answer accuracy: ${formatPercent(kpis.answerAccuracy)}`,
        `- Runtime failures: ${runtimeFailures.count}`,
        `- Anti-cheat anomalies: ${anomalies.length}`,
      ].join('\n'),
    });
  }

  async function getRetentionReport(rawQuery: unknown): Promise<SoftLaunchRetentionReport> {
    const query = analyticsAdminQuerySchema.parse(rawQuery ?? {});
    const events = filterEvents(await dependencies.analyticsRepository.listAll(), query);
    const userActivity = new Map<string, Set<string>>();
    const replayUsers = new Set<string>();

    for (const event of events) {
      if (!event.userId || !runOrReviewEventNames.has(event.eventName)) {
        continue;
      }

      const activeDays = userActivity.get(event.userId) ?? new Set<string>();
      activeDays.add(startOfDay(event.occurredAt));
      userActivity.set(event.userId, activeDays);
    }

    let d1RetainedUsers = 0;
    let d7RetainedUsers = 0;
    for (const [userId, activeDays] of userActivity.entries()) {
      const orderedDays = [...activeDays].sort();
      const firstSeen = orderedDays[0];
      if (!firstSeen) {
        continue;
      }
      if (orderedDays.length >= 2) {
        replayUsers.add(userId);
      }
      if (activeDays.has(addDays(firstSeen, 1))) {
        d1RetainedUsers += 1;
      }
      if (activeDays.has(addDays(firstSeen, 7))) {
        d7RetainedUsers += 1;
      }
    }

    const cohortSize = userActivity.size;
    return softLaunchRetentionReportSchema.parse({
      generatedAt: now().toISOString(),
      query,
      cohortSize,
      d1RetainedUsers,
      d7RetainedUsers,
      d1Rate: ratio(d1RetainedUsers, cohortSize),
      d7Rate: ratio(d7RetainedUsers, cohortSize),
      replayUsers: replayUsers.size,
      replayRate: ratio(replayUsers.size, cohortSize),
      markdownSummary: [
        '# Retention report',
        `- Cohort size: ${cohortSize}`,
        `- D1 retention: ${d1RetainedUsers} (${formatPercent(ratio(d1RetainedUsers, cohortSize))})`,
        `- D7 retention: ${d7RetainedUsers} (${formatPercent(ratio(d7RetainedUsers, cohortSize))})`,
        `- Replay users: ${replayUsers.size} (${formatPercent(ratio(replayUsers.size, cohortSize))})`,
      ].join('\n'),
    });
  }

  async function getContentIssueReport(rawQuery: unknown): Promise<SoftLaunchContentIssueReport> {
    const query = analyticsAdminQuerySchema.parse(rawQuery ?? {});
    const events = filterEvents(await dependencies.analyticsRepository.listAll(), query);
    const masteries = filterMasteries(await dependencies.userMasteryRepository.listAll(), query);
    const itemStats = buildContentIssueStats(events, masteries);
    const lessonMap = buildLessonMap();
    const topicMap = new Map(phase11LaunchBundle.vocabItems.map((item) => [item.id, item.topicId]));
    const weakTopicClusters = buildTopicClusters(events);
    const weakLessonClusters = buildLessonClusters(events);

    return softLaunchContentIssueReportSchema.parse({
      generatedAt: now().toISOString(),
      query,
      topFailedItems: [...itemStats.entries()]
        .map(([sourceItemId, stats]) => ({
          sourceItemId,
          topicId: topicMap.get(sourceItemId),
          lessonIds: lessonMap.get(sourceItemId) ?? [],
          wrongAnswerCount: stats.wrongAnswerCount,
          reviewWrongCount: stats.reviewWrongCount,
          weakMasteryCount: stats.weakMasteryCount,
          resurfacingCount: stats.resurfacingCount,
          issueScore: stats.wrongAnswerCount + stats.reviewWrongCount + stats.weakMasteryCount + (stats.resurfacingCount * 0.5),
        }))
        .sort((left, right) => right.issueScore - left.issueScore)
        .slice(0, 20),
      weakTopicClusters,
      weakLessonClusters,
      markdownSummary: [
        '# Content issue report',
        `- Failed item candidates: ${Math.min(itemStats.size, 20)}`,
        `- Weak topic clusters: ${weakTopicClusters.length}`,
        `- Weak lesson clusters: ${weakLessonClusters.length}`,
      ].join('\n'),
    });
  }

  async function getTuningBacklogReport(rawQuery: unknown): Promise<SoftLaunchTuningBacklogReport> {
    const query = analyticsAdminQuerySchema.parse(rawQuery ?? {});
    const launchReport = await getLaunchReport(query);
    const retentionReport = await getRetentionReport(query);
    const contentReport = await getContentIssueReport(query);
    const activeSettings = await getActiveSettingsSnapshot();

    const observedSignals = [
      {
        key: 'answerAccuracy',
        value: Number(launchReport.kpis.answerAccuracy.toFixed(3)),
        note: 'Combined run and review correctness in the selected soft-launch window.',
      },
      {
        key: 'averageRunLengthSeconds',
        value: Number(launchReport.kpis.averageRunLengthSeconds.toFixed(1)),
        note: 'Average duration of completed runs.',
      },
      {
        key: 'reviewAdoptionRate',
        value: Number(launchReport.kpis.reviewAdoptionRate.toFixed(3)),
        note: 'Share of first-run starters that opened review.',
      },
      {
        key: 'd1Rate',
        value: Number(retentionReport.d1Rate.toFixed(3)),
        note: 'Day-1 return rate for active soft-launch users.',
      },
      {
        key: 'topContentIssueScore',
        value: Number((contentReport.topFailedItems[0]?.issueScore ?? 0).toFixed(1)),
        note: 'Highest ranked content issue candidate in the current window.',
      },
    ];

    const recommendedAdjustments = buildTuningRecommendations(launchReport.kpis, retentionReport, contentReport);
    const openRisks = buildOpenRisks(launchReport, retentionReport, contentReport);

    return softLaunchTuningBacklogReportSchema.parse({
      generatedAt: now().toISOString(),
      query,
      activeSettings,
      observedSignals,
      recommendedAdjustments,
      openRisks,
      markdownSummary: [
        '# Tuning backlog',
        ...recommendedAdjustments.map((item) => `- ${item}`),
        ...openRisks.map((item) => `- Risk: ${item}`),
      ].join('\n'),
    });
  }

  return {
    getActiveSettings,
    getActiveSettingsSnapshot,

    async verifyPlayerAccess(authorizationHeader: string | undefined): Promise<SessionVerificationResponse> {
      const token = getBearerToken(authorizationHeader);
      const session = await dependencies.sessionVerifier.verifySessionToken(token);
      accessPolicy.assertUserAccess(session.user.id, session.user.telegramUserId);
      return session;
    },

    assertTelegramAuthAccess(user: { id: string; telegramUserId: string }) {
      accessPolicy.assertUserAccess(user.id, user.telegramUserId);
    },

    assertUserAccess(userId: string, telegramUserId: string) {
      accessPolicy.assertUserAccess(userId, telegramUserId);
    },

    getStatus,

    async updateSettings(
      actor: SessionVerificationResponse,
      body: unknown,
    ): Promise<SoftLaunchStatus> {
      const payload: SoftLaunchUpdateRequest = softLaunchUpdateRequestSchema.parse(body);
      await dependencies.settingsRepository.activateSnapshot({
        settings: payload.settings,
        note: payload.note,
        createdAt: now().toISOString(),
        createdByUserId: actor.user.id,
        createdByTelegramUserId: actor.user.telegramUserId,
      });
      return getStatus();
    },

    getLaunchReport,
    getRetentionReport,
    getContentIssueReport,
    getTuningBacklogReport,
  };
}

export function isSoftLaunchEnabled(env: Record<string, string | undefined>): boolean {
  return env.SOFT_LAUNCH_ENABLED === 'true' || env.SOFT_LAUNCH_ENABLED === '1';
}

export function createSoftLaunchAccessPolicy(env: Record<string, string | undefined>) {
  const adminAllowedUserIds = parseCommaSeparatedEnv(env.ADMIN_ALLOWED_USER_IDS);
  const adminAllowedTelegramUserIds = parseCommaSeparatedEnv(env.ADMIN_ALLOWED_TELEGRAM_USER_IDS);
  const softLaunchAllowedUserIds = parseCommaSeparatedEnv(env.SOFT_LAUNCH_ALLOWED_USER_IDS);
  const softLaunchAllowedTelegramUserIds = parseCommaSeparatedEnv(env.SOFT_LAUNCH_ALLOWED_TELEGRAM_USER_IDS);

  return {
    assertUserAccess(userId: string, telegramUserId: string) {
      if (!isSoftLaunchEnabled(env)) {
        return;
      }

      const isAdmin = adminAllowedUserIds.has(userId) || adminAllowedTelegramUserIds.has(telegramUserId);
      const isAllowed = softLaunchAllowedUserIds.has(userId) || softLaunchAllowedTelegramUserIds.has(telegramUserId);
      if (isAdmin || isAllowed) {
        return;
      }

      throw new AuthDomainError(
        'soft_launch_unavailable',
        'Soft launch is currently limited to the invited A1/A2 cohort.',
      );
    },
  };
}

export function resolveDefaultSoftLaunchSettings(env: Record<string, string | undefined>): SoftLaunchSettings {
  return softLaunchSettingsSchema.parse({
    startingHearts: toNumber(env.SOFT_LAUNCH_STARTING_HEARTS, 3),
    wrongAnswerHeartLoss: toNumber(env.SOFT_LAUNCH_WRONG_ANSWER_HEART_LOSS, 1),
    learningToStableSuccessStreak: toNumber(env.SOFT_LAUNCH_LEARNING_TO_STABLE_SUCCESS_STREAK, 3),
    stableToMasteredSuccessStreak: toNumber(env.SOFT_LAUNCH_STABLE_TO_MASTERED_SUCCESS_STREAK, 6),
    learningRequiresCorrectOverWrong: toBoolean(env.SOFT_LAUNCH_LEARNING_REQUIRES_CORRECT_OVER_WRONG, true),
    masteredMaxWrongCount: toNumber(env.SOFT_LAUNCH_MASTERED_MAX_WRONG_COUNT, 2),
    weakReviewHours: toNumber(env.SOFT_LAUNCH_WEAK_REVIEW_HOURS, 2),
    learningReviewHours: toNumber(env.SOFT_LAUNCH_LEARNING_REVIEW_HOURS, 12),
    stableReviewDays: toNumber(env.SOFT_LAUNCH_STABLE_REVIEW_DAYS, 3),
    masteredReviewDays: toNumber(env.SOFT_LAUNCH_MASTERED_REVIEW_DAYS, 10),
    weakResurfaceWindowHours: toNumber(env.SOFT_LAUNCH_WEAK_RESURFACE_WINDOW_HOURS, 2),
  });
}

function filterEvents(events: readonly StoredAnalyticsEvent[], query: AnalyticsAdminQuery): readonly StoredAnalyticsEvent[] {
  return events.filter((event) => {
    if (query.levelId && event.levelId !== query.levelId) {
      return false;
    }
    if (query.from && event.occurredAt < query.from) {
      return false;
    }
    if (query.to && event.occurredAt > query.to) {
      return false;
    }
    return true;
  });
}

function filterAnomalies(
  anomalies: readonly {
    type: string;
    severity: 'low' | 'medium' | 'high';
    occurredAt: string;
  }[],
  query: AnalyticsAdminQuery,
) {
  return anomalies.filter((anomaly) => {
    if (query.from && anomaly.occurredAt < query.from) {
      return false;
    }
    if (query.to && anomaly.occurredAt > query.to) {
      return false;
    }
    return true;
  });
}

function filterMasteries(masteries: readonly UserMastery[], query: AnalyticsAdminQuery) {
  return masteries.filter((mastery) => {
    if (query.levelId && mastery.cefrLevel !== query.levelId) {
      return false;
    }
    if (query.from && mastery.updatedAt < query.from) {
      return false;
    }
    if (query.to && mastery.updatedAt > query.to) {
      return false;
    }
    return true;
  });
}

function buildKpis(events: readonly StoredAnalyticsEvent[]): SoftLaunchKpi {
  const onboardingStartedUsers = uniqueUsers(events, 'onboarding_started');
  const onboardingCompletedUsers = uniqueUsers(events, 'onboarding_completed');
  const firstRunStartUsers = uniqueUsers(events, 'run_started');
  const firstRunFinishUsers = uniqueUsers(events, 'run_completed');
  const reviewAdoptionUsers = uniqueUsers(events, 'review_queue_opened');
  const completedRuns = events.filter((event) => event.eventName === 'run_completed');
  const abandonedRuns = events.filter((event) => event.eventName === 'run_abandoned');
  const answerCorrectCount = events.filter((event) => event.eventName === 'answer_correct' || event.eventName === 'review_answer_correct').length;
  const answerWrongCount = events.filter((event) => event.eventName === 'answer_wrong' || event.eventName === 'review_answer_wrong').length;
  const durationValues = completedRuns
    .map((event) => ('durationMs' in event.payload ? event.payload.durationMs : undefined))
    .filter((value): value is number => typeof value === 'number');

  return {
    onboardingCompletionCount: onboardingCompletedUsers.size,
    onboardingCompletionRate: ratio(onboardingCompletedUsers.size, onboardingStartedUsers.size),
    firstRunStartCount: firstRunStartUsers.size,
    firstRunFinishCount: firstRunFinishUsers.size,
    runCompletionCount: completedRuns.length,
    runAbandonCount: abandonedRuns.length,
    reviewAdoptionCount: reviewAdoptionUsers.size,
    reviewAdoptionRate: ratio(reviewAdoptionUsers.size, firstRunStartUsers.size || onboardingCompletedUsers.size),
    answerAccuracy: ratio(answerCorrectCount, answerCorrectCount + answerWrongCount),
    averageRunLengthSeconds: average(durationValues) / 1000,
    runtimeFailureCount: events.filter((event) => runtimeFailureEventNames.has(event.eventName)).length,
  };
}

function buildRuntimeFailures(events: readonly StoredAnalyticsEvent[]) {
  const recent = events
    .filter((event) => runtimeFailureEventNames.has(event.eventName))
    .slice(-10)
    .reverse()
    .map((event) => ({
      eventName: event.eventName,
      occurredAt: event.occurredAt,
      code: 'code' in event.payload && typeof event.payload.code === 'string' ? event.payload.code : undefined,
      route: 'route' in event.payload && typeof event.payload.route === 'string' ? event.payload.route : undefined,
      userId: event.userId,
    }));

  return {
    count: recent.length > 0 ? events.filter((event) => runtimeFailureEventNames.has(event.eventName)).length : 0,
    recent,
  };
}

function aggregateAnomalies(anomalies: readonly { type: string; severity: 'low' | 'medium' | 'high' }[]) {
  const counts = new Map<string, { type: string; severity: 'low' | 'medium' | 'high'; count: number }>();
  for (const anomaly of anomalies) {
    const key = `${anomaly.type}:${anomaly.severity}`;
    const current = counts.get(key) ?? {
      type: anomaly.type,
      severity: anomaly.severity,
      count: 0,
    };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.values()].sort((left, right) => right.count - left.count);
}

function buildContentIssueStats(events: readonly StoredAnalyticsEvent[], masteries: readonly UserMastery[]) {
  const itemStats = new Map<string, {
    wrongAnswerCount: number;
    reviewWrongCount: number;
    weakMasteryCount: number;
    resurfacingCount: number;
  }>();

  for (const event of events) {
    if (!event.sourceItemId) {
      continue;
    }
    const current = itemStats.get(event.sourceItemId) ?? {
      wrongAnswerCount: 0,
      reviewWrongCount: 0,
      weakMasteryCount: 0,
      resurfacingCount: 0,
    };
    if (event.eventName === 'answer_wrong') {
      current.wrongAnswerCount += 1;
    }
    if (event.eventName === 'review_answer_wrong') {
      current.reviewWrongCount += 1;
    }
    if (event.eventName === 'review_queue_opened') {
      current.resurfacingCount += 1;
    }
    itemStats.set(event.sourceItemId, current);
  }

  for (const mastery of masteries) {
    const current = itemStats.get(mastery.sourceItemId) ?? {
      wrongAnswerCount: 0,
      reviewWrongCount: 0,
      weakMasteryCount: 0,
      resurfacingCount: 0,
    };
    if (mastery.masteryState === 'weak' || mastery.failureStreak >= 2) {
      current.weakMasteryCount += 1;
    }
    itemStats.set(mastery.sourceItemId, current);
  }

  return itemStats;
}

function buildTopicClusters(events: readonly StoredAnalyticsEvent[]) {
  const stats = new Map<string, { answerCount: number; wrongAnswerCount: number }>();
  for (const event of events) {
    if (!event.topicId || (event.eventName !== 'answer_correct' && event.eventName !== 'answer_wrong')) {
      continue;
    }
    const current = stats.get(event.topicId) ?? { answerCount: 0, wrongAnswerCount: 0 };
    current.answerCount += 1;
    if (event.eventName === 'answer_wrong') {
      current.wrongAnswerCount += 1;
    }
    stats.set(event.topicId, current);
  }
  return [...stats.entries()]
    .map(([id, current]) => ({
      id,
      answerCount: current.answerCount,
      wrongAnswerCount: current.wrongAnswerCount,
      accuracy: ratio(current.answerCount - current.wrongAnswerCount, current.answerCount),
    }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 10);
}

function buildLessonClusters(events: readonly StoredAnalyticsEvent[]) {
  const stats = new Map<string, { answerCount: number; wrongAnswerCount: number }>();
  for (const event of events) {
    if (!event.lessonId || (event.eventName !== 'answer_correct' && event.eventName !== 'answer_wrong')) {
      continue;
    }
    const current = stats.get(event.lessonId) ?? { answerCount: 0, wrongAnswerCount: 0 };
    current.answerCount += 1;
    if (event.eventName === 'answer_wrong') {
      current.wrongAnswerCount += 1;
    }
    stats.set(event.lessonId, current);
  }
  return [...stats.entries()]
    .map(([id, current]) => ({
      id,
      answerCount: current.answerCount,
      wrongAnswerCount: current.wrongAnswerCount,
      accuracy: ratio(current.answerCount - current.wrongAnswerCount, current.answerCount),
    }))
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 10);
}

function buildLessonMap() {
  const map = new Map<string, string[]>();
  for (const lesson of phase11LaunchBundle.lessons) {
    for (const ref of lesson.contentRefs) {
      map.set(ref.itemId, [...(map.get(ref.itemId) ?? []), lesson.id]);
    }
  }
  return map;
}

function buildTuningRecommendations(
  kpis: SoftLaunchKpi,
  retention: SoftLaunchRetentionReport,
  content: SoftLaunchContentIssueReport,
) {
  const recommendations: string[] = [];
  if (kpis.answerAccuracy < 0.55) {
    recommendations.push('Review distractor quality and consider reducing wrong-answer penalty harshness before the next cohort expansion.');
  }
  if (kpis.averageRunLengthSeconds < 45) {
    recommendations.push('Observed runs are short; monitor whether starting hearts or heart-loss should be softened for first-session clarity.');
  }
  if (retention.d1Rate < 0.25) {
    recommendations.push('D1 retention is weak; verify onboarding clarity and review resurfacing frequency before widening the cohort.');
  }
  if ((content.topFailedItems[0]?.issueScore ?? 0) > 5) {
    recommendations.push('Top failed items show concentrated friction; patch the highest-ranked distractor/content issues within the daily review loop.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Keep current tuning for the next soft-launch slice and collect a larger sample before changing thresholds.');
  }
  return recommendations;
}

function buildOpenRisks(
  launchReport: SoftLaunchLaunchReport,
  retentionReport: SoftLaunchRetentionReport,
  contentReport: SoftLaunchContentIssueReport,
) {
  const risks: string[] = [];
  if (launchReport.kpis.runtimeFailureCount > 0) {
    risks.push('Runtime failures were surfaced in the selected window and should be reviewed before cohort expansion.');
  }
  if (launchReport.antiCheat.totalCount > 0) {
    risks.push('Anti-cheat anomalies were recorded during the current window; verify they are benign before scaling traffic.');
  }
  if (retentionReport.cohortSize < 10) {
    risks.push('Current cohort is still small, so retention and tuning conclusions may be noisy.');
  }
  if (contentReport.topFailedItems.length === 0) {
    risks.push('Content issue report has a sparse signal; confirm real gameplay volume before assuming content stability.');
  }
  return risks;
}

function uniqueUsers(events: readonly StoredAnalyticsEvent[], eventName: StoredAnalyticsEvent['eventName']) {
  return new Set(
    events
      .filter((event) => event.eventName === eventName && event.userId)
      .map((event) => event.userId as string),
  );
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function average(values: readonly number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return fallback;
}

function startOfDay(value: string) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

function addDays(value: string, days: number) {
  return new Date(new Date(value).getTime() + (days * 24 * 60 * 60 * 1000)).toISOString();
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
