import { describe, expect, it } from 'vitest';

import {
  contentSourceSchema,
  createQuestionCardPreview,
  distractorSetSchema,
  editorialImportBundleSchema,
  isContentStatus,
  lessonSchema,
  levelSchema,
  topicSchema,
  validateEditorialImportBundle,
  vocabItemSchema,
  type Lesson,
} from './index.js';

describe('vocabItemSchema', () => {
  it('parses a valid noun vocab item with article and gender', () => {
    const item = vocabItemSchema.parse(createBaseVocabItem());

    expect(item.translationRu).toBe('яблоко');
    expect(item.article).toBe('la');
    expect(item.gender).toBe('feminine');
  });

  it('parses a valid phrase item', () => {
    const item = vocabItemSchema.parse({
      ...createBaseVocabItem(),
      id: 'vocab.phrase.bonjour',
      itemType: 'phrase',
      partOfSpeech: 'expression',
      lemma: 'bonjour',
      surfaceForm: 'bonjour',
      article: undefined,
      gender: undefined,
    });

    expect(item.itemType).toBe('phrase');
    expect(item.partOfSpeech).toBe('expression');
  });

  it('parses a valid article+noun item', () => {
    const item = vocabItemSchema.parse({
      ...createBaseVocabItem(),
      id: 'vocab.article-noun.la-pomme',
      itemType: 'article_noun',
      surfaceForm: 'la pomme',
    });

    expect(item.itemType).toBe('article_noun');
    expect(item.surfaceForm).toBe('la pomme');
  });

  it('rejects missing Russian translation', () => {
    expect(() =>
      vocabItemSchema.parse({
        ...createBaseVocabItem(),
        translationRu: '   ',
      }),
    ).toThrow(/translationRu/i);
  });

  it('rejects empty lemma or surfaceForm', () => {
    expect(() =>
      vocabItemSchema.parse({
        ...createBaseVocabItem(),
        lemma: '',
      }),
    ).toThrow();

    expect(() =>
      vocabItemSchema.parse({
        ...createBaseVocabItem(),
        surfaceForm: '',
      }),
    ).toThrow();
  });

  it('rejects noun-like items without article and gender consistency', () => {
    expect(() =>
      vocabItemSchema.parse({
        ...createBaseVocabItem(),
        article: undefined,
        gender: undefined,
      }),
    ).toThrow(/Noun-like items must provide at least article or gender/i);

    expect(() =>
      vocabItemSchema.parse({
        ...createBaseVocabItem(),
        gender: undefined,
      }),
    ).toThrow(/must also provide gender/i);
  });

  it('rejects article or gender on non-noun items in v1', () => {
    expect(() =>
      vocabItemSchema.parse({
        ...createBaseVocabItem(),
        itemType: 'word',
        partOfSpeech: 'verb',
        article: 'la',
        gender: 'feminine',
      }),
    ).toThrow(/Only noun-like items may provide article or gender/i);
  });

  it('rejects invalid example sentence structure and duplicate translation languages', () => {
    expect(() =>
      vocabItemSchema.parse({
        ...createBaseVocabItem(),
        exampleSentence: {
          fr: '',
          ru: 'яблоко',
        },
      }),
    ).toThrow();

    expect(() =>
      vocabItemSchema.parse({
        ...createBaseVocabItem(),
        translations: [
          { language: 'ru', value: 'яблоко' },
          { language: 'ru', value: 'яблочко' },
        ],
      }),
    ).toThrow(/Translation entries must be unique per language/i);
  });
});

describe('topicSchema', () => {
  it('parses a valid topic', () => {
    const topic = topicSchema.parse(createTopic());

    expect(topic.slug).toBe('food');
    expect(topic.cefrLevels).toEqual(['A1', 'A2']);
  });

  it('rejects duplicate CEFR levels', () => {
    expect(() =>
      topicSchema.parse({
        ...createTopic(),
        cefrLevels: ['A1', 'A1'],
      }),
    ).toThrow(/cefrLevels must be unique/i);
  });
});

