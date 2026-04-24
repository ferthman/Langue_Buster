import { createPieceCatalog, listLegalPlacements, type Coordinate } from '@langue-buster/game-engine';
import type { EngineState, GeneratedQuestion, MoveEvent, PieceId, QuestionOption } from '@langue-buster/shared';
import {
  CLASSIC_RUN_BOARD_SIZE,
  CLASSIC_RUN_DEFAULT_HEARTS,
  CLASSIC_RUN_TRAY_SIZE,
} from '@langue-buster/shared';

const pieceCatalog = new Map(createPieceCatalog().map((piece) => [piece.id, piece]));
const optionLabels = ['A', 'B', 'C', 'D'] as const;

export function RunHeader(props: {
  score: number;
  hearts: number;
  combo: number;
  level: string;
  turn: number;
  pending: boolean;
  onFinish(): void;
}) {
  return (
    <section className="hero-card run-hero">
      <div className="run-hero__top">
        <div>
          <p className="eyebrow">Classic Run</p>
          <h1>Ход {props.turn}</h1>
          <p className="body-copy">Уровень {props.level}. Ответ открывает фигуру, затем поле принимает только валидный ход.</p>
        </div>
        <button
          type="button"
          className="secondary-button run-hero__action"
          onClick={props.onFinish}
          disabled={props.pending}
        >
          Завершить ран
        </button>
      </div>

      <div className="run-header">
        <MetricBlock label="Счёт" value={String(props.score)} />
        <MetricBlock label="Комбо" value={String(props.combo)} />
        <MetricBlock label="Поле" value={`${CLASSIC_RUN_BOARD_SIZE}x${CLASSIC_RUN_BOARD_SIZE}`} />
        <div className="metric-card metric-card--hearts">
          <span className="metric-label">Сердца</span>
          <div className="heart-meter" aria-label={`Сердца ${props.hearts} из ${CLASSIC_RUN_DEFAULT_HEARTS}`}>
            {Array.from({ length: CLASSIC_RUN_DEFAULT_HEARTS }, (_, index) => (
              <span
                key={`heart-${index + 1}`}
                className={index < props.hearts ? 'heart-meter__pip is-active' : 'heart-meter__pip'}
              />
            ))}
          </div>
          <strong>{props.hearts}/{CLASSIC_RUN_DEFAULT_HEARTS}</strong>
        </div>
      </div>
    </section>
  );
}

