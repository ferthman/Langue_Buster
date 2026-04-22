import { describe, expect, it } from 'vitest';

import {
  CLASSIC_BOARD_SIZE,
  applyPlacement,
  canPlacePiece,
  clearLines,
  createEmptyBoard,
  createInitialEngineState,
  createPieceCatalog,
  createSeededGenerator,
  detectClears,
  deserializeEngineState,
  generateTray,
  hasAnyLegalPlacement,
  isRunOver,
  listLegalPlacements,
  normalizeShape,
  serializeEngineState,
  setCellsFilled,
  type Coordinate,
  type EngineState,
  type PieceId,
  type PieceInstance,
  type TrayState,
} from './index.js';

const catalog = createPieceCatalog();

describe('board model', () => {
  it('creates a deterministic immutable 8x8 empty board by default', () => {
    const board = createEmptyBoard();

    expect(board.width).toBe(CLASSIC_BOARD_SIZE);
    expect(board.height).toBe(CLASSIC_BOARD_SIZE);
    expect(board.cells).toHaveLength(64);
    expect(board.cells.every((cell) => cell === 'empty')).toBe(true);

    const filled = setCellsFilled(board, [{ x: 0, y: 0 }]);
    expect(board.cells[0]).toBe('empty');
    expect(filled.cells[0]).toBe('filled');
  });

  it('supports explicit dimensions for internal testability', () => {
    const board = createEmptyBoard({ width: 4, height: 3 });

    expect(board.width).toBe(4);
    expect(board.height).toBe(3);
    expect(board.cells).toHaveLength(12);
  });
});

describe('piece model', () => {
  it('normalizes shapes and calculates width/height metadata correctly', () => {
    expect(normalizeShape([{ x: 2, y: 3 }, { x: 2, y: 4 }, { x: 3, y: 4 }])).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);

    const l3 = requirePiece('l3');
    expect(l3.width).toBe(2);
    expect(l3.height).toBe(2);
    expect(l3.cellCount).toBe(3);

    const rect = requirePiece('rect_2x3');
    expect(rect.width).toBe(2);
    expect(rect.height).toBe(3);
    expect(rect.cellCount).toBe(6);
  });
});

describe('seeded generation', () => {
  it('produces the same tray sequence for the same seed and different sequences for different seeds', () => {
    const first = generateTray(42);
    const second = generateTray(42);
    const third = generateTray(77);

    expect(first).toEqual(second);
    expect(first.tray.map((piece) => piece?.pieceId)).not.toEqual(third.tray.map((piece) => piece?.pieceId));
  });

  it('advances the RNG cursor deterministically', () => {
    const seedState = createSeededGenerator(99);
    const generated = generateTray(seedState);

    expect(seedState.cursor).toBe(0);
    expect(generated.rng.cursor).toBe(3);

    const nextGenerated = generateTray(generated.rng);
    expect(nextGenerated.rng.cursor).toBe(6);
    expect(nextGenerated.tray.map((piece) => piece?.instanceId)).toEqual(['p-4', 'p-5', 'p-6']);
  });
});

describe('placement validation', () => {
  it('accepts a valid center placement and lists legal placements', () => {
    const board = createEmptyBoard();
    const piece = requirePiece('square_2');
    const result = canPlacePiece(board, piece, { x: 3, y: 3 });

    expect(result).toEqual({
      ok: true,
      translatedCells: [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
      ],
      occupiedCells: [],
    });
    expect(hasAnyLegalPlacement(board, piece)).toBe(true);
    expect(listLegalPlacements(board, piece)).toContainEqual({ x: 6, y: 6 });
  });

  it('accepts exact edge fits and rejects out-of-bounds placement', () => {
    const board = createEmptyBoard();
    const piece = requirePiece('bar_h_5');

    expect(canPlacePiece(board, piece, { x: 3, y: 7 }).ok).toBe(true);
    expect(canPlacePiece(board, piece, { x: 4, y: 7 })).toMatchObject({
      ok: false,
      reason: 'out_of_bounds',
    });
  });

  it('rejects overlap with occupied cells', () => {
    const board = setCellsFilled(createEmptyBoard(), [{ x: 1, y: 1 }]);
    const piece = requirePiece('square_2');
    const result = canPlacePiece(board, piece, { x: 0, y: 0 });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('overlap');
    expect(result.occupiedCells).toEqual([{ x: 1, y: 1 }]);
  });
});

