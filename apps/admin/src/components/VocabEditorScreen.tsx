'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { vocabItemSchema, type VocabItem } from '@langue-buster/content-core';
import type { AdminQaFlagType, GeneratedQuestion } from '@langue-buster/shared';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';
import { splitCommaSeparated, splitExampleLines, splitKeyValueLines } from '../lib/forms';
import {
  ErrorBanner,
  HistoryPanel,
  LoadingBlock,
  PreviewCard,
  QaFlagsPanel,
  SectionCard,
} from './AdminPrimitives';

type VocabFormState = {
  id: string;
  language: string;
  itemType: string;
  partOfSpeech: string;
  cefrLevel: string;
  lemma: string;
  surfaceForm: string;
  article: string;
  gender: string;
  register: string;
  translationRu: string;
  translationEn: string;
  translationsText: string;
  topicId: string;
  subtopic: string;
  tagsText: string;
  exampleFr: string;
  exampleRu: string;
  extraExamplesText: string;
  distractorSetId: string;
  sourceLabel: string;
  sourceKind: string;
  sourceReferenceUrl: string;
  sourceCitation: string;
  frequencyScore: string;
  status: string;
  editorNotes: string;
};

const defaultForm: VocabFormState = {
  id: '',
  language: 'fr',
  itemType: 'word',
  partOfSpeech: 'noun',
  cefrLevel: 'A1',
  lemma: '',
  surfaceForm: '',
  article: '',
  gender: '',
  register: '',
  translationRu: '',
  translationEn: '',
  translationsText: '',
  topicId: '',
  subtopic: '',
  tagsText: '',
  exampleFr: '',
  exampleRu: '',
  extraExamplesText: '',
  distractorSetId: '',
  sourceLabel: '',
  sourceKind: 'editorial',
  sourceReferenceUrl: '',
  sourceCitation: '',
  frequencyScore: '0',
  status: 'draft',
  editorNotes: '',
};

