import { z } from 'zod';

import {
  cefrLevelSchema,
  contentStatusSchema,
  languageCodeSchema,
  type CefrLevelId,
  type ContentStatus,
  type LanguageCode,
} from '@langue-buster/shared';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const partOfSpeechSchema = z.enum([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'determiner',
  'interjection',
  'expression',
]);
export type PartOfSpeech = z.infer<typeof partOfSpeechSchema>;

export const grammaticalGenderSchema = z.enum(['masculine', 'feminine']);
export type GrammaticalGender = z.infer<typeof grammaticalGenderSchema>;

export const cardTypeSchema = z.enum(['single_word', 'phrase', 'article_noun']);
export type CardType = z.infer<typeof cardTypeSchema>;

export const itemTypeSchema = z.enum(['word', 'phrase', 'article_noun']);
export type ItemType = z.infer<typeof itemTypeSchema>;

export const contentSourceSchema = z.object({
  label: z.string().trim().min(1),
  kind: z.enum(['editorial', 'pedagogical', 'exam_reference', 'frequency_lexicon', 'internal']),
  referenceUrl: z.string().url().optional(),
  citation: z.string().trim().min(1).optional(),
});
export type ContentSource = z.infer<typeof contentSourceSchema>;

export const editorialMetadataSchema = z.object({
  createdBy: z.string().trim().min(1).optional(),
  updatedBy: z.string().trim().min(1).optional(),
  publishedBy: z.string().trim().min(1).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
});
export type EditorialMetadata = z.infer<typeof editorialMetadataSchema>;

export const exampleSentenceSchema = z.object({
  fr: z.string().trim().min(1),
  ru: z.string().trim().min(1),
});
export type ExampleSentence = z.infer<typeof exampleSentenceSchema>;

export const translationEntrySchema = z.object({
  language: languageCodeSchema,
  value: z.string().trim().min(1),
});
export type TranslationEntry = z.infer<typeof translationEntrySchema>;

export const distractorHintSchema = z.object({
  label: z.string().trim().min(1),
  reason: z.string().trim().min(1).optional(),
});
export type DistractorHint = z.infer<typeof distractorHintSchema>;

export const distractorOptionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  isCorrect: z.boolean(),
  linkedItemId: z.string().trim().min(1).optional(),
});
export type DistractorOption = z.infer<typeof distractorOptionSchema>;

export const distractorSetSchema = z.object({
  id: z.string().trim().min(1),
  cardType: cardTypeSchema,
  promptLanguage: languageCodeSchema,
  answerLanguage: languageCodeSchema,
  options: z.array(distractorOptionSchema).min(2),
  sourceItemId: z.string().trim().min(1).optional(),
  cefrLevel: cefrLevelSchema,
  status: contentStatusSchema,
  editorialMetadata: editorialMetadataSchema.default({}),
}).superRefine((value, context) => {
  const correctCount = value.options.filter((option) => option.isCorrect).length;
  if (correctCount !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Distractor sets must contain exactly one correct option.',
      path: ['options'],
    });
  }

  const ids = new Set<string>();
  const labels = new Set<string>();

  value.options.forEach((option, index) => {
    if (ids.has(option.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate distractor option id "${option.id}".`,
        path: ['options', index, 'id'],
      });
    }
    ids.add(option.id);

    const normalizedLabel = option.label.trim().toLocaleLowerCase('en');
    if (labels.has(normalizedLabel)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate distractor option label "${option.label}".`,
        path: ['options', index, 'label'],
      });
    }
    labels.add(normalizedLabel);
  });
});
export type DistractorSet = z.infer<typeof distractorSetSchema>;

