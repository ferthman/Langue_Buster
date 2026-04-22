import { describe, expect, it } from 'vitest';

import {
  launchLevels,
  runResultSchema,
  runSessionSchema,
  runStartRequestSchema,
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
});