describe('clear logic', () => {
  it('detects and clears a single row', () => {
    const board = setCellsFilled(
      createEmptyBoard(),
      line('row', 0),
    );

    const clears = detectClears(board);
    expect(clears.rows).toEqual([0]);
    expect(clears.columns).toEqual([]);
    expect(clears.clearedLineCount).toBe(1);

    const clearedBoard = clearLines(board, clears);
    expect(clearedBoard.cells.every((cell) => cell === 'empty')).toBe(true);
  });

  it('detects and clears a single column', () => {
    const board = setCellsFilled(
      createEmptyBoard(),
      line('column', 2),
    );

    const clears = detectClears(board);
    expect(clears.rows).toEqual([]);
    expect(clears.columns).toEqual([2]);
    expect(clears.clearedLineCount).toBe(1);
  });

  it('handles simultaneous row and column clears with shared intersection cells', () => {
    const board = setCellsFilled(
      createEmptyBoard(),
      [...line('row', 0), ...line('column', 0)],
    );

    const clears = detectClears(board);
    expect(clears.rows).toEqual([0]);
    expect(clears.columns).toEqual([0]);
    expect(clears.clearedLineCount).toBe(2);
    expect(clears.clearedCells).toHaveLength(15);

    const clearedBoard = clearLines(board, clears);
    expect(clearedBoard.cells.every((cell) => cell === 'empty')).toBe(true);
  });
});

describe('apply flow, scoring, and combo logic', () => {
  it('consumes tray slots, updates board immutably, and refills the tray only after all three pieces are used', () => {
    const initialState = createStateWithTray(
      createEmptyBoard(),
      ['single_1', 'single_1', 'single_1'],
      11,
    );

    const first = applyPlacement(initialState, 0, { x: 0, y: 0 });
    expect(initialState.board.cells[0]).toBe('empty');
    expect(first.state.board.cells[0]).toBe('filled');
    expect(first.state.tray[0]).toBeNull();
    expect(first.state.tray[1]).not.toBeNull();
    expect(first.state.score).toBe(1);

    const second = applyPlacement(first.state, 1, { x: 1, y: 0 });
    expect(second.state.tray[1]).toBeNull();

    const third = applyPlacement(second.state, 2, { x: 2, y: 0 });
    expect(third.state.tray.every((entry) => entry !== null)).toBe(true);
    expect(third.state.rng.cursor).toBe(6);
  });

  it('scores a row clear with additive placement and clear bonuses', () => {
    const board = setCellsFilled(createEmptyBoard(), rowWithoutLastCell(0));
    const state = createStateWithTray(board, ['single_1', 'single_1', 'single_1'], 12);
    const result = applyPlacement(state, 0, { x: 7, y: 0 });

    expect(result.clearResult.rows).toEqual([0]);
    expect(result.scoreBreakdown).toEqual({
      placementPoints: 1,
      lineClearPoints: 10,
      multiLineBonus: 0,
      comboBonus: 2,
      totalPoints: 13,
      clearedRowCount: 1,
      clearedColumnCount: 0,
    });
    expect(result.state.score).toBe(13);
    expect(result.state.combo).toBe(1);
  });

  it('increments combo on consecutive clears and applies the combo bonus', () => {
    const firstState = createStateWithTray(
      setCellsFilled(createEmptyBoard(), rowWithoutLastCell(0)),
      ['single_1', 'single_1', 'single_1'],
      13,
    );
    const first = applyPlacement(firstState, 0, { x: 7, y: 0 });

    const secondBoard = setCellsFilled(first.state.board, rowWithoutLastCell(1));
    const secondState: EngineState = {
      ...first.state,
      board: secondBoard,
    };
    const second = applyPlacement(secondState, 1, { x: 7, y: 1 });

    expect(second.state.combo).toBe(2);
    expect(second.scoreBreakdown.comboBonus).toBe(4);
    expect(second.scoreBreakdown.totalPoints).toBe(15);
  });

  it('resets combo after a non-clear move', () => {
    const state = createStateWithTray(createEmptyBoard(), ['single_1', 'single_1', 'single_1'], 14);
    const withCombo: EngineState = {
      ...state,
      combo: 2,
      lastClearCount: 1,
    };

    const result = applyPlacement(withCombo, 0, { x: 0, y: 0 });

    expect(result.clearResult.clearedLineCount).toBe(0);
    expect(result.state.combo).toBe(0);
    expect(result.scoreBreakdown).toEqual({
      placementPoints: 1,
      lineClearPoints: 0,
      multiLineBonus: 0,
      comboBonus: 0,
      totalPoints: 1,
      clearedRowCount: 0,
      clearedColumnCount: 0,
    });
  });

  it('awards multi-line bonuses for simultaneous row and column clears', () => {
    const board = setCellsFilled(createEmptyBoard(), [
      ...coordinates([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }]),
      ...coordinates([{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 }]),
    ]);
    const state = createStateWithTray(board, ['single_1', 'single_1', 'single_1'], 15);
    const result = applyPlacement(state, 0, { x: 0, y: 0 });

    expect(result.clearResult.rows).toEqual([0]);
    expect(result.clearResult.columns).toEqual([0]);
    expect(result.scoreBreakdown).toEqual({
      placementPoints: 1,
      lineClearPoints: 20,
      multiLineBonus: 5,
      comboBonus: 2,
      totalPoints: 28,
      clearedRowCount: 1,
      clearedColumnCount: 1,
    });
  });
});

