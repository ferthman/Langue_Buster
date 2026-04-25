import { describe, expect, it } from 'vitest';

import {
  applyPlacement,
  createInitialEngineState,
  isRunOver,
  listLegalPlacements,
  type Coordinate,
  type EngineState,
} from './index.js';

type BalanceSimulation = Readonly<{
  seed: number;
  moves: number;
  score: number;
  clearedLines: number;
  comboHits: number;
  runOver: boolean;
}>;

describe('classic run balance smoke simulation', () => {
  it('keeps deterministic legal-placement runs within launchable observation bands', () => {
    const simulations = Array.from({ length: 40 }, (_, index) => simulateRun(10_000 + index));
    const moveCounts = simulations.map((summary) => summary.moves).sort((left, right) => left - right);
    const medianMoves = moveCounts[Math.floor(moveCounts.length / 2)] ?? 0;
    const averageMoves = average(simulations.map((summary) => summary.moves));
    const averageScore = average(simulations.map((summary) => summary.score));
    const averageClears = average(simulations.map((summary) => summary.clearedLines));
    const comboRuns = simulations.filter((summary) => summary.comboHits > 0).length;

    expect(medianMoves).toBeGreaterThanOrEqual(9);
    expect(averageMoves).toBeGreaterThanOrEqual(10);
    expect(averageMoves).toBeLessThanOrEqual(80);
    expect(averageScore).toBeGreaterThan(averageMoves);
    expect(averageClears).toBeGreaterThan(0);
    expect(comboRuns).toBeGreaterThan(0);
  });
});

function simulateRun(seed: number): BalanceSimulation {
  let state = createInitialEngineState({ seed });
  let moves = 0;
  let comboHits = 0;
  const maxMoves = 80;

  while (moves < maxMoves && !isRunOver(state.board, state.tray).isOver) {
    const candidate = chooseBestLegalMove(state);
    if (!candidate) {
      break;
    }

    const result = applyPlacement(state, candidate.trayIndex, candidate.origin);
    state = result.state;
    moves += 1;
    if (result.state.combo > 1) {
      comboHits += 1;
    }
  }

  return {
    seed,
    moves,
    score: state.score,
    clearedLines: state.clearedLinesTotal,
    comboHits,
    runOver: isRunOver(state.board, state.tray).isOver,
  };
}

function chooseBestLegalMove(state: EngineState): Readonly<{ trayIndex: number; origin: Coordinate }> | null {
  const candidates: Array<Readonly<{
    trayIndex: number;
    origin: Coordinate;
    score: number;
    clears: number;
  }>> = [];

  for (const [trayIndex, piece] of state.tray.entries()) {
    if (!piece) {
      continue;
    }

    for (const origin of listLegalPlacements(state.board, piece)) {
      const result = applyPlacement(state, trayIndex, origin);
      candidates.push({
        trayIndex,
        origin,
        score: result.scoreBreakdown.totalPoints,
        clears: result.clearResult.clearedLineCount,
      });
    }
  }

  candidates.sort((left, right) =>
    right.clears - left.clears
    || right.score - left.score
    || left.origin.y - right.origin.y
    || left.origin.x - right.origin.x
    || left.trayIndex - right.trayIndex);

  return candidates[0] ?? null;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
