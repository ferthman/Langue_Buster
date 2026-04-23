import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VocabListScreen } from './VocabListScreen';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock('../lib/auth', () => ({
  useAdminSession: () => ({
    state: {
      status: 'ready',
      token: 'token-1',
      session: {
        user: {
          id: 'user-1',
          telegramUserId: '999999',
          firstName: 'Mila',
        },
        session: {
          expiresAt: '2026-04-23T05:00:00.000Z',
        },
      },
    },
  }),
}));

const apiMocks = vi.hoisted(() => ({
  listVocabItems: vi.fn(),
  bulkUpdateVocabItems: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  adminApi: {
    listVocabItems: apiMocks.listVocabItems,
    bulkUpdateVocabItems: apiMocks.bulkUpdateVocabItems,
  },
}));

describe('VocabListScreen', () => {
  it('renders vocab rows and triggers a bulk update', async () => {
    const response = {
      items: [
        {
          id: 'bonjour',
          lemma: 'bonjour',
          surfaceForm: 'bonjour',
          cefrLevel: 'A1',
          topicId: 'topic_greetings',
          status: 'approved',
          frequencyScore: 10,
          updatedAt: '2026-04-23T00:00:00.000Z',
          openQaFlagCount: 1,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    apiMocks.listVocabItems.mockImplementation(() => Promise.resolve(response));
    apiMocks.bulkUpdateVocabItems.mockResolvedValue({
      updatedIds: ['bonjour'],
      skipped: [],
    });

    render(<VocabListScreen />);

    expect(await screen.findAllByText('bonjour')).toBeTruthy();
    await userEvent.click(screen.getByLabelText('select-bonjour'));
    await userEvent.selectOptions(screen.getByLabelText('bulk-status'), 'approved');
    await userEvent.click(screen.getByText('Применить к 1'));

    await waitFor(() => expect(apiMocks.bulkUpdateVocabItems).toHaveBeenCalled());
  });
});
