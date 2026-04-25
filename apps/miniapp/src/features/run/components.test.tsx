import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createEmptyBoard, setCellsFilled } from '@langue-buster/game-engine';
import type { EngineState, GeneratedQuestion } from '@langue-buster/shared';
import { describe, expect, it, vi } from 'vitest';

import { RunPlayfield } from './components';

describe('RunPlayfield answer-piece interaction', () => {
  it('treats the whole tray option as one answer hit area', () => {
    const onSelectOption = vi.fn();

    render(
      <RunPlayfield
        engineState={createEngineState(createEmptyBoard())}
        question={createQuestion()}
        moveUnlocked={false}
        answerLocked={false}
        activeTrayIndex={null}
        pending={false}
        onSelectOption={onSelectOption}
        onPlace={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('poire'));
    expect(onSelectOption).toHaveBeenCalledWith(expect.objectContaining({ id: 'wrong-1', label: 'poire' }));

    onSelectOption.mockClear();
    fireEvent.click(screen.getByTestId('tray-slot-2'));
    expect(onSelectOption).toHaveBeenCalledWith(expect.objectContaining({ id: 'wrong-2', label: 'banane' }));
  });

  it('allows drag and drop only for the activated correct slot', async () => {
    const onPlace = vi.fn();

    render(
      <RunPlayfield
        engineState={createEngineState(createEmptyBoard())}
        question={createQuestion()}
        moveUnlocked
        answerLocked
        activeTrayIndex={0}
        pending={false}
        selectedOptionId="correct"
        onSelectOption={vi.fn()}
        onPlace={onPlace}
      />,
    );

    const board = screen.getByTestId('run-board');
    const activeSlot = screen.getByTestId('tray-slot-0');
    const blockedSlot = screen.getByTestId('tray-slot-1');

    mockRect(board, { left: 0, top: 0, width: 240, height: 240 });
    mockRect(activeSlot, { left: 0, top: 280, width: 96, height: 132 });
    mockRect(blockedSlot, { left: 104, top: 280, width: 96, height: 132 });

    dispatchPointerEvent(blockedSlot, 'pointerdown', {
      pointerId: 1,
      clientX: 150,
      clientY: 320,
    });
    expect(document.querySelector('.run-floating-piece')).toBeNull();

    dispatchPointerEvent(activeSlot, 'pointerdown', {
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
      expect(screen.getByTestId('board-cell-0-0').className).toContain('is-preview-valid');
    });

    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 2,
      clientX: 15,
      clientY: 15,
    });

    await waitFor(() => {
      expect(onPlace).toHaveBeenCalledWith(0, { x: 0, y: 0 });
    });
  });

  it('shows invalid preview and returns the active piece to the tray on invalid release', async () => {
    const onPlace = vi.fn();

    render(
      <RunPlayfield
        engineState={createEngineState(setCellsFilled(createEmptyBoard(), [{ x: 0, y: 0 }]))}
        question={createQuestion()}
        moveUnlocked
        answerLocked
        activeTrayIndex={0}
        pending={false}
        selectedOptionId="correct"
        onSelectOption={vi.fn()}
        onPlace={onPlace}
      />,
    );

    const board = screen.getByTestId('run-board');
    const traySlot = screen.getByTestId('tray-slot-0');

    mockRect(board, { left: 0, top: 0, width: 240, height: 240 });
    mockRect(traySlot, { left: 0, top: 280, width: 96, height: 132 });

    dispatchPointerEvent(traySlot, 'pointerdown', {
      pointerId: 3,
      clientX: 48,
      clientY: 320,
    });

    await waitFor(() => {
      expect(document.querySelector('.run-floating-piece')).toBeTruthy();
    });

    dispatchPointerEvent(window, 'pointermove', {
      pointerId: 3,
      clientX: 15,
      clientY: 15,
    });

    await waitFor(() => {
      expect(screen.getByTestId('board-cell-0-0').className).toContain('is-preview-invalid');
    });

    dispatchPointerEvent(window, 'pointerup', {
      pointerId: 3,
      clientX: 15,
      clientY: 15,
    });

    await waitFor(() => {
      expect(onPlace).not.toHaveBeenCalled();
    });
    expect(document.querySelector('.run-floating-piece.is-returning')).toBeTruthy();
  });
});

function createQuestion(): GeneratedQuestion {
  return {
    id: 'question.apple',
    cardType: 'single_word_translation',
    promptLanguage: 'ru',
    answerLanguage: 'fr',
    promptText: 'яблоко',
    options: [
      { id: 'correct', label: 'pomme', isCorrect: true, linkedItemId: 'vocab.food.apple' },
      { id: 'wrong-1', label: 'poire', isCorrect: false, linkedItemId: 'vocab.food.pear' },
      { id: 'wrong-2', label: 'banane', isCorrect: false, linkedItemId: 'vocab.food.banana' },
    ],
    correctOptionId: 'correct',
    sourceItemIds: ['vocab.food.apple'],
    cefrLevel: 'A1',
    meta: {
      sourceItemId: 'vocab.food.apple',
      topicId: 'topic.food',
      distractorSource: 'linked_set',
      generatorVersion: 'test',
    },
  };
}

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
