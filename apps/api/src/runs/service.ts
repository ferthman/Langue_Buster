import {
  buildAnswerTelemetryEvent,
  ContentAnswerError,
  createShortCycleRecoveryState,
  evaluateAnswer,
  generateQuestion,
  scheduleShortCycleRecovery,
  selectNextRecoverySource,
  type DistractorSet,
  type VocabItem,
} from '@langue-buster/content-core';
import {
  applyPlacement,
  createInitialEngineState,
  isRunOver,
  type EngineState as GameEngineState,
} from '@langue-buster/game-engine';
import {
  CLASSIC_RUN_DEFAULT_HEARTS,
  CLASSIC_RUN_DEFAULT_SHORT_CYCLE_GAP,
  launchLevels,
  runResultSchema,
  runSessionSchema,
} from '@langue-buster/shared';
import type {
  AnalyticsEventEnvelope,
  AnswerDirection,
  AnswerEvent,
  AnswerEvaluation,
  Coordinate,
  GeneratedQuestion,
  MoveEvent,
  RunResult,
  RunRecoveryState,
  RunSession,
  SoftLaunchSettings,
} from '@langue-buster/shared';
import { randomUUID } from 'node:crypto';

import type { RunContentRepository } from './content.js';
import { RunDomainError } from './errors.js';
import type {
  AnswerEventRepository,
  MoveEventRepository,
  RunResultRepository,
  RunSessionRepository,
} from './repositories.js';
import { buildRunDurationMs, recomputeRunTotals } from './scoring.js';

type RunServiceDependencies = {
  runSessionRepository: RunSessionRepository;
  answerEventRepository: AnswerEventRepository;
  moveEventRepository: MoveEventRepository;
  runResultRepository: RunResultRepository;
  contentRepository: RunContentRepository;
  now?: () => Date;
  seedGenerator?: () => number;
  masteryUpdater?: {
    applyRunMastery(runId: string): Promise<unknown>;
  };
  analytics?: {
    recordEvent(event: AnalyticsEventEnvelope): Promise<unknown>;
  };
  softLaunchSettings?: {
    getActiveSettings(): Promise<SoftLaunchSettings>;
  };
  logger?: {
    warn(message: string, context: Record<string, unknown>): void;
  };
  errorReporter?: {
    captureError(error: unknown, context: Record<string, unknown>): void;
  };
  antiCheat?: {
    recordAnomaly(input: {
      userId?: string;
      runId?: string;
      sourceItemId?: string;
      type:
        | 'rate_limit_exceeded'
        | 'impossible_answer_timing'
        | 'impossible_move_cadence'
        | 'ultra_fast_correct_streak'
        | 'suspicious_perfect_run'
        | 'invalid_move_attempt'
        | 'run_integrity_mismatch';
      severity: 'low' | 'medium' | 'high';
      metadata?: Record<string, unknown>;
      occurredAt?: string;
    }): Promise<unknown>;
    inspectAnswer(input: {
      run: RunSession;
      answerEvent: AnswerEvent;
      shownAt: string;
      answeredAt?: string;
    }): Promise<unknown>;
    inspectMoveCadence(input: {
      run: RunSession;
      moveEvent: MoveEvent;
      unlockedAt?: string;
    }): Promise<unknown>;
    inspectRunResult(input: {
      run: RunSession;
      result: RunResult;
    }): Promise<unknown>;
  };
};

export type RunService = ReturnType<typeof createRunService>;

const DEFAULT_HEARTS = CLASSIC_RUN_DEFAULT_HEARTS;
const DEFAULT_WRONG_ANSWER_HEART_LOSS = 1;

