import { useNavigate } from 'react-router-dom';

import { usePreferences } from '../preferences/PreferencesProvider';
import { ScreenHeader } from './StateScreens';

const levelCards = [
  {
    id: 'A1',
    title: 'A1 · Старт',
    description: 'Базовые слова для еды, приветствий и первых бытовых ситуаций.',
    topics: ['Еда', 'Приветствия'],
  },
  {
    id: 'A2',
    title: 'A2 · База',
    description: 'Путешествия, дорога, дом и повседневные действия.',
    topics: ['Поездки', 'Дом', 'Движение'],
  },
] as const;

export function LevelMapScreen() {
  const navigate = useNavigate();
  const preferences = usePreferences();
  const focusLevel = preferences.focusLevel;

  return (
    <main className="screen">
      <section className="hero-card">
        <p className="eyebrow">Уровни запуска</p>
        <h1>Карта прогресса</h1>
        <p className="body-copy">Для MVP доступны только A1 и A2, поэтому карта остаётся компактной и понятной.</p>
      </section>

      {levelCards.map((level) => {
        const isActive = focusLevel === level.id;
        return (
          <section key={level.id} className={isActive ? 'panel is-active-panel' : 'panel'}>
            <ScreenHeader title={level.title} caption={isActive ? 'Текущий фокус' : 'Готово к выбору'} />
            <p className="body-copy">{level.description}</p>
            <ul className="chip-list">
              {level.topics.map((topic) => (
                <li key={topic} className="chip">
                  {topic}
                </li>
              ))}
            </ul>
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={() => preferences.setFocusLevel(level.id)}>
                {isActive ? 'Выбрано' : 'Сделать фокусом'}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  preferences.setFocusLevel(level.id);
                  void navigate('/home');
                }}
              >
                Играть с этого уровня
              </button>
            </div>
          </section>
        );
      })}
    </main>
  );
}
