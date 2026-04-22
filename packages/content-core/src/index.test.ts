import { describe, expect, it } from 'vitest';

import {
  ContentAnswerError,
  answerTelemetryEventSchema,
  createQuestionCardPreview,
  distractorSetSchema,
  editorialImportBundleSchema,
  evaluateAnswer,
  generateQuestion,
  generatedQuestionSchema,
  isContentStatus,
  lessonSchema,
  levelSchema,
  questionCardTypeSchema,
  selectDistractorOptions,
  topicSchema,
  validateEditorialImportBundle,
  validateQuestionOptions,
  vocabItemSchema,
  buildAnswerTelemetryEvent,
  type DistractorSet,
  type Lesson,
  type VocabItem,
} from './index.js';

describe('phase 5 content schemas', () => {
  it('parses a valid noun vocab item', () => {
    const item = vocabItemSchema.parse(createBaseWordItem());

    expect(item.translationRu).toBe('яблоко');
    expect(item.article).toBe('la');
    expect(item.gender).toBe('feminine');
  });

  it('rejects invalid noun metadata and missing Russian translation', () => {
    expect(() =>
      vocabItemSchema.parse({
        ...createBaseWordItem(),
        translationRu: ' ',
      }),
    ).toThrow();

    expect(() =>
      vocabItemSchema.parse({
        ...createBaseWordItem(),
        gender: undefined,
      }),
    ).toThrow(/must also provide gender/i);
  });

  it('parses valid topic and lesson schemas', () => {
    expect(topicSchema.parse(createTopic()).id).toBe('topic.food');
    expect(lessonSchema.parse(createLesson()).id).toBe('lesson.a1.food.1');
  });

  it('rejects duplicate lesson content order', () => {
    expect(() =>
      lessonSchema.parse({
        ...createLesson(),
        contentRefs: [
          { itemId: 'vocab.food.apple', order: 1, cardType: 'single_word' },
          { itemId: 'vocab.food.pear', order: 1, cardType: 'single_word' },
        ],
      }),
    ).toThrow(/Duplicate lesson content order/i);
  });

  it('parses valid distractor sets and statuses', () => {
    expect(distractorSetSchema.parse(createLinkedWordDistractorSet()).options).toHaveLength(4);
    expect(isContentStatus('approved')).toBe(true);
    expect(isContentStatus('published')).toBe(false);
  });

  it('parses and validates editorial import bundles', () => {
    const bundle = editorialImportBundleSchema.parse(createValidBundle());
    expect(bundle.vocabItems).toHaveLength(10);

    const invalidBundle = createValidBundle();
    invalidBundle.levels[0] = {
      ...invalidBundle.levels[0]!,
      lessonIds: ['lesson.missing'],
    };

    const result = validateEditorialImportBundle(invalidBundle);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected validation failure.');
    }
    expect(result.issues.some((issue) => issue.message.includes('Unknown lessonId "lesson.missing"'))).toBe(true);
  });
});

