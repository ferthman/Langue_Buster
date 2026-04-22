import { afterEach, describe, expect, it } from 'vitest';

import type { AppUser, AnswerEvent, RunResult } from '@langue-buster/shared';

import { PostgresUserRepository } from '../auth/repositories.js';
import { createDatabaseRuntime } from '../db/runtime.js';
import { createRunContentRepository } from '../runs/content.js';
import { PostgresAnswerEventRepository, PostgresRunResultRepository, PostgresRunSessionRepository } from '../runs/repositories.js';
import { createTestPool } from '../test-helpers.js';
import { PostgresReviewAnswerEventRepository, PostgresUserMasteryRepository } from './repositories.js';
import { createMasteryService } from './service.js';

const pools: Array<Awaited<ReturnType<typeof createTestPool>>> = [];

afterEach(async () => {
  while (pools.length > 0) {
    const pool = pools.pop();
    if (pool) {
      await pool.close();
    }
  }
});

describe('mastery service', () => {
  it('applies run-end mastery updates from persisted answer events and stamps run_results', async () => {
    const context = await createServiceContext();
    await context.runSessionRepository.save(createRunSession('run_1'));
    await context.answerEventRepository.save(createAnswerEvent({
      id: 'ans_1',
      runId: 'run_1',
      sourceItemId: 'vocab.a1.apple',
      correctness: true,
      occurredAt: '2026-04-22T00:00:00.000Z',
    }));
    await context.answerEventRepository.save(createAnswerEvent({
      id: 'ans_2',
      runId: 'run_1',
      sourceItemId: 'vocab.a1.apple',
      correctness: true,
      occurredAt: '2026-04-22T12:00:00.000Z',
    }));
    await context.runResultRepository.save(createRunResult('run_1'));

    const applied = await context.masteryService.applyRunMastery('run_1');
    const mastery = await context.userMasteryRepository.findByUserAndItem(context.user.id, 'vocab.a1.apple');

    expect(applied.masteryAppliedAt).toBeDefined();
    expect(mastery?.correctCount).toBe(2);
    expect(mastery?.masteryState).toBe('learning');
  });

  it('is idempotent when mastery_applied_at is already present', async () => {
    const context = await createServiceContext();
    await context.runSessionRepository.save(createRunSession('run_2'));
    await context.answerEventRepository.save(createAnswerEvent({
      id: 'ans_3',
      runId: 'run_2',
      sourceItemId: 'vocab.a1.apple',
      correctness: true,
      occurredAt: '2026-04-22T00:00:00.000Z',
    }));
    await context.runResultRepository.save(createRunResult('run_2'));

    const first = await context.masteryService.applyRunMastery('run_2');
    const second = await context.masteryService.applyRunMastery('run_2');
    const mastery = await context.userMasteryRepository.findByUserAndItem(context.user.id, 'vocab.a1.apple');

    expect(second.masteryAppliedAt).toBe(first.masteryAppliedAt);
    expect(mastery?.seenCount).toBe(1);
  });

  it('returns a review feed with generated questions and persists review answers', async () => {
    const context = await createServiceContext();
    await context.userMasteryRepository.save({
      userId: context.user.id,
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      masteryState: 'weak',
      seenCount: 2,
      correctCount: 0,
      wrongCount: 2,
      successStreak: 0,
      failureStreak: 2,
      lastSeenAt: '2026-04-21T00:00:00.000Z',
      lastOutcome: 'wrong',
      lastTimingMs: 1300,
      averageTimingMs: 1300,
      nextReviewAt: '2026-04-21T02:00:00.000Z',
      resurfacingReason: 'weak_item',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    const queue = await context.masteryService.getReviewQueue({
      userId: context.user.id,
      limit: 10,
      levelId: 'A1',
      direction: 'ru_to_fr',
    });
    const firstItem = queue[0];
    if (!firstItem?.question) {
      throw new Error('Expected queued review item to include a generated question.');
    }

    const reviewResponse = await context.masteryService.submitReviewAnswer({
      userId: context.user.id,
      sourceItemId: firstItem.sourceItemId,
      questionId: firstItem.question.id,
      selectedOptionId: firstItem.question.correctOptionId,
      direction: 'ru_to_fr',
      answeredAt: '2026-04-22T00:00:00.000Z',
    });
    const persistedEvents = await context.reviewAnswerEventRepository.listByUser(context.user.id);

    expect(queue).toHaveLength(1);
    expect(reviewResponse.mastery.masteryState).toBe('learning');
    expect(reviewResponse.reviewQueueItem.priority).toBeGreaterThan(0);
    expect(persistedEvents).toHaveLength(1);
  });

  it('keeps mastery records available across repository re-instantiation', async () => {
    const context = await createServiceContext();
    await context.userMasteryRepository.save({
      userId: context.user.id,
      sourceItemId: 'vocab.a1.bread',
      cefrLevel: 'A1',
      masteryState: 'stable',
      seenCount: 3,
      correctCount: 3,
      wrongCount: 0,
      successStreak: 3,
      failureStreak: 0,
      lastSeenAt: '2026-04-22T00:00:00.000Z',
      lastOutcome: 'correct',
      lastTimingMs: 800,
      averageTimingMs: 900,
      nextReviewAt: '2026-04-25T00:00:00.000Z',
      resurfacingReason: 'scheduled_review',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
    });

    const siblingPool = context.pool.createSiblingPool();
    try {
      const masteryRepository = new PostgresUserMasteryRepository(siblingPool);
      const persisted = await masteryRepository.findByUserAndItem(context.user.id, 'vocab.a1.bread');
      expect(persisted?.masteryState).toBe('stable');
    } finally {
      await siblingPool.end();
    }
  });
});

async function createServiceContext() {
  const pool = createTestPool();
  pools.push(pool);
  const runtime = createDatabaseRuntime({
    pool: pool.pool,
  });
  await runtime.ready;

  const userRepository = new PostgresUserRepository({
    client: pool.pool,
    now: () => new Date('2026-04-22T00:00:00.000Z'),
  });
  const user = await userRepository.save(createUser());

  const userMasteryRepository = new PostgresUserMasteryRepository(pool.pool);
  const reviewAnswerEventRepository = new PostgresReviewAnswerEventRepository(pool.pool);
  const answerEventRepository = new PostgresAnswerEventRepository(pool.pool);
  const runSessionRepository = new PostgresRunSessionRepository(pool.pool);
  const runResultRepository = new PostgresRunResultRepository(pool.pool);
  const masteryService = createMasteryService({
    userMasteryRepository,
    reviewAnswerEventRepository,
    answerEventRepository,
    runResultRepository,
    contentRepository: createRunContentRepository(),
    now: () => new Date('2026-04-22T00:00:00.000Z'),
  });

  return {
    pool,
    user,
    userMasteryRepository,
    reviewAnswerEventRepository,
    answerEventRepository,
    runSessionRepository,
    runResultRepository,
    masteryService,
  };
}

function createUser(): AppUser {
  return {
    id: 'usr_mastery',
    telegramUserId: '700001',
    firstName: 'Mastery',
    isPremium: false,
    createdAt: '2026-04-22T00:00:00.000Z',
    lastLoginAt: '2026-04-22T00:00:00.000Z',
  };
}

function createAnswerEvent(input: {
  id: string;
  runId: string;
  sourceItemId: string;
  correctness: boolean;
  occurredAt: string;
}): AnswerEvent {
  return {
    id: input.id,
    runId: input.runId,
    questionId: `question:${input.sourceItemId}`,
    sourceItemId: input.sourceItemId,
    selectedOptionId: input.correctness ? 'correct' : 'wrong',
    correctOptionId: 'correct',
    correctness: input.correctness,
    timingMs: 1000,
    penalty: input.correctness ? null : { applies: true, penaltyType: 'heart_loss', amount: 1 },
    occurredAt: input.occurredAt,
  };
}

function createRunResult(runId: string): RunResult {
  return {
    runId,
    userId: 'usr_mastery',
    levelId: 'A1',
    direction: 'ru_to_fr',
    status: 'completed',
    finalScore: 10,
    clearedLinesTotal: 1,
    correctCount: 2,
    wrongCount: 0,
    startedAt: '2026-04-22T00:00:00.000Z',
    finishedAt: '2026-04-22T00:05:00.000Z',
    durationMs: 300000,
  };
}

function createRunSession(runId: string) {
  return {
    id: runId,
    userId: 'usr_mastery',
    levelId: 'A1' as const,
    direction: 'ru_to_fr' as const,
    status: 'completed' as const,
    heartsRemaining: 3,
    score: 10,
    combo: 0,
    seed: 777,
    engineState: {
      board: {
        width: 8,
        height: 8,
        cells: Array.from({ length: 64 }, () => 'empty' as const),
      },
      tray: [null, null, null] as const,
      rng: {
        seed: 777,
        cursor: 3,
      },
      score: 10,
      combo: 0,
      turn: 1,
      lastClearCount: 0,
      clearedLinesTotal: 1,
    },
    currentQuestionState: null,
    answerCount: 2,
    correctCount: 2,
    wrongCount: 0,
    moveCount: 1,
    startedAt: '2026-04-22T00:00:00.000Z',
    finishedAt: '2026-04-22T00:05:00.000Z',
  };
}
