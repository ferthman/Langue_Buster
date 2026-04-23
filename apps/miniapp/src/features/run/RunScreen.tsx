import type { Coordinate, MoveEvent, QuestionOption, RunResult, RunSession } from '@langue-buster/shared';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { apiClient, ApiClientError } from '../api/client';
import { trackAnalyticsEvent } from '../analytics/client';
import { describeError } from '../api/errors';
import { useAuth } from '../auth/AuthProvider';
import { usePreferences } from '../preferences/PreferencesProvider';
import { useTelegram } from '../telegram/TelegramProvider';
import { FullscreenState } from '../shell/StateScreens';
import { BoardView, FeedbackCard, MoveSummary, QuestionCard, RunHeader, TrayView } from './components';

export function RunScreen() {
  const { runId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const telegram = useTelegram();
  const preferences = usePreferences();
  const [run, setRun] = useState<RunSession | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; title: string; description: string } | null>(null);
  const [moveEvent, setMoveEvent] = useState<MoveEvent | null>(null);
  const [pending, setPending] = useState(true);
  const [selectedTrayIndex, setSelectedTrayIndex] = useState<number | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const token = auth.status === 'authenticated' ? auth.token : null;
  const locationState = location.state as { result?: RunResult } | null;

  const selectedPiece = selectedTrayIndex === null ? null : run?.engineState.tray[selectedTrayIndex] ?? null;
  const question = run?.currentQuestionState?.question ?? null;

  const loadRun = useCallback(async () => {
    if (!token) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await apiClient.getRun(token, runId);
      if (response.run.status === 'completed' || response.run.status === 'failed' || response.run.status === 'abandoned') {
        preferences.setActiveRunId(null);
        void navigate(`/run/${runId}/result`, {
          replace: true,
          state: { result: locationState?.result },
        });
        return;
      }

      setRun(response.run);
      setSelectedOptionId(response.run.currentQuestionState?.selectedOptionId);
      setSelectedTrayIndex(null);
    } catch (loadError) {
      setError(describeError(loadError));
      if (auth.status === 'authenticated') {
        void trackAnalyticsEvent(token, {
          eventName: 'user_visible_failure',
          occurredAt: new Date().toISOString(),
          userId: auth.user.id,
          sessionId: auth.session.id,
          runId,
          payload: {
            route: `/run/${runId}`,
            screen: 'run',
            code: loadError instanceof ApiClientError ? loadError.code : 'run_load_failed',
            message: describeError(loadError),
          },
        });
      }
    } finally {
      setPending(false);
    }
  }, [locationState, navigate, preferences, runId, token]);

  useEffect(() => {
    void loadRun();
  }, [loadRun, runId]);

  useEffect(() => {
    if (!token || auth.status !== 'authenticated') {
      return;
    }

    void trackAnalyticsEvent(token, {
      eventName: 'run_screen_opened',
      occurredAt: new Date().toISOString(),
      userId: auth.user.id,
      sessionId: auth.session.id,
      runId,
      levelId: run?.levelId,
      payload: {
        route: `/run/${runId}`,
        focusLevel: run?.levelId,
      },
    });
  }, [auth, run?.levelId, runId, token]);

  if (auth.status !== 'authenticated') {
    return null;
  }

  async function handleAnswer(option: QuestionOption) {
    if (!run || !token) {
      return;
    }

    setSelectedOptionId(option.id);
    setPending(true);
    setError(null);

    try {
      const response = await apiClient.answerRun(token, run.id, {
        selectedOptionId: option.id,
        answeredAt: new Date().toISOString(),
      });
      setRun(response.run);
      setMoveEvent(null);

      if (response.evaluation.isCorrect) {
        telegram.notify('success');
        setFeedback({
          tone: 'success',
          title: 'Верно',
          description: 'Ход открыт. Выберите фигуру в трее и клетку старта на поле.',
        });
      } else {
        telegram.notify('error');
        setSelectedOptionId(undefined);
        setFeedback({
          tone: 'error',
          title: 'Неверно',
          description: response.evaluation.penalty
            ? `Сердца: ${response.run.heartsRemaining}. Новый вопрос уже готов.`
            : 'Попробуйте следующую карточку.',
        });
      }

      if (response.result) {
        preferences.setActiveRunId(null);
        void navigate(`/run/${run.id}/result`, {
          replace: true,
          state: { result: response.result, run: response.run },
        });
      }
    } catch (answerError) {
      setError(describeError(answerError));
      if (answerError instanceof ApiClientError && answerError.code === 'run_invalid_state') {
        if (auth.status === 'authenticated') {
          void trackAnalyticsEvent(token, {
            eventName: 'retry_clicked',
            occurredAt: new Date().toISOString(),
            userId: auth.user.id,
            sessionId: auth.session.id,
            runId,
            payload: {
              route: `/run/${runId}`,
              screen: 'run',
              target: 'reload_after_invalid_state',
            },
          });
        }
        void loadRun();
      }
    } finally {
      setPending(false);
    }
  }

  async function handleMove(origin: Coordinate) {
    if (!run || selectedTrayIndex === null || !token) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await apiClient.moveRun(token, run.id, {
        trayIndex: selectedTrayIndex,
        origin,
      });
      telegram.notify('success');
      setRun(response.run);
      setMoveEvent(response.moveEvent);
      setSelectedTrayIndex(null);
      setSelectedOptionId(undefined);
      setFeedback({
        tone: 'success',
        title: 'Ход принят',
        description: `+${response.moveEvent.scoreBreakdown.totalPoints} очков и ${response.moveEvent.clearedLineCount} очищенных линий.`,
      });

      if (response.result) {
        preferences.setActiveRunId(null);
        void navigate(`/run/${run.id}/result`, {
          replace: true,
          state: { result: response.result, run: response.run },
        });
      }
    } catch (moveError) {
      telegram.notify('error');
      setError(describeError(moveError));
      if (moveError instanceof ApiClientError && moveError.code === 'run_invalid_state') {
        if (auth.status === 'authenticated') {
          void trackAnalyticsEvent(token, {
            eventName: 'retry_clicked',
            occurredAt: new Date().toISOString(),
            userId: auth.user.id,
            sessionId: auth.session.id,
            runId,
            payload: {
              route: `/run/${runId}`,
              screen: 'run',
              target: 'reload_after_invalid_move_state',
            },
          });
        }
        void loadRun();
      }
    } finally {
      setPending(false);
    }
  }

  async function handleFinish() {
    if (!run || !token) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await apiClient.finishRun(token, run.id);
      preferences.setActiveRunId(null);
      void navigate(`/run/${run.id}/result`, {
        replace: true,
        state: response,
      });
    } catch (finishError) {
      setError(describeError(finishError));
    } finally {
      setPending(false);
    }
  }

  if (pending && !run && !error) {
    return (
      <FullscreenState
        tone="loading"
        title="Загружаем ран"
        description="Получаем серверное состояние, вопрос и поле."
      />
    );
  }

  if (error && !run) {
    return (
      <FullscreenState
        tone="error"
        title="Ран недоступен"
        description={error}
        actionLabel="Повторить"
        onAction={() => {
          if (auth.status === 'authenticated') {
            void trackAnalyticsEvent(token, {
              eventName: 'retry_clicked',
              occurredAt: new Date().toISOString(),
              userId: auth.user.id,
              sessionId: auth.session.id,
              runId,
              payload: {
                route: `/run/${runId}`,
                screen: 'run',
                target: 'run_reload',
              },
            });
          }
          void loadRun();
        }}
      />
    );
  }

  if (!run || !question) {
    return (
      <FullscreenState
        tone="empty"
        title="Состояние рана пустое"
        description="Не удалось получить активный вопрос. Попробуйте открыть ран заново."
        actionLabel="Домой"
        onAction={() => { void navigate('/home'); }}
      />
    );
  }

  const answerLocked = run.status !== 'active' || run.currentQuestionState?.answerState !== 'awaiting_answer';
  const moveUnlocked = run.status === 'awaiting_move' && Boolean(selectedPiece);

  return (
    <main className="screen">
      <RunHeader score={run.score} hearts={run.heartsRemaining} combo={run.combo} level={run.levelId} />

      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => { void handleFinish(); }} disabled={pending}>
          Завершить ран
        </button>
      </div>

      {feedback ? <FeedbackCard {...feedback} /> : null}
      {error ? <FeedbackCard tone="error" title="Нужна синхронизация" description={error} /> : null}

      <QuestionCard
        question={question}
        answerLocked={answerLocked}
        pending={pending}
        selectedOptionId={selectedOptionId}
        onSelect={(option) => void handleAnswer(option)}
      />

      <TrayView
        tray={run.engineState.tray}
        selectedIndex={selectedTrayIndex}
        selectable={run.status === 'awaiting_move' && !pending}
        onSelect={(index) => {
          telegram.impact('light');
          setSelectedTrayIndex(index === selectedTrayIndex ? null : index);
        }}
      />

      <BoardView
        engineState={run.engineState}
        selectedPieceId={moveUnlocked && selectedPiece ? selectedPiece.pieceId : undefined}
        onSelectOrigin={(origin) => void handleMove(origin)}
      />

      {moveEvent ? <MoveSummary moveEvent={moveEvent} /> : null}
    </main>
  );
}
