import {
  analyticsContentResponseSchema,
  analyticsFunnelsResponseSchema,
  analyticsIngestRequestSchema,
  analyticsAdminQuerySchema,
  analyticsOverviewResponseSchema,
  analyticsRetentionResponseSchema,
  type AnalyticsAdminQuery,
  type AnalyticsContentResponse,
  type AnalyticsEventEnvelope,
  type AnalyticsFunnelsResponse,
  type AnalyticsIngestRequest,
  type AnalyticsOverviewResponse,
  type AnalyticsRetentionResponse,
  type MasteryState,
} from '@langue-buster/shared';
import { phase11LaunchBundle } from '@langue-buster/content-core/phase11-launch-pack';

import type { SessionVerificationResponse } from '@langue-buster/shared';
import type { UserMasteryRepository } from '../mastery/repositories.js';
import { createAdminSessionGuard, parseCommaSeparatedEnv } from '../content-admin/auth.js';
import type { SessionVerifier } from '../auth/session-verifier.js';
import { getBearerToken } from '../auth/session-verifier.js';
import type { ErrorReporter } from './error-reporter.js';
import type { StructuredLogger } from './logger.js';
import type { PostgresAnalyticsEventRepository, StoredAnalyticsEvent } from './repository.js';

type AnalyticsServiceDependencies = {
  repository: PostgresAnalyticsEventRepository;
  userMasteryRepository: UserMasteryRepository;
  sessionVerifier: SessionVerifier;
  env: Record<string, string | undefined>;
  logger: StructuredLogger;
  errorReporter: ErrorReporter;
  now?: () => Date;
};

const activityEventNames = new Set<string>([
  'run_started',
  'question_shown',
  'answer_submitted',
  'answer_correct',
  'answer_wrong',
  'move_submitted',
  'move_accepted',
  'run_completed',
  'run_abandoned',
  'review_queue_opened',
  'review_answer_submitted',
  'review_answer_correct',
  'review_answer_wrong',
  'home_opened',
  'profile_opened',
  'run_screen_opened',
  'review_screen_opened',
] as const);

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;

