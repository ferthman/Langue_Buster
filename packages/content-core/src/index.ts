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
const DEFAULT_GENERATOR_VERSION = 'phase6-v1';

export class ContentAnswerError extends Error {
  readonly code:
    | 'unsupported_card_type'
    | 'invalid_generation_request'
    | 'insufficient_distractors'
    | 'ambiguous_options'
    | 'invalid_selected_option';

  constructor(
    code:
      | 'unsupported_card_type'
      | 'invalid_generation_request'
      | 'insufficient_distractors'
      | 'ambiguous_options'
      | 'invalid_selected_option',
    message: string,
  ) {
    super(message);
    this.name = 'ContentAnswerError';
    this.code = code;
  }
}

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

export const questionCardTypeSchema = z.enum([
  'single_word_translation',
  'phrase_translation',
  'article_noun_selection',
]);
export type QuestionCardType = z.infer<typeof questionCardTypeSchema>;

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
  addOptionValidationIssues(value.options, context, ['options']);
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
  if (new Set(value.cefrLevels).size !== value.cefrLevels.length) {
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
  addUniqueValueIssues(value.topicIds, context, ['topicIds'], (topicId) => `Duplicate lesson topic reference "${topicId}".`);
  addUniqueValueIssues(
    value.contentRefs.map((contentRef) => contentRef.order),
    context,
    ['contentRefs'],
    (order) => `Duplicate lesson content order "${order}".`,
    (index) => [index, 'order'],
  );
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

  addUniqueValueIssues(value.topicIds, context, ['topicIds'], () => 'Level topicIds must be unique.');
  addUniqueValueIssues(value.lessonIds, context, ['lessonIds'], () => 'Level lessonIds must be unique.');
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
  const nounLike = isNounLike(value);

  if (nounLike) {
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

  if (new Set(value.translations.map((entry) => entry.language)).size !== value.translations.length) {
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

export const questionOptionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  isCorrect: z.boolean(),
  linkedItemId: z.string().trim().min(1).optional(),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

export const generatedQuestionMetaSchema = z.object({
  sourceItemId: z.string().trim().min(1),
  topicId: z.string().trim().min(1),
  distractorSource: z.enum(['linked_set', 'fallback_pool']),
  generatorVersion: z.string().trim().min(1),
  debug: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});
export type GeneratedQuestionMeta = z.infer<typeof generatedQuestionMetaSchema>;

export const generatedQuestionSchema = z.object({
  id: z.string().trim().min(1),
  cardType: questionCardTypeSchema,
  promptLanguage: languageCodeSchema,
  answerLanguage: languageCodeSchema,
  promptText: z.string().trim().min(1),
  options: z.array(questionOptionSchema).min(2),
  correctOptionId: z.string().trim().min(1),
  sourceItemIds: z.array(z.string().trim().min(1)).min(1),
  cefrLevel: cefrLevelSchema,
  meta: generatedQuestionMetaSchema,
}).superRefine((value, context) => {
  if (value.promptLanguage === value.answerLanguage) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'promptLanguage and answerLanguage must be different.',
      path: ['answerLanguage'],
    });
  }

  addOptionValidationIssues(value.options, context, ['options']);

  const correctOption = value.options.find((option) => option.id === value.correctOptionId && option.isCorrect);
  if (!correctOption) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'correctOptionId must reference the single correct option.',
      path: ['correctOptionId'],
    });
  }
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const questionGenerationRequestSchema = z.object({
  sourceItem: vocabItemSchema,
  allVocabItems: z.array(vocabItemSchema),
  distractorSets: z.array(distractorSetSchema).default([]),
  promptLanguage: languageCodeSchema,
  answerLanguage: languageCodeSchema,
  generatorVersion: z.string().trim().min(1).default(DEFAULT_GENERATOR_VERSION),
}).superRefine((value, context) => {
  if (value.promptLanguage === value.answerLanguage) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question generation requires different prompt and answer languages.',
      path: ['answerLanguage'],
    });
  }
});
export type QuestionGenerationRequest = z.infer<typeof questionGenerationRequestSchema>;

export const answerPenaltySchema = z.object({
  applies: z.literal(true),
  penaltyType: z.literal('heart_loss'),
  amount: z.number().int().positive(),
});
export type AnswerPenalty = z.infer<typeof answerPenaltySchema>;

