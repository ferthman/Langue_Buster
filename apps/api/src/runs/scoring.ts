import type { MoveEvent, RunResult, RunSession } from '@langue-buster/shared';

import { RunDomainError } from './errors.js';

export type RecomputedRunSummary = Readonly<{
  finalScore: number;
  finalCombo: number;
  clearedLinesTotal: number;
}>;

export function recomputeRunTotals(run: RunSession, moveEvents: readonly MoveEvent[]): RecomputedRunSummary {
  const finalScore = moveEvents.reduce((total, event) => total + event.scoreBreakdown.totalPoints, 0);
  const finalCombo = moveEvents.at(-1)?.resultingCombo ?? 0;
  const clearedLinesTotal = moveEvents.reduce((total, event) => total + event.clearedLineCount, 0);

  if (finalScore !== run.score) {
    throw new RunDomainError('run_integrity_error', 'Persisted run score does not match recomputed move totals.');
  }

  if (finalCombo !== run.combo) {
    throw new RunDomainError('run_integrity_error', 'Persisted run combo does not match recomputed move totals.');
  }

  if (clearedLinesTotal !== run.engineState.clearedLinesTotal) {
    throw new RunDomainError(
      'run_integrity_error',
      'Persisted cleared line total does not match recomputed move totals.',
    );
  }

  return {
    finalScore,
    finalCombo,
    clearedLinesTotal,
  };
}

export function buildRunDurationMs(result: Pick<RunResult, 'startedAt' | 'finishedAt'>): number {
  return Math.max(0, new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime());
}