export function createRunService(dependencies: RunServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const seedGenerator = dependencies.seedGenerator ?? (() => Math.floor(Math.random() * 0xffffffff));

  return {
    async startRun(input: {
      userId: string;
      levelId: 'A1' | 'A2';
      direction: AnswerDirection;
    }): Promise<RunSession> {
      if (!launchLevels.includes(input.levelId)) {
        throw new RunDomainError('run_invalid_state', 'Runs may only be started for A1 and A2 during Phase 7.');
      }

      const startedAt = now().toISOString();
      const settings = await dependencies.softLaunchSettings?.getActiveSettings();
      const seed = normalizeSeed(seedGenerator());
      const engineState = cloneEngineState(createInitialEngineState({ seed }));
      const initialRecoveryState = createShortCycleRecoveryState({
        resurfacingGap: CLASSIC_RUN_DEFAULT_SHORT_CYCLE_GAP,
      });
      const questionSelection = createQuestionState({
        levelId: input.levelId,
        direction: input.direction,
        seed,
        sequence: 0,
        shownAt: startedAt,
        recoveryState: initialRecoveryState,
        contentRepository: dependencies.contentRepository,
      });

      const run = runSessionSchema.parse({
        id: `run_${randomUUID()}`,
        userId: input.userId,
        levelId: input.levelId,
        direction: input.direction,
        status: 'active',
        heartsRemaining: settings?.startingHearts ?? DEFAULT_HEARTS,
        score: 0,
        combo: 0,
        seed,
        engineState,
        recoveryState: questionSelection.recoveryState,
        currentQuestionState: questionSelection.questionState,
        answerCount: 0,
        correctCount: 0,
        wrongCount: 0,
        moveCount: 0,
        startedAt,
      });

      const saved = await dependencies.runSessionRepository.save(run);
      await dependencies.analytics?.recordEvent({
        eventName: 'run_started',
        source: 'backend',
        occurredAt: startedAt,
        userId: saved.userId,
        runId: saved.id,
        levelId: saved.levelId,
        payload: {
          status: saved.status,
          score: saved.score,
          moveCount: saved.moveCount,
        },
      });
      await recordQuestionShown(dependencies, saved);
      return saved;
    },

    async getRunForUser(runId: string, userId: string): Promise<RunSession> {
      const run = await requireOwnedRun(runId, userId, dependencies.runSessionRepository);
      return run;
    },

    async getResultForUser(runId: string, userId: string): Promise<RunResult> {
      const run = await requireOwnedRun(runId, userId, dependencies.runSessionRepository);
      if (!isTerminalStatus(run.status)) {
        throw new RunDomainError('run_result_unavailable', 'Run result is not available until the run has finished.');
      }

      const existing = await dependencies.runResultRepository.findByRunId(runId);
      if (!existing) {
        throw new RunDomainError('run_result_unavailable', 'Run result has not been persisted yet.');
      }

      return ensureMasteryApplied(runId, existing, dependencies);
    },

    async submitAnswer(input: {
      runId: string;
      userId: string;
      selectedOptionId: string;
      answeredAt?: string;
    }): Promise<{
      run: RunSession;
      evaluation: AnswerEvaluation;
      result?: RunResult;
    }> {
      const run = await requireOwnedRun(input.runId, input.userId, dependencies.runSessionRepository);
      const questionState = run.currentQuestionState;

      if (run.status !== 'active' || !questionState || questionState.answerState !== 'awaiting_answer') {
        throw new RunDomainError('run_invalid_state', 'This run is not currently accepting answer submissions.');
      }

      const evaluation = evaluateAnswer(questionState.question, input.selectedOptionId, {
        shownAt: questionState.shownAt,
        answeredAt: input.answeredAt,
      });
      const settings = await dependencies.softLaunchSettings?.getActiveSettings();
      const effectiveHeartLoss = evaluation.penalty?.applies
        ? settings?.wrongAnswerHeartLoss ?? DEFAULT_WRONG_ANSWER_HEART_LOSS
        : 0;
      const effectivePenalty = evaluation.penalty?.applies
        ? {
            ...evaluation.penalty,
            amount: effectiveHeartLoss,
          }
        : evaluation.penalty;
      const occurredAt = input.answeredAt ?? now().toISOString();
      const telemetryEvent = buildAnswerTelemetryEvent({
        question: questionState.question,
        evaluation,
        occurredAt,
      });
      const answerEvent: AnswerEvent = {
        id: `ans_${randomUUID()}`,
        runId: run.id,
        questionId: telemetryEvent.questionId,
        sourceItemId: telemetryEvent.sourceItemId,
        selectedOptionId: telemetryEvent.selectedOptionId,
        correctOptionId: telemetryEvent.correctOptionId,
        correctness: telemetryEvent.isCorrect,
        timingMs: telemetryEvent.timingMs,
        penalty: effectivePenalty,
        occurredAt,
      };
      await dependencies.answerEventRepository.save(answerEvent);
      await dependencies.antiCheat?.inspectAnswer({
        run,
        answerEvent,
        shownAt: questionState.shownAt,
        answeredAt: input.answeredAt,
      });
      await dependencies.analytics?.recordEvent({
        eventName: 'answer_submitted',
        source: 'backend',
        occurredAt,
        userId: run.userId,
        runId: run.id,
        levelId: run.levelId,
        sourceItemId: answerEvent.sourceItemId,
        topicId: questionState.question.meta.topicId,
        payload: {
          questionId: answerEvent.questionId,
          selectedOptionId: answerEvent.selectedOptionId,
          correctOptionId: answerEvent.correctOptionId,
          cardType: evaluation.cardType,
          timingMs: evaluation.timingMs,
          moveUnlocked: evaluation.moveUnlocked,
          correctness: evaluation.isCorrect,
        },
      });
      await dependencies.analytics?.recordEvent({
        eventName: evaluation.isCorrect ? 'answer_correct' : 'answer_wrong',
        source: 'backend',
        occurredAt,
        userId: run.userId,
        runId: run.id,
        levelId: run.levelId,
        sourceItemId: answerEvent.sourceItemId,
        topicId: questionState.question.meta.topicId,
        payload: {
          questionId: answerEvent.questionId,
          selectedOptionId: answerEvent.selectedOptionId,
          correctOptionId: answerEvent.correctOptionId,
          cardType: evaluation.cardType,
          timingMs: evaluation.timingMs,
          moveUnlocked: evaluation.moveUnlocked,
          correctness: evaluation.isCorrect,
        },
      });

      if (evaluation.isCorrect) {
        const nextRun = await dependencies.runSessionRepository.save({
          ...run,
          status: 'awaiting_move',
          answerCount: run.answerCount + 1,
          correctCount: run.correctCount + 1,
          currentQuestionState: {
            ...questionState,
            answerState: 'answered_correct',
            answeredAt: occurredAt,
            selectedOptionId: input.selectedOptionId,
          },
        });

        return {
          run: nextRun,
          evaluation,
        };
      }

      const heartsRemaining = Math.max(0, run.heartsRemaining - effectiveHeartLoss);
      const recoveryState = scheduleShortCycleRecovery(
        run.recoveryState,
        questionState.question.meta.sourceItemId,
        questionState.sequence,
      );
      const baseRun: RunSession = {
        ...run,
        heartsRemaining,
        recoveryState,
        answerCount: run.answerCount + 1,
        wrongCount: run.wrongCount + 1,
      };

      if (heartsRemaining === 0) {
        const finishedRun = await dependencies.runSessionRepository.save({
          ...baseRun,
          status: 'failed',
          currentQuestionState: {
            ...questionState,
            answerState: 'answered_wrong',
            answeredAt: occurredAt,
            selectedOptionId: input.selectedOptionId,
          },
          finishedAt: occurredAt,
        });
        const result = await finalizeRunWithMastery(finishedRun, dependencies, now);

        return {
          run: finishedRun,
          evaluation: {
            ...evaluation,
            penalty: effectivePenalty,
          },
          result,
        };
      }

      const nextQuestion = createQuestionState({
        levelId: run.levelId,
        direction: run.direction,
        seed: run.seed,
        sequence: questionState.sequence + 1,
        shownAt: occurredAt,
        recoveryState,
        contentRepository: dependencies.contentRepository,
      });
      const nextRun = await dependencies.runSessionRepository.save({
        ...baseRun,
        status: 'active',
        recoveryState: nextQuestion.recoveryState,
        currentQuestionState: nextQuestion.questionState,
      });
      await recordQuestionShown(dependencies, nextRun);

      return {
        run: nextRun,
        evaluation: {
          ...evaluation,
          penalty: effectivePenalty,
        },
      };
    },

    async submitMove(input: {
      runId: string;
      userId: string;
      trayIndex: number;
      origin: Coordinate;
    }): Promise<{
      run: RunSession;
      moveEvent: MoveEvent;
      result?: RunResult;
    }> {
      const run = await requireOwnedRun(input.runId, input.userId, dependencies.runSessionRepository);
      const questionState = run.currentQuestionState;
      if (run.status !== 'awaiting_move' || !questionState || questionState.answerState !== 'answered_correct') {
        throw new RunDomainError('run_invalid_state', 'This run is not currently accepting move submissions.');
      }

      const activePiece = run.engineState.tray[input.trayIndex];
      if (!activePiece) {
        throw new RunDomainError('run_invalid_move', `Tray slot ${input.trayIndex} does not contain an active piece.`);
      }

      const selectedOptionIndex = questionState.question.options.findIndex(
        (option) => option.id === questionState.selectedOptionId,
      );
      if (selectedOptionIndex === -1) {
        throw new RunDomainError('run_invalid_state', 'Selected answer option could not be matched to a tray slot.');
      }

      if (input.trayIndex !== selectedOptionIndex) {
        throw new RunDomainError(
          'run_invalid_move',
          `Tray slot ${input.trayIndex} is not unlocked for the selected answer. Expected slot ${selectedOptionIndex}.`,
        );
      }

      await dependencies.analytics?.recordEvent({
        eventName: 'move_submitted',
        source: 'backend',
        occurredAt: now().toISOString(),
        userId: run.userId,
        runId: run.id,
        levelId: run.levelId,
        sourceItemId: questionState.question.meta.sourceItemId,
        topicId: questionState.question.meta.topicId,
        payload: {
          trayIndex: input.trayIndex,
          originX: input.origin.x,
          originY: input.origin.y,
          pieceId: activePiece.pieceId,
          pieceInstanceId: activePiece.instanceId,
          engineTurn: run.engineState.turn,
        },
      });

      let applied;
      try {
        applied = applyPlacement(run.engineState, input.trayIndex, input.origin);
      } catch (error) {
        await dependencies.antiCheat?.recordAnomaly({
          userId: run.userId,
          runId: run.id,
          sourceItemId: questionState.question.meta.sourceItemId,
          type: 'invalid_move_attempt',
          severity: 'low',
          occurredAt: now().toISOString(),
          metadata: {
            trayIndex: input.trayIndex,
            origin: input.origin,
            engineTurn: run.engineState.turn,
            reason: error instanceof Error ? error.message : 'invalid_move',
          },
        });
        await dependencies.analytics?.recordEvent({
          eventName: 'move_rejected',
          source: 'backend',
          occurredAt: now().toISOString(),
          userId: run.userId,
          runId: run.id,
          levelId: run.levelId,
          sourceItemId: questionState.question.meta.sourceItemId,
          topicId: questionState.question.meta.topicId,
          payload: {
            trayIndex: input.trayIndex,
            originX: input.origin.x,
            originY: input.origin.y,
            pieceId: activePiece.pieceId,
            pieceInstanceId: activePiece.instanceId,
            engineTurn: run.engineState.turn,
            reasonCode: error instanceof Error ? error.message : 'invalid_move',
          },
        });
        dependencies.logger?.warn('Run move rejected by engine.', {
          domain: 'run',
          runId: run.id,
          userId: run.userId,
          code: 'run_invalid_move',
          extra: {
            trayIndex: input.trayIndex,
            origin: input.origin,
          },
        });
        throw new RunDomainError(
          'run_invalid_move',
          error instanceof Error ? error.message : 'Move could not be applied by the game engine.',
        );
      }

      const occurredAt = now().toISOString();
      const moveEvent: MoveEvent = {
        id: `mov_${randomUUID()}`,
        runId: run.id,
        engineTurn: run.engineState.turn,
        trayIndex: input.trayIndex,
        pieceInstanceId: applied.placedPiece.instanceId,
        pieceId: applied.placedPiece.pieceId,
        origin: input.origin,
        validationResult: 'accepted',
        clearedLineCount: applied.clearResult.clearedLineCount,
        scoreBreakdown: applied.scoreBreakdown,
        resultingScore: applied.state.score,
        resultingCombo: applied.state.combo,
        occurredAt,
      };
      await dependencies.moveEventRepository.save(moveEvent);
      await dependencies.antiCheat?.inspectMoveCadence({
        run,
        moveEvent,
        unlockedAt: questionState.answeredAt,
      });
      await dependencies.analytics?.recordEvent({
        eventName: 'move_accepted',
        source: 'backend',
        occurredAt,
        userId: run.userId,
        runId: run.id,
        levelId: run.levelId,
        sourceItemId: questionState.question.meta.sourceItemId,
        topicId: questionState.question.meta.topicId,
        payload: {
          trayIndex: input.trayIndex,
          originX: input.origin.x,
          originY: input.origin.y,
          pieceId: moveEvent.pieceId,
          pieceInstanceId: moveEvent.pieceInstanceId,
          engineTurn: moveEvent.engineTurn,
          clearedLineCount: moveEvent.clearedLineCount,
          scoreDelta: moveEvent.scoreBreakdown.totalPoints,
        },
      });

      const baseRun: RunSession = {
        ...run,
        status: 'active',
        score: applied.state.score,
        combo: applied.state.combo,
        engineState: cloneEngineState(applied.state),
        moveCount: run.moveCount + 1,
      };
      const runOver = isRunOver(applied.state.board, applied.state.tray);

      if (runOver.isOver) {
        const finishedRun = await dependencies.runSessionRepository.save({
          ...baseRun,
          status: 'completed',
          currentQuestionState: null,
          finishedAt: occurredAt,
        });
        const result = await finalizeRunWithMastery(finishedRun, dependencies, now);

        return {
          run: finishedRun,
          moveEvent,
          result,
        };
      }

      const nextQuestion = createQuestionState({
        levelId: run.levelId,
        direction: run.direction,
        seed: run.seed,
        sequence: (questionState.sequence ?? 0) + 1,
        shownAt: occurredAt,
        recoveryState: run.recoveryState,
        contentRepository: dependencies.contentRepository,
      });

      const nextRun = await dependencies.runSessionRepository.save({
        ...baseRun,
        status: 'active',
        recoveryState: nextQuestion.recoveryState,
        currentQuestionState: nextQuestion.questionState,
      });
      await recordQuestionShown(dependencies, nextRun);

      return {
        run: nextRun,
        moveEvent,
      };
    },

    async finishRun(input: { runId: string; userId: string }): Promise<{ run: RunSession; result: RunResult }> {
      const run = await requireOwnedRun(input.runId, input.userId, dependencies.runSessionRepository);
      if (isTerminalStatus(run.status)) {
        const result = await finalizeRunWithMastery(run, dependencies, now);
        return {
          run,
          result,
        };
      }

      const finishedAt = now().toISOString();
      const terminalRun = await dependencies.runSessionRepository.save({
        ...run,
        status: 'abandoned',
        finishedAt,
      });
      const result = await finalizeRunWithMastery(terminalRun, dependencies, now);

      return {
        run: terminalRun,
        result,
      };
    },
  };
}

