import { describe, expect, it } from 'vitest';

import {
  analyticsEventEnvelopeSchema,
  analyticsOverviewResponseSchema,
  antiCheatAnomalyListResponseSchema,
  antiCheatAnomalySchema,
  launchLevels,
  rateLimitedErrorSchema,
  reviewQueueItemSchema,
  runResultSchema,
  runSessionSchema,
  runStartRequestSchema,
  userMasterySchema,
} from './index.js';

describe('shared domain contracts', () => {
  it('keeps MVP launch levels constrained to A1 and A2', () => {
    expect(launchLevels).toEqual(['A1', 'A2']);
  });

  it('validates a run start request for launch levels only', () => {
    expect(() => runStartRequestSchema.parse({ levelId: 'A1' })).not.toThrow();
    expect(() => runStartRequestSchema.parse({ levelId: 'B1' })).toThrow(/A1.*A2/i);
  });

  it('validates a full run session payload', () => {
    expect(() =>
      runSessionSchema.parse({
        id: 'run_1',
        userId: 'usr_1',
        levelId: 'A1',
        direction: 'ru_to_fr',
        status: 'active',
        heartsRemaining: 3,
        score: 0,
        combo: 0,
        seed: 42,
        engineState: {
          board: {
            width: 8,
            height: 8,
            cells: Array.from({ length: 64 }, () => 'empty'),
          },
          tray: [
            { instanceId: 'p-1', pieceId: 'single_1' },
            { instanceId: 'p-2', pieceId: 'bar_h_2' },
            { instanceId: 'p-3', pieceId: 'square_2' },
          ],
          rng: {
            seed: 42,
            cursor: 3,
          },
          score: 0,
          combo: 0,
          turn: 0,
          lastClearCount: 0,
          clearedLinesTotal: 0,
        },
        currentQuestionState: {
          sequence: 0,
          shownAt: '2026-04-22T00:00:00.000Z',
          answerState: 'awaiting_answer',
          question: {
            id: 'question:1',
            cardType: 'single_word_translation',
            promptLanguage: 'ru',
            answerLanguage: 'fr',
            promptText: 'яблоко',
            options: [
              { id: 'one', label: 'pomme', isCorrect: true },
              { id: 'two', label: 'poire', isCorrect: false },
            ],
            correctOptionId: 'one',
            sourceItemIds: ['vocab.apple'],
            cefrLevel: 'A1',
            meta: {
              sourceItemId: 'vocab.apple',
              topicId: 'topic.food',
              distractorSource: 'fallback_pool',
              generatorVersion: 'phase7-v1',
            },
          },
        },
        answerCount: 0,
        correctCount: 0,
        wrongCount: 0,
        moveCount: 0,
        startedAt: '2026-04-22T00:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates a terminal run result payload', () => {
    expect(() =>
      runResultSchema.parse({
        runId: 'run_1',
        userId: 'usr_1',
        levelId: 'A1',
        direction: 'ru_to_fr',
        status: 'completed',
        finalScore: 15,
        clearedLinesTotal: 1,
        correctCount: 2,
        wrongCount: 1,
        startedAt: '2026-04-22T00:00:00.000Z',
        finishedAt: '2026-04-22T00:01:00.000Z',
        durationMs: 60_000,
      }),
    ).not.toThrow();
  });

  it('validates mastery and review queue payloads', () => {
    expect(() =>
      userMasterySchema.parse({
        userId: 'usr_1',
        sourceItemId: 'vocab.apple',
        cefrLevel: 'A1',
        masteryState: 'learning',
        seenCount: 1,
        correctCount: 1,
        wrongCount: 0,
        successStreak: 1,
        failureStreak: 0,
        lastSeenAt: '2026-04-22T00:00:00.000Z',
        lastOutcome: 'correct',
        lastTimingMs: 1200,
        averageTimingMs: 1200,
        nextReviewAt: '2026-04-22T12:00:00.000Z',
        resurfacingReason: 'new_item',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      }),
    ).not.toThrow();

    expect(() =>
      reviewQueueItemSchema.parse({
        userId: 'usr_1',
        sourceItemId: 'vocab.apple',
        cefrLevel: 'A1',
        masteryState: 'weak',
        nextReviewAt: '2026-04-22T02:00:00.000Z',
        priority: 110,
        reason: 'recent_failure',
        topicId: 'topic.food',
        lastSeenAt: '2026-04-22T00:00:00.000Z',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates analytics event envelopes and dashboard payloads', () => {
    expect(() =>
      analyticsEventEnvelopeSchema.parse({
        eventName: 'answer_wrong',
        source: 'backend',
        occurredAt: '2026-04-22T00:00:00.000Z',
        userId: 'usr_1',
        runId: 'run_1',
        levelId: 'A1',
        sourceItemId: 'vocab.apple',
        topicId: 'topic.food',
        payload: {
          questionId: 'question:1',
          selectedOptionId: 'two',
          correctOptionId: 'one',
          cardType: 'single_word_translation',
          timingMs: 1200,
          moveUnlocked: false,
          correctness: false,
        },
      }),
    ).not.toThrow();

    expect(() =>
      analyticsOverviewResponseSchema.parse({
        overview: {
          onboardingCompletionCount: 10,
          onboardingCompletionRate: 0.5,
          firstRunStartCount: 7,
          firstRunFinishCount: 4,
          reviewAdoptionCount: 3,
          reviewAdoptionRate: 0.4,
          runCompletionCount: 4,
          runAbandonCount: 2,
          averageRunLengthSeconds: 42.5,
          answerAccuracy: 0.75,
          lessonCompletionCount: 0,
        },
      }),
    ).not.toThrow();
  });

  it('validates anti-cheat anomaly and rate-limit payloads', () => {
    expect(() =>
      antiCheatAnomalySchema.parse({
        id: 'ac_1',
        userId: 'usr_1',
        runId: 'run_1',
        sourceItemId: 'vocab.apple',
        type: 'impossible_answer_timing',
        severity: 'medium',
        metadata: {
          timingMs: 120,
        },
        occurredAt: '2026-04-22T00:00:00.000Z',
      }),
    ).not.toThrow();

    expect(() =>
      antiCheatAnomalyListResponseSchema.parse({
        anomalies: [
          {
            id: 'ac_1',
            type: 'rate_limit_exceeded',
            severity: 'low',
            metadata: {},
            occurredAt: '2026-04-22T00:00:00.000Z',
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      rateLimitedErrorSchema.parse({
        code: 'rate_limited',
        message: 'Too many requests.',
        retryAfterSeconds: 60,
      }),
    ).not.toThrow();
  });
});
