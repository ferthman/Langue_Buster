import { cefrLevels, type CefrLevelId, launchLevels } from '@langue-buster/shared';
import { Link } from 'react-router-dom';

const launchLevelSet = new Set<CefrLevelId>(launchLevels);

export function HomeScreen() {
  return (
    <main className="screen">
      <section className="hero-card">
        <p className="eyebrow">Telegram Mini App</p>
        <h1>Langue Buster</h1>
        <p className="body-copy">
          Мини-игра для изучения французского, где правильный ответ открывает ход на поле.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Уровни запуска</h2>
          <span>Только A1 и A2 для MVP</span>
        </div>

        <ul className="level-list">
          {cefrLevels.map((level) => (
            <li key={level.id} className="level-item">
              <LevelBadge level={level.id} />
              <div>
                <strong>{level.label}</strong>
                <p>{launchLevelSet.has(level.id) ? 'В первой версии' : 'Подготовлено для расширения'}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Первый контур</h2>
          <span>Основа до реализации полной игры</span>
        </div>

        <ul className="feature-list">
          <li>Telegram shell и мобильные safe-area отступы</li>
          <li>Маршруты для дома и классического рана</li>
          <li>Границы между UI, движком, контентом и аналитикой</li>
        </ul>

        <Link to="/run" className="primary-button">
          Открыть прототип рана
        </Link>
      </section>
    </main>
  );
}

function LevelBadge({ level }: { level: CefrLevelId }) {
  return <span className="level-badge">{level}</span>;
}