describe('phase 6 answer generation', () => {
  it('generates a valid single_word_translation question from a linked distractor set', () => {
    const wordItem = createBaseWordItem();
    const question = generateQuestion({
      sourceItem: wordItem,
      allVocabItems: createQuestionPool(),
      distractorSets: [createLinkedWordDistractorSet()],
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });

    expect(questionCardTypeSchema.parse(question.cardType)).toBe('single_word_translation');
    expect(question.promptText).toBe('яблоко');
    expect(question.meta.distractorSource).toBe('linked_set');
    expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
    expect(question.correctOptionId).toBe('correct');
    expect(new Set(question.options.map((option) => option.label.toLowerCase()))).toHaveLength(question.options.length);
    expect(generatedQuestionSchema.parse(question).sourceItemIds).toContain('vocab.food.apple');
  });

  it('generates a deterministic phrase_translation question using fallback pool selection', () => {
    const phraseItem = createPhraseItem();
    const first = generateQuestion({
      sourceItem: phraseItem,
      allVocabItems: createQuestionPool(),
      distractorSets: [],
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });
    const second = generateQuestion({
      sourceItem: phraseItem,
      allVocabItems: createQuestionPool(),
      distractorSets: [],
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });

    expect(first).toEqual(second);
    expect(first.cardType).toBe('phrase_translation');
    expect(first.meta.distractorSource).toBe('fallback_pool');
    expect(first.options).toHaveLength(4);
    expect(first.options.every((option) => option.linkedItemId?.startsWith('vocab.phrase.'))).toBe(true);
  });

  it('generates article_noun_selection with article+noun answer options', () => {
    const item = createArticleNounItem();
    const question = generateQuestion({
      sourceItem: item,
      allVocabItems: createQuestionPool(),
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });

    expect(question.cardType).toBe('article_noun_selection');
    expect(question.promptText).toBe('яблоко');
    expect(question.options.every((option) => /^(le|la|les|l')\s?/i.test(option.label))).toBe(true);
    const correct = question.options.find((option) => option.isCorrect);
    expect(correct?.label).toBe('la pomme');
  });

  it('prevents duplicate option labels from linked distractor sets', () => {
    expect(() =>
      generateQuestion({
        sourceItem: createBaseWordItem(),
        allVocabItems: createQuestionPool(),
        distractorSets: [createAmbiguousLinkedWordDistractorSet()],
        promptLanguage: 'ru',
        answerLanguage: 'fr',
      }),
    ).toThrow(/Duplicate option label/i);
  });

  it('prevents fallback generation when unique distractors are insufficient', () => {
    expect(() =>
      generateQuestion({
        sourceItem: createBaseWordItem(),
        allVocabItems: [
          createBaseWordItem(),
          {
            ...createBaseWordItem(),
            id: 'vocab.food.apple.copy',
            surfaceForm: 'pomme',
            translationRu: 'яблоко-копия',
          },
        ],
        promptLanguage: 'ru',
        answerLanguage: 'fr',
      }),
    ).toThrow(/Could not generate enough distractors/i);
  });
});

describe('question option validation', () => {
  it('rejects duplicate normalized labels and invalid correctness shapes', () => {
    expect(() =>
      validateQuestionOptions([
        { id: 'one', label: 'La Pomme', isCorrect: true },
        { id: 'two', label: 'la   pomme', isCorrect: false },
      ]),
    ).toThrow(/Duplicate question option label/i);

    expect(() =>
      validateQuestionOptions([
        { id: 'one', label: 'pomme', isCorrect: false },
        { id: 'two', label: 'poire', isCorrect: false },
      ]),
    ).toThrow(/exactly one correct/i);
  });

  it('returns valid options unchanged', () => {
    const options = validateQuestionOptions([
      { id: 'one', label: 'pomme', isCorrect: true },
      { id: 'two', label: 'poire', isCorrect: false },
    ]);

    expect(options).toHaveLength(2);
  });

  it('selects deterministic fallback distractors without including the source item', () => {
    const selection = selectDistractorOptions({
      sourceItem: createBaseWordItem(),
      allVocabItems: createQuestionPool(),
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });

    expect(selection.distractorSource).toBe('fallback_pool');
    expect(selection.options.filter((option) => option.linkedItemId === 'vocab.food.apple')).toHaveLength(1);
    expect(selection.options).toHaveLength(4);
  });
});

describe('answer evaluation', () => {
  it('evaluates a correct answer and unlocks the move', () => {
    const question = generateQuestion({
      sourceItem: createBaseWordItem(),
      allVocabItems: createQuestionPool(),
      distractorSets: [createLinkedWordDistractorSet()],
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });

    const evaluation = evaluateAnswer(question, 'correct', {
      shownAt: '2026-04-22T00:00:00.000Z',
      answeredAt: '2026-04-22T00:00:01.250Z',
    });

    expect(evaluation.isCorrect).toBe(true);
    expect(evaluation.moveUnlocked).toBe(true);
    expect(evaluation.penalty).toBeNull();
    expect(evaluation.timingMs).toBe(1250);
  });

  it('evaluates an incorrect answer and applies a heart_loss penalty', () => {
    const question = generateQuestion({
      sourceItem: createBaseWordItem(),
      allVocabItems: createQuestionPool(),
      distractorSets: [createLinkedWordDistractorSet()],
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });

    const evaluation = evaluateAnswer(question, 'wrong-1');

    expect(evaluation.isCorrect).toBe(false);
    expect(evaluation.moveUnlocked).toBe(false);
    expect(evaluation.penalty).toEqual({
      applies: true,
      penaltyType: 'heart_loss',
      amount: 1,
    });
  });

  it('rejects unknown selected option ids', () => {
    const question = generateQuestion({
      sourceItem: createBaseWordItem(),
      allVocabItems: createQuestionPool(),
      distractorSets: [createLinkedWordDistractorSet()],
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });

    expect(() => evaluateAnswer(question, 'missing')).toThrow(ContentAnswerError);
  });
});

describe('telemetry structure', () => {
  it('builds a valid telemetry event from question and evaluation', () => {
    const question = generateQuestion({
      sourceItem: createPhraseItem(),
      allVocabItems: createQuestionPool(),
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });
    const selectedOptionId = question.options.find((option) => option.isCorrect)?.id;
    if (!selectedOptionId) {
      throw new Error('Expected generated question to contain a correct option.');
    }

    const evaluation = evaluateAnswer(question, selectedOptionId, {
      shownAt: '2026-04-22T00:00:00.000Z',
      answeredAt: '2026-04-22T00:00:02.000Z',
    });

    const event = buildAnswerTelemetryEvent({
      question,
      evaluation,
      occurredAt: '2026-04-22T00:00:02.000Z',
    });

    expect(answerTelemetryEventSchema.parse(event)).toEqual(event);
    expect(event.questionId).toBe(question.id);
    expect(event.sourceItemId).toBe(question.meta.sourceItemId);
    expect(event.cardType).toBe(question.cardType);
    expect(event.isCorrect).toBe(true);
    expect(event.cefrLevel).toBe(question.cefrLevel);
  });
});

describe('preview helper compatibility', () => {
  it('still produces exactly one correct answer for demo previews', () => {
    const card = createQuestionCardPreview({
      cefrLevel: 'A1',
      promptLanguage: 'ru',
      answerLanguage: 'fr',
    });

    expect(card.options.filter((option) => option.isCorrect)).toHaveLength(1);
  });
});

function createBaseWordItem(): VocabItem {
  return vocabItemSchema.parse({
    id: 'vocab.food.apple',
    language: 'fr',
    itemType: 'word',
    partOfSpeech: 'noun',
    cefrLevel: 'A1',
    lemma: 'pomme',
    surfaceForm: 'pomme',
    article: 'la',
    gender: 'feminine',
    register: 'neutral',
    translationRu: 'яблоко',
    translationEn: 'apple',
    translations: [
      { language: 'ru', value: 'яблоко' },
      { language: 'fr', value: 'pomme' },
    ],
    topicId: 'topic.food',
    subtopic: 'fruit',
    tags: ['fruit', 'basic'],
    exampleSentence: {
      fr: 'Je mange une pomme.',
      ru: 'Я ем яблоко.',
    },
    exampleSentences: [],
    distractorSetId: 'distractor.food.apple',
    distractorHints: [{ label: 'same semantic field' }],
    source: {
      label: 'Internal Editorial Source',
      kind: 'internal',
    },
    frequencyScore: 10,
    status: 'approved',
    editorNotes: 'Reviewed.',
    editorialMetadata: {
      createdBy: 'editor-1',
      createdAt: '2026-04-22T00:00:00.000Z',
    },
    audioAssetId: 'audio.apple',
  });
}

function createArticleNounItem(): VocabItem {
  return vocabItemSchema.parse({
    ...createBaseWordItem(),
    id: 'vocab.article-noun.apple',
    itemType: 'article_noun',
    surfaceForm: 'la pomme',
  });
}

function createPhraseItem(): VocabItem {
  return vocabItemSchema.parse({
    ...createBaseWordItem(),
    id: 'vocab.phrase.good-morning',
    itemType: 'phrase',
    partOfSpeech: 'expression',
    lemma: 'bonjour',
    surfaceForm: 'bonjour',
    article: undefined,
    gender: undefined,
    translationRu: 'доброе утро',
    translationEn: 'good morning',
    topicId: 'topic.greetings',
    subtopic: undefined,
  });
}

function createTopic() {
  return {
    id: 'topic.food',
    slug: 'food',
    title: 'Food',
    description: 'Vocabulary about food and drink.',
    cefrLevels: ['A1', 'A2'],
    status: 'approved',
    editorialMetadata: {
      createdBy: 'editor-1',
    },
  } as const;
}

function createGreetingsTopic() {
  return {
    id: 'topic.greetings',
    slug: 'greetings',
    title: 'Greetings',
    description: 'Basic greetings.',
    cefrLevels: ['A1'],
    status: 'approved',
    editorialMetadata: {
      createdBy: 'editor-1',
    },
  } as const;
}

function createLesson(): Lesson {
  return {
    id: 'lesson.a1.food.1',
    slug: 'a1-food-basics',
    title: 'A1 Food Basics',
    description: 'Introductory food vocabulary.',
    cefrLevel: 'A1',
    topicIds: ['topic.food'],
    contentRefs: [
      { itemId: 'vocab.food.apple', order: 1, cardType: 'single_word' },
      { itemId: 'vocab.food.pear', order: 2, cardType: 'single_word' },
    ],
    status: 'draft',
    editorialMetadata: {
      updatedBy: 'editor-2',
    },
  };
}

function createLinkedWordDistractorSet(): DistractorSet {
  return distractorSetSchema.parse({
    id: 'distractor.food.apple',
    cardType: 'single_word',
    promptLanguage: 'ru',
    answerLanguage: 'fr',
    options: [
      { id: 'correct', label: 'pomme', isCorrect: true, linkedItemId: 'vocab.food.apple' },
      { id: 'wrong-1', label: 'poire', isCorrect: false, linkedItemId: 'vocab.food.pear' },
      { id: 'wrong-2', label: 'banane', isCorrect: false, linkedItemId: 'vocab.food.banana' },
      { id: 'wrong-3', label: 'orange', isCorrect: false, linkedItemId: 'vocab.food.orange' },
    ],
    sourceItemId: 'vocab.food.apple',
    cefrLevel: 'A1',
    status: 'approved',
    editorialMetadata: {
      publishedBy: 'editor-3',
      publishedAt: '2026-04-22T00:00:00.000Z',
    },
  });
}

function createAmbiguousLinkedWordDistractorSet(): DistractorSet {
  return {
    ...createLinkedWordDistractorSet(),
    options: [
      { id: 'correct', label: 'pomme', isCorrect: true, linkedItemId: 'vocab.food.apple' },
      { id: 'wrong-1', label: 'Pomme', isCorrect: false, linkedItemId: 'vocab.food.pear' },
    ],
  };
}

function createQuestionPool(): VocabItem[] {
  return [
    createBaseWordItem(),
    vocabItemSchema.parse({
      ...createBaseWordItem(),
      id: 'vocab.food.pear',
      lemma: 'poire',
      surfaceForm: 'poire',
      translationRu: 'груша',
      translationEn: 'pear',
      distractorSetId: undefined,
    }),
    vocabItemSchema.parse({
      ...createBaseWordItem(),
      id: 'vocab.food.banana',
      lemma: 'banane',
      surfaceForm: 'banane',
      translationRu: 'банан',
      translationEn: 'banana',
      distractorSetId: undefined,
    }),
    vocabItemSchema.parse({
      ...createBaseWordItem(),
      id: 'vocab.food.orange',
      lemma: 'orange',
      surfaceForm: 'orange',
      translationRu: 'апельсин',
      translationEn: 'orange',
      distractorSetId: undefined,
    }),
    vocabItemSchema.parse({
      ...createArticleNounItem(),
      id: 'vocab.article-noun.pear',
      lemma: 'poire',
      surfaceForm: 'la poire',
      translationRu: 'груша',
      translationEn: 'pear',
      distractorSetId: undefined,
    }),
    vocabItemSchema.parse({
      ...createArticleNounItem(),
      id: 'vocab.article-noun.banana',
      article: 'la',
      gender: 'feminine',
      lemma: 'banane',
      surfaceForm: 'la banane',
      translationRu: 'банан',
      translationEn: 'banana',
      distractorSetId: undefined,
    }),
    createPhraseItem(),
    vocabItemSchema.parse({
      ...createPhraseItem(),
      id: 'vocab.phrase.good-evening',
      lemma: 'bonsoir',
      surfaceForm: 'bonsoir',
      translationRu: 'добрый вечер',
      translationEn: 'good evening',
    }),
    vocabItemSchema.parse({
      ...createPhraseItem(),
      id: 'vocab.phrase.see-you',
      lemma: 'à bientôt',
      surfaceForm: 'à bientôt',
      translationRu: 'до скорого',
      translationEn: 'see you soon',
    }),
    vocabItemSchema.parse({
      ...createPhraseItem(),
      id: 'vocab.phrase.thank-you',
      lemma: 'merci beaucoup',
      surfaceForm: 'merci beaucoup',
      translationRu: 'большое спасибо',
      translationEn: 'thank you very much',
    }),
  ];
}

function createValidBundle() {
  const pool = createQuestionPool();
  return {
    version: '1.0.0',
    exportedAt: '2026-04-22T00:00:00.000Z',
    sourceLabel: 'editorial-seed',
    levels: [
      levelSchema.parse({
        id: 'A1',
        cefrLevel: 'A1',
        title: 'A1',
        description: 'Starter level.',
        order: 1,
        topicIds: ['topic.food', 'topic.greetings'],
        lessonIds: ['lesson.a1.food.1'],
        status: 'approved',
        editorialMetadata: {},
      }),
    ],
    topics: [createTopic(), createGreetingsTopic()],
    lessons: [createLesson()],
    vocabItems: pool,
    distractorSets: [createLinkedWordDistractorSet()],
  };
}
