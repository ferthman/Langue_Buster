import type { LaunchLevelId } from '@langue-buster/shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { trackAnalyticsEvent } from '../analytics/client';
import { useAuth } from '../auth/AuthProvider';
import { usePreferences } from '../preferences/PreferencesProvider';

const levels: Array<{ id: LaunchLevelId; title: string; description: string }> = [
  {
    id: 'A1',
    title: 'A1 · Мягкий старт',
    description: 'Подходит, если вы только входите в ритм и хотите собрать базовые слова без лишнего давления.',
  },
  {
    id: 'A2',
    title: 'A2 · Уверенная база',
    description: 'Для тех, кто уже держит простые фразы и готов к более плотному темпу вопросов.',
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
    <main className="screen placement-screen">
      <section className="hero-card placement-hero">
        <p className="eyebrow">Выбор фокуса</p>
        <h1>Выберите стартовый уровень</h1>
        <p className="body-copy">
          Для запуска доступны два режима входа: спокойный старт и более плотная база. Позже сюда можно добавить полноценный входной тест.
        </p>
        <div className="placement-hero__meta">
          <span className="placement-pill placement-pill--accent">MVP: только A1 и A2</span>
          <span className="placement-pill">Фокус можно сменить позже</span>
        </div>
      </section>

      <div className="placement-grid">
        {levels.map((level) => {
          const isSelected = selectedLevel === level.id;

          return (
            <button
              key={level.id}
              type="button"
              className={`choice-card placement-card${isSelected ? ' is-selected' : ''}`}
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
              <div className="placement-card__top">
                <span className="placement-card__id">{level.id}</span>
                <span className={`placement-pill${isSelected ? ' placement-pill--accent' : ''}`}>
                  {isSelected ? 'Выбрано' : level.id === 'A1' ? 'Рекомендуем' : 'Бодрый темп'}
                </span>
              </div>
              <strong>{level.title}</strong>
              <span>{level.description}</span>
            </button>
          );
        })}
      </div>

      <section className="panel placement-lock-panel">
        <div className="panel-header">
          <h2>Следующие уровни</h2>
          <span>Скоро</span>
        </div>
        <p className="body-copy">B1 и выше появятся позже, после полировки стартовой петли A1/A2 и баланса коротких повторов.</p>
      </section>

      <button
        type="button"
        className="primary-button placement-cta"
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
        Играть с уровнем {selectedLevel}
      </button>
    </main>
  );
}
