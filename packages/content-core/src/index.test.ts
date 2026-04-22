import { describe, expect, it } from 'vitest';

import { createQuestionCardPreview } from './index.js';

describe('createQuestionCardPreview', () => {
  it('produces exactly one correct answer for MVP previews', () => {
    const card = createQuestionCardPreview({
      cefrLevel: 'A1',
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });

    expect(card.options.filter((option) => option.isCorrect)).toHaveLength(1);
  });
});
