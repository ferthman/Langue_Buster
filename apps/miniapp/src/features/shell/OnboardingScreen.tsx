import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { trackAnalyticsEvent } from '../analytics/client';
import { useAuth } from '../auth/AuthProvider';
import { usePreferences } from '../preferences/PreferencesProvider';

const steps = [
  {
    title: 'Ответ открывает ход',
    description: 'Сначала выбираете правильный перевод. Только после этого поле принимает ход.',
  },
  {
    title: 'Ошибки стоят сердца',
    description: 'Неверный ответ не двигает фигуру и уменьшает запас на ран.',
  },
  {
    title: 'Слабые слова возвращаются',
    description: 'Повторение поднимет проблемные карточки из очереди, когда придёт их время.',
  },
];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const preferences = usePreferences();
  const auth = useAuth();
  const token = auth.status === 'authenticated' ? auth.token : null;

  useEffect(() => {
    void trackAnalyticsEvent(token, {
      eventName: 'onboarding_started',
      occurredAt: new Date().toISOString(),
      userId: auth.status === 'authenticated' ? auth.user.id : undefined,
      sessionId: auth.status === 'authenticated' ? auth.session.id : undefined,
      payload: {
        route: '/onboarding',
      },
    });
  }, [auth, token]);

  return (
    <main className="screen">
      <section className="hero-card">
        <p className="eyebrow">Добро пожаловать</p>
        <h1>Как работает петля игры</h1>
        <p className="body-copy">Langue Buster соединяет тренировку слов и тактическое поле, без лишних экранов и шума.</p>
      </section>

      {steps.map((step, index) => (
        <section key={step.title} className="panel">
          <p className="eyebrow">Шаг {index + 1}</p>
          <h2>{step.title}</h2>
          <p className="body-copy">{step.description}</p>
        </section>
      ))}

      <button
        type="button"
        className="primary-button"
        onClick={() => {
          preferences.setOnboardingSeen(true);
          void trackAnalyticsEvent(token, {
            eventName: 'onboarding_completed',
            occurredAt: new Date().toISOString(),
            userId: auth.status === 'authenticated' ? auth.user.id : undefined,
            sessionId: auth.status === 'authenticated' ? auth.session.id : undefined,
            payload: {
              route: '/onboarding',
            },
          });
          void navigate('/placement');
        }}
      >
        Дальше к выбору уровня
      </button>
    </main>
  );
}
