import type { LaunchLevelId } from '@langue-buster/shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { trackAnalyticsEvent } from '../analytics/client';
import { useAuth } from '../auth/AuthProvider';
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
  const auth = useAuth();
  const focusLevel = preferences.focusLevel;
  const [selectedLevel, setSelectedLevel] = useState<LaunchLevelId>(focusLevel ?? 'A1');
  const token = auth.status === 'authenticated' ? auth.token : null;

  useEffect(() => {
    void trackAnalyticsEvent(token, {
      eventName: 'placement_started',
      occurredAt: new Date().toISOString(),
      userId: auth.status === 'authenticated' ? auth.user.id : undefined,
      sessionId: auth.status === 'authenticated' ? auth.session.id : undefined,
      payload: {
        route: '/placement',
        focusLevel: focusLevel ?? undefined,
      },
    });
  }, [auth, focusLevel, token]);

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
          onClick={() => {
            setSelectedLevel(level.id);
            void trackAnalyticsEvent(token, {
              eventName: 'level_selected',
              occurredAt: new Date().toISOString(),
              userId: auth.status === 'authenticated' ? auth.user.id : undefined,
              sessionId: auth.status === 'authenticated' ? auth.session.id : undefined,
              levelId: level.id,
              payload: {
                selectedLevelId: level.id,
                route: '/placement',
              },
            });
          }}
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
          void trackAnalyticsEvent(token, {
            eventName: 'placement_completed',
            occurredAt: new Date().toISOString(),
            userId: auth.status === 'authenticated' ? auth.user.id : undefined,
            sessionId: auth.status === 'authenticated' ? auth.session.id : undefined,
            levelId: selectedLevel,
            payload: {
              selectedLevelId: selectedLevel,
              recommendedLevelId: 'A1',
            },
          });
          void navigate('/home');
        }}
      >
        Продолжить с {selectedLevel}
      </button>
    </main>
  );
}
