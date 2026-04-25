import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '../api/client';
import { trackAnalyticsEvent } from '../analytics/client';
import { describeError } from '../api/errors';
import { useAuth } from '../auth/AuthProvider';
import { usePreferences } from '../preferences/PreferencesProvider';
import { InlineNotice, ScreenHeader } from './StateScreens';

export function ProfileScreen() {
  const auth = useAuth();
  const preferences = usePreferences();
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = auth.status === 'authenticated' ? auth.token : null;
  const focusLevel = preferences.focusLevel;

  const loadQueue = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const queue = await apiClient.getReviewQueue(token, {
        limit: 20,
        levelId: focusLevel ?? undefined,
        direction: 'ru_to_fr',
      });
      const now = Date.now();
      setReviewCount(queue.items.filter((item) => new Date(item.nextReviewAt).getTime() <= now).length);
      setError(null);
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [focusLevel, token]);

  useEffect(() => {
    void loadQueue();
  }, [focusLevel, loadQueue]);

  useEffect(() => {
    if (!token || auth.status !== 'authenticated') {
      return;
    }

    void trackAnalyticsEvent(token, {
      eventName: 'profile_opened',
      occurredAt: new Date().toISOString(),
      userId: auth.user.id,
      sessionId: auth.session.id,
      levelId: focusLevel ?? undefined,
      payload: {
        route: '/profile',
        focusLevel: focusLevel ?? undefined,
      },
    });
  }, [auth, focusLevel, token]);

  if (auth.status !== 'authenticated') {
    return null;
  }

  return (
    <main className="screen">
      <section className="hero-card">
        <p className="eyebrow">Профиль</p>
        <h1>{auth.user.firstName}</h1>
        <p className="body-copy">Минимальный честный профиль без выдуманных очков и искусственного прогресса.</p>
      </section>

      {error ? <InlineNotice tone="error" title="Данные частично недоступны" description={error} /> : null}

      <section className="panel">
        <ScreenHeader title="Учётная запись" caption="Реальные данные сессии" />
        <dl className="stats-list">
          <div>
            <dt>ID Telegram</dt>
            <dd>{auth.user.telegramUserId}</dd>
          </div>
          <div>
            <dt>Имя</dt>
            <dd>{auth.user.firstName}{auth.user.lastName ? ` ${auth.user.lastName}` : ''}</dd>
          </div>
          <div>
            <dt>Фокус уровня</dt>
            <dd>{focusLevel ?? 'A1'}</dd>
          </div>
          <div>
            <dt>Повтор сейчас</dt>
            <dd>{reviewCount === null ? '...' : reviewCount}</dd>
          </div>
          <div>
            <dt>Сессия истекает</dt>
            <dd>{new Date(auth.session.expiresAt).toLocaleString('ru-RU')}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
