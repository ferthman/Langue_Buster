import { useNavigate } from 'react-router-dom';

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
          void navigate('/placement');
        }}
      >
        Дальше к выбору уровня
      </button>
    </main>
  );
}
