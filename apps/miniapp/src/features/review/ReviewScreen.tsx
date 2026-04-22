import type { ReviewAnswerResponse, ReviewQueueItem } from '@langue-buster/shared';
import { useCallback, useEffect, useState } from 'react';

import { apiClient, ApiClientError } from '../api/client';
import { describeError } from '../api/errors';
import { useAuth } from '../auth/AuthProvider';
import { usePreferences } from '../preferences/PreferencesProvider';
import { useTelegram } from '../telegram/TelegramProvider';
import { FullscreenState } from '../shell/StateScreens';
import { FeedbackCard, QuestionCard } from '../run/components';

export function ReviewScreen() {
  const auth = useAuth();
  const telegram = useTelegram();
  const preferences = usePreferences();
  const [items, setItems] = useState<readonly ReviewQueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ReviewAnswerResponse | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined);
  const focusLevel = preferences.focusLevel;
  const token = auth.status === 'authenticated' ? auth.token : null;

  const loadQueue = useCallback(async () => {
    if (!token) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await apiClient.getReviewQueue(token, {
        limit: 20,
        levelId: focusLevel ?? undefined,
        direction: 'ru_to_fr',
      });
      setItems(response.items);
      setIndex(0);
      setFeedback(null);
      setSelectedOptionId(undefined);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setPending(false);
    }
  }, [focusLevel, token]);

  useEffect(() => {
    void loadQueue();
  }, [focusLevel, loadQueue]);

  if (auth.status !== 'authenticated') {
    return null;
  }

  const currentItem = items[index];
  const currentQuestion = currentItem?.question;

  async function handleAnswer(optionId: string) {
    if (!currentItem || !currentQuestion || !token) {
      return;
    }

    setPending(true);
    setSelectedOptionId(optionId);
    try {
      const response = await apiClient.answerReview(token, {
        sourceItemId: currentItem.sourceItemId,
        questionId: currentQuestion.id,
        selectedOptionId: optionId,
        answeredAt: new Date().toISOString(),
        direction: 'ru_to_fr',
      });
      setFeedback(response);
      if (response.evaluation.isCorrect) {
        telegram.notify('success');
      } else {
        telegram.notify('error');
      }
    } catch (answerError) {
      if (answerError instanceof ApiClientError && answerError.code === 'review_question_mismatch') {
        await loadQueue();
        return;
      }

      setError(describeError(answerError));
    } finally {
      setPending(false);
    }
  }

  if (pending && items.length === 0 && !error) {
    return (
      <FullscreenState
        tone="loading"
        title="Готовим повторение"
        description="Загружаем реальные карточки из очереди review."
      />
    );
  }

  if (error && items.length === 0) {
    return (
      <FullscreenState
        tone="error"
        title="Повторение недоступно"
        description={error}
        actionLabel="Повторить"
        onAction={() => void loadQueue()}
      />
    );
  }

  if (!currentItem || !currentQuestion) {
    return (
      <FullscreenState
        tone="empty"
        title="Пока ничего не нужно повторять"
        description="Слабые слова уже обработаны или очередь ещё не подошла по времени."
        actionLabel="Обновить"
        onAction={() => void loadQueue()}
      />
    );
  }

  return (
    <main className="screen">
      <section className="hero-card">
        <p className="eyebrow">Review Queue</p>
        <h1>Повторение</h1>
        <p className="body-copy">
          Карточка {index + 1} из {items.length}. Причина: {currentItem.reason}.
        </p>
      </section>

      {error ? <FeedbackCard tone="error" title="Сбой сети" description={error} /> : null}
      {feedback ? (
        <FeedbackCard
          tone={feedback.evaluation.isCorrect ? 'success' : 'error'}
          title={feedback.evaluation.isCorrect ? 'Верно' : 'Нужно ещё повторить'}
          description={`Состояние: ${feedback.mastery.masteryState}. Следующий показ: ${new Date(feedback.mastery.nextReviewAt).toLocaleString('ru-RU')}.`}
        />
      ) : null}

      <QuestionCard
        question={currentQuestion}
        selectedOptionId={selectedOptionId}
        answerLocked={Boolean(feedback)}
        pending={pending}
        onSelect={(option) => void handleAnswer(option.id)}
      />

      {feedback ? (
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setIndex((current) => current + 1);
            setFeedback(null);
            setSelectedOptionId(undefined);
          }}
        >
          Следующая карточка
        </button>
      ) : null}
    </main>
  );
}
