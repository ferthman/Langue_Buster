import {
  classicRunDefaults,
  createEmptyBoard,
  type GameBoardState,
} from '@langue-buster/game-engine';
import { createQuestionCardPreview } from '@langue-buster/content-core';
import { appEvents } from '@langue-buster/analytics';
import { Link } from 'react-router-dom';

const boardState: GameBoardState = createEmptyBoard(classicRunDefaults.boardSize);
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
          <strong>{classicRunDefaults.hearts}</strong>
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
          <h2>Поле {boardState.size}x{boardState.size}</h2>
          <span>{appEvents.runStarted}</span>
        </div>
        <div className="board-grid" style={{ gridTemplateColumns: `repeat(${boardState.size}, 1fr)` }}>
          {boardState.cells.map((cell) => (
            <div key={cell.id} className="board-cell">
              {cell.occupied ? '■' : ''}
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

