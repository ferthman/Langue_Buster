import {
  CLASSIC_RUN_DEFAULT_HEARTS,
  type Coordinate,
  type EngineState,
  type GeneratedQuestion,
  type MoveEvent,
  type PieceId,
  type PieceInstance,
  type QuestionOption,
} from '@langue-buster/shared';
import { canPlacePiece, createPieceCatalog } from '@langue-buster/game-engine';
import { useEffect, useMemo, useRef, useState } from 'react';

const PIECE_CATALOG = new Map(createPieceCatalog().map((piece) => [piece.id, piece]));

const PIECE_TONES: Record<PieceId, string> = {
  single_1: 'sun',
  bar_h_2: 'berry',
  bar_h_3: 'cyan',
  bar_h_4: 'violet',
  bar_h_5: 'sun',
  bar_v_2: 'mint',
  bar_v_3: 'cyan',
  bar_v_4: 'berry',
  bar_v_5: 'violet',
  square_2: 'mint',
  rect_2x3: 'cyan',
  l3: 'berry',
};

type FeedbackTone = 'success' | 'error' | 'info';

type RunHeaderProps = Readonly<{
  score: number;
  hearts: number;
  combo: number;
  level: string;
  turn: number;
  pending: boolean;
  onOpenMenu(): void;
}>;

type FeedbackCardProps = Readonly<{
  tone: FeedbackTone;
  title: string;
  description: string;
}>;

type RunPromptCardProps = Readonly<{
  question: GeneratedQuestion;
  moveUnlocked: boolean;
  pending: boolean;
}>;

type QuestionCardProps = Readonly<{
  question: GeneratedQuestion;
  answerLocked: boolean;
  pending: boolean;
  selectedOptionId?: string;
  moveUnlocked?: boolean;
  lockedHint?: string;
  onSelect(option: QuestionOption): void;
}>;

type RunPlayfieldProps = Readonly<{
  engineState: EngineState;
  question: GeneratedQuestion;
  moveUnlocked: boolean;
  answerLocked: boolean;
  activeTrayIndex: number | null;
  pending: boolean;
  selectedOptionId?: string;
  wrongOptionId?: string;
  onSelectOption(option: QuestionOption): void;
  onPlace(trayIndex: number, origin: Coordinate): void;
  onInteract?(effect: 'lift' | 'valid' | 'invalid'): void;
}>;

type MoveSummaryProps = Readonly<{
  moveEvent: MoveEvent;
}>;

type PauseOverlayProps = Readonly<{
  level: string;
  onResume(): void;
  onFinish(): void;
  onGoHome(): void;
}>;

type PreviewState = Readonly<{
  origin: Coordinate;
  translatedCells: readonly Coordinate[];
  isValid: boolean;
  boardIntent: boolean;
}>;

type DragState = Readonly<{
  trayIndex: number;
  pointerId: number;
  piece: PieceInstance;
  pointer: {
    x: number;
    y: number;
  };
  preview: PreviewState;
}>;

type ReturnAnimation = Readonly<{
  trayIndex: number;
  piece: PieceInstance;
  from: {
    x: number;
    y: number;
  };
  to: {
    x: number;
    y: number;
  };
  settling: boolean;
}>;

