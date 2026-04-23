import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PreviewCard } from './AdminPrimitives';

describe('PreviewCard', () => {
  it('renders prompt and answer options for the core card shape', () => {
    render(
      <PreviewCard
        question={{
          id: 'question-1',
          cardType: 'single_word_translation',
          promptLanguage: 'ru',
          answerLanguage: 'fr',
          promptText: 'здравствуйте',
          options: [
            { id: '1', label: 'bonjour', isCorrect: true },
            { id: '2', label: 'merci', isCorrect: false },
          ],
          correctOptionId: '1',
          sourceItemIds: ['bonjour'],
          cefrLevel: 'A1',
          meta: {
            sourceItemId: 'bonjour',
            topicId: 'topic_greetings',
            distractorSource: 'linked_set',
            generatorVersion: 'phase10-preview',
          },
        }}
      />,
    );

    expect(screen.getByText('здравствуйте')).toBeTruthy();
    expect(screen.getByText('bonjour')).toBeTruthy();
    expect(screen.getByText('merci')).toBeTruthy();
  });
});