describe('lessonSchema', () => {
  it('parses a valid lesson with ordered refs', () => {
    const lesson = lessonSchema.parse(createLesson());

    expect(lesson.contentRefs.map((contentRef) => contentRef.order)).toEqual([1, 2]);
  });

  it('rejects empty topicIds and duplicate content order', () => {
    expect(() =>
      lessonSchema.parse({
        ...createLesson(),
        topicIds: [],
      }),
    ).toThrow();

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
});

describe('distractorSetSchema', () => {
  it('parses a valid distractor set with exactly one correct answer', () => {
    const distractorSet = distractorSetSchema.parse(createDistractorSet());

    expect(distractorSet.options.filter((option) => option.isCorrect)).toHaveLength(1);
  });

  it('rejects zero or multiple correct answers', () => {
    expect(() =>
      distractorSetSchema.parse({
        ...createDistractorSet(),
        options: createDistractorSet().options.map((option) => ({
          ...option,
          isCorrect: false,
        })),
      }),
    ).toThrow(/exactly one correct option/i);

    expect(() =>
      distractorSetSchema.parse({
        ...createDistractorSet(),
        options: createDistractorSet().options.map((option) => ({
          ...option,
          isCorrect: true,
        })),
      }),
    ).toThrow(/exactly one correct option/i);
  });

  it('rejects duplicate option ids or labels', () => {
    expect(() =>
      distractorSetSchema.parse({
        ...createDistractorSet(),
        options: [
          { id: 'same', label: 'pomme', isCorrect: true },
          { id: 'same', label: 'poire', isCorrect: false },
        ],
      }),
    ).toThrow(/Duplicate distractor option id/i);

    expect(() =>
      distractorSetSchema.parse({
        ...createDistractorSet(),
        options: [
          { id: 'one', label: 'pomme', isCorrect: true },
          { id: 'two', label: 'pomme', isCorrect: false },
        ],
      }),
    ).toThrow(/Duplicate distractor option label/i);
  });
});

describe('status validation', () => {
  it('accepts allowed status values and rejects invalid ones', () => {
    expect(isContentStatus('draft')).toBe(true);
    expect(isContentStatus('on_review')).toBe(true);
    expect(isContentStatus('approved')).toBe(true);
    expect(isContentStatus('archived')).toBe(true);
    expect(isContentStatus('published')).toBe(false);
  });
});

describe('editorial import bundle', () => {
  it('parses a valid import bundle with linked refs', () => {
    const bundle = editorialImportBundleSchema.parse(createValidBundle());

    expect(bundle.vocabItems).toHaveLength(2);
    expect(bundle.lessons[0]?.contentRefs).toHaveLength(2);
  });

  it('rejects duplicate ids and unresolved references', () => {
    const invalidBundle = createValidBundle();
    invalidBundle.vocabItems.push({ ...createBaseVocabItem() });
    invalidBundle.lessons[0] = {
      ...invalidBundle.lessons[0]!,
      topicIds: ['topic.missing'],
    };

    const result = validateEditorialImportBundle(invalidBundle);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected validation to fail.');
    }

    expect(result.issues.some((issue) => issue.message.includes('Duplicate vocabItems id'))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes('Unknown topicId "topic.missing"'))).toBe(true);
  });

  it('rejects level to lesson CEFR mismatches', () => {
    const invalidBundle = createValidBundle();
    invalidBundle.lessons[0] = {
      ...invalidBundle.lessons[0]!,
      cefrLevel: 'A2',
    };

    const result = validateEditorialImportBundle(invalidBundle);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected validation to fail.');
    }

    expect(result.issues.some((issue) => issue.message.includes('has CEFR A2 but level "A1" is A1'))).toBe(true);
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

function createBaseVocabItem() {
  return {
    id: 'vocab.food.apple',
    language: 'fr' as const,
    itemType: 'word' as const,
    partOfSpeech: 'noun' as const,
    cefrLevel: 'A1' as const,
    lemma: 'pomme',
    surfaceForm: 'pomme',
    article: 'la',
    gender: 'feminine' as const,
    register: 'neutral',
    translationRu: 'яблоко',
    translationEn: 'apple',
    translations: [
      { language: 'ru' as const, value: 'яблоко' },
      { language: 'fr' as const, value: 'pomme' },
    ],
    topicId: 'topic.food',
    subtopic: 'fruit',
    tags: ['fruit', 'basic'],
    exampleSentence: {
      fr: 'Je mange une pomme.',
      ru: 'Я ем яблоко.',
    },
    exampleSentences: [
      {
        fr: 'La pomme est rouge.',
        ru: 'Яблоко красное.',
      },
    ],
    distractorSetId: 'distractor.food.apple',
    distractorHints: [{ label: 'same semantic field' }],
    source: contentSourceSchema.parse({
      label: 'Internal Editorial Source',
      kind: 'internal',
    }),
    frequencyScore: 10,
    status: 'draft' as const,
    editorNotes: 'Reviewed by editor.',
    editorialMetadata: {
      createdBy: 'editor-1',
      createdAt: '2026-04-22T00:00:00.000Z',
    },
    audioAssetId: 'audio.apple',
  };
}

function createTopic() {
  return {
    id: 'topic.food',
    slug: 'food',
    title: 'Food',
    description: 'Vocabulary about food and drink.',
    cefrLevels: ['A1', 'A2'] as const,
    status: 'approved' as const,
    editorialMetadata: {
      createdBy: 'editor-1',
    },
  };
}

function createLesson(): Lesson {
  return {
    id: 'lesson.a1.food.1',
    slug: 'a1-food-basics',
    title: 'A1 Food Basics',
    description: 'Introductory food vocabulary.',
    cefrLevel: 'A1' as const,
    topicIds: ['topic.food'],
    contentRefs: [
      { itemId: 'vocab.food.apple', order: 1, cardType: 'single_word' as const },
      { itemId: 'vocab.food.pear', order: 2, cardType: 'single_word' as const },
    ],
    status: 'draft' as const,
    editorialMetadata: {
      updatedBy: 'editor-2',
    },
  };
}

function createDistractorSet() {
  return {
    id: 'distractor.food.apple',
    cardType: 'single_word' as const,
    promptLanguage: 'ru' as const,
    answerLanguage: 'fr' as const,
    options: [
      { id: 'correct', label: 'la pomme', isCorrect: true, linkedItemId: 'vocab.food.apple' },
      { id: 'wrong-1', label: 'la poire', isCorrect: false, linkedItemId: 'vocab.food.pear' },
      { id: 'wrong-2', label: 'la banane', isCorrect: false },
    ],
    sourceItemId: 'vocab.food.apple',
    cefrLevel: 'A1' as const,
    status: 'approved' as const,
    editorialMetadata: {
      publishedBy: 'editor-3',
      publishedAt: '2026-04-22T00:00:00.000Z',
    },
  };
}

function createValidBundle() {
  const pear = {
    ...createBaseVocabItem(),
    id: 'vocab.food.pear',
    lemma: 'poire',
    surfaceForm: 'poire',
    translationRu: 'груша',
    translationEn: 'pear',
    distractorSetId: undefined,
    audioAssetId: 'audio.pear',
  };

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
        topicIds: ['topic.food'],
        lessonIds: ['lesson.a1.food.1'],
        status: 'approved',
        editorialMetadata: {},
      }),
    ],
    topics: [createTopic()],
    lessons: [createLesson()],
    vocabItems: [createBaseVocabItem(), pear],
    distractorSets: [createDistractorSet()],
  };
}
