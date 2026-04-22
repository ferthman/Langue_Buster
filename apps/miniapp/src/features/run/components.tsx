import { createPieceCatalog, listLegalPlacements, type Coordinate } from '@langue-buster/game-engine';
import type { EngineState, GeneratedQuestion, MoveEvent, PieceId, QuestionOption } from '@langue-buster/shared';

const pieceCatalog = new Map(createPieceCatalog().map((piece) => [piece.id, piece]));

export function RunHeader(props: {
  score: number;
  hearts: number;
  combo: number;
  level: string;
}) {
  return (
    <header className="run-header">
      <MetricBlock label="Уровень" value={props.level} />
      <MetricBlock label="Счёт" value={String(props.score)} />
      <MetricBlock label="Сердца" value={String(props.hearts)} />
      <MetricBlock label="Комбо" value={String(props.combo)} />
    </header>
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
      <p className="eyebrow">{props.question.cardType}</p>
      <h1>{props.question.promptText}</h1>
      <p className="body-copy">Тема: {props.question.meta.topicId}</p>
      <div className="answer-grid">
        {props.question.options.map((option) => {
          const isSelected = props.selectedOptionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={isSelected ? 'answer-button is-selected' : 'answer-button'}
              disabled={props.pending || props.answerLocked}
              onClick={() => props.onSelect(option)}
            >
              {option.label}
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
        <h2>Поле {props.engineState.board.width}x{props.engineState.board.height}</h2>
        <span>Ход {props.engineState.turn + 1}</span>
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
              {isLegalOrigin ? '•' : null}
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
        <h2>Трей</h2>
        <span>{props.selectable ? 'Выберите фигуру' : 'Трей заблокирован до верного ответа'}</span>
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
        <h2>Последний ход</h2>
        <span>{moveEvent.pieceId}</span>
      </div>
      <dl className="stats-list">
        <div>
          <dt>Очки за ход</dt>
          <dd>+{moveEvent.scoreBreakdown.totalPoints}</dd>
        </div>
        <div>
          <dt>Очищено линий</dt>
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
    <div>
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
