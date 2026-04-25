import type { RunFinishResponse, RunResult, RunSession } from '@langue-buster/shared';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { apiClient } from '../api/client';
import { describeError } from '../api/errors';
import { useAuth } from '../auth/AuthProvider';
import { usePreferences } from '../preferences/PreferencesProvider';
import { FullscreenState } from '../shell/StateScreens';

type ResultLocationState =
  | {
      result?: RunResult;
      run?: RunSession;
    }
  | RunFinishResponse
  | null
  | undefined;

export function RunResultScreen() {
  const { runId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const preferences = usePreferences();
  const initialState = location.state as ResultLocationState;
  const [result, setResult] = useState<RunResult | null>(() => {
    if (!initialState) {
      return null;
    }

    return 'result' in initialState && initialState.result ? initialState.result : null;
  });
  const [runSnapshot] = useState<RunSession | null>(() => {
    if (!initialState || !('run' in initialState) || !initialState.run) {
      return null;
    }

    return initialState.run;
  });
  const [loading, setLoading] = useState(result === null);
  const [error, setError] = useState<string | null>(null);
  const token = auth.status === 'authenticated' ? auth.token : null;

  const loadResult = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getRunResult(token, runId);
      setResult(response.result);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  }, [runId, token]);

  useEffect(() => {
    preferences.setActiveRunId(null);
  }, [preferences]);

  useEffect(() => {
    if (!result) {
      void loadResult();
    }
  }, [loadResult, result, runId]);

  if (auth.status !== 'authenticated') {
    return null;
  }

  if (loading && !result) {
    return (
      <FullscreenState
        tone="loading"
        title="Собираем итог"
        description="Подтягиваем финальную сводку рана с сервера."
      />
    );
  }

  if (error && !result) {
    return (
      <FullscreenState
        tone="error"
        title="Итог пока недоступен"
        description={error}
        actionLabel="Повторить"
        onAction={() => { void loadResult(); }}
      />
    );
  }

  if (!result) {
    return null;
  }

  return (
    <main className="screen result-screen">
      <section className="hero-card result-hero">
        <p className="eyebrow">Итоги рана</p>
        <h1>{result.status === 'completed' ? 'Ран завершён' : result.status === 'failed' ? 'Ран остановлен' : 'Ран закрыт'}</h1>
        <p className="body-copy">
          Сервер уже пересчитал итог без клиентских допущений. Ошибки отправлены в контур повторения, а результат готов к следующему заходу.
        </p>
        <div className="result-hero__score">{result.finalScore}</div>
      </section>

      <section className="result-grid">
        <article className="result-stat-card">
          <span>Точность</span>
          <strong>{formatAccuracy(result.correctCount, result.wrongCount)}</strong>
        </article>
        <article className="result-stat-card">
          <span>Линии</span>
          <strong>{result.clearedLinesTotal}</strong>
        </article>
        <article className="result-stat-card">
          <span>Ошибки</span>
          <strong>{result.wrongCount}</strong>
        </article>
        <article className="result-stat-card">
          <span>Длительность</span>
          <strong>{Math.max(1, Math.round(result.durationMs / 1000))} сек</strong>
        </article>
      </section>

      <section className="panel result-panel">
        <div className="panel-header">
          <h2>Разбор попытки</h2>
          <span>{translateStatus(result.status)}</span>
        </div>
        <dl className="stats-list">
          <div>
            <dt>Верных ответов</dt>
            <dd>{result.correctCount}</dd>
          </div>
          <div>
            <dt>Ошибок</dt>
            <dd>{result.wrongCount}</dd>
          </div>
          <div>
            <dt>Уровень</dt>
            <dd>{result.levelId}</dd>
          </div>
          <div>
            <dt>Слова в коротком повторе</dt>
            <dd>{runSnapshot?.recoveryState?.pending.length ?? 0}</dd>
          </div>
        </dl>
        <p className="body-copy result-panel__copy">
          {describePerformance(result.correctCount, result.wrongCount, result.clearedLinesTotal)}
        </p>
      </section>

      <section className="panel result-panel">
        <div className="panel-header">
          <h2>Что делать дальше</h2>
          <span>Следующий шаг</span>
        </div>
        <ul className="feature-list">
          <li>Повтор сейчас: откройте очередь повторения, чтобы сразу закрыть слабые элементы.</li>
          <li>Новый ран: идите ещё раз, если хотите удержать темп и добрать очки.</li>
          <li>Фокус уровня можно сменить на карте прогресса без нового онбординга.</li>
        </ul>
      </section>

      <div className="button-row result-actions">
        <button type="button" className="primary-button" onClick={() => { void navigate('/review'); }}>
          Открыть повторение
        </button>
        <button type="button" className="secondary-button" onClick={() => { void navigate('/home'); }}>
          Новый ран
        </button>
        <button type="button" className="secondary-button" onClick={() => { void navigate('/home'); }}>
          На главный экран
        </button>
      </div>
    </main>
  );
}

function translateStatus(status: RunResult['status']) {
  if (status === 'completed') {
    return 'Завершён';
  }
  if (status === 'failed') {
    return 'Провален';
  }
  if (status === 'abandoned') {
    return 'Остановлен';
  }
  return status;
}

function formatAccuracy(correctCount: number, wrongCount: number) {
  const total = correctCount + wrongCount;
  if (total === 0) {
    return '0%';
  }

  return `${Math.round((correctCount / total) * 100)}%`;
}

function describePerformance(correctCount: number, wrongCount: number, clearedLinesTotal: number) {
  const total = correctCount + wrongCount;
  const accuracy = total === 0 ? 0 : correctCount / total;

  if (accuracy >= 0.85 && clearedLinesTotal >= 3) {
    return 'Сильная попытка: и язык, и поле держались уверенно. Такой ран уже хорошо конвертируется в запоминание.';
  }

  if (wrongCount > correctCount) {
    return 'Ошибок было больше, чем стабильных ответов. Лучше сразу открыть повторение и вернуть слабые слова в короткий цикл.';
  }

  return 'Ран держался ровно: база уже есть, а короткое повторение поможет закрепить промахи без лишней перегрузки.';
}
