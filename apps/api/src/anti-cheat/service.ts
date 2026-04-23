import { randomUUID } from 'node:crypto';

import type {
  AnswerEvent,
  AntiCheatAnomaly,
  AntiCheatAnomalyListQuery,
  AntiCheatAnomalyType,
  AntiCheatSeverity,
  MoveEvent,
  RunResult,
  RunSession,
} from '@langue-buster/shared';
import { antiCheatAnomalySchema } from '@langue-buster/shared';

import type { AnswerEventRepository, MoveEventRepository } from '../runs/repositories.js';
import type { AntiCheatAnomalyRepository } from './repository.js';

type AntiCheatServiceDependencies = {
  anomalyRepository: AntiCheatAnomalyRepository;
  answerEventRepository?: AnswerEventRepository;
  moveEventRepository?: MoveEventRepository;
  now?: () => Date;
  logger?: {
    warn(message: string, context: Record<string, unknown>): void;
  };
  errorReporter?: {
    captureError(error: unknown, context: Record<string, unknown>): void;
  };
};

export type AntiCheatService = ReturnType<typeof createAntiCheatService>;

const IMPOSSIBLE_ANSWER_TIMING_MS = 250;
const IMPOSSIBLE_MOVE_CADENCE_MS = 150;
const ULTRA_FAST_STREAK_LENGTH = 5;
const ULTRA_FAST_STREAK_AVERAGE_MS = 700;
const PERFECT_RUN_MIN_ANSWERS = 20;

