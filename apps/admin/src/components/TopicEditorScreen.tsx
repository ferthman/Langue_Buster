'use client';

import { useEffect, useState } from 'react';

import { topicSchema, type Topic } from '@langue-buster/content-core';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';
import { HistoryPanel, ErrorBanner, LoadingBlock, QaFlagsPanel, SectionCard } from './AdminPrimitives';

type TopicFormState = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cefrLevels: string[];
  parentTopicId: string;
  status: string;
};

const defaultForm: TopicFormState = {
  id: '',
  slug: '',
  title: '',
  description: '',
  cefrLevels: ['A1'],
  parentTopicId: '',
  status: 'draft',
};

export function TopicEditorScreen({ topicId }: { topicId: string }) {
  const { state } = useAdminSession();
  const [form, setForm] = useState<TopicFormState>(defaultForm);
  const [loading, setLoading] = useState(topicId !== 'new');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminApi.getTopic>> | null>(null);

  useEffect(() => {
    if (state.status !== 'ready' || topicId === 'new') {
      setLoading(false);
      return;
    }

    void adminApi
      .getTopic(state.token, topicId)
      .then((response) => {
        const item = topicSchema.parse(response.item);
        setDetail(response);
        setForm({
          id: item.id,
          slug: item.slug,
          title: item.title,
          description: item.description ?? '',
          cefrLevels: item.cefrLevels,
          parentTopicId: item.parentTopicId ?? '',
          status: item.status,
        });
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить тему.'))
      .finally(() => setLoading(false));
  }, [state, topicId]);

  async function saveWithStatus(status: Topic['status']) {
    if (state.status !== 'ready') {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = topicSchema.parse({
        id: form.id.trim(),
        slug: form.slug.trim(),
        title: form.title.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        cefrLevels: form.cefrLevels,
        ...(form.parentTopicId.trim() ? { parentTopicId: form.parentTopicId.trim() } : {}),
        status,
        editorialMetadata: {},
      });
      const response = await adminApi.saveTopic(state.token, { item: payload });
      const item = topicSchema.parse(response.item);
      setDetail(response);
      setForm({
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description ?? '',
        cefrLevels: item.cefrLevels,
        parentTopicId: item.parentTopicId ?? '',
        status: item.status,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить тему.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingBlock label="Загружаем тему…" />;
  }

  return (
    <div className="editor-layout single-column">
      <div className="stack gap-16">
        <SectionCard
          title={topicId === 'new' ? 'Новая тема' : form.title || form.id}
          description="Slug, CEFR, parent topic и workflow-статус."
          actions={
            <div className="row gap-8 wrap">
              <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveWithStatus('draft')}>Draft</button>
              <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveWithStatus('on_review')}>On review</button>
              <button type="button" className="primary-button" disabled={saving} onClick={() => void saveWithStatus('approved')}>Approve</button>
              <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveWithStatus('archived')}>Archive</button>
            </div>
          }
        >
          <ErrorBanner message={error} />
          <div className="editor-grid">
            <label>
              ID
              <input value={form.id} onChange={(event) => setForm((previous) => ({ ...previous, id: event.target.value }))} />
            </label>
            <label>
              Slug
              <input value={form.slug} onChange={(event) => setForm((previous) => ({ ...previous, slug: event.target.value }))} />
            </label>
            <label className="full-span">
              Title
              <input value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
            </label>
            <label className="full-span">
              Description
              <textarea rows={4} value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} />
            </label>
            <div className="full-span stack gap-8">
              <span className="field-label">CEFR levels</span>
              <div className="row gap-8 wrap">
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => (
                  <label key={level} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.cefrLevels.includes(level)}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          cefrLevels: event.target.checked
                            ? Array.from(new Set([...previous.cefrLevels, level]))
                            : previous.cefrLevels.filter((entry) => entry !== level),
                        }))
                      }
                    />
                    {level}
                  </label>
                ))}
              </div>
            </div>
            <label>
              Parent topic
              <input value={form.parentTopicId} onChange={(event) => setForm((previous) => ({ ...previous, parentTopicId: event.target.value }))} />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}>
                <option value="draft">draft</option>
                <option value="on_review">on_review</option>
                <option value="approved">approved</option>
                <option value="archived">archived</option>
              </select>
            </label>
          </div>
        </SectionCard>
        <SectionCard title="QA Flags" description="Редакторские замечания по теме.">
          <QaFlagsPanel flags={detail?.qaFlags ?? []} onResolve={() => {}} />
        </SectionCard>
        <SectionCard title="История" description="Минимальный audit trail.">
          <HistoryPanel entries={detail?.history ?? []} />
        </SectionCard>
      </div>
    </div>
  );
}