export function RunHeader({
  score,
  hearts,
  combo,
  level,
  turn,
  pending,
  onOpenMenu,
}: RunHeaderProps) {
  const totalHeartSlots = Math.max(hearts, CLASSIC_RUN_DEFAULT_HEARTS);

  return (
    <section className="run-header-panel">
      <div className="run-header-panel__row">
        <div className="run-hud-card">
          <span className="run-hud-card__label">Счёт</span>
          <strong>{score}</strong>
        </div>
        <div className={`run-hud-card run-hud-card--accent${combo > 0 ? ' is-live' : ''}`}>
          <span className="run-hud-card__label">Серия</span>
          <strong>{combo > 0 ? `x${combo}` : 'x0'}</strong>
        </div>
        <button
          type="button"
          className="run-menu-button"
          disabled={pending}
          aria-label="Открыть паузу"
          onClick={onOpenMenu}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="run-header-panel__row run-header-panel__row--bottom">
        <div className="run-header-chip">
          <span className="run-header-chip__label">Уровень</span>
          <strong>{level}</strong>
        </div>
        <div className="run-header-chip">
          <span className="run-header-chip__label">Ход</span>
          <strong>{turn}</strong>
        </div>
        <div className="run-hearts" aria-label={`Сердца: ${hearts}`}>
          {Array.from({ length: totalHeartSlots }, (_, index) => (
            <span
              key={index}
              className={`run-heart${index < hearts ? ' is-active' : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeedbackCard({ tone, title, description }: FeedbackCardProps) {
  return (
    <section className={`run-inline-card run-inline-card--${tone}`}>
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  );
}

export function RunPromptCard({ question, moveUnlocked, pending }: RunPromptCardProps) {
  return (
    <section className={`run-prompt-card${moveUnlocked ? ' is-unlocked' : ''}`}>
      <div className="run-prompt-card__meta">
        <span className="run-prompt-card__direction">{getQuestionDirectionLabel(question)}</span>
        <span className={`run-prompt-card__status${moveUnlocked ? ' is-unlocked' : ''}`}>
          {moveUnlocked ? 'Фигура активирована' : translateCardType(question.cardType)}
        </span>
      </div>
      <h1>{question.promptText}</h1>
      <p className="run-prompt-card__hint">
        {moveUnlocked
          ? 'Правильный слот уже подсвечен. Потяните именно эту фигуру на поле.'
          : pending
          ? 'Проверяем выбор и синхронизируем состояние.'
          : 'Нажмите на один из трёх слотов внизу: перевод и фигура внутри слота выбираются вместе.'}
      </p>
    </section>
  );
}

export function QuestionCard({
  question,
  answerLocked,
  pending,
  selectedOptionId,
  moveUnlocked = false,
  lockedHint,
  onSelect,
}: QuestionCardProps) {
  const directionLabel = getQuestionDirectionLabel(question);

  return (
    <section className={`run-question-card${moveUnlocked ? ' is-unlocked' : ''}`}>
      <div className="run-question-card__meta">
        <span className="run-question-card__direction">{directionLabel}</span>
        <span className={`run-question-card__type${moveUnlocked ? ' is-unlocked' : ''}`}>
          {moveUnlocked ? 'Ход открыт' : translateCardType(question.cardType)}
        </span>
      </div>
      <h1>{question.promptText}</h1>
      <div className="run-answer-grid">
        {question.options.map((option, index) => {
          const isSelected = option.id === selectedOptionId;
          const isCorrectSelection = moveUnlocked && isSelected;

          return (
            <button
              key={option.id}
              type="button"
              className={[
                'run-answer-button',
                isSelected ? ' is-selected' : '',
                isCorrectSelection ? ' is-correct' : '',
              ].filter(Boolean).join(' ')}
              disabled={pending || answerLocked}
              onClick={() => {
                if (!pending && !answerLocked) {
                  onSelect(option);
                }
              }}
            >
              <span className="run-answer-button__badge">{index + 1}</span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="run-question-card__hint">
        {moveUnlocked
          ? 'Верный ответ принят. Теперь перетащите фигуру на поле: превью уже покажет валидную постановку.'
          : answerLocked
          ? (lockedHint ?? 'Проверяем ответ и синхронизируем состояние хода.')
          : 'Верный ответ открывает один прямой ход: перетащите любую фигуру на поле.'}
      </p>
    </section>
  );
}

export function RunPlayfield({
  engineState,
  question,
  moveUnlocked,
  answerLocked,
  activeTrayIndex,
  pending,
  selectedOptionId,
  wrongOptionId,
  onSelectOption,
  onPlace,
  onInteract,
}: RunPlayfieldProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const trayRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const previousEngineRef = useRef(engineState);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [returning, setReturning] = useState<ReturnAnimation | null>(null);
  const [placedCellKeys, setPlacedCellKeys] = useState<readonly string[]>([]);
  const [boardPulse, setBoardPulse] = useState(false);

  const boardCellSize = useMemo(() => {
    if (typeof window === 'undefined') {
      return 34;
    }

    const boardWidth = boardRef.current?.getBoundingClientRect().width;
    return boardWidth ? boardWidth / engineState.board.width : 34;
  }, [engineState.board.width, drag?.pointer.x, drag?.pointer.y]);

  useEffect(() => {
    if (!drag) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) {
        return;
      }

      event.preventDefault();
      setDrag((current) => {
        if (!current || current.pointerId !== event.pointerId) {
          return current;
        }

        return {
          ...current,
          pointer: {
            x: event.clientX,
            y: event.clientY,
          },
          preview: createPreviewState(engineState.board, current.piece, {
            x: event.clientX,
            y: event.clientY,
          }, boardRef.current),
        };
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) {
        return;
      }

      event.preventDefault();
      setDrag((current) => {
        if (!current || current.pointerId !== event.pointerId) {
          return current;
        }

        finalizeDrop(current);
        return null;
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd, { passive: false });
    window.addEventListener('pointercancel', handlePointerEnd, { passive: false });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [drag, engineState.board, onInteract, onPlace]);

  useEffect(() => {
    if (!returning || returning.settling) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      setReturning((current) => (current ? { ...current, settling: true } : current));
    });
    const timeout = window.setTimeout(() => {
      setReturning(null);
    }, 220);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [returning]);

  useEffect(() => {
    const previousEngine = previousEngineRef.current;
    previousEngineRef.current = engineState;

    if (engineState.turn <= previousEngine.turn) {
      return undefined;
    }

    const nextPlacedKeys = engineState.board.cells.flatMap((cell, index) => {
      if (cell !== 'filled' || previousEngine.board.cells[index] === 'filled') {
        return [];
      }

      const x = index % engineState.board.width;
      const y = Math.floor(index / engineState.board.width);
      return [`${x}:${y}`];
    });

    setPlacedCellKeys(nextPlacedKeys);
    setBoardPulse(true);

    const timeout = window.setTimeout(() => {
      setPlacedCellKeys([]);
      setBoardPulse(false);
    }, 260);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [engineState]);

  const previewCells = drag?.preview.translatedCells.filter((cell) => (
    cell.x >= 0
      && cell.y >= 0
      && cell.x < engineState.board.width
      && cell.y < engineState.board.height
  )) ?? [];

  function handleDragStart(event: React.PointerEvent<HTMLButtonElement>, trayIndex: number) {
    const trayPiece = engineState.tray[trayIndex];
    if (!trayPiece || pending || !moveUnlocked || activeTrayIndex !== trayIndex) {
      return;
    }

    event.preventDefault();

    const preview = createPreviewState(
      engineState.board,
      trayPiece,
      { x: event.clientX, y: event.clientY },
      boardRef.current,
    );

    setDrag({
      trayIndex,
      pointerId: event.pointerId,
      piece: trayPiece,
      pointer: {
        x: event.clientX,
        y: event.clientY,
      },
      preview,
    });
    onInteract?.('lift');
  }

  function finalizeDrop(current: DragState) {
    if (current.preview.isValid && current.preview.boardIntent) {
      onInteract?.('valid');
      onPlace(current.trayIndex, current.preview.origin);
      return;
    }

    const slotRect = trayRefs.current[current.trayIndex]?.getBoundingClientRect();
    if (slotRect) {
      setReturning({
        trayIndex: current.trayIndex,
        piece: current.piece,
        from: current.pointer,
        to: {
          x: slotRect.left + (slotRect.width / 2),
          y: slotRect.top + (slotRect.height / 2),
        },
        settling: false,
      });
    }

    onInteract?.('invalid');
  }

  return (
    <section className="run-playfield">
      <div
        ref={boardRef}
        className={[
          'run-board-shell',
          drag?.preview.boardIntent ? (drag.preview.isValid ? 'is-valid-drop' : 'is-invalid-drop') : '',
          boardPulse ? 'is-placement-burst' : '',
        ].filter(Boolean).join(' ')}
        data-testid="run-board"
      >
        <div
          className="run-board-grid"
          style={{ gridTemplateColumns: `repeat(${engineState.board.width}, minmax(0, 1fr))` }}
        >
          {engineState.board.cells.map((cell, index) => {
            const x = index % engineState.board.width;
            const y = Math.floor(index / engineState.board.width);
            const boardKey = `${x}:${y}`;
            const previewHit = previewCells.find((previewCell) => previewCell.x === x && previewCell.y === y);

            return (
              <div
                key={`${x}-${y}`}
                className={[
                  'run-board-cell',
                  cell === 'filled' ? 'is-filled' : '',
                  placedCellKeys.includes(boardKey) ? 'is-placed' : '',
                  previewHit ? (drag?.preview.isValid ? 'is-preview-valid' : 'is-preview-invalid') : '',
                ].filter(Boolean).join(' ')}
                data-testid={`board-cell-${x}-${y}`}
              >
                <span className="run-board-cell__inner" />
              </div>
            );
          })}
        </div>
      </div>

      <div className="run-tray-shell">
        <div className="run-tray-shell__copy">
          <strong>{moveUnlocked ? 'Тяните активную фигуру на поле' : 'Выберите перевод прямо в лотке'}</strong>
          <p>
            {moveUnlocked
              ? 'Только подсвеченный слот теперь draggable: поле покажет живой превью, а valid drop сразу поставит фигуру.'
              : 'Каждый слот объединяет фигуру и перевод. Нажатие в любом месте слота считается ответом.'}
          </p>
        </div>

        <div className="run-tray-grid">
          {engineState.tray.map((piece, index) => {
            const option = question.options[index];
            const isDragging = drag?.trayIndex === index;
            const isReturning = returning?.trayIndex === index;
            const isActive = activeTrayIndex === index && moveUnlocked;
            const isSelected = Boolean(option && option.id === selectedOptionId);
            const isWrong = Boolean(option && option.id === wrongOptionId);
            const selectionDisabled = !option || !piece || pending || answerLocked || moveUnlocked;

            return (
              <button
                key={`${piece?.instanceId ?? `empty-${index}`}-${option?.id ?? 'missing-option'}`}
                ref={(element) => {
                  trayRefs.current[index] = element;
                }}
                type="button"
                className={[
                  'run-tray-slot',
                  isSelected ? 'is-selected' : '',
                  isActive ? 'is-active' : '',
                  isWrong ? 'is-wrong' : '',
                  isActive && piece && !pending ? 'is-draggable' : '',
                  isDragging ? 'is-dragging' : '',
                  isReturning ? 'is-return-target' : '',
                ].filter(Boolean).join(' ')}
                disabled={!piece || !option || pending}
                data-testid={`tray-slot-${index}`}
                onClick={() => {
                  if (!selectionDisabled && option) {
                    onSelectOption(option);
                  }
                }}
                onPointerDown={(event) => {
                  handleDragStart(event, index);
                }}
              >
                <span className="run-tray-slot__status">
                  {isActive
                    ? 'Можно тянуть'
                    : isWrong
                    ? 'Неверно'
                    : moveUnlocked
                    ? 'Слот заблокирован'
                    : isSelected
                    ? 'Проверяем'
                    : 'Нажмите'}
                </span>
                {piece ? (
                  <PieceShape
                    piece={piece}
                    cellSize={18}
                    faded={isDragging}
                  />
                ) : (
                  <span className="run-tray-slot__empty">Ожидаем новый набор</span>
                )}
                <span className="run-tray-slot__translation">{option?.label ?? 'Ответ недоступен'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {drag ? (
        <FloatingPiece
          piece={drag.piece}
          pointer={drag.pointer}
          cellSize={Math.max(20, Math.min(boardCellSize, 34))}
          tone={drag.preview.isValid ? 'valid' : 'invalid'}
        />
      ) : null}

      {returning ? (
        <ReturningPiece
          piece={returning.piece}
          from={returning.from}
          to={returning.to}
          settling={returning.settling}
        />
      ) : null}
    </section>
  );
}

export function MoveSummary({ moveEvent }: MoveSummaryProps) {
  return (
    <section className="run-inline-card run-inline-card--info">
      <strong>Последний ход</strong>
      <p>
        Фигура {translatePiece(moveEvent.pieceId)}. +{moveEvent.scoreBreakdown.totalPoints} очков,
        очищено линий: {moveEvent.clearedLineCount}. Комбо после хода: x{Math.max(1, moveEvent.resultingCombo)}.
      </p>
    </section>
  );
}

export function PauseOverlay({
  level,
  onResume,
  onFinish,
  onGoHome,
}: PauseOverlayProps) {
  return (
    <div className="run-overlay" role="presentation" onClick={onResume}>
      <section
        className="run-pause-card"
        role="dialog"
        aria-modal="true"
        aria-label="Пауза"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <p className="eyebrow">Пауза</p>
        <h2>Ран поставлен на паузу</h2>
        <p className="body-copy">
          Уровень {level}. Можно быстро вернуться в игру, завершить текущую попытку или выйти на главный экран.
        </p>
        <div className="run-pause-card__actions">
          <button type="button" className="primary-button" onClick={onResume}>
            Продолжить
          </button>
          <button type="button" className="secondary-button" onClick={onFinish}>
            Завершить ран
          </button>
          <button type="button" className="secondary-button" onClick={onGoHome}>
            На главный экран
          </button>
        </div>
      </section>
    </div>
  );
}

function PieceShape({
  piece,
  cellSize,
  faded = false,
}: Readonly<{
  piece: PieceInstance;
  cellSize: number;
  faded?: boolean;
}>) {
  const pieceDefinition = PIECE_CATALOG.get(piece.pieceId);
  if (!pieceDefinition) {
    return null;
  }

  return (
    <div
      className={`run-piece-shape run-piece-shape--${PIECE_TONES[piece.pieceId]}${faded ? ' is-faded' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${pieceDefinition.width}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${pieceDefinition.height}, ${cellSize}px)`,
      }}
    >
      {Array.from({ length: pieceDefinition.width * pieceDefinition.height }, (_, index) => {
        const x = index % pieceDefinition.width;
        const y = Math.floor(index / pieceDefinition.width);
        const filled = pieceDefinition.cells.some((cell) => cell.x === x && cell.y === y);

        return (
          <span
            key={`${piece.instanceId}-${x}-${y}`}
            className={`run-piece-shape__cell${filled ? ' is-filled' : ''}`}
          />
        );
      })}
    </div>
  );
}

function FloatingPiece({
  piece,
  pointer,
  cellSize,
  tone,
}: Readonly<{
  piece: PieceInstance;
  pointer: { x: number; y: number };
  cellSize: number;
  tone: 'valid' | 'invalid';
}>) {
  const pieceDefinition = PIECE_CATALOG.get(piece.pieceId);
  if (!pieceDefinition) {
    return null;
  }

  const width = pieceDefinition.width * cellSize;
  const height = pieceDefinition.height * cellSize;

  return (
    <div
      className={`run-floating-piece is-lifted is-${tone}`}
      style={{
        width,
        height,
        transform: `translate(${pointer.x - (width / 2)}px, ${pointer.y - (height / 2)}px) scale(1.08)`,
      }}
    >
      <PieceShape piece={piece} cellSize={cellSize} />
    </div>
  );
}

function ReturningPiece({
  piece,
  from,
  to,
  settling,
}: Readonly<{
  piece: PieceInstance;
  from: { x: number; y: number };
  to: { x: number; y: number };
  settling: boolean;
}>) {
  return (
    <div
      className="run-floating-piece is-returning"
      style={{
        transform: `translate(${(settling ? to.x : from.x) - 27}px, ${(settling ? to.y : from.y) - 27}px)`,
      }}
    >
      <PieceShape piece={piece} cellSize={18} />
    </div>
  );
}

function createPreviewState(
  board: EngineState['board'],
  piece: PieceInstance,
  pointer: { x: number; y: number },
  boardElement: HTMLDivElement | null,
): PreviewState {
  const pieceDefinition = PIECE_CATALOG.get(piece.pieceId);
  const boardRect = boardElement?.getBoundingClientRect();

  if (!pieceDefinition || !boardRect) {
    return {
      origin: { x: 0, y: 0 },
      translatedCells: [],
      isValid: false,
      boardIntent: false,
    };
  }

  const cellSize = boardRect.width / board.width;
  const piecePixelWidth = pieceDefinition.width * cellSize;
  const piecePixelHeight = pieceDefinition.height * cellSize;
  const localX = pointer.x - boardRect.left;
  const localY = pointer.y - boardRect.top;

  const origin = {
    x: Math.round((localX - (piecePixelWidth / 2)) / cellSize),
    y: Math.round((localY - (piecePixelHeight / 2)) / cellSize),
  };

  const placement = canPlacePiece(board, pieceDefinition, origin);
  const boardIntent = localX >= -cellSize
    && localY >= -cellSize
    && localX <= boardRect.width + cellSize
    && localY <= boardRect.height + cellSize;

  return {
    origin,
    translatedCells: placement.translatedCells,
    isValid: placement.ok,
    boardIntent,
  };
}

function translateCardType(cardType: GeneratedQuestion['cardType']) {
  if (cardType === 'single_word_translation') {
    return 'Слово';
  }

  if (cardType === 'phrase_translation') {
    return 'Фраза';
  }

  return 'Артикль + существительное';
}

function getQuestionDirectionLabel(question: GeneratedQuestion) {
  return question.promptLanguage === 'ru' ? 'Русский → Français' : 'Français → Русский';
}

function translatePiece(pieceId: PieceId) {
  if (pieceId === 'single_1') {
    return 'точка';
  }

  if (pieceId.startsWith('bar_h')) {
    return 'горизонтальная линия';
  }

  if (pieceId.startsWith('bar_v')) {
    return 'вертикальная линия';
  }

  if (pieceId === 'square_2') {
    return 'квадрат';
  }

  if (pieceId === 'rect_2x3') {
    return 'прямоугольник';
  }

  return 'уголок';
}