export function VocabEditorScreen({ vocabItemId }: { vocabItemId: string }) {
  const { state } = useAdminSession();
  const [form, setForm] = useState<VocabFormState>(defaultForm);
  const [loading, setLoading] = useState(vocabItemId !== 'new');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedQuestion | null>(null);
  const [qaType, setQaType] = useState<AdminQaFlagType>('needs_review');
  const [qaNote, setQaNote] = useState('');
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminApi.getVocabItem>> | null>(null);

  const canPreview = useMemo(() => form.id.trim().length > 0 && vocabItemId !== 'new', [form.id, vocabItemId]);

  const loadDetail = useCallback(async () => {
    if (state.status !== 'ready' || vocabItemId === 'new') {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.getVocabItem(state.token, vocabItemId);
      const item = vocabItemSchema.parse(response.item);
      setDetail(response);
      setForm(toFormState(item));

      try {
        const previewResponse = await adminApi.previewVocabItem(state.token, vocabItemId);
        setPreview(previewResponse.question);
      } catch {
        setPreview(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить запись.');
    } finally {
      setLoading(false);
    }
  }, [state, vocabItemId]);

  useEffect(() => {
    if (state.status !== 'ready' || vocabItemId === 'new') {
      setLoading(false);
      return;
    }

    void loadDetail();
  }, [loadDetail, state, vocabItemId]);

  async function saveWithStatus(status: VocabItem['status']) {
    if (state.status !== 'ready') {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = toVocabItem(form, status);
      const response = await adminApi.saveVocabItem(state.token, {
        item: payload,
      });
      const savedItem = vocabItemSchema.parse(response.item);
      setDetail(response);
      setForm(toFormState(savedItem));
      if (savedItem.id) {
        try {
          const previewResponse = await adminApi.previewVocabItem(state.token, savedItem.id);
          setPreview(previewResponse.question);
        } catch {
          setPreview(null);
        }
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить слово.');
    } finally {
      setSaving(false);
    }
  }

  async function addQaFlag() {
    if (state.status !== 'ready' || !form.id.trim()) {
      return;
    }

    try {
      await adminApi.createQaFlag(state.token, {
        entityType: 'vocab_item',
        entityId: form.id.trim(),
        flagType: qaType,
        note: qaNote.trim() || undefined,
      });
      setQaNote('');
      await loadDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось добавить QA-флаг.');
    }
  }

  async function resolveQaFlag(flagId: string) {
    if (state.status !== 'ready') {
      return;
    }

    try {
      await adminApi.resolveQaFlag(state.token, flagId);
      await loadDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось закрыть QA-флаг.');
    }
  }

  if (loading) {
    return <LoadingBlock label="Загружаем карточку слова…" />;
  }

  return (
    <div className="editor-layout">
      <div className="stack gap-16">
        <SectionCard
          title={vocabItemId === 'new' ? 'Новое слово' : form.lemma || form.id}
          description="Редактирование словарной карточки через реальные content-core схемы и backend validation."
          actions={
            <div className="row gap-8 wrap">
              <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveWithStatus('draft')}>
                Сохранить draft
              </button>
              <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveWithStatus('on_review')}>
                На review
              </button>
              <button type="button" className="primary-button" disabled={saving} onClick={() => void saveWithStatus('approved')}>
                Approve
              </button>
              <button type="button" className="secondary-button" disabled={saving} onClick={() => void saveWithStatus('archived')}>
                Archive
              </button>
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
              Language
              <input value={form.language} onChange={(event) => setForm((previous) => ({ ...previous, language: event.target.value }))} />
            </label>
            <label>
              Item Type
              <select value={form.itemType} onChange={(event) => setForm((previous) => ({ ...previous, itemType: event.target.value }))}>
                <option value="word">word</option>
                <option value="phrase">phrase</option>
                <option value="article_noun">article_noun</option>
              </select>
            </label>
            <label>
              Part of Speech
              <select value={form.partOfSpeech} onChange={(event) => setForm((previous) => ({ ...previous, partOfSpeech: event.target.value }))}>
                <option value="noun">noun</option>
                <option value="verb">verb</option>
                <option value="adjective">adjective</option>
                <option value="adverb">adverb</option>
                <option value="pronoun">pronoun</option>
                <option value="preposition">preposition</option>
                <option value="conjunction">conjunction</option>
                <option value="determiner">determiner</option>
                <option value="interjection">interjection</option>
                <option value="expression">expression</option>
              </select>
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
            <label>
              Lemma
              <input value={form.lemma} onChange={(event) => setForm((previous) => ({ ...previous, lemma: event.target.value }))} />
            </label>
            <label>
              Surface Form
              <input value={form.surfaceForm} onChange={(event) => setForm((previous) => ({ ...previous, surfaceForm: event.target.value }))} />
            </label>
            <label>
              Article
              <input value={form.article} onChange={(event) => setForm((previous) => ({ ...previous, article: event.target.value }))} />
            </label>
            <label>
              Gender
              <select value={form.gender} onChange={(event) => setForm((previous) => ({ ...previous, gender: event.target.value }))}>
                <option value="">—</option>
                <option value="masculine">masculine</option>
                <option value="feminine">feminine</option>
              </select>
            </label>
            <label>
              Register
              <input value={form.register} onChange={(event) => setForm((previous) => ({ ...previous, register: event.target.value }))} />
            </label>
            <label>
              Frequency Score
              <input value={form.frequencyScore} onChange={(event) => setForm((previous) => ({ ...previous, frequencyScore: event.target.value }))} />
            </label>
            <label>
              Topic ID
              <input value={form.topicId} onChange={(event) => setForm((previous) => ({ ...previous, topicId: event.target.value }))} />
            </label>
            <label>
              Subtopic
              <input value={form.subtopic} onChange={(event) => setForm((previous) => ({ ...previous, subtopic: event.target.value }))} />
            </label>
            <label>
              Distractor Set
              <input value={form.distractorSetId} onChange={(event) => setForm((previous) => ({ ...previous, distractorSetId: event.target.value }))} />
            </label>
            <label className="full-span">
              Translation RU
              <input value={form.translationRu} onChange={(event) => setForm((previous) => ({ ...previous, translationRu: event.target.value }))} />
            </label>
            <label className="full-span">
              Translation EN
              <input value={form.translationEn} onChange={(event) => setForm((previous) => ({ ...previous, translationEn: event.target.value }))} />
            </label>
            <label className="full-span">
              Extra translations
              <textarea
                rows={4}
                value={form.translationsText}
                onChange={(event) => setForm((previous) => ({ ...previous, translationsText: event.target.value }))}
                placeholder="fr: bonjour&#10;ru: приветствие"
              />
            </label>
            <label className="full-span">
              Example sentence FR
              <textarea rows={2} value={form.exampleFr} onChange={(event) => setForm((previous) => ({ ...previous, exampleFr: event.target.value }))} />
            </label>
            <label className="full-span">
              Example sentence RU
              <textarea rows={2} value={form.exampleRu} onChange={(event) => setForm((previous) => ({ ...previous, exampleRu: event.target.value }))} />
            </label>
            <label className="full-span">
              Extra examples
              <textarea
                rows={4}
                value={form.extraExamplesText}
                onChange={(event) => setForm((previous) => ({ ...previous, extraExamplesText: event.target.value }))}
                placeholder="Je dis bonjour. | Я говорю bonjour."
              />
            </label>
            <label className="full-span">
              Tags
              <input value={form.tagsText} onChange={(event) => setForm((previous) => ({ ...previous, tagsText: event.target.value }))} placeholder="greeting, basics" />
            </label>
            <label>
              Source label
              <input value={form.sourceLabel} onChange={(event) => setForm((previous) => ({ ...previous, sourceLabel: event.target.value }))} />
            </label>
            <label>
              Source kind
              <select value={form.sourceKind} onChange={(event) => setForm((previous) => ({ ...previous, sourceKind: event.target.value }))}>
                <option value="editorial">editorial</option>
                <option value="pedagogical">pedagogical</option>
                <option value="exam_reference">exam_reference</option>
                <option value="frequency_lexicon">frequency_lexicon</option>
                <option value="internal">internal</option>
              </select>
            </label>
            <label className="full-span">
              Source reference URL
              <input value={form.sourceReferenceUrl} onChange={(event) => setForm((previous) => ({ ...previous, sourceReferenceUrl: event.target.value }))} />
            </label>
            <label className="full-span">
              Source citation
              <textarea rows={2} value={form.sourceCitation} onChange={(event) => setForm((previous) => ({ ...previous, sourceCitation: event.target.value }))} />
            </label>
            <label className="full-span">
              Editorial notes
              <textarea rows={5} value={form.editorNotes} onChange={(event) => setForm((previous) => ({ ...previous, editorNotes: event.target.value }))} />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="QA Flags" description="Проблемные карточки отмечаются и остаются аудируемыми.">
          <div className="row gap-8 wrap">
            <select value={qaType} onChange={(event) => setQaType(event.target.value as AdminQaFlagType)}>
              <option value="ambiguous">ambiguous</option>
              <option value="broken_distractors">broken_distractors</option>
              <option value="wrong_translation">wrong_translation</option>
              <option value="invalid_grammar">invalid_grammar</option>
              <option value="needs_review">needs_review</option>
            </select>
            <input value={qaNote} onChange={(event) => setQaNote(event.target.value)} placeholder="Заметка редактора" />
            <button type="button" className="secondary-button" disabled={!form.id.trim()} onClick={() => void addQaFlag()}>
              Добавить флаг
            </button>
          </div>
          <QaFlagsPanel flags={detail?.qaFlags ?? []} onResolve={(flagId) => void resolveQaFlag(flagId)} />
        </SectionCard>

        <SectionCard title="История" description="Аудит действий по карточке.">
          <HistoryPanel entries={detail?.history ?? []} />
        </SectionCard>
      </div>

      <div className="stack gap-16">
        <SectionCard title="Превью карточки" description="Backend preview через реальную question-generation цепочку.">
          {canPreview ? <PreviewCard question={preview} /> : <div className="empty-panel">Сначала сохраните карточку, чтобы открыть превью.</div>}
        </SectionCard>
        <SectionCard title="Validation" description="Проблемы текущей сущности из server-side проверки publish workflow.">
          {(detail?.validationIssues.length ?? 0) === 0 ? (
            <div className="empty-panel">Проблем для текущей версии не найдено.</div>
          ) : (
            <div className="stack gap-8">
              {detail?.validationIssues.map((issue) => (
                <div key={`${issue.path}-${issue.message}`} className="issue-row">
                  <strong>{issue.path}</strong>
                  <p>{issue.message}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function toFormState(item: VocabItem): VocabFormState {
  return {
    id: item.id,
    language: item.language,
    itemType: item.itemType,
    partOfSpeech: item.partOfSpeech,
    cefrLevel: item.cefrLevel,
    lemma: item.lemma,
    surfaceForm: item.surfaceForm,
    article: item.article ?? '',
    gender: item.gender ?? '',
    register: item.register ?? '',
    translationRu: item.translationRu,
    translationEn: item.translationEn ?? '',
    translationsText: item.translations.map((entry) => `${entry.language}: ${entry.value}`).join('\n'),
    topicId: item.topicId,
    subtopic: item.subtopic ?? '',
    tagsText: item.tags.join(', '),
    exampleFr: item.exampleSentence.fr,
    exampleRu: item.exampleSentence.ru,
    extraExamplesText: item.exampleSentences.map((entry) => `${entry.fr} | ${entry.ru}`).join('\n'),
    distractorSetId: item.distractorSetId ?? '',
    sourceLabel: item.source.label,
    sourceKind: item.source.kind,
    sourceReferenceUrl: item.source.referenceUrl ?? '',
    sourceCitation: item.source.citation ?? '',
    frequencyScore: String(item.frequencyScore),
    status: item.status,
    editorNotes: item.editorNotes ?? '',
  };
}

function toVocabItem(form: VocabFormState, status: VocabItem['status']): VocabItem {
  return vocabItemSchema.parse({
    id: form.id.trim(),
    language: form.language.trim(),
    itemType: form.itemType.trim(),
    partOfSpeech: form.partOfSpeech.trim(),
    cefrLevel: form.cefrLevel.trim(),
    lemma: form.lemma.trim(),
    surfaceForm: form.surfaceForm.trim(),
    ...(form.article.trim() ? { article: form.article.trim() } : {}),
    ...(form.gender.trim() ? { gender: form.gender.trim() } : {}),
    ...(form.register.trim() ? { register: form.register.trim() } : {}),
    translationRu: form.translationRu.trim(),
    ...(form.translationEn.trim() ? { translationEn: form.translationEn.trim() } : {}),
    translations: splitKeyValueLines(form.translationsText).map((entry) => ({
      language: entry.key,
      value: entry.text,
    })),
    topicId: form.topicId.trim(),
    ...(form.subtopic.trim() ? { subtopic: form.subtopic.trim() } : {}),
    tags: splitCommaSeparated(form.tagsText),
    exampleSentence: {
      fr: form.exampleFr.trim(),
      ru: form.exampleRu.trim(),
    },
    exampleSentences: splitExampleLines(form.extraExamplesText),
    ...(form.distractorSetId.trim() ? { distractorSetId: form.distractorSetId.trim() } : {}),
    distractorHints: [],
    source: {
      label: form.sourceLabel.trim(),
      kind: form.sourceKind.trim(),
      ...(form.sourceReferenceUrl.trim() ? { referenceUrl: form.sourceReferenceUrl.trim() } : {}),
      ...(form.sourceCitation.trim() ? { citation: form.sourceCitation.trim() } : {}),
    },
    frequencyScore: Number(form.frequencyScore) || 0,
    status,
    ...(form.editorNotes.trim() ? { editorNotes: form.editorNotes.trim() } : {}),
    editorialMetadata: {},
  });
}
