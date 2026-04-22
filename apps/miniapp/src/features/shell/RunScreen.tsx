import {
  CLASSIC_BOARD_SIZE,
  createEmptyBoard,
  type BoardCellState,
  type BoardState,
} from '@langue-buster/game-engine';
import { createQuestionCardPreview } from '@langue-buster/content-core';
import { appEvents } from '@langue-buster/analytics';
import { Link } from 'react-router-dom';

const CLASSIC_RUN_HEARTS = 3;

const boardState: BoardState = createEmptyBoard({
  width: CLASSIC_BOARD_SIZE,
  height: CLASSIC_BOARD_SIZE,
});
const demoCard = createQuestionCardPreview({
  cefrLevel: 'A1',
  promptLanguage: 'ru',
  answerLanguage: 'fr',
});

export function RunScreen() {
  return (
    <main className="screen">
      <header className="run-header">
        <div>
          <span className="metric-label">Счёт</span>
          <strong>0</strong>
        </div>
        <div>
          <span className="metric-label">Сердца</span>
          <strong>{CLASSIC_RUN_HEARTS}</strong>
        </div>
        <div>
          <span className="metric-label">Серия</span>
          <strong>0</strong>
        </div>
      </header>

      <section className="question-card">
        <p className="eyebrow">{demoCard.meta.cardType}</p>
        <h1>{demoCard.prompt}</h1>
        <div className="answer-grid">
          {demoCard.options.map((option) => (
            <button key={option.id} type="button" className="answer-button">
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Поле {boardState.width}x{boardState.height}</h2>
          <span>{appEvents.runStarted}</span>
        </div>
        <div className="board-grid" style={{ gridTemplateColumns: `repeat(${boardState.width}, 1fr)` }}>
          {boardState.cells.map((cell: BoardCellState, index) => (
            <div key={index} className="board-cell">
              {cell === 'filled' ? '■' : ''}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Следующий шаг</h2>
          <span>Движок и реальные ответы подключаются отдельно</span>
        </div>
        <p className="body-copy">
          Этот экран пока закрепляет границы: вопрос, игровое состояние и аналитика не смешиваются в одном компоненте.
        </p>
        <Link to="/" className="secondary-button">
          Назад
        </Link>
      </section>
    </main>
  );
}
