import { describe, expect, it } from 'vitest';

import type { UserMastery } from '@langue-buster/shared';

import {
  applyMasterySignal,
  calculateNextReviewAt,
  calculateReviewPriority,
  isWeakResurfacingCandidate,
  scheduleReviewQueue,
} from './scheduler.js';

const baseTime = '2026-04-22T00:00:00.000Z';

describe('mastery scheduler and state machine', () => {
  it('creates a mastery record from first exposure and transitions new to learning on correct', () => {
    const result = applyMasterySignal(null, {
      userId: 'usr_1',
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      correctness: true,
      occurredAt: baseTime,
      timingMs: 900,
    });

    expect(result.previousState).toBe('new');
    expect(result.mastery.masteryState).toBe('learning');
    expect(result.mastery.correctCount).toBe(1);
    expect(result.mastery.resurfacingReason).toBe('new_item');
  });

  it('moves first wrong exposures and repeated failures into weak', () => {
    const firstWrong = applyMasterySignal(null, {
      userId: 'usr_1',
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      correctness: false,
      occurredAt: baseTime,
    });
    const secondWrong = applyMasterySignal(firstWrong.mastery, {
      userId: 'usr_1',
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      correctness: false,
      occurredAt: '2026-04-22T01:00:00.000Z',
    });

    expect(firstWrong.mastery.masteryState).toBe('weak');
    expect(secondWrong.mastery.masteryState).toBe('weak');
    expect(secondWrong.mastery.failureStreak).toBe(2);
    expect(secondWrong.mastery.resurfacingReason).toBe('weak_item');
  });

  it('progresses repeated correct answers from learning to stable to mastered', () => {
    let mastery = applyMasterySignal(null, {
      userId: 'usr_1',
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      correctness: true,
      occurredAt: baseTime,
    }).mastery;

    mastery = applyMasterySignal(mastery, {
      userId: 'usr_1',
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      correctness: true,
      occurredAt: '2026-04-22T12:00:00.000Z',
    }).mastery;
    mastery = applyMasterySignal(mastery, {
      userId: 'usr_1',
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      correctness: true,
      occurredAt: '2026-04-23T00:00:00.000Z',
    }).mastery;
    expect(mastery.masteryState).toBe('stable');

    mastery = applyMasterySignal(mastery, {
      userId: 'usr_1',
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      correctness: true,
      occurredAt: '2026-04-24T00:00:00.000Z',
    }).mastery;
    mastery = applyMasterySignal(mastery, {
      userId: 'usr_1',
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      correctness: true,
      occurredAt: '2026-04-25T00:00:00.000Z',
    }).mastery;
    mastery = applyMasterySignal(mastery, {
      userId: 'usr_1',
      sourceItemId: 'vocab.a1.apple',
      cefrLevel: 'A1',
      correctness: true,
      occurredAt: '2026-04-26T00:00:00.000Z',
    }).mastery;
    expect(mastery.masteryState).toBe('mastered');
  });

  it('calculates next-review timestamps by resulting state', () => {
    expect(calculateNextReviewAt('weak', baseTime)).toBe('2026-04-22T02:00:00.000Z');
    expect(calculateNextReviewAt('learning', baseTime)).toBe('2026-04-22T12:00:00.000Z');
    expect(calculateNextReviewAt('stable', baseTime)).toBe('2026-04-25T00:00:00.000Z');
    expect(calculateNextReviewAt('mastered', baseTime)).toBe('2026-05-02T00:00:00.000Z');
  });

  it('orders review queue by due status and priority', () => {
    const queue = scheduleReviewQueue(
      [
        createMastery({
          sourceItemId: 'vocab.a1.stable',
          masteryState: 'stable',
          nextReviewAt: '2026-04-25T00:00:00.000Z',
          lastOutcome: 'correct',
        }),
        createMastery({
          sourceItemId: 'vocab.a1.weak',
          masteryState: 'weak',
          nextReviewAt: '2026-04-21T00:00:00.000Z',
          lastOutcome: 'wrong',
        }),
        createMastery({
          sourceItemId: 'vocab.a1.learning',
          masteryState: 'learning',
          nextReviewAt: '2026-04-22T00:00:00.000Z',
          lastOutcome: 'correct',
        }),
      ],
      {
        now: baseTime,
        limit: 3,
      },
    );

    expect(queue.map((entry) => entry.mastery.sourceItemId)).toEqual([
      'vocab.a1.weak',
      'vocab.a1.learning',
      'vocab.a1.stable',
    ]);
    const firstQueueEntry = queue[0];
    const secondQueueEntry = queue[1];
    if (!firstQueueEntry || !secondQueueEntry) {
      throw new Error('Expected at least two queue entries.');
    }

    expect(calculateReviewPriority(firstQueueEntry.mastery, baseTime)).toBeGreaterThan(
      calculateReviewPriority(secondQueueEntry.mastery, baseTime),
    );
  });

  it('detects weak-item resurfacing candidates', () => {
    expect(
      isWeakResurfacingCandidate(
        createMastery({
          sourceItemId: 'vocab.a1.weak',
          masteryState: 'weak',
          nextReviewAt: '2026-04-22T02:00:00.000Z',
          lastOutcome: 'wrong',
        }),
        baseTime,
      ),
    ).toBe(true);

    expect(
      isWeakResurfacingCandidate(
        createMastery({
          sourceItemId: 'vocab.a1.stable',
          masteryState: 'stable',
          nextReviewAt: '2026-04-30T00:00:00.000Z',
          lastOutcome: 'correct',
        }),
        baseTime,
      ),
    ).toBe(false);
  });
});

function createMastery(input: {
  sourceItemId: string;
  masteryState: UserMastery['masteryState'];
  nextReviewAt: string;
  lastOutcome: UserMastery['lastOutcome'];
}): UserMastery {
  return {
    userId: 'usr_1',
    sourceItemId: input.sourceItemId,
    cefrLevel: 'A1',
    masteryState: input.masteryState,
    seenCount: 3,
    correctCount: input.lastOutcome === 'correct' ? 3 : 1,
    wrongCount: input.lastOutcome === 'wrong' ? 2 : 0,
    successStreak: input.lastOutcome === 'correct' ? 3 : 0,
    failureStreak: input.lastOutcome === 'wrong' ? 2 : 0,
    lastSeenAt: '2026-04-21T00:00:00.000Z',
    lastOutcome: input.lastOutcome,
    lastTimingMs: 900,
    averageTimingMs: 1100,
    nextReviewAt: input.nextReviewAt,
    resurfacingReason: input.lastOutcome === 'wrong' ? 'weak_item' : 'scheduled_review',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-21T00:00:00.000Z',
  };
}
