'use client';

import { useEffect, useState } from 'react';

import { lessonSchema, type Lesson } from '@langue-buster/content-core';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';
import { splitCommaSeparated } from '../lib/forms';
import { ErrorBanner, HistoryPanel, LoadingBlock, QaFlagsPanel, SectionCard } from './AdminPrimitives';

type LessonFormState = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cefrLevel: string;
  topicIdsText: string;
  contentRefs: Array<{ itemId: string; order: string; cardType: string; notes: string }>;
  status: string;
};

const defaultForm: LessonFormState = {
  id: '',
  slug: '',
  title: '',
  description: '',
  cefrLevel: 'A1',
  topicIdsText: '',
  contentRefs: [{ itemId: '', order: '1', cardType: 'single_word', notes: '' }],
  status: 'draft',
};

export function LessonEditorScreen({ lessonId }: { lessonId: string }) {
  const { state } = useAdminSession();
  const [form, setForm] = useState<LessonFormState>(defaultForm);
  const [loading, setLoading] = useState(lessonId !== 'new');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminApi.getLesson>> | null>(null);

  useEffect(() => {
    if (state.status !== 'ready' || lessonId === 'new') {
      setLoading(false);
      return;
    }

    void adminApi
      .getLesson(state.token, lessonId)
      .then((response) => {
        const item = lessonSchema.parse(response.item);
        setDetail(response);
        setForm({
          id: item.id,
          slug: item.slug,
          title: item.title,
          description: item.description ?? '',
          cefrLevel: item.cefrLevel,
          topicIdsText: item.topicIds.join(', '),
          contentRefs: item.contentRefs.map((ref) => ({
            itemId: ref.itemId,
            order: String(ref.order),
            cardType: ref.cardType,
            notes: ref.notes ?? '',
          })),
          status: item.status,
        });
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить урок.'))
      .finally(() => setLoading(false));
  }, [state, lessonId]);

  async function saveWithStatus(status: Lesson['status']) {
    if (state.status !== 'ready') {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = lessonSchema.parse({
        id: form.id.trim(),
        slug: form.slug.trim(),
        title: form.title.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        cefrLevel: form.cefrLevel.trim(),
        topicIds: splitCommaSeparated(form.topicIdsText),
        contentRefs: form.contentRefs.map((ref) => ({
          itemId: ref.itemId.trim(),
          order: Number(ref.order),
          cardType: ref.cardType.trim(),
          ...(ref.notes.trim() ? { notes: ref.notes.trim() } : {}),
        })),
        status,
        editorialMetadata: {},
      });
      const response = await adminApi.saveLesson(state.token, { item: payload });
      const item = lessonSchema.parse(response.item);
      setDetail(response);
      setForm({
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description ?? '',
        cefrLevel: item.cefrLevel,
        topicIdsText: item.topicIds.join(', '),
        contentRefs: item.contentRefs.map((ref) => ({
          itemId: ref.itemId,
          order: String(ref.order),
          cardType: ref.cardType,
          notes: ref.notes ?? '',
        })),
        status: item.status,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить урок.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingBlock label="Загружаем урок…" />;
  }

  return (
    <div className="editor-layout single-column">
      <div className="stack gap-16">
        <SectionCard
          title={lessonId === 'new' ? 'Новый урок' : form.title || form.id}
          description="Topic refs и ordered content refs редактируются как отдельные строки, не как raw JSON."
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
            <label>
              CEFR
              <select value={form.cefrLevel} onChange={(event) => setForm((previous) => ({ ...previous, cefrLevel: event.target.value }))}>
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
              </select>
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
            <label className="full-span">
              Topic refs
              <input value={form.topicIdsText} onChange={(event) => setForm((previous) => ({ ...previous, topicIdsText: event.target.value }))} placeholder="topic_1, topic_2" />
            </label>
          </div>
          <div className="stack gap-12">
            <div className="row space-between">
              <strong>Ordered content refs</strong>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    contentRefs: [
                      ...previous.contentRefs,
                      { itemId: '', order: String(previous.contentRefs.length + 1), cardType: 'single_word', notes: '' },
                    ],
                  }))
                }
              >
                Добавить ref
              </button>
            </div>
            {form.contentRefs.map((ref, index) => (
              <div key={`${index}-${ref.itemId}`} className="content-ref-row">
                <input
                  value={ref.itemId}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      contentRefs: previous.contentRefs.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, itemId: event.target.value } : entry,
                      ),
                    }))
                  }
                  placeholder="item id"
                />
                <input
                  value={ref.order}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      contentRefs: previous.contentRefs.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, order: event.target.value } : entry,
                      ),
                    }))
                  }
                  placeholder="order"
                />
                <select
                  value={ref.cardType}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      contentRefs: previous.contentRefs.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, cardType: event.target.value } : entry,
                      ),
                    }))
                  }
                >
                  <option value="single_word">single_word</option>
                  <option value="phrase">phrase</option>
                  <option value="article_noun">article_noun</option>
                </select>
                <input
                  value={ref.notes}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      contentRefs: previous.contentRefs.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, notes: event.target.value } : entry,
                      ),
                    }))
                  }
                  placeholder="notes"
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      contentRefs:
                        previous.contentRefs.length === 1
                          ? previous.contentRefs
                          : previous.contentRefs.filter((_, entryIndex) => entryIndex !== index),
                    }))
                  }
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="QA Flags" description="Проблемы по уроку.">
          <QaFlagsPanel flags={detail?.qaFlags ?? []} onResolve={() => {}} />
        </SectionCard>
        <SectionCard title="История" description="История изменений урока.">
          <HistoryPanel entries={detail?.history ?? []} />
        </SectionCard>
      </div>
    </div>
  );
}
