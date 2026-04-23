'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type {
  AdminBulkUpdateVocabItemsRequest,
  AdminVocabListQuery,
  AdminVocabListResponse,
} from '@langue-buster/shared';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';
import { ErrorBanner, LoadingBlock, SectionCard } from './AdminPrimitives';

const pageSize = 20;

export function VocabListScreen() {
  const { state } = useAdminSession();
  const [data, setData] = useState<AdminVocabListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState({
    search: '',
    levelId: '',
    topicId: '',
    status: '',
    sortBy: 'updatedAt',
    sortDirection: 'desc',
    page: 1,
  });
  const [bulkDraft, setBulkDraft] = useState<{
    status: string;
    topicId: string;
    levelId: string;
    archive: boolean;
  }>({
    status: '',
    topicId: '',
    levelId: '',
    archive: false,
  });
  const selectedIds = useMemo(
    () => Object.entries(selection).filter(([, selected]) => selected).map(([id]) => id),
    [selection],
  );

  useEffect(() => {
    if (state.status !== 'ready') {
      return;
    }

        setLoading(true);
    setError(null);
    void adminApi
      .listVocabItems(state.token, {
        search: query.search || undefined,
        levelId: (query.levelId || undefined) as AdminVocabListQuery['levelId'],
        topicId: query.topicId || undefined,
        status: (query.status || undefined) as AdminVocabListQuery['status'],
        sortBy: query.sortBy as 'updatedAt' | 'lemma' | 'frequencyScore' | 'status',
        sortDirection: query.sortDirection as 'asc' | 'desc',
        page: query.page,
        pageSize,
      })
      .then((response) => {
        setData(response);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить список.');
      })
      .finally(() => setLoading(false));
  }, [query, state]);

  async function applyBulkUpdate() {
    if (state.status !== 'ready' || selectedIds.length === 0) {
      return;
    }

    setError(null);
    const payload: AdminBulkUpdateVocabItemsRequest = {
      ids: selectedIds,
      ...(bulkDraft.status ? { status: bulkDraft.status as AdminBulkUpdateVocabItemsRequest['status'] } : {}),
      ...(bulkDraft.topicId ? { topicId: bulkDraft.topicId } : {}),
      ...(bulkDraft.levelId ? { levelId: bulkDraft.levelId as AdminBulkUpdateVocabItemsRequest['levelId'] } : {}),
      ...(bulkDraft.archive ? { archive: true } : {}),
    };

    try {
      await adminApi.bulkUpdateVocabItems(state.token, payload);
      setSelection({});
      setBulkDraft({ status: '', topicId: '', levelId: '', archive: false });
      const refreshed = await adminApi.listVocabItems(state.token, {
        search: query.search || undefined,
        levelId: (query.levelId || undefined) as AdminVocabListQuery['levelId'],
        topicId: query.topicId || undefined,
        status: (query.status || undefined) as AdminVocabListQuery['status'],
        sortBy: query.sortBy as 'updatedAt' | 'lemma' | 'frequencyScore' | 'status',
        sortDirection: query.sortDirection as 'asc' | 'desc',
        page: query.page,
        pageSize,
      });
      setData(refreshed);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось применить bulk update.');
    }
  }

  return (
    <div className="stack gap-16">
      <SectionCard
        title="Словарь"
        description="Поиск, фильтры, статусы, QA-флаги и массовые правки."
        actions={
          <Link className="primary-button" href="/vocab-items/new">
            Новое слово
          </Link>
        }
      >
        <div className="filters-grid">
          <input
            value={query.search}
            onChange={(event) => setQuery((previous) => ({ ...previous, search: event.target.value, page: 1 }))}
            placeholder="Поиск по lemma / surface / id"
          />
          <select value={query.levelId} onChange={(event) => setQuery((previous) => ({ ...previous, levelId: event.target.value, page: 1 }))}>
            <option value="">Все уровни</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
          <input
            value={query.topicId}
            onChange={(event) => setQuery((previous) => ({ ...previous, topicId: event.target.value, page: 1 }))}
            placeholder="topic id"
          />
          <select value={query.status} onChange={(event) => setQuery((previous) => ({ ...previous, status: event.target.value, page: 1 }))}>
            <option value="">Все статусы</option>
            <option value="draft">draft</option>
            <option value="on_review">on_review</option>
            <option value="approved">approved</option>
            <option value="archived">archived</option>
          </select>
          <select value={query.sortBy} onChange={(event) => setQuery((previous) => ({ ...previous, sortBy: event.target.value }))}>
            <option value="updatedAt">updatedAt</option>
            <option value="lemma">lemma</option>
            <option value="frequencyScore">frequencyScore</option>
            <option value="status">status</option>
          </select>
          <select value={query.sortDirection} onChange={(event) => setQuery((previous) => ({ ...previous, sortDirection: event.target.value }))}>
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Bulk Edit" description="Минимальный batch workflow для смены статуса, темы и уровня.">
        <div className="filters-grid">
          <select aria-label="bulk-status" value={bulkDraft.status} onChange={(event) => setBulkDraft((previous) => ({ ...previous, status: event.target.value, archive: false }))}>
            <option value="">Статус без изменения</option>
            <option value="draft">draft</option>
            <option value="on_review">on_review</option>
            <option value="approved">approved</option>
            <option value="archived">archived</option>
          </select>
          <input aria-label="bulk-topic" value={bulkDraft.topicId} onChange={(event) => setBulkDraft((previous) => ({ ...previous, topicId: event.target.value }))} placeholder="Новый topic id" />
          <select aria-label="bulk-level" value={bulkDraft.levelId} onChange={(event) => setBulkDraft((previous) => ({ ...previous, levelId: event.target.value }))}>
            <option value="">Уровень без изменения</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={bulkDraft.archive}
              onChange={(event) => setBulkDraft((previous) => ({ ...previous, archive: event.target.checked, status: event.target.checked ? '' : previous.status }))}
            />
            Архивировать выбранное
          </label>
          <button type="button" className="primary-button" disabled={selectedIds.length === 0} onClick={() => void applyBulkUpdate()}>
            Применить к {selectedIds.length}
          </button>
        </div>
      </SectionCard>

      <ErrorBanner message={error} />

      <SectionCard
        title="Список слов"
        description={data ? `Всего записей: ${data.total}` : 'Пагинация и редакционный статус.'}
      >
        {loading ? (
          <LoadingBlock label="Загружаем словарь…" />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th />
                    <th>ID</th>
                    <th>Lemma</th>
                    <th>Surface</th>
                    <th>Level</th>
                    <th>Topic</th>
                    <th>Status</th>
                    <th>Freq</th>
                    <th>QA</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          aria-label={`select-${item.id}`}
                          type="checkbox"
                          checked={selection[item.id] ?? false}
                          onChange={(event) =>
                            setSelection((previous) => ({
                              ...previous,
                              [item.id]: event.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <Link href={`/vocab-items/${item.id}`}>{item.id}</Link>
                      </td>
                      <td>{item.lemma}</td>
                      <td>{item.surfaceForm}</td>
                      <td>{item.cefrLevel}</td>
                      <td>{item.topicId}</td>
                      <td><span className={`status-badge ${item.status}`}>{item.status}</span></td>
                      <td>{item.frequencyScore}</td>
                      <td>{item.openQaFlagCount}</td>
                      <td>{new Date(item.updatedAt).toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row space-between">
              <button
                type="button"
                className="secondary-button"
                disabled={query.page <= 1}
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page - 1 }))}
              >
                Назад
              </button>
              <span className="meta-line">Страница {query.page}</span>
              <button
                type="button"
                className="secondary-button"
                disabled={!data || query.page * pageSize >= data.total}
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page + 1 }))}
              >
                Далее
              </button>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
