import {
  evaluateAnswer,
  generateQuestion,
  type DistractorSet,
  type VocabItem,
} from '@langue-buster/content-core';
import type {
  AnalyticsEventEnvelope,
  AnswerDirection,
  AnswerEvaluation,
  AnswerEvent,
  ReviewAnswerEvent,
  ReviewQueueItem,
  RunResult,
  UserMastery,
} from '@langue-buster/shared';
import {
  reviewAnswerEventSchema,
  reviewQueueItemSchema,
  reviewQueueResponseSchema,
} from '@langue-buster/shared';
import { randomUUID } from 'node:crypto';

import type { RunContentRepository } from '../runs/content.js';
import type { AnswerEventRepository, RunResultRepository } from '../runs/repositories.js';
import { MasteryDomainError } from './errors.js';
import type { ReviewAnswerEventRepository, UserMasteryRepository } from './repositories.js';
import {
  applyMasterySignal,
  isWeakResurfacingCandidate,
  scheduleReviewQueue,
  type MasteryUpdateSignal,
} from './scheduler.js';

type MasteryServiceDependencies = {
  userMasteryRepository: UserMasteryRepository;
  reviewAnswerEventRepository: ReviewAnswerEventRepository;
  answerEventRepository: AnswerEventRepository;
  runResultRepository: RunResultRepository;
  contentRepository: RunContentRepository;
  now?: () => Date;
  analytics?: {
    recordEvent(event: AnalyticsEventEnvelope): Promise<unknown>;
  };
  logger?: {
    warn(message: string, context: Record<string, unknown>): void;
  };
  errorReporter?: {
    captureError(error: unknown, context: Record<string, unknown>): void;
  };
};

export type MasteryService = ReturnType<typeof createMasteryService>;

export function createMasteryService(dependencies: MasteryServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());

  return {
    async applyRunMastery(runId: string): Promise<RunResult> {
      const runResult = await dependencies.runResultRepository.findByRunId(runId);
      if (!runResult) {
        throw new MasteryDomainError('review_unavailable', `Run result "${runId}" could not be resolved for mastery updates.`);
      }

      if (runResult.masteryAppliedAt) {
        return runResult;
      }

      const answerEvents = await dependencies.answerEventRepository.findByRunId(runId);
      for (const event of answerEvents) {
        await applySignal(dependencies, {
          userId: runResult.userId,
          sourceItemId: event.sourceItemId,
          cefrLevel: resolveItemLevel(dependencies.contentRepository, event.sourceItemId, runResult.levelId),
          correctness: event.correctness,
          occurredAt: event.occurredAt,
          timingMs: event.timingMs,
        });
      }

      return dependencies.runResultRepository.markMasteryApplied(runId, now().toISOString());
    },

    async getReviewQueue(input: {
      userId: string;
      limit: number;
      levelId?: UserMastery['cefrLevel'];
      direction: AnswerDirection;
    }): Promise<readonly ReviewQueueItem[]> {
      const nowIso = now().toISOString();
      const masteries = await dependencies.userMasteryRepository.listByUser(input.userId, input.levelId);
      const scheduled = scheduleReviewQueue(masteries, {
        now: nowIso,
        limit: input.limit,
      });
      await dependencies.analytics?.recordEvent({
        eventName: 'review_queue_opened',
        source: 'backend',
        occurredAt: nowIso,
        userId: input.userId,
        levelId: input.levelId,
        payload: {
          queueLength: scheduled.length,
        },
      });

      return scheduled.map(({ mastery, priority }) =>
        reviewQueueItemSchema.parse({
          userId: mastery.userId,
          sourceItemId: mastery.sourceItemId,
          cefrLevel: mastery.cefrLevel,
          masteryState: mastery.masteryState,
          nextReviewAt: mastery.nextReviewAt,
          priority,
          reason: mastery.resurfacingReason,
          topicId: requireSourceItem(dependencies.contentRepository, mastery.sourceItemId).topicId,
          question: createReviewQuestion(dependencies.contentRepository, mastery.sourceItemId, input.direction),
          lastSeenAt: mastery.lastSeenAt,
          createdAt: mastery.createdAt,
          updatedAt: mastery.updatedAt,
        }),
      );
    },

    async submitReviewAnswer(input: {
      userId: string;
      sourceItemId: string;
      questionId: string;
      selectedOptionId: string;
      answeredAt?: string;
      direction: AnswerDirection;
    }): Promise<{
      evaluation: AnswerEvaluation;
      mastery: UserMastery;
      reviewQueueItem: ReviewQueueItem;
    }> {
      const existing = await dependencies.userMasteryRepository.findByUserAndItem(input.userId, input.sourceItemId);
      if (!existing) {
        throw new MasteryDomainError('review_item_not_found', `No mastery record exists for item "${input.sourceItemId}".`);
      }

      const question = createReviewQuestion(dependencies.contentRepository, input.sourceItemId, input.direction);
      if (question.id !== input.questionId) {
        throw new MasteryDomainError(
          'review_question_mismatch',
          `Review question "${input.questionId}" does not match the current generated question for item "${input.sourceItemId}".`,
        );
      }

      const occurredAt = input.answeredAt ?? now().toISOString();
      const evaluation = evaluateAnswer(question, input.selectedOptionId);
      await dependencies.analytics?.recordEvent({
        eventName: 'review_answer_submitted',
        source: 'backend',
        occurredAt,
        userId: input.userId,
        levelId: existing.cefrLevel,
        sourceItemId: input.sourceItemId,
        topicId: requireSourceItem(dependencies.contentRepository, input.sourceItemId).topicId,
        payload: {
          questionId: question.id,
          selectedOptionId: input.selectedOptionId,
          correctOptionId: question.correctOptionId,
          timingMs: evaluation.timingMs,
          correctness: evaluation.isCorrect,
          masteryStateBefore: existing.masteryState,
        },
      });
      const applied = await applySignal(dependencies, {
        userId: input.userId,
        sourceItemId: input.sourceItemId,
        cefrLevel: existing.cefrLevel,
        correctness: evaluation.isCorrect,
        occurredAt,
        timingMs: evaluation.timingMs,
      });
      const event: ReviewAnswerEvent = reviewAnswerEventSchema.parse({
        id: `rev_${randomUUID()}`,
        userId: input.userId,
        sourceItemId: input.sourceItemId,
        questionId: question.id,
        selectedOptionId: input.selectedOptionId,
        correctOptionId: question.correctOptionId,
        correctness: evaluation.isCorrect,
        timingMs: evaluation.timingMs,
        masteryStateBefore: applied.previousState,
        masteryStateAfter: applied.mastery.masteryState,
        occurredAt,
      });
      await dependencies.reviewAnswerEventRepository.save(event);
      await dependencies.analytics?.recordEvent({
        eventName: evaluation.isCorrect ? 'review_answer_correct' : 'review_answer_wrong',
        source: 'backend',
        occurredAt,
        userId: input.userId,
        levelId: existing.cefrLevel,
        sourceItemId: input.sourceItemId,
        topicId: requireSourceItem(dependencies.contentRepository, input.sourceItemId).topicId,
        payload: {
          questionId: question.id,
          selectedOptionId: input.selectedOptionId,
          correctOptionId: question.correctOptionId,
          timingMs: evaluation.timingMs,
          correctness: evaluation.isCorrect,
          masteryStateBefore: applied.previousState,
          masteryStateAfter: applied.mastery.masteryState,
        },
      });

      return {
        evaluation,
        mastery: applied.mastery,
        reviewQueueItem: buildReviewQueueItem(dependencies.contentRepository, applied.mastery, input.direction, now().toISOString()),
      };
    },

    async getWeakItemCandidates(input: {
      userId: string;
      levelId?: UserMastery['cefrLevel'];
    }): Promise<readonly UserMastery[]> {
      const masteries = await dependencies.userMasteryRepository.listByUser(input.userId, input.levelId);
      const nowIso = now().toISOString();
      return masteries.filter((mastery) => isWeakResurfacingCandidate(mastery, nowIso));
    },
  };
}