async function requireOwnedRun(
  runId: string,
  userId: string,
  repository: RunSessionRepository,
): Promise<RunSession> {
  const run = await repository.findById(runId);
  if (!run) {
    throw new RunDomainError('run_not_found', 'Run session was not found.');
  }

  if (run.userId !== userId) {
    throw new RunDomainError('run_forbidden', 'Run session does not belong to the authenticated user.');
  }

  return run;
}

async function finalizeRunInternal(
  run: RunSession,
  dependencies: Pick<
    RunServiceDependencies,
    'moveEventRepository' | 'answerEventRepository' | 'runResultRepository' | 'antiCheat'
  >,
  now: () => Date,
): Promise<RunResult> {
  const existing = await dependencies.runResultRepository.findByRunId(run.id);
  if (existing) {
    return existing;
  }

  if (!isTerminalStatus(run.status)) {
    throw new RunDomainError('run_invalid_state', 'Only terminal runs may be finalized.');
  }

  const answerEvents = await dependencies.answerEventRepository.findByRunId(run.id);
  const moveEvents = await dependencies.moveEventRepository.findByRunId(run.id);
  let totals;
  try {
    totals = recomputeRunTotals(run, moveEvents);
  } catch (error) {
    await dependencies.antiCheat?.recordAnomaly({
      userId: run.userId,
      runId: run.id,
      type: 'run_integrity_mismatch',
      severity: 'high',
      occurredAt: now().toISOString(),
      metadata: {
        reason: error instanceof Error ? error.message : 'run_integrity_error',
        storedScore: run.score,
        storedCombo: run.combo,
        moveCount: moveEvents.length,
      },
    });
    throw error;
  }

  if (answerEvents.filter((event) => event.correctness).length !== run.correctCount) {
    await dependencies.antiCheat?.recordAnomaly({
      userId: run.userId,
      runId: run.id,
      type: 'run_integrity_mismatch',
      severity: 'high',
      occurredAt: now().toISOString(),
      metadata: {
        reason: 'correct_answer_count_mismatch',
        storedCorrectCount: run.correctCount,
        persistedCorrectCount: answerEvents.filter((event) => event.correctness).length,
      },
    });
    throw new RunDomainError('run_integrity_error', 'Correct answer count does not match persisted answer events.');
  }

  if (answerEvents.filter((event) => !event.correctness).length !== run.wrongCount) {
    await dependencies.antiCheat?.recordAnomaly({
      userId: run.userId,
      runId: run.id,
      type: 'run_integrity_mismatch',
      severity: 'high',
      occurredAt: now().toISOString(),
      metadata: {
        reason: 'wrong_answer_count_mismatch',
        storedWrongCount: run.wrongCount,
        persistedWrongCount: answerEvents.filter((event) => !event.correctness).length,
      },
    });
    throw new RunDomainError('run_integrity_error', 'Wrong answer count does not match persisted answer events.');
  }

  const finishedAt = run.finishedAt ?? now().toISOString();
  const result = runResultSchema.parse({
    runId: run.id,
    userId: run.userId,
    levelId: run.levelId,
    direction: run.direction,
    status: run.status,
    finalScore: totals.finalScore,
    clearedLinesTotal: totals.clearedLinesTotal,
    correctCount: run.correctCount,
    wrongCount: run.wrongCount,
    startedAt: run.startedAt,
    finishedAt,
    durationMs: buildRunDurationMs({
      startedAt: run.startedAt,
      finishedAt,
    }),
  });

  return dependencies.runResultRepository.save(result);
}

