import { describe, expect, it } from 'vitest';

import type { AnswerEvent, AntiCheatAnomaly, MoveEvent, RunResult, RunSession } from '@langue-buster/shared';

import { createAntiCheatService } from './service.js';
import type { AntiCheatAnomalyRepository } from './repository.js';

const fixedNow = new Date('2026-04-22T00:00:00.000Z');

describe('anti-cheat service', () => {
  it('detects ultra-fast correct streaks and suspicious perfect runs', async () => {
    const anomalyRepository = createMemoryAnomalyRepository();
    const answerEvents = Array.from({ length: 20 }, (_, index) => createAnswerEvent({
      id: `ans_${index}`,
      correctness: true,
      timingMs: 400,
      occurredAt: new Date(fixedNow.getTime() + index * 1000).toISOString(),
    }));
    const service = createAntiCheatService({
      anomalyRepository,
      answerEventRepository: {
        save(event) {
          answerEvents.push(event);
          return Promise.resolve(event);
        },
        findByRunId() {
          return Promise.resolve(answerEvents);
        },
      },
      now: () => fixedNow,
    });

    await service.inspectUltraFastCorrectStreak('run_1', 'usr_1');
    await service.inspectRunResult({
      run: createRunSession({ correctCount: 20, wrongCount: 0 }),
      result: createRunResult({ correctCount: 20, wrongCount: 0 }),
    });

    expect(anomalyRepository.items.map((item) => item.type)).toEqual([
      'suspicious_perfect_run',
    ]);

    const fiveAnswerRepository = createMemoryAnomalyRepository();
    const fiveAnswerService = createAntiCheatService({
      anomalyRepository: fiveAnswerRepository,
      answerEventRepository: {
        save(event) {
          return Promise.resolve(event);
        },
        findByRunId() {
          return Promise.resolve(answerEvents.slice(0, 5));
        },
      },
      now: () => fixedNow,
    });
    await fiveAnswerService.inspectUltraFastCorrectStreak('run_1', 'usr_1');
    expect(fiveAnswerRepository.items.map((item) => item.type)).toEqual([
      'ultra_fast_correct_streak',
    ]);
  });

  it('detects impossible answer timing and move cadence', async () => {
    const anomalyRepository = createMemoryAnomalyRepository();
    const moveEvents: MoveEvent[] = [];
    const service = createAntiCheatService({
      anomalyRepository,
      answerEventRepository: {
        save(event) {
          return Promise.resolve(event);
        },
        findByRunId() {
          return Promise.resolve([]);
        },
      },
      moveEventRepository: {
        save(event) {
          moveEvents.push(event);
          return Promise.resolve(event);
        },
        findByRunId() {
          return Promise.resolve(moveEvents);
        },
      },
      now: () => fixedNow,
    });
    const run = createRunSession({});

    await service.inspectAnswer({
      run,
      answerEvent: createAnswerEvent({
        id: 'ans_fast',
        correctness: true,
        timingMs: 100,
        occurredAt: '2026-04-22T00:00:00.100Z',
      }),
      shownAt: '2026-04-22T00:00:00.000Z',
      answeredAt: '2026-04-22T00:00:00.100Z',
    });

    const moveEvent = createMoveEvent({
      occurredAt: '2026-04-22T00:00:01.050Z',
    });
    moveEvents.push(moveEvent);
    await service.inspectMoveCadence({
      run,
      moveEvent,
      unlockedAt: '2026-04-22T00:00:01.000Z',
    });

    expect(anomalyRepository.items.map((item) => item.type)).toEqual([
      'impossible_answer_timing',
      'impossible_move_cadence',
    ]);
  });
});

function createMemoryAnomalyRepository(): AntiCheatAnomalyRepository & { items: AntiCheatAnomaly[] } {
  const items: AntiCheatAnomaly[] = [];
  return {
    items,
    save(anomaly) {
      items.push(anomaly);
      return Promise.resolve(anomaly);
    },
    list() {
      return Promise.resolve(items);
    },
  };
}

function createAnswerEvent(input: {
  id: string;
  correctness: boolean;
  timingMs?: number;
  occurredAt: string;
}): AnswerEvent {
  return {
    id: input.id,
    runId: 'run_1',
    questionId: `question_${input.id}`,
    sourceItemId: 'vocab.apple',
    selectedOptionId: 'option_correct',
    correctOptionId: 'option_correct',
    correctness: input.correctness,
    timingMs: input.timingMs,
    penalty: null,
    occurredAt: input.occurredAt,
  };
}

function createMoveEvent(input: { occurredAt: string }): MoveEvent {
  return {
    id: 'mov_1',
    runId: 'run_1',
    engineTurn: 0,
    trayIndex: 0,
    pieceInstanceId: 'piece_1',
    pieceId: 'single_1',
    origin: { x: 0, y: 0 },
    validationResult: 'accepted',
    clearedLineCount: 0,
    scoreBreakdown: {
      placementPoints: 1,
      lineClearPoints: 0,
      multiLineBonus: 0,
      comboBonus: 0,
      totalPoints: 1,
      clearedRowCount: 0,
      clearedColumnCount: 0,
    },
    resultingScore: 1,
    resultingCombo: 0,
    occurredAt: input.occurredAt,
  };
}

function createRunSession(input: Partial<Pick<RunSession, 'correctCount' | 'wrongCount'>>): RunSession {
  return {
    id: 'run_1',
    userId: 'usr_1',
    levelId: 'A1',
    direction: 'ru_to_fr',
    status: 'active',
    heartsRemaining: 3,
    score: 0,
    combo: 0,
    seed: 777,
    engineState: {
      board: {
        width: 8,
        height: 8,
        cells: Array.from({ length: 64 }, () => 'empty'),
      },
      tray: [null, null, null],
      rng: { seed: 777, cursor: 0 },
      score: 0,
      combo: 0,
      turn: 0,
      lastClearCount: 0,
      clearedLinesTotal: 0,
    },
    currentQuestionState: null,
    answerCount: input.correctCount ?? 0,
    correctCount: input.correctCount ?? 0,
    wrongCount: input.wrongCount ?? 0,
    moveCount: 0,
    startedAt: '2026-04-22T00:00:00.000Z',
  };
}

function createRunResult(input: Pick<RunResult, 'correctCount' | 'wrongCount'>): RunResult {
  return {
    runId: 'run_1',
    userId: 'usr_1',
    levelId: 'A1',
    direction: 'ru_to_fr',
    status: 'completed',
    finalScore: 0,
    clearedLinesTotal: 0,
    correctCount: input.correctCount,
    wrongCount: input.wrongCount,
    startedAt: '2026-04-22T00:00:00.000Z',
    finishedAt: '2026-04-22T00:01:00.000Z',
    durationMs: 60_000,
  };
}