export const moveUnlockDecisionSchema = z.object({
  moveUnlocked: z.boolean(),
  penalty: answerPenaltySchema.nullable(),
});
export type MoveUnlockDecision = z.infer<typeof moveUnlockDecisionSchema>;

export const answerEvaluationSchema = z.object({
  questionId: z.string().trim().min(1),
  selectedOptionId: z.string().trim().min(1),
  correctOptionId: z.string().trim().min(1),
  isCorrect: z.boolean(),
  moveUnlocked: z.boolean(),
  penalty: answerPenaltySchema.nullable(),
  cardType: questionCardTypeSchema,
  sourceItemId: z.string().trim().min(1),
  cefrLevel: cefrLevelSchema,
  timingMs: z.number().int().nonnegative().optional(),
});
export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>;

export const answerTelemetryEventSchema = z.object({
  questionId: z.string().trim().min(1),
  sourceItemId: z.string().trim().min(1),
  cardType: questionCardTypeSchema,
  selectedOptionId: z.string().trim().min(1),
  correctOptionId: z.string().trim().min(1),
  isCorrect: z.boolean(),
  cefrLevel: cefrLevelSchema,
  promptLanguage: languageCodeSchema,
  answerLanguage: languageCodeSchema,
  timingMs: z.number().int().nonnegative().optional(),
  occurredAt: z.string().datetime(),
  meta: z.object({
    topicId: z.string().trim().min(1),
    generatorVersion: z.string().trim().min(1),
    distractorSource: z.enum(['linked_set', 'fallback_pool']),
  }).optional(),
});
export type AnswerTelemetryEvent = z.infer<typeof answerTelemetryEventSchema>;

export function generateQuestion(input: z.input<typeof questionGenerationRequestSchema>): GeneratedQuestion {
  return generateQuestionFromVocabItem(input);
}

export function generateQuestionFromVocabItem(input: z.input<typeof questionGenerationRequestSchema>): GeneratedQuestion {
  const request = questionGenerationRequestSchema.parse(input);
  const cardType = resolveQuestionCardType(request.sourceItem);
  const promptText = buildPromptText(request.sourceItem, cardType, request.promptLanguage, request.answerLanguage);
  const selection = selectDistractorOptions({
    sourceItem: request.sourceItem,
    allVocabItems: request.allVocabItems,
    distractorSets: request.distractorSets,
    promptLanguage: request.promptLanguage,
    answerLanguage: request.answerLanguage,
    generatorVersion: request.generatorVersion,
    cardType,
  });

  const correctOption = selection.options.find((option) => option.isCorrect);
  if (!correctOption) {
    throw new ContentAnswerError('ambiguous_options', 'Generated question must contain one correct option.');
  }

  const sourceItemIds = uniqueStrings([
    request.sourceItem.id,
    ...selection.options.flatMap((option) => option.linkedItemId ? [option.linkedItemId] : []),
  ]);

  return generatedQuestionSchema.parse({
    id: [
      'question',
      request.sourceItem.id,
      cardType,
      request.promptLanguage,
      request.answerLanguage,
    ].join(':'),
    cardType,
    promptLanguage: request.promptLanguage,
    answerLanguage: request.answerLanguage,
    promptText,
    options: selection.options,
    correctOptionId: correctOption.id,
    sourceItemIds,
    cefrLevel: request.sourceItem.cefrLevel,
    meta: {
      sourceItemId: request.sourceItem.id,
      topicId: request.sourceItem.topicId,
      distractorSource: selection.distractorSource,
      generatorVersion: request.generatorVersion,
      debug: selection.debug,
    },
  });
}

