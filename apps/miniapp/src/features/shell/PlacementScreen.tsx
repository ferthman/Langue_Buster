import type { LaunchLevelId } from '@langue-buster/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePreferences } from '../preferences/PreferencesProvider';

const levels: Array<{ id: LaunchLevelId; title: string; description: string }> = [
  {
    id: 'A1',
    title: 'A1 · Рекомендуется для старта',
    description: 'Если французский только запускается в памяти, начните здесь.',
  },
  {
    id: 'A2',
    title: 'A2 · Если база уже есть',
    description: 'Подходит, если вы уверенно держите простые слова и бытовые фразы.',
  },
];

export function PlacementScreen() {
  const navigate = useNavigate();
  const preferences = usePreferences();
  const focusLevel = preferences.focusLevel;
  const [selectedLevel, setSelectedLevel] = useState<LaunchLevelId>(focusLevel ?? 'A1');

  return (
    <main className="screen">
      <section className="hero-card">
        <p className="eyebrow">Placement</p>
        <h1>Выберите стартовый уровень</h1>
        <p className="body-copy">Пока это лёгкий выбор между A1 и A2. Позже сюда можно встроить полноценный placement test.</p>
      </section>

      {levels.map((level) => (
        <button
          key={level.id}
          type="button"
          className={selectedLevel === level.id ? 'choice-card is-selected' : 'choice-card'}
          onClick={() => setSelectedLevel(level.id)}
        >
          <strong>{level.title}</strong>
          <span>{level.description}</span>
        </button>
      ))}

      <button
        type="button"
        className="primary-button"
        onClick={() => {
          preferences.setFocusLevel(selectedLevel);
          void navigate('/home');
        }}
      >
        Продолжить с {selectedLevel}
      </button>
    </main>
  );
}