export function QuestionCard(props: {
  question: GeneratedQuestion;
  selectedOptionId?: string;
  answerLocked: boolean;
  pending: boolean;
  onSelect(option: QuestionOption): void;
}) {
  return (
    <section className="question-card">
      <div className="question-card__meta">
        <p className="eyebrow">{translateCardType(props.question.cardType)}</p>
        <span className="question-card__direction">
          {translateDirection(props.question.promptLanguage, props.question.answerLanguage)}
        </span>
      </div>
      <h1 className="question-card__prompt">{props.question.promptText}</h1>
      <p className="body-copy">Тема: {props.question.meta.topicId}. Нужен ровно один правильный вариант.</p>
      <div className="answer-grid">
        {props.question.options.map((option, index) => {
          const isSelected = props.selectedOptionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={isSelected ? 'answer-button is-selected' : 'answer-button'}
              disabled={props.pending || props.answerLocked}
              onClick={() => props.onSelect(option)}
            >
              <span className="answer-button__prefix">{optionLabels[index] ?? String(index + 1)}</span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function BoardView(props: {
  engineState: EngineState;
  selectedPieceId?: PieceId;
  onSelectOrigin(origin: Coordinate): void;
}) {
  const legalOrigins = props.selectedPieceId
    ? listLegalPlacements(props.engineState.board, props.selectedPieceId)
    : [];
  const legalOriginKeys = new Set(legalOrigins.map((origin) => `${origin.x}:${origin.y}`));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Поле</h2>
          <p className="body-copy panel-copy">
            {props.selectedPieceId
              ? `Доступно стартовых позиций: ${legalOrigins.length}.`
              : 'Сначала откройте ход ответом и выберите фигуру в трее.'}
          </p>
        </div>
        <span>{CLASSIC_RUN_BOARD_SIZE}x{CLASSIC_RUN_BOARD_SIZE}</span>
      </div>
      <div
        className="board-grid"
        style={{ gridTemplateColumns: `repeat(${props.engineState.board.width}, minmax(0, 1fr))` }}
      >
        {props.engineState.board.cells.map((cell, index) => {
          const x = index % props.engineState.board.width;
          const y = Math.floor(index / props.engineState.board.width);
          const key = `${x}:${y}`;
          const isLegalOrigin = legalOriginKeys.has(key);
          return (
            <button
              key={key}
              type="button"
              aria-label={`cell-${x}-${y}`}
              className={[
                'board-cell',
                cell === 'filled' ? 'is-filled' : '',
                isLegalOrigin ? 'is-legal-origin' : '',
              ].filter(Boolean).join(' ')}
              disabled={!isLegalOrigin}
              onClick={() => props.onSelectOrigin({ x, y })}
            >
              {isLegalOrigin ? <span className="board-cell__dot" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function TrayView(props: {
  tray: EngineState['tray'];
  selectedIndex: number | null;
  selectable: boolean;
  onSelect(index: number): void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Трей</h2>
          <p className="body-copy panel-copy">
            {props.selectable
              ? 'Выберите фигуру и поставьте её в одну из подсвеченных стартовых клеток.'
              : 'Трей заблокирован, пока вопрос не закрыт верным ответом.'}
          </p>
        </div>
        <span>{CLASSIC_RUN_TRAY_SIZE} фигуры</span>
      </div>
      <div className="tray-grid">
        {props.tray.map((piece, index) => (
          <button
            key={piece?.instanceId ?? `empty-${index}`}
            type="button"
            className={props.selectedIndex === index ? 'tray-slot is-selected' : 'tray-slot'}
            disabled={!piece || !props.selectable}
            onClick={() => props.onSelect(index)}
          >
            <span className="tray-slot__label">Слот {index + 1}</span>
            {piece ? <PiecePreview pieceId={piece.pieceId} /> : <span className="tray-slot__empty">Пусто</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

export function FeedbackCard(props: {
  title: string;
  description: string;
  tone: 'success' | 'error' | 'info';
}) {
  return (
    <section className={`inline-notice is-${props.tone}`}>
      <strong>{props.title}</strong>
      <p>{props.description}</p>
    </section>
  );
}

export function MoveSummary({ moveEvent }: { moveEvent: MoveEvent }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Последний ход</h2>
          <p className="body-copy panel-copy">Сервер уже подтвердил размещение и пересчитал очки.</p>
        </div>
        <span>{moveEvent.pieceId}</span>
      </div>
      <dl className="stats-list">
        <div>
          <dt>Очки за ход</dt>
          <dd>+{moveEvent.scoreBreakdown.totalPoints}</dd>
        </div>
        <div>
          <dt>Линий очищено</dt>
          <dd>{moveEvent.clearedLineCount}</dd>
        </div>
        <div>
          <dt>Комбо после хода</dt>
          <dd>{moveEvent.resultingCombo}</dd>
        </div>
      </dl>
    </section>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PiecePreview({ pieceId }: { pieceId: PieceId }) {
  const piece = pieceCatalog.get(pieceId);
  if (!piece) {
    return <span>{pieceId}</span>;
  }

  const filledCells = new Set(piece.cells.map((cell) => `${cell.x}:${cell.y}`));
  return (
    <div
      className="piece-preview"
      style={{
        gridTemplateColumns: `repeat(${piece.width}, 1fr)`,
        gridTemplateRows: `repeat(${piece.height}, 1fr)`,
      }}
    >
      {Array.from({ length: piece.width * piece.height }, (_, index) => {
        const x = index % piece.width;
        const y = Math.floor(index / piece.width);
        const key = `${x}:${y}`;
        return <span key={key} className={filledCells.has(key) ? 'piece-preview__cell is-filled' : 'piece-preview__cell'} />;
      })}
    </div>
  );
}

function translateCardType(cardType: GeneratedQuestion['cardType']) {
  if (cardType === 'single_word_translation') {
    return 'Одиночное слово';
  }
  if (cardType === 'phrase_translation') {
    return 'Короткая фраза';
  }

  return 'Артикль + существительное';
}

function translateDirection(promptLanguage: GeneratedQuestion['promptLanguage'], answerLanguage: GeneratedQuestion['answerLanguage']) {
  const from = promptLanguage === 'ru' ? 'RU' : 'FR';
  const to = answerLanguage === 'ru' ? 'RU' : 'FR';
  return `${from} -> ${to}`;
}
