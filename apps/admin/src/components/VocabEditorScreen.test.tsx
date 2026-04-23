import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VocabEditorScreen } from './VocabEditorScreen';

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
  getVocabItem: vi.fn(),
  previewVocabItem: vi.fn(),
  saveVocabItem: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  adminApi: {
    getVocabItem: apiMocks.getVocabItem,
    previewVocabItem: apiMocks.previewVocabItem,
    saveVocabItem: apiMocks.saveVocabItem,
    createQaFlag: vi.fn(),
    resolveQaFlag: vi.fn(),
  },
}));

describe('VocabEditorScreen', () => {
  it('surfaces save validation errors from the editor path', async () => {
    apiMocks.saveVocabItem.mockRejectedValue(new Error('translationRu: String must contain at least 1 character(s)'));

    render(<VocabEditorScreen vocabItemId="new" />);

    await userEvent.type(screen.getByLabelText('ID'), 'bonjour');
    await userEvent.selectOptions(screen.getByLabelText('Part of Speech'), 'interjection');
    await userEvent.type(screen.getByLabelText('Lemma'), 'bonjour');
    await userEvent.type(screen.getByLabelText('Surface Form'), 'bonjour');
    await userEvent.type(screen.getByLabelText('Translation RU'), 'здравствуйте');
    await userEvent.type(screen.getByLabelText('Topic ID'), 'topic_greetings');
    await userEvent.type(screen.getByLabelText('Example sentence FR'), 'Bonjour !');
    await userEvent.type(screen.getByLabelText('Example sentence RU'), 'Здравствуйте!');
    await userEvent.type(screen.getByLabelText('Source label'), 'Editorial seed');

    const translationField = screen.getByLabelText('Translation RU');
    await userEvent.clear(translationField);
    await userEvent.click(screen.getByText('Approve'));

    await waitFor(() =>
      expect(screen.getByText(/translationRu/)).toBeTruthy(),
    );
  });
});
