import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/vocab-items',
}));

describe('AppShell bootstrap', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows token prompt when there is no stored session token', async () => {
    render(
      <AppShell>
        <div>child</div>
      </AppShell>,
    );

    expect(await screen.findByText('Нужен токен редактора')).toBeTruthy();
  });

  it('restores a valid session token and renders shell content', async () => {
    window.localStorage.setItem('langue-buster.sessionToken', 'token-1');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(mockJsonResponse(200, {
          user: {
            id: 'user-1',
            telegramUserId: '999999',
            firstName: 'Mila',
            isPremium: false,
            createdAt: '2026-04-23T00:00:00.000Z',
            lastLoginAt: '2026-04-23T00:00:00.000Z',
          },
          session: {
            id: 'session-1',
            token: 'token-1',
            userId: 'user-1',
            issuedAt: '2026-04-23T00:00:00.000Z',
            expiresAt: '2026-04-23T05:00:00.000Z',
          },
        }))
        .mockResolvedValueOnce(mockJsonResponse(200, { entries: [] })),
    );

    render(
      <AppShell>
        <div>cms-child</div>
      </AppShell>,
    );

    await waitFor(() => expect(screen.getByText('cms-child')).toBeTruthy());
    expect(screen.getAllByText('Слова').length).toBeGreaterThan(0);
  });
});

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text() {
      return Promise.resolve(JSON.stringify(body));
    },
  } satisfies Partial<Response>;
}