async function applySignal(
  dependencies: Pick<
    MasteryServiceDependencies,
    'userMasteryRepository' | 'contentRepository'
  >,
  signal: MasteryUpdateSignal,
) {
  const existing = await dependencies.userMasteryRepository.findByUserAndItem(signal.userId, signal.sourceItemId);
  const applied = applyMasterySignal(existing, signal);
  const mastery = await dependencies.userMasteryRepository.save(applied.mastery);

  return {
    mastery,
    previousState: applied.previousState,
  };
}

function buildReviewQueueItem(
  contentRepository: RunContentRepository,
  mastery: UserMastery,
  direction: AnswerDirection,
  nowIso: string,
): ReviewQueueItem {
  const item = requireSourceItem(contentRepository, mastery.sourceItemId);
  const scheduled = scheduleReviewQueue([mastery], {
    now: nowIso,
    limit: 1,
  });
  const priority = scheduled[0]?.priority ?? 0;

  return reviewQueueItemSchema.parse({
    userId: mastery.userId,
    sourceItemId: mastery.sourceItemId,
    cefrLevel: mastery.cefrLevel,
    masteryState: mastery.masteryState,
    nextReviewAt: mastery.nextReviewAt,
    priority,
    reason: mastery.resurfacingReason,
    topicId: item.topicId,
    question: createReviewQuestion(contentRepository, mastery.sourceItemId, direction),
    lastSeenAt: mastery.lastSeenAt,
    createdAt: mastery.createdAt,
    updatedAt: mastery.updatedAt,
  });
}

function createReviewQuestion(
  contentRepository: RunContentRepository,
  sourceItemId: string,
  direction: AnswerDirection,
) {
  const sourceItem = requireSourceItem(contentRepository, sourceItemId);
  const bundle = contentRepository.getBundleForItem(sourceItemId);
  if (!bundle) {
    throw new MasteryDomainError('review_item_not_found', `No approved content bundle exists for "${sourceItemId}".`);
  }

  const promptLanguage = direction === 'ru_to_fr' ? 'ru' : 'fr';
  const answerLanguage = direction === 'ru_to_fr' ? 'fr' : 'ru';

  return generateQuestion({
    sourceItem,
    allVocabItems: [...bundle.vocabItems],
    distractorSets: [...bundle.distractorSets],
    promptLanguage,
    answerLanguage,
    generatorVersion: 'phase8-v1',
  });
}

function requireSourceItem(contentRepository: RunContentRepository, sourceItemId: string): VocabItem {
  const item = contentRepository.findItemById(sourceItemId);
  if (!item) {
    throw new MasteryDomainError('review_item_not_found', `Content item "${sourceItemId}" could not be found.`);
  }

  return item;
}

function resolveItemLevel(
  contentRepository: RunContentRepository,
  sourceItemId: string,
  fallbackLevel: RunResult['levelId'],
): UserMastery['cefrLevel'] {
  return contentRepository.findItemById(sourceItemId)?.cefrLevel ?? fallbackLevel;
}
