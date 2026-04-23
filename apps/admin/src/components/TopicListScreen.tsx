'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';
import { ErrorBanner, LoadingBlock, SectionCard } from './AdminPrimitives';

export function TopicListScreen() {
  const { state } = useAdminSession();
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.listTopics>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== 'ready') {
      return;
    }

    void adminApi
      .listTopics(state.token)
      .then((response) => setData(response))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить темы.'))
      .finally(() => setLoading(false));
  }, [state]);

  return (
    <SectionCard
      title="Темы"
      description="Редактор тем с CEFR-связями и publish workflow."
      actions={
        <Link className="primary-button" href="/topics/new">
          Новая тема
        </Link>
      }
    >
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock label="Загружаем темы…" />
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Slug</th>
                <th>CEFR</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td><Link href={`/topics/${item.id}`}>{item.id}</Link></td>
                  <td>{item.title}</td>
                  <td>{item.slug}</td>
                  <td>{item.cefrLevels.join(', ')}</td>
                  <td><span className={`status-badge ${item.status}`}>{item.status}</span></td>
                  <td>{new Date(item.updatedAt).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