export function selectDistractorOptions(input: Readonly<{
  sourceItem: VocabItem;
  allVocabItems: readonly VocabItem[];
  distractorSets?: readonly DistractorSet[];
  promptLanguage: LanguageCode;
  answerLanguage: LanguageCode;
  generatorVersion?: string;
  cardType?: QuestionCardType;
}>): Readonly<{
  options: readonly QuestionOption[];
  distractorSource: 'linked_set' | 'fallback_pool';
  debug?: Record<string, string | number | boolean | null>;
}> {
  const cardType = input.cardType ?? resolveQuestionCardType(input.sourceItem);
  const generatorVersion = input.generatorVersion ?? DEFAULT_GENERATOR_VERSION;
  const linkedSet = findCompatibleLinkedDistractorSet(
    input.sourceItem,
    input.distractorSets ?? [],
    cardType,
    input.promptLanguage,
    input.answerLanguage,
  );

  if (linkedSet) {
    const options = linkedSet.options.map((option) => ({
      id: option.id,
      label: option.label,
      isCorrect: option.isCorrect,
      linkedItemId: option.linkedItemId,
    }));
    validateQuestionOptions(options);

    return {
      options,
      distractorSource: 'linked_set',
      debug: {
        linkedDistractorSetId: linkedSet.id,
        generatorVersion,
      },
    };
  }

  const correctLabel = buildAnswerLabel(input.sourceItem, cardType, input.answerLanguage);
  const candidatePool = input.allVocabItems.filter((candidate) =>
    isCompatibleFallbackCandidate(candidate, input.sourceItem, cardType),
  );

  const sameTopic = candidatePool.filter((candidate) => candidate.topicId === input.sourceItem.topicId);
  const broaderPool = candidatePool.filter((candidate) => candidate.topicId !== input.sourceItem.topicId);
  const rankedCandidates = [...rankCandidates(sameTopic, cardType, input.answerLanguage), ...rankCandidates(broaderPool, cardType, input.answerLanguage)];

  const distractors: QuestionOption[] = [];
  const usedLabels = new Set<string>([normalizeOptionLabel(correctLabel)]);

  for (const candidate of rankedCandidates) {
    const label = buildAnswerLabel(candidate, cardType, input.answerLanguage);
    const normalizedLabel = normalizeOptionLabel(label);
    if (usedLabels.has(normalizedLabel)) {
      continue;
    }

    distractors.push({
      id: `option:${candidate.id}`,
      label,
      isCorrect: false,
      linkedItemId: candidate.id,
    });
    usedLabels.add(normalizedLabel);

    if (distractors.length === 3) {
      break;
    }
  }

  const desiredOptionCount = distractors.length >= 3 ? 4 : distractors.length >= 2 ? 3 : 0;
  if (desiredOptionCount === 0) {
    throw new ContentAnswerError(
      'insufficient_distractors',
      `Could not generate enough distractors for source item "${input.sourceItem.id}".`,
    );
  }

  const options: QuestionOption[] = [
    {
      id: `option:${input.sourceItem.id}`,
      label: correctLabel,
      isCorrect: true,
      linkedItemId: input.sourceItem.id,
    },
    ...distractors.slice(0, desiredOptionCount - 1),
  ].sort((left, right) => left.label.localeCompare(right.label, 'fr'));

  validateQuestionOptions(options);

  return {
    options,
    distractorSource: 'fallback_pool',
    debug: {
      candidateCount: candidatePool.length,
      optionCount: options.length,
      generatorVersion,
    },
  };
}

export function validateQuestionOptions(options: readonly QuestionOption[]): readonly QuestionOption[] {
  if (options.length < 2) {
    throw new ContentAnswerError('insufficient_distractors', 'Questions must contain at least two answer options.');
  }

  const correctCount = options.filter((option) => option.isCorrect).length;
  if (correctCount !== 1) {
    throw new ContentAnswerError('ambiguous_options', 'Questions must contain exactly one correct option.');
  }

  const ids = new Set<string>();
  const labels = new Set<string>();

  for (const option of options) {
    if (ids.has(option.id)) {
      throw new ContentAnswerError('ambiguous_options', `Duplicate question option id "${option.id}".`);
    }
    ids.add(option.id);

    const normalizedLabel = normalizeOptionLabel(option.label);
    if (labels.has(normalizedLabel)) {
      throw new ContentAnswerError('ambiguous_options', `Duplicate question option label "${option.label}".`);
    }
    labels.add(normalizedLabel);
  }

  return options;
}

export function evaluateAnswer(
  question: GeneratedQuestion,
  selectedOptionId: string,
  input?: Readonly<{ shownAt?: string; answeredAt?: string }>,
): AnswerEvaluation {
  const parsedQuestion = generatedQuestionSchema.parse(question);
  const selectedOption = parsedQuestion.options.find((option) => option.id === selectedOptionId);

  if (!selectedOption) {
    throw new ContentAnswerError(
      'invalid_selected_option',
      `Selected option "${selectedOptionId}" is not part of question "${parsedQuestion.id}".`,
    );
  }

  const isCorrect = selectedOption.id === parsedQuestion.correctOptionId;
  const timingMs = resolveTimingMs(input?.shownAt, input?.answeredAt);

  return answerEvaluationSchema.parse({
    questionId: parsedQuestion.id,
    selectedOptionId,
    correctOptionId: parsedQuestion.correctOptionId,
    isCorrect,
    moveUnlocked: isCorrect,
    penalty: isCorrect ? null : { applies: true, penaltyType: 'heart_loss', amount: 1 },
    cardType: parsedQuestion.cardType,
    sourceItemId: parsedQuestion.meta.sourceItemId,
    cefrLevel: parsedQuestion.cefrLevel,
    ...(timingMs === undefined ? {} : { timingMs }),
  });
}