export const topicSchema = z.object({
  id: z.string().trim().min(1),
  slug: z.string().trim().regex(slugPattern, 'Topic slug must use lowercase kebab-case.'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  cefrLevels: z.array(cefrLevelSchema).min(1),
  parentTopicId: z.string().trim().min(1).optional(),
  status: contentStatusSchema,
  editorialMetadata: editorialMetadataSchema.default({}),
}).superRefine((value, context) => {
  const levelSet = new Set(value.cefrLevels);
  if (levelSet.size !== value.cefrLevels.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Topic cefrLevels must be unique.',
      path: ['cefrLevels'],
    });
  }
});
export type Topic = z.infer<typeof topicSchema>;

export const lessonContentRefSchema = z.object({
  itemId: z.string().trim().min(1),
  order: z.number().int().positive(),
  cardType: cardTypeSchema,
  notes: z.string().trim().min(1).optional(),
});
export type LessonContentRef = z.infer<typeof lessonContentRefSchema>;

export const lessonSchema = z.object({
  id: z.string().trim().min(1),
  slug: z.string().trim().regex(slugPattern, 'Lesson slug must use lowercase kebab-case.'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  cefrLevel: cefrLevelSchema,
  topicIds: z.array(z.string().trim().min(1)).min(1),
  contentRefs: z.array(lessonContentRefSchema).min(1),
  status: contentStatusSchema,
  editorialMetadata: editorialMetadataSchema.default({}),
}).superRefine((value, context) => {
  const topicIds = new Set<string>();
  value.topicIds.forEach((topicId, index) => {
    if (topicIds.has(topicId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate lesson topic reference "${topicId}".`,
        path: ['topicIds', index],
      });
    }
    topicIds.add(topicId);
  });

  const orders = new Set<number>();
  value.contentRefs.forEach((contentRef, index) => {
    if (orders.has(contentRef.order)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate lesson content order "${contentRef.order}".`,
        path: ['contentRefs', index, 'order'],
      });
    }
    orders.add(contentRef.order);
  });
});
export type Lesson = z.infer<typeof lessonSchema>;

export const levelSchema = z.object({
  id: cefrLevelSchema,
  cefrLevel: cefrLevelSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  order: z.number().int().positive(),
  topicIds: z.array(z.string().trim().min(1)).default([]),
  lessonIds: z.array(z.string().trim().min(1)).default([]),
  status: contentStatusSchema,
  editorialMetadata: editorialMetadataSchema.default({}),
}).superRefine((value, context) => {
  if (value.id !== value.cefrLevel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Level id and cefrLevel must match.',
      path: ['id'],
    });
  }

  if (new Set(value.topicIds).size !== value.topicIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Level topicIds must be unique.',
      path: ['topicIds'],
    });
  }

  if (new Set(value.lessonIds).size !== value.lessonIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Level lessonIds must be unique.',
      path: ['lessonIds'],
    });
  }
});
export type Level = z.infer<typeof levelSchema>;

export const vocabItemSchema = z.object({
  id: z.string().trim().min(1),
  language: z.union([languageCodeSchema, z.literal('multi')]).default('fr'),
  itemType: itemTypeSchema,
  partOfSpeech: partOfSpeechSchema,
  cefrLevel: cefrLevelSchema,
  lemma: z.string().trim().min(1),
  surfaceForm: z.string().trim().min(1),
  article: z.string().trim().min(1).optional(),
  gender: grammaticalGenderSchema.optional(),
  register: z.string().trim().min(1).optional(),
  translationRu: z.string().trim().min(1),
  translationEn: z.string().trim().min(1).optional(),
  translations: z.array(translationEntrySchema).default([]),
  topicId: z.string().trim().min(1),
  subtopic: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  exampleSentence: exampleSentenceSchema,
  exampleSentences: z.array(exampleSentenceSchema).default([]),
  distractorSetId: z.string().trim().min(1).optional(),
  distractorHints: z.array(distractorHintSchema).default([]),
  source: contentSourceSchema,
  frequencyScore: z.number().int().nonnegative(),
  status: contentStatusSchema,
  editorNotes: z.string().trim().min(1).optional(),
  editorialMetadata: editorialMetadataSchema.default({}),
  audioAssetId: z.string().trim().min(1).optional(),
}).superRefine((value, context) => {
  const isNounLike = value.partOfSpeech === 'noun' || value.itemType === 'article_noun';

  if (isNounLike) {
    if (!value.article && !value.gender) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Noun-like items must provide at least article or gender.',
        path: ['article'],
      });
    }

    if (value.article && !value.gender) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Noun-like items with article must also provide gender.',
        path: ['gender'],
      });
    }
  } else if (value.article || value.gender) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Only noun-like items may provide article or gender in v1.',
      path: ['article'],
    });
  }

  if (value.itemType === 'phrase' && value.partOfSpeech === 'noun') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Phrase items should not use noun as partOfSpeech.',
      path: ['partOfSpeech'],
    });
  }

  const translationLanguages = new Set(value.translations.map((entry) => entry.language));
  if (translationLanguages.size !== value.translations.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Translation entries must be unique per language.',
      path: ['translations'],
    });
  }
});
export type VocabItem = z.infer<typeof vocabItemSchema>;

