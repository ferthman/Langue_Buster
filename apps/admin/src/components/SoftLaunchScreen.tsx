'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type {
  SoftLaunchSettingsSnapshot,
  SoftLaunchUpdateRequest,
} from '@langue-buster/shared';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';

type SoftLaunchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      overview: Awaited<ReturnType<typeof adminApi.getSoftLaunchStatus>>;
      launch: Awaited<ReturnType<typeof adminApi.getSoftLaunchLaunchReport>>;
      retention: Awaited<ReturnType<typeof adminApi.getSoftLaunchRetentionReport>>;
      content: Awaited<ReturnType<typeof adminApi.getSoftLaunchContentReport>>;
      tuning: Awaited<ReturnType<typeof adminApi.getSoftLaunchTuningReport>>;
      anomalies: Awaited<ReturnType<typeof adminApi.listAntiCheatAnomalies>>['anomalies'];
    };

export function SoftLaunchScreen() {
  const session = useAdminSession();
  const [state, setState] = useState<SoftLaunchState>({ status: 'loading' });
  const [saveState, setSaveState] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({
    status: 'idle',
  });
  const [flagState, setFlagState] = useState<string | null>(null);

  const dayRange = useMemo(() => {
    const now = new Date();
    return {
      to: now.toISOString(),
      from: new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString(),
    };
  }, []);
  const weekRange = useMemo(() => {
    const now = new Date();
    return {
      to: now.toISOString(),
      from: new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString(),
    };
  }, []);

  useEffect(() => {
    if (session.state.status !== 'ready') {
      return;
    }

    const { token } = session.state;
    void (async () => {
      setState({ status: 'loading' });
      try {
        const [overview, launch, retention, content, tuning, anomalies] = await Promise.all([
          adminApi.getSoftLaunchStatus(token),
          adminApi.getSoftLaunchLaunchReport(token, dayRange),
          adminApi.getSoftLaunchRetentionReport(token, weekRange),
          adminApi.getSoftLaunchContentReport(token, dayRange),
          adminApi.getSoftLaunchTuningReport(token, dayRange),
          adminApi.listAntiCheatAnomalies(token, { limit: 10 }),
        ]);
        setState({
          status: 'ready',
          overview,
          launch,
          retention,
          content,
          tuning,
          anomalies: anomalies.anomalies,
        });
      } catch (error) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить soft-launch панель.',
        });
      }
    })();
  }, [dayRange, session.state, weekRange]);

  if (state.status === 'loading') {
    return <section className="panel"><p className="muted">Собираем soft-launch контур...</p></section>;
  }

  if (state.status === 'error') {
    return <section className="panel"><p className="muted">{state.message}</p></section>;
  }

  return (
    <div className="stack gap-24">
      <section className="panel">
        <p className="eyebrow">Soft launch</p>
        <h3>Контрольный режим</h3>
        <div className="dashboard-grid">
          <MetricCard label="Soft launch" value={state.overview.enabled ? 'Включён' : 'Выключен'} />
          <MetricCard label="Launch levels" value={state.overview.launchLevels.join(', ')} />
          <MetricCard label="Allowed user ids" value={String(state.overview.allowedUserIdsCount)} />
          <MetricCard label="Allowed Telegram ids" value={String(state.overview.allowedTelegramUserIdsCount)} />
        </div>
      </section>

      <SettingsPanel
        snapshot={state.overview.activeSettings}
        savingState={saveState}
        onSave={async (payload) => {
          if (session.state.status !== 'ready') {
            return;
          }
          setSaveState({ status: 'saving' });
          try {
            const updated = await adminApi.updateSoftLaunchSettings(session.state.token, payload);
            setState((current) => current.status !== 'ready' ? current : {
              ...current,
              overview: updated,
              tuning: {
                ...current.tuning,
                activeSettings: updated.activeSettings,
              },
            });
            setSaveState({ status: 'saved', message: 'Активный tuning snapshot обновлён.' });
          } catch (error) {
            setSaveState({
              status: 'error',
              message: error instanceof Error ? error.message : 'Не удалось сохранить настройки.',
            });
          }
        }}
      />

      <section className="panel">
        <p className="eyebrow">Live 24h</p>
        <h3>Операционные KPI</h3>
        <div className="dashboard-grid">
          <MetricCard label="Onboarding completion" value={formatPercent(state.launch.kpis.onboardingCompletionRate)} />
          <MetricCard label="First run start" value={String(state.launch.kpis.firstRunStartCount)} />
          <MetricCard label="First run finish" value={String(state.launch.kpis.firstRunFinishCount)} />
          <MetricCard label="Answer accuracy" value={formatPercent(state.launch.kpis.answerAccuracy)} />
          <MetricCard label="Review adoption" value={formatPercent(state.launch.kpis.reviewAdoptionRate)} />
          <MetricCard label="Runtime failures" value={String(state.launch.runtimeFailures.count)} />
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Retention 7d</p>
        <h3>Retention / replay</h3>
        <div className="dashboard-grid">
          <MetricCard label="Cohort size" value={String(state.retention.cohortSize)} />
          <MetricCard label="D1" value={formatPercent(state.retention.d1Rate)} />
          <MetricCard label="D7" value={formatPercent(state.retention.d7Rate)} />
          <MetricCard label="Replay" value={formatPercent(state.retention.replayRate)} />
        </div>
      </section>

      <section className="panel">
        <div className="row space-between align-center">
          <div>
            <p className="eyebrow">Content review</p>
            <h3>Top failed / weak items</h3>
          </div>
          {flagState ? <span className="header-pill">{flagState}</span> : null}
        </div>
        {state.content.topFailedItems.length === 0 ? (
          <p className="muted">Пока нет проблемных элементов в выбранном окне.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Topic</th>
                <th>Wrong</th>
                <th>Review wrong</th>
                <th>Weak</th>
                <th>Resurface</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {state.content.topFailedItems.map((item) => (
                <tr key={item.sourceItemId}>
                  <td><code>{item.sourceItemId}</code></td>
                  <td>{item.topicId ?? '—'}</td>
                  <td>{item.wrongAnswerCount}</td>
                  <td>{item.reviewWrongCount}</td>
                  <td>{item.weakMasteryCount}</td>
                  <td>{item.resurfacingCount}</td>
                  <td>
                    <div className="row gap-12">
                      <Link href={`/vocab-items/${encodeURIComponent(item.sourceItemId)}`} className="secondary-button">
                        Открыть
                      </Link>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleFlagForReview(session.state.status === 'ready' ? session.state.token : '', item.sourceItemId, setFlagState)}
                      >
                        QA-флаг
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Weak clusters</p>
        <h3>Темы и уроки</h3>
        <div className="split-grid">
          <ClusterTable title="Topics" rows={state.content.weakTopicClusters} />
          <ClusterTable title="Lessons" rows={state.content.weakLessonClusters} />
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Anomalies</p>
        <h3>Anti-cheat и runtime хвост</h3>
        <div className="split-grid">
          <div>
            <h4>Recent runtime failures</h4>
            {state.launch.runtimeFailures.recent.length === 0 ? (
              <p className="muted">Нет свежих runtime failures.</p>
            ) : (
              <ul className="compact-list">
                {state.launch.runtimeFailures.recent.map((item, index) => (
                  <li key={`${item.eventName}-${item.occurredAt}-${index}`}>
                    <strong>{item.eventName}</strong> · {item.code ?? 'no_code'} · {new Date(item.occurredAt).toLocaleString('ru-RU')}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4>Recent anti-cheat anomalies</h4>
            {state.anomalies.length === 0 ? (
              <p className="muted">Нет свежих anti-cheat anomalies.</p>
            ) : (
              <ul className="compact-list">
                {state.anomalies.map((item) => (
                  <li key={item.id}>
                    <strong>{item.type}</strong> · {item.severity} · {new Date(item.occurredAt).toLocaleString('ru-RU')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Tuning backlog</p>
        <h3>Наблюдения и следующие шаги</h3>
        <div className="split-grid">
          <div>
            <h4>Signals</h4>
            <ul className="compact-list">
              {state.tuning.observedSignals.map((signal) => (
                <li key={signal.key}>
                  <strong>{signal.key}</strong>: {String(signal.value)} · {signal.note}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Recommendations</h4>
            <ul className="compact-list">
              {state.tuning.recommendedAdjustments.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <h4>Open risks</h4>
            <ul className="compact-list">
              {state.tuning.openRisks.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsPanel({
  snapshot,
  savingState,
  onSave,
}: {
  snapshot: SoftLaunchSettingsSnapshot;
  savingState: { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string };
  onSave: (payload: SoftLaunchUpdateRequest) => Promise<void>;
}) {
  const [settings, setSettings] = useState(snapshot.settings);
  const [note, setNote] = useState(snapshot.note ?? '');

  useEffect(() => {
    setSettings(snapshot.settings);
    setNote(snapshot.note ?? '');
  }, [snapshot]);

  return (
    <section className="panel">
      <p className="eyebrow">Tuning controls</p>
      <h3>Активный snapshot</h3>
      <div className="form-grid two-columns">
        {Object.entries(settings).map(([key, value]) => (
          <label key={key} className="field">
            <span>{key}</span>
            {typeof value === 'boolean' ? (
              <select
                value={String(value)}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  [key]: event.target.value === 'true',
                }))}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type="number"
                step="1"
                value={value}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  [key]: Number(event.target.value),
                }))}
              />
            )}
          </label>
        ))}
      </div>
      <label className="field">
        <span>Note</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
      </label>
      <div className="row gap-12 align-center">
        <button type="button" className="primary-button" onClick={() => void onSave({ settings, note })} disabled={savingState.status === 'saving'}>
          {savingState.status === 'saving' ? 'Сохраняем…' : 'Сохранить snapshot'}
        </button>
        <span className="muted">
          {savingState.message ?? `Текущий snapshot: ${snapshot.id}`}
        </span>
      </div>
    </section>
  );
}

function ClusterTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; accuracy: number; wrongAnswerCount: number; answerCount: number }>;
}) {
  return (
    <div>
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p className="muted">Нет данных.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Accuracy</th>
              <th>Wrong</th>
              <th>Answers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{formatPercent(row.accuracy)}</td>
                <td>{row.wrongAnswerCount}</td>
                <td>{row.answerCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

async function handleFlagForReview(
  token: string,
  sourceItemId: string,
  setFlagState: (value: string | null) => void,
) {
  try {
    await adminApi.createQaFlag(token, {
      entityType: 'vocab_item',
      entityId: sourceItemId,
      flagType: 'needs_review',
      note: 'Soft-launch daily review candidate.',
    });
    setFlagState(`QA-флаг создан для ${sourceItemId}`);
  } catch (error) {
    setFlagState(error instanceof Error ? error.message : 'Не удалось создать QA-флаг.');
  }
}
