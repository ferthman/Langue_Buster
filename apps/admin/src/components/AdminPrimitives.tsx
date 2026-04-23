'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import type { AdminAuditLogEntry, AdminQaFlag } from '@langue-buster/shared';
import type { GeneratedQuestion } from '@langue-buster/shared';

import { formatDateTime } from '../lib/forms';

export function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-header">
        <div>
          <h3>{title}</h3>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {actions ? <div className="row gap-8">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <div className="error-banner">{message}</div>;
}

export function LoadingBlock({ label = 'Загрузка…' }: { label?: string }) {
  return <div className="loading-block">{label}</div>;
}

export function PreviewCard({ question }: { question: GeneratedQuestion | null }) {
  if (!question) {
    return <div className="empty-panel">Сохраните карточку или импортируйте набор, чтобы увидеть превью.</div>;
  }

  return (
    <div className="preview-card">
      <p className="eyebrow">{question.cardType}</p>
      <h4>{question.promptText}</h4>
      <div className="preview-options">
        {question.options.map((option) => (
          <div key={option.id} className={option.isCorrect ? 'preview-option correct' : 'preview-option'}>
            <span>{option.label}</span>
            {option.isCorrect ? <strong>Верно</strong> : null}
          </div>
        ))}
      </div>
      <p className="muted">
        Уровень {question.cefrLevel} · Тема {question.meta.topicId} · {question.meta.distractorSource}
      </p>
    </div>
  );
}

export function QaFlagsPanel({
  flags,
  onResolve,
}: {
  flags: readonly AdminQaFlag[];
  onResolve: (flagId: string) => void;
}) {
  if (flags.length === 0) {
    return <div className="empty-panel">Флагов пока нет.</div>;
  }

  return (
    <div className="stack gap-12">
      {flags.map((flag) => (
        <div key={flag.id} className="list-row">
          <div>
            <strong>{flag.flagType}</strong>
            <p className="muted">{flag.note ?? 'Без заметки'}</p>
            <p className="meta-line">
              Создан {formatDateTime(flag.createdAt)} · {flag.createdByUserId}
            </p>
          </div>
          {flag.status === 'active' ? (
            <button type="button" className="secondary-button" onClick={() => onResolve(flag.id)}>
              Закрыть
            </button>
          ) : (
            <span className="status-badge archived">resolved</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function HistoryPanel({ entries }: { entries: readonly AdminAuditLogEntry[] }) {
  if (entries.length === 0) {
    return <div className="empty-panel">Изменений пока нет.</div>;
  }

  return (
    <div className="history-list">
      {entries.map((entry) => (
        <article key={entry.id} className="history-row">
          <div className="row space-between">
            <strong>{entry.actionType}</strong>
            <span className="meta-line">{formatDateTime(entry.occurredAt)}</span>
          </div>
          <p>{entry.summary}</p>
          <p className="meta-line">
            {entry.entityType}:{entry.entityId} · {entry.actorUserId}
          </p>
        </article>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  actionHref,
  actionLabel,
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="empty-panel">
      <h3>{title}</h3>
      <p className="muted">{message}</p>
      {actionHref && actionLabel ? (
        <Link className="primary-button" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
