'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { AdminSessionProvider, useAdminSession } from '../lib/auth';

const navigationItems = [
  { href: '/vocab-items', label: 'Слова' },
  { href: '/topics', label: 'Темы' },
  { href: '/lessons', label: 'Уроки' },
  { href: '/import', label: 'Импорт' },
  { href: '/history', label: 'История' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AdminSessionProvider>
      <ShellFrame>{children}</ShellFrame>
    </AdminSessionProvider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useAdminSession();
  const state = session.state;
  const [tokenDraft, setTokenDraft] = useState('');

  if (state.status === 'loading') {
    return <FullScreenState title="Открываем CMS" message="Проверяем сессию и доступ редактора." />;
  }

  if (state.status === 'needs_token') {
    return (
      <FullScreenState
        title="Нужен токен редактора"
        message={state.message ?? 'Вставьте токен существующей Mini App-сессии.'}
      >
        <div className="auth-card">
          <textarea
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            placeholder="Bearer token"
            rows={6}
          />
          <button type="button" className="primary-button" onClick={() => void session.submitToken(tokenDraft)}>
            Подключить CMS
          </button>
        </div>
      </FullScreenState>
    );
  }

  if (state.status === 'unauthorized') {
    return (
      <FullScreenState title="Доступ запрещён" message={state.message}>
        <button type="button" className="secondary-button" onClick={() => session.logout()}>
          Очистить токен
        </button>
      </FullScreenState>
    );
  }

  if (state.status === 'error') {
    return (
      <FullScreenState title="CMS недоступна" message={state.message}>
        <div className="row gap-12">
            <button type="button" className="primary-button" onClick={() => void session.retry()}>
              Повторить
            </button>
            <button type="button" className="secondary-button" onClick={() => session.logout()}>
              Очистить токен
            </button>
        </div>
      </FullScreenState>
    );
  }

  return (
    <div className="shell-root">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Langue Buster</p>
          <h1>Admin CMS</h1>
          <p className="muted">Редакционный контур v1</p>
        </div>
        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname?.startsWith(item.href) ? 'nav-link active' : 'nav-link'}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="muted">
            {state.session.user.firstName} · {state.session.user.telegramUserId}
          </p>
          <button type="button" className="secondary-button" onClick={() => session.logout()}>
            Сменить токен
          </button>
        </div>
      </aside>
      <main className="content-area">
        <header className="page-header">
          <div>
            <p className="eyebrow">Редактор</p>
            <h2>{navigationItems.find((item) => pathname?.startsWith(item.href))?.label ?? 'CMS'}</h2>
          </div>
          <div className="header-pill">
            Сессия до {new Date(state.session.session.expiresAt).toLocaleString('ru-RU')}
          </div>
        </header>
        <section className="page-content">{children}</section>
      </main>
    </div>
  );
}

function FullScreenState({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <main className="fullscreen-state">
      <div className="state-card">
        <p className="eyebrow">Admin CMS</p>
        <h1>{title}</h1>
        <p className="muted">{message}</p>
        {children}
      </div>
    </main>
  );
}
