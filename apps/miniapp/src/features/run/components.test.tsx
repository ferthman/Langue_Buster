import { act, render, screen, waitFor } from '@testing-library/react';
import { createEmptyBoard, setCellsFilled } from '@langue-buster/game-engine';
import type { EngineState } from '@langue-buster/shared';
import { describe, expect, it, vi } from 'vitest';

import { RunPlayfield } from './components';

describe('RunPlayfield drag and drop', () => {
  it('shows a valid preview and places a piece directly on valid drop', async () => {
    const onPlace = vi.fn();

    render(
      <RunPlayfield
        engineState={createEngineState(createEmptyBoard())}
        moveUnlocked
        pending={false}
        onPlace={onPlace}
      />,
    );

    const board = screen.getByTestId('run-board');
    const traySlot = screen.getByTestId('tray-slot-0');

    mockRect(board, { left: 0, top: 0, width: 240, height: 240 });
    mockRect(traySlot, { left: 0, top: 280, width: 96, height: 120 });

    dispatchPointerEvent(traySlot, 'pointerdown', {
      pointerId: 1,
      clientX: 48,
      clientY: 320,
    });

    await waitFor(() => {
      expect(document.querySelector('.run-floating-piece')).toBeTruthy();
    });

    dispatchPointerEvent(window, 'pointermove', {
      pointerId: 1,
      clientX: 15,
      clientY: 15,
    });

    await waitFor(() => {
      expect(screen.getByTestId('board-cell-0-0').className).toContain('is-preview-valid');
    });

    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 1,
      clientX: 15,
      clientY: 15,
    });

    await waitFor(() => {
      expect(onPlace).toHaveBeenCalledWith(0, { x: 0, y: 0 });
    });
  });

  it('rejects an invalid drop and does not call onPlace', async () => {
    const onPlace = vi.fn();

    render(
      <RunPlayfield
        engineState={createEngineState(setCellsFilled(createEmptyBoard(), [{ x: 0, y: 0 }]))}
        moveUnlocked
        pending={false}
        onPlace={onPlace}
      />,
    );

    const board = screen.getByTestId('run-board');
    const traySlot = screen.getByTestId('tray-slot-0');

    mockRect(board, { left: 0, top: 0, width: 240, height: 240 });
    mockRect(traySlot, { left: 0, top: 280, width: 96, height: 120 });

    dispatchPointerEvent(traySlot, 'pointerdown', {
      pointerId: 2,
      clientX: 48,
      clientY: 320,
    });

    await waitFor(() => {
      expect(document.querySelector('.run-floating-piece')).toBeTruthy();
    });

    dispatchPointerEvent(window, 'pointermove', {
      pointerId: 2,
      clientX: 15,
      clientY: 15,
    });

    await waitFor(() => {
      expect(screen.getByTestId('board-cell-0-0').className).toContain('is-preview-invalid');
    });

    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 2,
      clientX: 15,
      clientY: 15,
    });

    await waitFor(() => {
      expect(onPlace).not.toHaveBeenCalled();
    });
    expect(document.querySelector('.run-floating-piece.is-returning')).toBeTruthy();
  });
});

function createEngineState(board: ReturnType<typeof createEmptyBoard>): EngineState {
  return {
    board: {
      width: board.width,
      height: board.height,
      cells: [...board.cells],
    },
    tray: [
      { instanceId: 'piece-1', pieceId: 'single_1' },
      { instanceId: 'piece-2', pieceId: 'bar_h_2' },
      { instanceId: 'piece-3', pieceId: 'l3' },
    ],
    rng: {
      seed: 1,
      cursor: 3,
    },
    score: 0,
    combo: 0,
    turn: 0,
    lastClearCount: 0,
    clearedLinesTotal: 0,
  };
}

function mockRect(
  element: Element,
  input: Readonly<{ left: number; top: number; width: number; height: number }>,
) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: input.left,
    y: input.top,
    left: input.left,
    top: input.top,
    width: input.width,
    height: input.height,
    right: input.left + input.width,
    bottom: input.top + input.height,
    toJSON() {
      return input;
    },
  } as DOMRect);
}

function dispatchPointerEvent(
  target: Element | Window,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  input: Readonly<{ pointerId: number; clientX: number; clientY: number }>,
) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  });

  Object.defineProperties(event, {
    pointerId: { value: input.pointerId },
    clientX: { value: input.clientX },
    clientY: { value: input.clientY },
  });

  act(() => {
    target.dispatchEvent(event);
  });
}