export function createAnalyticsService(dependencies: AnalyticsServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const adminGuard = createAdminSessionGuard(dependencies.sessionVerifier, {
    allowedUserIds: parseCommaSeparatedEnv(dependencies.env.ADMIN_ALLOWED_USER_IDS),
    allowedTelegramUserIds: parseCommaSeparatedEnv(dependencies.env.ADMIN_ALLOWED_TELEGRAM_USER_IDS),
  });

  return {
    async ingestClientEvents(
      authorizationHeader: string | undefined,
      body: unknown,
    ) {
      const token = getBearerToken(authorizationHeader);
      const session = await dependencies.sessionVerifier.verifySessionToken(token);
      return saveClientEvents(dependencies, session, body);
    },

    async recordEvent(event: AnalyticsEventEnvelope) {
      return dependencies.repository.save(event);
    },

    async verifyAdmin(authorizationHeader: string | undefined): Promise<SessionVerificationResponse> {
      return adminGuard.verify(authorizationHeader);
    },

    async getOverview(query: unknown = {}): Promise<AnalyticsOverviewResponse> {
      const events = filterEvents(await dependencies.repository.listAll(), analyticsAdminQuerySchema.parse(query));
      const onboardingStartedUsers = uniqueUsers(events, 'onboarding_started');
      const onboardingCompletedUsers = uniqueUsers(events, 'onboarding_completed');
      const firstRunStartUsers = uniqueUsers(events, 'run_started');
      const firstRunFinishUsers = uniqueUsers(events, 'run_completed');
      const reviewAdoptionUsers = uniqueUsers(events, 'review_queue_opened');
      const completedRuns = events.filter((event) => event.eventName === 'run_completed');
      const abandonedRuns = events.filter((event) => event.eventName === 'run_abandoned');
      const answerCorrectCount = events.filter((event) => event.eventName === 'answer_correct' || event.eventName === 'review_answer_correct').length;
      const answerWrongCount = events.filter((event) => event.eventName === 'answer_wrong' || event.eventName === 'review_answer_wrong').length;
      const lessonCompletionCount = events.filter((event) => event.eventName === 'lesson_completed').length;
      const durationValues = completedRuns
        .map((event) => ('durationMs' in event.payload ? event.payload.durationMs : undefined))
        .filter((value): value is number => typeof value === 'number');

      return analyticsOverviewResponseSchema.parse({
        overview: {
          onboardingCompletionCount: onboardingCompletedUsers.size,
          onboardingCompletionRate: ratio(onboardingCompletedUsers.size, onboardingStartedUsers.size),
          firstRunStartCount: firstRunStartUsers.size,
          firstRunFinishCount: firstRunFinishUsers.size,
          reviewAdoptionCount: reviewAdoptionUsers.size,
          reviewAdoptionRate: ratio(reviewAdoptionUsers.size, firstRunStartUsers.size || onboardingCompletedUsers.size),
          runCompletionCount: completedRuns.length,
          runAbandonCount: abandonedRuns.length,
          averageRunLengthSeconds: average(durationValues) / 1000,
          answerAccuracy: ratio(answerCorrectCount, answerCorrectCount + answerWrongCount),
          lessonCompletionCount,
        },
      });
    },

    async getFunnels(query: unknown = {}): Promise<AnalyticsFunnelsResponse> {
      const events = filterEvents(await dependencies.repository.listAll(), analyticsAdminQuerySchema.parse(query));
      const response = {
        steps: [
          { step: 'app_bootstrap', users: uniqueUsers(events, 'app_bootstrap_succeeded').size },
          { step: 'onboarding_completed', users: uniqueUsers(events, 'onboarding_completed').size },
          { step: 'placement_completed', users: uniqueUsers(events, 'placement_completed').size },
          { step: 'first_run_started', users: uniqueUsers(events, 'run_started').size },
          { step: 'first_run_finished', users: uniqueUsers(events, 'run_completed').size },
        ],
      };
      return analyticsFunnelsResponseSchema.parse(response);
    },

    async getContent(query: unknown = {}): Promise<AnalyticsContentResponse> {
      const parsedQuery = analyticsAdminQuerySchema.parse(query);
      const events = filterEvents(await dependencies.repository.listAll(), parsedQuery);
      const masteries = filterMasteries(await dependencies.userMasteryRepository.listAll(), parsedQuery);
      const byItem = new Map<string, {
        wrongAnswerCount: number;
        reviewWrongCount: number;
        weakMasteryCount: number;
        resurfacingCount: number;
      }>();

      for (const event of events) {
        if (!event.sourceItemId) {
          continue;
        }

        const current = byItem.get(event.sourceItemId) ?? {
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

        byItem.set(event.sourceItemId, current);
      }

      for (const mastery of masteries) {
        const current = byItem.get(mastery.sourceItemId) ?? {
          wrongAnswerCount: 0,
          reviewWrongCount: 0,
          weakMasteryCount: 0,
          resurfacingCount: 0,
        };
        if (isWeakMastery(mastery.masteryState)) {
          current.weakMasteryCount += 1;
        }
        byItem.set(mastery.sourceItemId, current);
      }

      const lessonMap = buildLessonMap();
      const topicMap = new Map(phase11LaunchBundle.vocabItems.map((item) => [item.id, item.topicId]));
      const topicStats = new Map<string, { answerCount: number; wrongAnswerCount: number }>();
      const lessonStats = new Map<string, { answerCount: number; wrongAnswerCount: number }>();

      for (const event of events) {
        if (!event.sourceItemId || (event.eventName !== 'answer_correct' && event.eventName !== 'answer_wrong')) {
          continue;
        }

        const topicId = topicMap.get(event.sourceItemId);
        if (topicId) {
          const current = topicStats.get(topicId) ?? { answerCount: 0, wrongAnswerCount: 0 };
          current.answerCount += 1;
          if (event.eventName === 'answer_wrong') {
            current.wrongAnswerCount += 1;
          }
          topicStats.set(topicId, current);
        }

        for (const lessonId of lessonMap.get(event.sourceItemId) ?? []) {
          const current = lessonStats.get(lessonId) ?? { answerCount: 0, wrongAnswerCount: 0 };
          current.answerCount += 1;
          if (event.eventName === 'answer_wrong') {
            current.wrongAnswerCount += 1;
          }
          lessonStats.set(lessonId, current);
        }
      }

      return analyticsContentResponseSchema.parse({
        frequentlyFailedItems: [...byItem.entries()]
          .map(([sourceItemId, values]) => ({
            sourceItemId,
            topicId: topicMap.get(sourceItemId),
            lessonIds: lessonMap.get(sourceItemId) ?? [],
            ...values,
          }))
          .sort((left, right) => (
            (right.wrongAnswerCount + right.reviewWrongCount + right.weakMasteryCount)
            - (left.wrongAnswerCount + left.reviewWrongCount + left.weakMasteryCount)
          ))
          .slice(0, 20),
        topicPerformance: [...topicStats.entries()]
          .map(([topicId, stats]) => ({
            topicId,
            answerCount: stats.answerCount,
            wrongAnswerCount: stats.wrongAnswerCount,
            accuracy: ratio(stats.answerCount - stats.wrongAnswerCount, stats.answerCount),
          }))
          .sort((left, right) => left.accuracy - right.accuracy)
          .slice(0, 20),
        lessonPerformance: [...lessonStats.entries()]
          .map(([lessonId, stats]) => ({
            lessonId,
            answerCount: stats.answerCount,
            wrongAnswerCount: stats.wrongAnswerCount,
            accuracy: ratio(stats.answerCount - stats.wrongAnswerCount, stats.answerCount),
          }))
          .sort((left, right) => left.accuracy - right.accuracy)
          .slice(0, 20),
      });
    },

    async getRetention(query: unknown = {}): Promise<AnalyticsRetentionResponse> {
      const events = filterEvents(await dependencies.repository.listAll(), analyticsAdminQuerySchema.parse(query));
      const byUser = new Map<string, readonly StoredAnalyticsEvent[]>();
      for (const event of events) {
        if (!event.userId || !activityEventNames.has(event.eventName)) {
          continue;
        }

        byUser.set(event.userId, [...(byUser.get(event.userId) ?? []), event]);
      }

      let d1RetainedUsers = 0;
      let d7RetainedUsers = 0;
      for (const [userId, userEvents] of byUser.entries()) {
        void userId;
        const firstSeen = startOfDay(userEvents[0]?.occurredAt ?? now().toISOString());
        const activeDays = new Set(userEvents.map((event) => startOfDay(event.occurredAt)));
        if (activeDays.has(addDays(firstSeen, 1))) {
          d1RetainedUsers += 1;
        }
        if (activeDays.has(addDays(firstSeen, 7))) {
          d7RetainedUsers += 1;
        }
      }

      return analyticsRetentionResponseSchema.parse({
        totalUsers: byUser.size,
        d1RetainedUsers,
        d7RetainedUsers,
        d1Rate: ratio(d1RetainedUsers, byUser.size),
        d7Rate: ratio(d7RetainedUsers, byUser.size),
      });
    },
  };
}

function filterEvents(events: readonly StoredAnalyticsEvent[], query: AnalyticsAdminQuery) {
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

function filterMasteries(masteries: readonly import('@langue-buster/shared').UserMastery[], query: AnalyticsAdminQuery) {
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

async function saveClientEvents(
  dependencies: Pick<AnalyticsServiceDependencies, 'repository' | 'logger' | 'errorReporter'>,
  session: SessionVerificationResponse,
  body: unknown,
) {
  const normalizedBody: AnalyticsIngestRequest =
    Array.isArray(body)
      ? { events: body as AnalyticsIngestRequest['events'] }
      : typeof body === 'object' && body !== null && 'events' in body
        ? body as AnalyticsIngestRequest
        : { events: [body as AnalyticsIngestRequest['events'][number]] };
  const request = analyticsIngestRequestSchema.parse(normalizedBody);
  const sanitized = request.events.map((event) => ({
    ...event,
    userId: session.user.id,
    sessionId: session.session.id,
  }));
  const saved = await dependencies.repository.saveMany(sanitized);
  dependencies.logger.info('Accepted analytics events from client.', {
    domain: 'analytics',
    userId: session.user.id,
    extra: { acceptedCount: saved.length },
  });
  return {
    acceptedCount: saved.length,
    ids: saved.map((event) => event.id),
  };
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

function startOfDay(iso: string) {
  return iso.slice(0, 10);
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function buildLessonMap() {
  const map = new Map<string, string[]>();
  for (const lesson of phase11LaunchBundle.lessons) {
    for (const contentRef of lesson.contentRefs) {
      const next = map.get(contentRef.itemId) ?? [];
      next.push(lesson.id);
      map.set(contentRef.itemId, next);
    }
  }
  return map;
}

function isWeakMastery(state: MasteryState) {
  return state === 'weak' || state === 'learning';
}
