'use client';

import { useCallback, useEffect, useState } from 'react';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';
import { HistoryPanel, ErrorBanner, LoadingBlock, SectionCard } from './AdminPrimitives';
import type { AdminHistoryQuery } from '@langue-buster/shared';

export function HistoryScreen() {
  const { state } = useAdminSession();
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [limit, setLimit] = useState('50');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof adminApi.getHistory>>['entries']>([]);

  const loadEntries = useCallback(async () => {
    if (state.status !== 'ready') {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.getHistory(state.token, {
        entityType: (entityType || undefined) as AdminHistoryQuery['entityType'],
        entityId: entityId || undefined,
        limit: Number(limit) || 50,
      });
      setEntries(response.entries);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить историю.');
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, limit, state]);

  useEffect(() => {
    if (state.status !== 'ready') {
      return;
    }

    void loadEntries();
  }, [loadEntries, state]);

  return (
    <div className="stack gap-16">
      <SectionCard title="Change History" description="Минимальный audit log по сущностям и операциям.">
        <div className="filters-grid">
          <select value={entityType} onChange={(event) => setEntityType(event.target.value)}>
            <option value="">Все сущности</option>
            <option value="vocab_item">vocab_item</option>
            <option value="topic">topic</option>
            <option value="lesson">lesson</option>
            <option value="level">level</option>
          </select>
          <input value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder="entity id" />
          <input value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="limit" />
          <button type="button" className="primary-button" onClick={() => void loadEntries()}>
            Обновить
          </button>
        </div>
        <ErrorBanner message={error} />
        {loading ? <LoadingBlock label="Загружаем историю…" /> : <HistoryPanel entries={entries} />}
      </SectionCard>
    </div>
  );
}
