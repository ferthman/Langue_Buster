'use client';

import { useEffect, useState } from 'react';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';

type AntiCheatState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; anomalies: Awaited<ReturnType<typeof adminApi.listAntiCheatAnomalies>>['anomalies'] };

export function AntiCheatScreen() {
  const session = useAdminSession();
  const [state, setState] = useState<AntiCheatState>({ status: 'loading' });

  useEffect(() => {
    if (session.state.status !== 'ready') {
      return;
    }

    const { token } = session.state;
    void (async () => {
      setState({ status: 'loading' });
      try {
        const response = await adminApi.listAntiCheatAnomalies(token, { limit: 50 });
        setState({
          status: 'ready',
          anomalies: response.anomalies,
        });
      } catch (error) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Не удалось загрузить anti-cheat события.',
        });
      }
    })();
  }, [session.state]);

  if (state.status === 'loading') {
    return <section className="panel"><p className="muted">Загружаем anomaly log...</p></section>;
  }

  if (state.status === 'error') {
    return <section className="panel"><p className="muted">{state.message}</p></section>;
  }

  return (
    <section className="panel">
      <p className="eyebrow">Anti-cheat</p>
      <h3>Последние anomaly events</h3>
      {state.anomalies.length === 0 ? (
        <p className="muted">Пока нет зафиксированных anti-cheat аномалий.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Severity</th>
              <th>User</th>
              <th>Run</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {state.anomalies.map((anomaly) => (
              <tr key={anomaly.id}>
                <td>{new Date(anomaly.occurredAt).toLocaleString('ru-RU')}</td>
                <td>{anomaly.type}</td>
                <td><span className={`status-badge severity-${anomaly.severity}`}>{anomaly.severity}</span></td>
                <td>{anomaly.userId ?? '—'}</td>
                <td>{anomaly.runId ?? '—'}</td>
                <td><code>{JSON.stringify(anomaly.metadata)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
