'use client';

import { useState } from 'react';

import { adminApi } from '../lib/api';
import { useAdminSession } from '../lib/auth';
import { ErrorBanner, SectionCard } from './AdminPrimitives';

export function ImportScreen() {
  const { state } = useAdminSession();
  const [bundleText, setBundleText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof adminApi.validateImport>> | null>(null);
  const [applyResult, setApplyResult] = useState<Awaited<ReturnType<typeof adminApi.applyImport>> | null>(null);

  async function validateBundle() {
    if (state.status !== 'ready') {
      return;
    }

    setError(null);
    setApplyResult(null);
    try {
      const parsedBundle = JSON.parse(bundleText) as unknown;
      const response = await adminApi.validateImport(state.token, { bundle: parsedBundle });
      setValidation(response);
    } catch (requestError) {
      setValidation(null);
      setError(requestError instanceof Error ? requestError.message : 'Не удалось проверить импорт.');
    }
  }

  async function applyBundle() {
    if (state.status !== 'ready') {
      return;
    }

    setError(null);
    try {
      const parsedBundle = JSON.parse(bundleText) as unknown;
      const response = await adminApi.applyImport(state.token, { bundle: parsedBundle });
      setApplyResult(response);
    } catch (requestError) {
      setApplyResult(null);
      setError(requestError instanceof Error ? requestError.message : 'Не удалось применить импорт.');
    }
  }

  return (
    <div className="stack gap-16">
      <SectionCard title="Bulk Import" description="Сначала validate, потом transactional apply. Broken bundle не должен пройти молча.">
        <ErrorBanner message={error} />
        <div className="stack gap-12">
          <textarea
            rows={22}
            value={bundleText}
            onChange={(event) => setBundleText(event.target.value)}
            placeholder="Вставьте editorialImportBundle JSON"
          />
          <div className="row gap-8">
            <button type="button" className="secondary-button" onClick={() => void validateBundle()}>
              Validate
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!validation || validation.success === false}
              onClick={() => void applyBundle()}
            >
              Apply
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Validation Result" description="Ошибки bundle format и связей должны быть явными.">
        {!validation ? (
          <div className="empty-panel">Сначала выполните validate.</div>
        ) : validation.success ? (
          <div className="success-panel">
            Bundle валиден. Можно применять импорт.
          </div>
        ) : (
          <div className="stack gap-8">
            {validation.issues.map((issue) => (
              <div key={`${issue.path}-${issue.message}`} className="issue-row">
                <strong>{issue.path}</strong>
                <p>{issue.message}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Apply Result" description="Сводка по реально записанным сущностям.">
        {!applyResult ? (
          <div className="empty-panel">Импорт ещё не применялся.</div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card"><strong>{applyResult.counts.levels}</strong><span>Levels</span></div>
            <div className="stat-card"><strong>{applyResult.counts.topics}</strong><span>Topics</span></div>
            <div className="stat-card"><strong>{applyResult.counts.lessons}</strong><span>Lessons</span></div>
            <div className="stat-card"><strong>{applyResult.counts.vocabItems}</strong><span>Vocab</span></div>
            <div className="stat-card"><strong>{applyResult.counts.distractorSets}</strong><span>Distractors</span></div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
