'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';
import { ErrorBanner, LoadingBlock, SectionCard } from './AdminPrimitives';

export function LessonListScreen() {
  const { state } = useAdminSession();
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.listLessons>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== 'ready') {
      return;
    }

    void adminApi
      .listLessons(state.token)
      .then((response) => setData(response))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить уроки.'))
      .finally(() => setLoading(false));
  }, [state]);

  return (
    <SectionCard
      title="Уроки"
      description="Lesson editor с topic refs и ordered content refs."
      actions={
        <Link className="primary-button" href="/lessons/new">
          Новый урок
        </Link>
      }
    >
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock label="Загружаем уроки…" />
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>CEFR</th>
                <th>Topics</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td><Link href={`/lessons/${item.id}`}>{item.id}</Link></td>
                  <td>{item.title}</td>
                  <td>{item.cefrLevel}</td>
                  <td>{item.topicIds.join(', ')}</td>
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