export function buildAnswerTelemetryEvent(input: Readonly<{
  question: GeneratedQuestion;
  evaluation: AnswerEvaluation;
  occurredAt: string;
  meta?: Readonly<{
    topicId?: string;
    generatorVersion?: string;
    distractorSource?: 'linked_set' | 'fallback_pool';
  }>;
}>): AnswerTelemetryEvent {
  const question = generatedQuestionSchema.parse(input.question);
  const evaluation = answerEvaluationSchema.parse(input.evaluation);

  return answerTelemetryEventSchema.parse({
    questionId: question.id,
    sourceItemId: question.meta.sourceItemId,
    cardType: question.cardType,
    selectedOptionId: evaluation.selectedOptionId,
    correctOptionId: question.correctOptionId,
    isCorrect: evaluation.isCorrect,
    cefrLevel: question.cefrLevel,
    promptLanguage: question.promptLanguage,
    answerLanguage: question.answerLanguage,
    ...(evaluation.timingMs === undefined ? {} : { timingMs: evaluation.timingMs }),
    occurredAt: input.occurredAt,
    meta: {
      topicId: input.meta?.topicId ?? question.meta.topicId,
      generatorVersion: input.meta?.generatorVersion ?? question.meta.generatorVersion,
      distractorSource: input.meta?.distractorSource ?? question.meta.distractorSource,
    },
  });
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

export function isContentStatus(value: string): value is ContentStatus {
  return contentStatusSchema.safeParse(value).success;
}

function resolveQuestionCardType(sourceItem: VocabItem): QuestionCardType {
  if (sourceItem.itemType === 'article_noun') {
    return 'article_noun_selection';
  }

  if (sourceItem.itemType === 'phrase') {
    return 'phrase_translation';
  }

  if (sourceItem.itemType === 'word') {
    return 'single_word_translation';
  }

  throw new ContentAnswerError(
    'unsupported_card_type',
    `Unsupported source item "${sourceItem.id}" for answer generation.`,
  );
}

function buildPromptText(
  sourceItem: VocabItem,
  cardType: QuestionCardType,
  promptLanguage: LanguageCode,
  answerLanguage: LanguageCode,
): string {
  if (promptLanguage === answerLanguage) {
    throw new ContentAnswerError(
      'invalid_generation_request',
      'Question generation requires different prompt and answer languages.',
    );
  }

  if (cardType === 'article_noun_selection') {
    if (promptLanguage !== 'ru' || answerLanguage !== 'fr') {
      throw new ContentAnswerError(
        'invalid_generation_request',
        'article_noun_selection currently supports only Russian prompts with French answers.',
      );
    }

    return sourceItem.translationRu;
  }

  return promptLanguage === 'ru' ? sourceItem.translationRu : sourceItem.surfaceForm;
}

function buildAnswerLabel(
  item: VocabItem,
  cardType: QuestionCardType,
  answerLanguage: LanguageCode,
): string {
  if (cardType === 'article_noun_selection') {
    if (!isArticleNounCapable(item)) {
      throw new ContentAnswerError(
        'unsupported_card_type',
        `Item "${item.id}" cannot be used for article_noun_selection.`,
      );
    }

    return buildArticleNounLabel(item);
  }

  return answerLanguage === 'fr' ? item.surfaceForm : item.translationRu;
}

function buildArticleNounLabel(item: VocabItem): string {
  const article = item.article?.trim();
  if (!article) {
    throw new ContentAnswerError('unsupported_card_type', `Item "${item.id}" is missing article data.`);
  }

  const baseSurface = item.surfaceForm.trim();
  const articlePrefix = `${article.toLocaleLowerCase('fr')} `;
  if (baseSurface.toLocaleLowerCase('fr').startsWith(articlePrefix)) {
    return baseSurface;
  }

  return `${article} ${item.lemma}`;
}

function findCompatibleLinkedDistractorSet(
  sourceItem: VocabItem,
  distractorSets: readonly DistractorSet[],
  cardType: QuestionCardType,
  promptLanguage: LanguageCode,
  answerLanguage: LanguageCode,
): DistractorSet | null {
  if (!sourceItem.distractorSetId) {
    return null;
  }

  const expectedCardType = mapQuestionCardTypeToContentCardType(cardType);
  return distractorSets.find((set) =>
    set.id === sourceItem.distractorSetId
    && set.cardType === expectedCardType
    && set.cefrLevel === sourceItem.cefrLevel
    && set.promptLanguage === promptLanguage
    && set.answerLanguage === answerLanguage,
  ) ?? null;
}

function mapQuestionCardTypeToContentCardType(cardType: QuestionCardType): CardType {
  switch (cardType) {
    case 'single_word_translation':
      return 'single_word';
    case 'phrase_translation':
      return 'phrase';
    case 'article_noun_selection':
      return 'article_noun';
  }
}

function isCompatibleFallbackCandidate(
  candidate: VocabItem,
  sourceItem: VocabItem,
  cardType: QuestionCardType,
): boolean {
  if (candidate.id === sourceItem.id) {
    return false;
  }

  if (candidate.cefrLevel !== sourceItem.cefrLevel) {
    return false;
  }

  switch (cardType) {
    case 'single_word_translation':
      return candidate.itemType === 'word' && candidate.partOfSpeech === sourceItem.partOfSpeech;
    case 'phrase_translation':
      return candidate.itemType === 'phrase';
    case 'article_noun_selection':
      return isArticleNounCapable(candidate);
  }
}

function rankCandidates(
  candidates: readonly VocabItem[],
  cardType: QuestionCardType,
  answerLanguage: LanguageCode,
): readonly VocabItem[] {
  return [...candidates].sort((left, right) => {
    const leftLabel = buildAnswerLabel(left, cardType, answerLanguage);
    const rightLabel = buildAnswerLabel(right, cardType, answerLanguage);
    const labelComparison = leftLabel.localeCompare(rightLabel, 'fr');
    if (labelComparison !== 0) {
      return labelComparison;
    }

    return left.id.localeCompare(right.id, 'en');
  });
}

function isNounLike(item: Pick<VocabItem, 'partOfSpeech' | 'itemType'>): boolean {
  return item.partOfSpeech === 'noun' || item.itemType === 'article_noun';
}

function isArticleNounCapable(item: Pick<VocabItem, 'partOfSpeech' | 'itemType' | 'article' | 'gender'>): boolean {
  return isNounLike(item) && typeof item.article === 'string' && item.article.length > 0 && typeof item.gender === 'string';
}

function resolveTimingMs(shownAt?: string, answeredAt?: string): number | undefined {
  if (!shownAt || !answeredAt) {
    return undefined;
  }

  const shownAtMs = Date.parse(shownAt);
  const answeredAtMs = Date.parse(answeredAt);
  if (Number.isNaN(shownAtMs) || Number.isNaN(answeredAtMs) || answeredAtMs < shownAtMs) {
    return undefined;
  }

  return answeredAtMs - shownAtMs;
}

function normalizeOptionLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function addOptionValidationIssues(
  options: readonly { id: string; label: string; isCorrect: boolean }[],
  context: z.RefinementCtx,
  basePath: readonly (string | number)[],
) {
  const correctCount = options.filter((option) => option.isCorrect).length;
  if (correctCount !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Options must contain exactly one correct answer.',
      path: [...basePath],
    });
  }

  const ids = new Set<string>();
  const labels = new Set<string>();

  options.forEach((option, index) => {
    if (ids.has(option.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate option id "${option.id}".`,
        path: [...basePath, index, 'id'],
      });
    }
    ids.add(option.id);

    const normalizedLabel = normalizeOptionLabel(option.label);
    if (labels.has(normalizedLabel)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate option label "${option.label}".`,
        path: [...basePath, index, 'label'],
      });
    }
    labels.add(normalizedLabel);
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

function addUniqueValueIssues<T>(
  values: readonly T[],
  context: z.RefinementCtx,
  basePath: readonly (string | number)[],
  messageForValue: (value: T) => string,
  pathBuilder?: (index: number) => readonly (string | number)[],
) {
  const seen = new Set<T>();

  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: messageForValue(value),
        path: pathBuilder ? [...basePath, ...pathBuilder(index)] : [...basePath, index],
      });
    }
    seen.add(value);
  });
}