export const editorialImportBundleSchema = z.object({
  version: z.string().trim().min(1),
  exportedAt: z.string().datetime(),
  sourceLabel: z.string().trim().min(1),
  levels: z.array(levelSchema).default([]),
  topics: z.array(topicSchema).default([]),
  lessons: z.array(lessonSchema).default([]),
  vocabItems: z.array(vocabItemSchema).min(1),
  distractorSets: z.array(distractorSetSchema).default([]),
}).superRefine((value, context) => {
  addUniqueIdIssues(value.levels, 'levels', context);
  addUniqueIdIssues(value.topics, 'topics', context);
  addUniqueIdIssues(value.lessons, 'lessons', context);
  addUniqueIdIssues(value.vocabItems, 'vocabItems', context);
  addUniqueIdIssues(value.distractorSets, 'distractorSets', context);

  const topicIds = new Set(value.topics.map((topic) => topic.id));
  const lessonIds = new Set(value.lessons.map((lesson) => lesson.id));
  const vocabIds = new Set(value.vocabItems.map((item) => item.id));
  const distractorIds = new Set(value.distractorSets.map((set) => set.id));
  const lessonMap = new Map(value.lessons.map((lesson) => [lesson.id, lesson]));

  value.topics.forEach((topic, index) => {
    if (topic.parentTopicId && !topicIds.has(topic.parentTopicId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown parentTopicId "${topic.parentTopicId}".`,
        path: ['topics', index, 'parentTopicId'],
      });
    }

    if (topic.parentTopicId === topic.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Topic cannot reference itself as parentTopicId.',
        path: ['topics', index, 'parentTopicId'],
      });
    }
  });

  value.vocabItems.forEach((item, index) => {
    if (!topicIds.has(item.topicId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown topicId "${item.topicId}".`,
        path: ['vocabItems', index, 'topicId'],
      });
    }

    if (item.distractorSetId && !distractorIds.has(item.distractorSetId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown distractorSetId "${item.distractorSetId}".`,
        path: ['vocabItems', index, 'distractorSetId'],
      });
    }
  });

  value.lessons.forEach((lesson, lessonIndex) => {
    lesson.topicIds.forEach((topicId, topicIndex) => {
      if (!topicIds.has(topicId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown topicId "${topicId}".`,
          path: ['lessons', lessonIndex, 'topicIds', topicIndex],
        });
      }
    });

    lesson.contentRefs.forEach((contentRef, refIndex) => {
      if (!vocabIds.has(contentRef.itemId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown vocab item reference "${contentRef.itemId}".`,
          path: ['lessons', lessonIndex, 'contentRefs', refIndex, 'itemId'],
        });
      }
    });
  });

  value.levels.forEach((level, levelIndex) => {
    level.topicIds.forEach((topicId, topicIndex) => {
      if (!topicIds.has(topicId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown topicId "${topicId}".`,
          path: ['levels', levelIndex, 'topicIds', topicIndex],
        });
      }
    });

    level.lessonIds.forEach((lessonId, lessonIndex) => {
      if (!lessonIds.has(lessonId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown lessonId "${lessonId}".`,
          path: ['levels', levelIndex, 'lessonIds', lessonIndex],
        });
        return;
      }

      const lesson = lessonMap.get(lessonId);
      if (lesson && lesson.cefrLevel !== level.cefrLevel) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Lesson "${lessonId}" has CEFR ${lesson.cefrLevel} but level "${level.id}" is ${level.cefrLevel}.`,
          path: ['levels', levelIndex, 'lessonIds', lessonIndex],
        });
      }
    });
  });

  value.distractorSets.forEach((set, setIndex) => {
    if (set.sourceItemId && !vocabIds.has(set.sourceItemId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown sourceItemId "${set.sourceItemId}".`,
        path: ['distractorSets', setIndex, 'sourceItemId'],
      });
    }

    set.options.forEach((option, optionIndex) => {
      if (option.linkedItemId && !vocabIds.has(option.linkedItemId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown linkedItemId "${option.linkedItemId}".`,
          path: ['distractorSets', setIndex, 'options', optionIndex, 'linkedItemId'],
        });
      }
    });
  });
});
export type EditorialImportBundle = z.infer<typeof editorialImportBundleSchema>;