describe('run-over detection', () => {
  it('is false when any active piece has at least one legal placement', () => {
    const board = setCellsFilled(
      createEmptyBoard(),
      coordinates(
        Array.from({ length: 63 }, (_, index) => {
          const x = index % CLASSIC_BOARD_SIZE;
          const y = Math.floor(index / CLASSIC_BOARD_SIZE);
          return { x, y };
        }),
      ),
    );
    const tray = createTray(['bar_h_2', 'bar_v_2', 'single_1']);

    expect(isRunOver(board, tray)).toEqual({
      isOver: false,
      checkedPieceIds: ['bar_h_2', 'bar_v_2', 'single_1'],
    });
  });

  it('is true when no active tray piece can be placed', () => {
    const board = setCellsFilled(
      createEmptyBoard(),
      coordinates(
        Array.from({ length: 63 }, (_, index) => {
          const x = index % CLASSIC_BOARD_SIZE;
          const y = Math.floor(index / CLASSIC_BOARD_SIZE);
          return { x, y };
        }),
      ),
    );
    const tray = createTray(['bar_h_2', 'bar_v_2', 'square_2']);

    expect(isRunOver(board, tray)).toEqual({
      isOver: true,
      checkedPieceIds: ['bar_h_2', 'bar_v_2', 'square_2'],
    });
  });
});

describe('serialization', () => {
  it('round-trips engine state and preserves deterministic continuation', () => {
    const initial = createInitialEngineState({ seed: 123 });
    const startingState = createStateWithTray(initial.board, ['single_1', 'single_1', 'single_1'], 123);
    const first = applyPlacement(startingState, 0, { x: 0, y: 0 });
    const serialized = serializeEngineState(first.state);
    const restored = deserializeEngineState(serialized);

    expect(restored).toEqual(first.state);

    const nextOriginal = applyPlacement(first.state, 1, { x: 1, y: 0 });
    const nextRestored = applyPlacement(restored, 1, { x: 1, y: 0 });

    expect(nextRestored).toEqual(nextOriginal);
  });
});

function requirePiece(id: PieceId) {
  const piece = catalog.find((entry) => entry.id === id);
  if (!piece) {
    throw new Error(`Missing piece ${id} in catalog.`);
  }

  return piece;
}

function createTray(pieceIds: readonly [PieceId, PieceId, PieceId]): TrayState {
  return [
    pieceInstance(pieceIds[0], 1),
    pieceInstance(pieceIds[1], 2),
    pieceInstance(pieceIds[2], 3),
  ];
}

function createStateWithTray(board: EngineState['board'], pieceIds: readonly [PieceId, PieceId, PieceId], seed: number): EngineState {
  const generated = generateTray(seed);

  return {
    board,
    tray: createTray(pieceIds),
    rng: generated.rng,
    score: 0,
    combo: 0,
    turn: 0,
    lastClearCount: 0,
    clearedLinesTotal: 0,
  };
}

function pieceInstance(pieceId: PieceId, index: number): PieceInstance {
  return {
    instanceId: `custom-${index}`,
    pieceId,
  };
}

function line(axis: 'row' | 'column', position: number): Coordinate[] {
  return coordinates(
    Array.from({ length: CLASSIC_BOARD_SIZE }, (_, offset) =>
      axis === 'row'
        ? { x: offset, y: position }
        : { x: position, y: offset },
    ),
  );
}

function rowWithoutLastCell(row: number): Coordinate[] {
  return coordinates(
    Array.from({ length: CLASSIC_BOARD_SIZE - 1 }, (_, x) => ({ x, y: row })),
  );
}

function coordinates(input: readonly Coordinate[]): Coordinate[] {
  return input.map((coordinate) => ({ x: coordinate.x, y: coordinate.y }));
}