async function finalizeRunWithMastery(
  run: RunSession,
  dependencies: Pick<
    RunServiceDependencies,
    'moveEventRepository' | 'answerEventRepository' | 'runResultRepository' | 'masteryUpdater' | 'analytics' | 'antiCheat'
  >,
  now: () => Date,
): Promise<RunResult> {
  const existing = await dependencies.runResultRepository.findByRunId(run.id);
  const result = await finalizeRunInternal(run, dependencies, now);
  if (!existing) {
    await recordRunFinished(dependencies, run, result);
    await dependencies.antiCheat?.inspectRunResult({
      run,
      result,
    });
  }
  return ensureMasteryApplied(run.id, result, dependencies);
}

async function ensureMasteryApplied(
  runId: string,
  result: RunResult,
  dependencies: Pick<RunServiceDependencies, 'masteryUpdater' | 'runResultRepository'>,
): Promise<RunResult> {
  if (!dependencies.masteryUpdater) {
    return result;
  }

  await dependencies.masteryUpdater.applyRunMastery(runId);
  return (await dependencies.runResultRepository.findByRunId(runId)) ?? result;
}

function isTerminalStatus(status: RunSession['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'abandoned';
}

function createQuestionState(input: {
  levelId: RunSession['levelId'];
  direction: AnswerDirection;
  seed: number;
  sequence: number;
  shownAt: string;
  recoveryState?: RunRecoveryState;
  contentRepository: RunContentRepository;
}) {
  if (!launchLevels.includes(input.levelId as (typeof launchLevels)[number])) {
    throw new RunDomainError('run_unavailable', `No Phase 7 run content exists for ${input.levelId}.`);
  }

  const bundle = input.contentRepository.getLevelBundle(input.levelId);
  let recoveryState = input.recoveryState;

  for (let attempt = 0; attempt < bundle.vocabItems.length; attempt += 1) {
    const selection = selectNextRecoverySource({
      pool: bundle.vocabItems,
      recoveryState,
      seed: input.seed + attempt,
      sequence: input.sequence,
    });

    try {
      const question = createGeneratedQuestion({
        sourceItem: selection.sourceItem,
        allVocabItems: bundle.vocabItems,
        distractorSets: bundle.distractorSets,
        direction: input.direction,
      });

      return {
        recoveryState: selection.recoveryState,
        questionState: {
          sequence: input.sequence,
          shownAt: input.shownAt,
          answerState: 'awaiting_answer' as const,
          question,
        },
      };
    } catch (error) {
      if (!(error instanceof ContentAnswerError)) {
        throw error;
      }

      if (selection.selectionReason === 'recovery_queue') {
        recoveryState = selection.recoveryState;
      }
    }
  }

  throw new RunDomainError('run_unavailable', 'No approved content exists for the requested level.');
}

function createGeneratedQuestion(input: {
  sourceItem: VocabItem;
  allVocabItems: readonly VocabItem[];
  distractorSets: readonly DistractorSet[];
  direction: AnswerDirection;
}): GeneratedQuestion {
  const promptLanguage = input.direction === 'ru_to_fr' ? 'ru' : 'fr';
  const answerLanguage = input.direction === 'ru_to_fr' ? 'fr' : 'ru';

  return generateQuestion({
    sourceItem: input.sourceItem,
    allVocabItems: [...input.allVocabItems],
    distractorSets: [...input.distractorSets],
    promptLanguage,
    answerLanguage,
    generatorVersion: 'phase7-v1',
  });
}

function normalizeSeed(seed: number): number {
  return seed >>> 0;
}

function cloneEngineState(state: GameEngineState): RunSession['engineState'] {
  return JSON.parse(JSON.stringify(state)) as RunSession['engineState'];
}

async function recordQuestionShown(
  dependencies: Pick<RunServiceDependencies, 'analytics'>,
  run: RunSession,
) {
  const questionState = run.currentQuestionState;
  if (!questionState) {
    return;
  }

  await dependencies.analytics?.recordEvent({
    eventName: 'question_shown',
    source: 'backend',
    occurredAt: questionState.shownAt,
    userId: run.userId,
    runId: run.id,
    levelId: run.levelId,
    sourceItemId: questionState.question.meta.sourceItemId,
    topicId: questionState.question.meta.topicId,
    payload: {
      questionId: questionState.question.id,
      sequence: questionState.sequence,
      cardType: questionState.question.cardType,
      answerState: questionState.answerState,
    },
  });
}

async function recordRunFinished(
  dependencies: Pick<RunServiceDependencies, 'analytics'>,
  run: RunSession,
  result: RunResult,
) {
  await dependencies.analytics?.recordEvent({
    eventName: result.status === 'abandoned' ? 'run_abandoned' : 'run_completed',
    source: 'backend',
    occurredAt: result.finishedAt,
    userId: result.userId,
    runId: result.runId,
    levelId: result.levelId,
    payload: {
      status: result.status,
      score: result.finalScore,
      durationMs: result.durationMs,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      moveCount: run.moveCount,
    },
  });
}
