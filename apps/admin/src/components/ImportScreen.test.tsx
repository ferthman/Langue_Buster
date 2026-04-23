import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ImportScreen } from './ImportScreen';

vi.mock('../lib/auth', () => ({
  useAdminSession: () => ({
    state: {
      status: 'ready',
      token: 'token-1',
      session: {
        user: { id: 'user-1', telegramUserId: '999999', firstName: 'Mila' },
        session: { expiresAt: '2026-04-23T05:00:00.000Z' },
      },
    },
  }),
}));

const apiMocks = vi.hoisted(() => ({
  validateImport: vi.fn(),
  applyImport: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  adminApi: {
    validateImport: apiMocks.validateImport,
    applyImport: apiMocks.applyImport,
  },
}));

describe('ImportScreen', () => {
  it('renders validation issues for broken import bundles', async () => {
    apiMocks.validateImport.mockResolvedValue({
      success: false,
      issues: [{ path: 'vocabItems.0.translationRu', message: 'Required' }],
    });
    apiMocks.applyImport.mockResolvedValue({
      counts: { levels: 0, topics: 0, lessons: 0, vocabItems: 0, distractorSets: 0 },
    });

    render(<ImportScreen />);

    fireEvent.change(screen.getByPlaceholderText('Вставьте editorialImportBundle JSON'), {
      target: { value: '{"bad":true}' },
    });
    await userEvent.click(screen.getByText('Validate'));

    await waitFor(() => expect(screen.getByText('vocabItems.0.translationRu')).toBeTruthy());
  });
});
