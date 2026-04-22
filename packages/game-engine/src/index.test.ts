import { describe, expect, it } from 'vitest';

import { classicRunDefaults, createEmptyBoard } from './index.js';

describe('createEmptyBoard', () => {
  it('creates a deterministic empty 8x8 board for classic run defaults', () => {
    const board = createEmptyBoard(classicRunDefaults.boardSize);

    expect(board.size).toBe(8);
    expect(board.cells).toHaveLength(64);
    expect(board.cells.every((cell) => cell.occupied === false)).toBe(true);
  });
});
