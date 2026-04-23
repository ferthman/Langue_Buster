'use client';

import { useEffect, useState } from 'react';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';

type AnalyticsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      overview: Awaited<ReturnType<typeof adminApi.getAnalyticsOverview>>['overview'];
      funnels: Awaited<ReturnType<typeof adminApi.getAnalyticsFunnels>>['steps'];
      content: Awaited<ReturnType<typeof adminApi.getAnalyticsContent>>;
      retention: Awaited<ReturnType<typeof adminApi.getAnalyticsRetention>>;
    };

export function AnalyticsScreen() {
  const session = useAdminSession();
  const [state, setState] = useState<AnalyticsState>({ status: 'loading' });

  useEffect(() => {
    if (session.state.status !== 'ready') {
      return;
    }

    const { token } = session.state;
    void (async () => {
      setState({ status: 'loading' });
      try {
        const [overview, funnels, content, retention] = await Promise.all([
          adminApi.getAnalyticsOverview(token),
          adminApi.getAnalyticsFunnels(token),
          adminApi.getAnalyticsContent(token),
          adminApi.getAnalyticsRetention(token),
        ]);
        setState({
          status: 'ready',
          overview: overview.overview,
          funnels: funnels.steps,
          content,
          retention,
        });
      } catch (error) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить аналитику.',
        });
      }
    })();
  }, [session.state]);

  if (state.status === 'loading') {
    return <section className="panel"><p className="muted">Собираем аналитику...</p></section>;
  }

  if (state.status === 'error') {
    return <section className="panel"><p className="muted">{state.message}</p></section>;
  }

  return (
    <div className="stack gap-24">
      <section className="panel">
        <p className="eyebrow">Overview</p>
        <h3>Ключевые метрики</h3>
        <div className="dashboard-grid">
          <MetricCard label="Onboarding completion" value={String(state.overview.onboardingCompletionCount)} />
          <MetricCard label="First run start" value={String(state.overview.firstRunStartCount)} />
          <MetricCard label="First run finish" value={String(state.overview.firstRunFinishCount)} />
          <MetricCard label="Answer accuracy" value={formatPercent(state.overview.answerAccuracy)} />
          <MetricCard label="Review adoption" value={formatPercent(state.overview.reviewAdoptionRate)} />
          <MetricCard label="Avg run length" value={`${state.overview.averageRunLengthSeconds.toFixed(1)}s`} />
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Funnels</p>
        <h3>Базовая воронка</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Шаг</th>
              <th>Пользователи</th>
            </tr>
          </thead>
          <tbody>
            {state.funnels.map((step) => (
              <tr key={step.step}>
                <td>{step.step}</td>
                <td>{step.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <p className="eyebrow">Retention</p>
        <h3>D1 / D7</h3>
        <div className="dashboard-grid">
          <MetricCard label="Всего пользователей" value={String(state.retention.totalUsers)} />
          <MetricCard label="D1" value={formatPercent(state.retention.d1Rate)} />
          <MetricCard label="D7" value={formatPercent(state.retention.d7Rate)} />
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Content</p>
        <h3>Часто падающие элементы</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Topic</th>
              <th>Wrong</th>
              <th>Review wrong</th>
              <th>Weak</th>
              <th>Resurface</th>
            </tr>
          </thead>
          <tbody>
            {state.content.frequentlyFailedItems.map((item) => (
              <tr key={item.sourceItemId}>
                <td>{item.sourceItemId}</td>
                <td>{item.topicId ?? '—'}</td>
                <td>{item.wrongAnswerCount}</td>
                <td>{item.reviewWrongCount}</td>
                <td>{item.weakMasteryCount}</td>
                <td>{item.resurfacingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
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