export function createAntiCheatService(dependencies: AntiCheatServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());

  async function recordAnomaly(input: {
    userId?: string;
    runId?: string;
    sourceItemId?: string;
    type: AntiCheatAnomalyType;
    severity: AntiCheatSeverity;
    metadata?: Record<string, unknown>;
    occurredAt?: string;
  }): Promise<AntiCheatAnomaly | null> {
    const anomaly = antiCheatAnomalySchema.parse({
      id: `ac_${randomUUID()}`,
      userId: input.userId,
      runId: input.runId,
      sourceItemId: input.sourceItemId,
      type: input.type,
      severity: input.severity,
      metadata: input.metadata ?? {},
      occurredAt: input.occurredAt ?? now().toISOString(),
    });

    try {
      const saved = await dependencies.anomalyRepository.save(anomaly);
      dependencies.logger?.warn('Anti-cheat anomaly recorded.', {
        domain: 'anti-cheat',
        code: saved.type,
        userId: saved.userId,
        runId: saved.runId,
        extra: {
          severity: saved.severity,
          sourceItemId: saved.sourceItemId,
          metadata: saved.metadata,
        },
      });
      return saved;
    } catch (error) {
      dependencies.errorReporter?.captureError(error, {
        domain: 'anti-cheat',
        code: input.type,
        userId: input.userId,
        runId: input.runId,
      });
      return null;
    }
  }

  return {
    recordAnomaly,

    async listAnomalies(query: AntiCheatAnomalyListQuery): Promise<readonly AntiCheatAnomaly[]> {
      return dependencies.anomalyRepository.list(query);
    },

    async inspectAnswer(input: {
      run: RunSession;
      answerEvent: AnswerEvent;
      shownAt: string;
      answeredAt?: string;
    }): Promise<void> {
      const answeredAt = input.answeredAt ?? input.answerEvent.occurredAt;
      const timing = calculateTimingMs(input.shownAt, answeredAt);
      if (timing === null || timing < IMPOSSIBLE_ANSWER_TIMING_MS) {
        await recordAnomaly({
          userId: input.run.userId,
          runId: input.run.id,
          sourceItemId: input.answerEvent.sourceItemId,
          type: 'impossible_answer_timing',
          severity: 'medium',
          occurredAt: input.answerEvent.occurredAt,
          metadata: {
            questionId: input.answerEvent.questionId,
            shownAt: input.shownAt,
            answeredAt,
            timingMs: timing,
            thresholdMs: IMPOSSIBLE_ANSWER_TIMING_MS,
            correctness: input.answerEvent.correctness,
          },
        });
      }

      await inspectUltraFastCorrectStreak(input.run.id, input.run.userId);
    },

    async inspectMoveCadence(input: {
      run: RunSession;
      moveEvent: MoveEvent;
      unlockedAt?: string;
    }): Promise<void> {
      if (!dependencies.moveEventRepository) {
        return;
      }

      const moveEvents = await dependencies.moveEventRepository.findByRunId(input.run.id);
      const previousMove = moveEvents
        .filter((event) => event.id !== input.moveEvent.id)
        .at(-1);
      const referenceAt = previousMove?.occurredAt ?? input.unlockedAt;
      if (!referenceAt) {
        return;
      }

      const cadenceMs = calculateTimingMs(referenceAt, input.moveEvent.occurredAt);
      if (cadenceMs !== null && cadenceMs >= IMPOSSIBLE_MOVE_CADENCE_MS) {
        return;
      }

      await recordAnomaly({
        userId: input.run.userId,
        runId: input.run.id,
        sourceItemId: input.run.currentQuestionState?.question.meta.sourceItemId,
        type: 'impossible_move_cadence',
        severity: 'medium',
        occurredAt: input.moveEvent.occurredAt,
        metadata: {
          moveEventId: input.moveEvent.id,
          engineTurn: input.moveEvent.engineTurn,
          referenceAt,
          movedAt: input.moveEvent.occurredAt,
          cadenceMs,
          thresholdMs: IMPOSSIBLE_MOVE_CADENCE_MS,
        },
      });
    },

    inspectUltraFastCorrectStreak,

    async inspectRunResult(input: {
      run: RunSession;
      result: RunResult;
    }): Promise<void> {
      if (input.result.correctCount < PERFECT_RUN_MIN_ANSWERS || input.result.wrongCount !== 0) {
        return;
      }

      const answerEvents = dependencies.answerEventRepository
        ? await dependencies.answerEventRepository.findByRunId(input.run.id)
        : [];
      const timingValues = answerEvents
        .map((event) => event.timingMs)
        .filter((timing): timing is number => typeof timing === 'number');

      await recordAnomaly({
        userId: input.run.userId,
        runId: input.run.id,
        type: 'suspicious_perfect_run',
        severity: 'medium',
        occurredAt: input.result.finishedAt,
        metadata: {
          status: input.result.status,
          levelId: input.result.levelId,
          durationMs: input.result.durationMs,
          correctCount: input.result.correctCount,
          wrongCount: input.result.wrongCount,
          moveCount: input.run.moveCount,
          averageTimingMs: timingValues.length > 0 ? average(timingValues) : undefined,
          thresholdCorrectCount: PERFECT_RUN_MIN_ANSWERS,
        },
      });
    },
  };

  async function inspectUltraFastCorrectStreak(runId: string, userId: string): Promise<void> {
      if (!dependencies.answerEventRepository) {
        return;
      }

      const answerEvents = await dependencies.answerEventRepository.findByRunId(runId);
      const streak = trailingCorrectAnswersWithTiming(answerEvents);
      if (streak.length !== ULTRA_FAST_STREAK_LENGTH) {
        return;
      }

      const considered = streak.slice(-ULTRA_FAST_STREAK_LENGTH);
      const averageTimingMs = average(considered.map((event) => event.timingMs ?? 0));
      if (averageTimingMs >= ULTRA_FAST_STREAK_AVERAGE_MS) {
        return;
      }

      await recordAnomaly({
        userId,
        runId,
        sourceItemId: considered.at(-1)?.sourceItemId,
        type: 'ultra_fast_correct_streak',
        severity: 'high',
        occurredAt: considered.at(-1)?.occurredAt,
        metadata: {
          streakLength: considered.length,
          averageTimingMs,
          thresholdAverageMs: ULTRA_FAST_STREAK_AVERAGE_MS,
          thresholdLength: ULTRA_FAST_STREAK_LENGTH,
        },
      });
  }
}

function calculateTimingMs(startedAt: string, finishedAt: string): number | null {
  const startedAtMs = Date.parse(startedAt);
  const finishedAtMs = Date.parse(finishedAt);
  if (Number.isNaN(startedAtMs) || Number.isNaN(finishedAtMs) || finishedAtMs < startedAtMs) {
    return null;
  }

  return finishedAtMs - startedAtMs;
}

function trailingCorrectAnswersWithTiming(events: readonly AnswerEvent[]): AnswerEvent[] {
  const streak: AnswerEvent[] = [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event?.correctness || typeof event.timingMs !== 'number') {
      break;
    }
    streak.unshift(event);
  }

  return streak;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}
