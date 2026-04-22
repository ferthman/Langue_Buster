import type { RunSession } from '@langue-buster/shared';
import { startTransition, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiClient } from '../api/client';
import { describeError } from '../api/errors';
import { useAuth } from '../auth/AuthProvider';
import { usePreferences } from '../preferences/PreferencesProvider';
import { InlineNotice, ScreenHeader } from './StateScreens';

export function HomeScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const preferences = usePreferences();
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [resumeRun, setResumeRun] = useState<RunSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const token = auth.status === 'authenticated' ? auth.token : null;
  const focusLevel = preferences.focusLevel;
  const activeRunId = preferences.activeRunId;

  const loadSummary = useCallback(async () => {
    if (!token) {
      return;
    }

    setError(null);

    try {
      const queue = await apiClient.getReviewQueue(token, {
        limit: 20,
        levelId: focusLevel ?? undefined,
        direction: 'ru_to_fr',
      });
      const now = Date.now();
      setReviewCount(queue.items.filter((item) => new Date(item.nextReviewAt).getTime() <= now).length);
    } catch (loadError) {
      setReviewCount(null);
      setError(describeError(loadError));
    }

    if (!activeRunId) {
      setResumeRun(null);
      return;
    }

    try {
      const response = await apiClient.getRun(token, activeRunId);
      if (response.run.status === 'active' || response.run.status === 'awaiting_move') {
        setResumeRun(response.run);
        return;
      }
    } catch {
      // Treat stale local run ids as recoverable noise.
    }

    setResumeRun(null);
    preferences.setActiveRunId(null);
  }, [activeRunId, focusLevel, preferences, token]);

  useEffect(() => {
    void loadSummary();
  }, [activeRunId, focusLevel, loadSummary]);

  if (auth.status !== 'authenticated') {
    return null;
  }

  async function handleStartRun() {
    if (!focusLevel || !token) {
      void navigate('/placement');
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const response = await apiClient.startRun(token, {
        levelId: focusLevel,
        direction: 'ru_to_fr',
      });
      preferences.setActiveRunId(response.run.id);
      startTransition(() => {
        void navigate(`/run/${response.run.id}`);
      });
    } catch (startError) {
      setError(describeError(startError));
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className="screen">
      <section className="hero-card">
        <p className="eyebrow">Telegram Mini App</p>
        <h1>Привет, {auth.user.firstName}</h1>
        <p className="body-copy">
          Сегодня фокус на уровне {focusLevel ?? 'A1'}: отвечайте правильно, открывайте ход и возвращайте слабые слова в повтор.
        </p>
      </section>

      {error ? <InlineNotice tone="error" title="Нужна повторная попытка" description={error} /> : null}

      <section className="panel">
        <ScreenHeader title="Быстрый старт" caption="Главные действия на сегодня" />
        <div className="dashboard-grid">
          <MetricCard label="Фокус" value={focusLevel ?? 'A1'} />
          <MetricCard label="Повтор сейчас" value={reviewCount === null ? '...' : String(reviewCount)} />
          <MetricCard label="Сессия" value={formatSessionStatus(auth.session.expiresAt)} />
        </div>
        <div className="stack">
          <button type="button" className="primary-button" onClick={() => { void handleStartRun(); }} disabled={starting}>
            {starting ? 'Запускаем ран...' : 'Начать Classic Run'}
          </button>
          <button type="button" className="secondary-button" onClick={() => { void navigate('/review'); }}>
            Открыть повторение
          </button>
          {resumeRun ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => { void navigate(`/run/${resumeRun.id}`); }}
            >
              Продолжить ран
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <ScreenHeader title="На что смотреть" caption="Минимальный честный прогресс" />
        <ul className="feature-list">
          <li>Уровень запуска: {focusLevel ?? 'A1'}</li>
          <li>Повторение берётся из реальной очереди Phase 8</li>
          <li>Ран использует серверное состояние без клиентской подмены</li>
        </ul>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatSessionStatus(expiresAt: string) {
  const minutesLeft = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
  return minutesLeft > 60 ? 'Активна' : `${minutesLeft} мин`;
}
