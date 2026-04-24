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
  const [result, setResult] = useState<RunResult | null>(() => {
    const state = location.state as ResultLocationState;
    if (!state) {
      return null;
    }

    return 'result' in state && state.result ? state.result : null;
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
    <main className="screen">
      <section className="hero-card">
        <p className="eyebrow">Итоги рана</p>
        <h1>{result.status === 'completed' ? 'Ран завершён' : result.status === 'failed' ? 'Ран остановлен' : 'Ран закрыт'}</h1>
        <p className="body-copy">
          Финальная сводка приходит с сервера без клиентских пересчётов. Ошибки уже учтены в повторении и mastery-пайплайне.
        </p>
      </section>

      <section className="panel">
        <dl className="stats-list">
          <div>
            <dt>Счёт</dt>
            <dd>{result.finalScore}</dd>
          </div>
          <div>
            <dt>Линий очищено</dt>
            <dd>{result.clearedLinesTotal}</dd>
          </div>
          <div>
            <dt>Верных ответов</dt>
            <dd>{result.correctCount}</dd>
          </div>
          <div>
            <dt>Ошибок</dt>
            <dd>{result.wrongCount}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>{translateStatus(result.status)}</dd>
          </div>
          <div>
            <dt>Длительность</dt>
            <dd>{Math.max(1, Math.round(result.durationMs / 1000))} сек</dd>
          </div>
        </dl>
      </section>

      <div className="button-row">
        <button type="button" className="primary-button" onClick={() => { void navigate('/home'); }}>
          Вернуться домой
        </button>
        <button type="button" className="secondary-button" onClick={() => { void navigate('/home'); }}>
          Начать новый ран
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