export type EditorialImportValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type EditorialImportValidationResult =
  | Readonly<{ success: true; data: EditorialImportBundle }>
  | Readonly<{ success: false; issues: readonly EditorialImportValidationIssue[] }>;

export function parseEditorialImportBundle(input: unknown): EditorialImportBundle {
  return editorialImportBundleSchema.parse(input);
}

export function validateEditorialImportBundle(input: unknown): EditorialImportValidationResult {
  const parsed = editorialImportBundleSchema.safeParse(input);
  if (parsed.success) {
    return {
      success: true,
      data: parsed.data,
    };
  }

  return {
    success: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

export const questionCardPreviewSchema = z.object({
  prompt: z.string(),
  options: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      isCorrect: z.boolean(),
    }),
  ),
  meta: z.object({
    cardType: cardTypeSchema,
    cefrLevel: cefrLevelSchema,
  }),
});
export type QuestionCardPreview = z.infer<typeof questionCardPreviewSchema>;

type CreateQuestionCardPreviewInput = {
  cefrLevel: CefrLevelId;
  promptLanguage: LanguageCode;
  answerLanguage: LanguageCode;
};

export function createQuestionCardPreview(
  input: CreateQuestionCardPreviewInput,
): QuestionCardPreview {
  const prompt = input.promptLanguage === 'ru' ? 'яблоко' : 'pomme';
  const correct = input.answerLanguage === 'fr' ? 'la pomme' : 'яблоко';
  const distractors = input.answerLanguage === 'fr'
    ? ['la poire', 'la banane', "l'orange"]
    : ['груша', 'банан', 'апельсин'];

  return questionCardPreviewSchema.parse({
    prompt,
    options: [
      { id: 'correct', label: correct, isCorrect: true },
      ...distractors.map((label, index) => ({
        id: `distractor-${index + 1}`,
        label,
        isCorrect: false,
      })),
    ],
    meta: {
      cardType: 'single_word',
      cefrLevel: input.cefrLevel,
    },
  });
}

function addUniqueIdIssues(
  entries: readonly Readonly<{ id: string }>[],
  path: string,
  context: z.RefinementCtx,
) {
  const ids = new Set<string>();

  entries.forEach((entry, index) => {
    if (ids.has(entry.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate ${path} id "${entry.id}".`,
        path: [path, index, 'id'],
      });
    }
    ids.add(entry.id);
  });
}

export function isContentStatus(value: string): value is ContentStatus {
  return contentStatusSchema.safeParse(value).success;
}
