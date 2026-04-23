import {
  distractorSetSchema,
  editorialImportBundleSchema,
  generateQuestion,
  type DistractorSet,
  type EditorialImportBundle,
  type Lesson,
  type VocabItem,
  vocabItemSchema,
} from './index.js';
import {
  phase11A1SourceList,
  phase11A2SourceList,
  phase11LessonDefinitions,
  phase11SourceLists,
  phase11TopicDefinitions,
  type Phase11SourceEntry,
} from './phase11-source-lists.js';

const PHASE11_TIMESTAMP = '2026-04-23T00:00:00.000Z';
const PHASE11_ACTOR = 'system.phase11';
const PHASE11_SOURCE_LABEL = 'Phase 11 curated launch list';

export type Phase11LaunchIssue = Readonly<{
  code:
    | 'schema_invalid'
    | 'translation_incomplete'
    | 'article_gender_inconsistent'
    | 'status_not_approved'
    | 'distractor_invalid'
    | 'card_type_incompatible'
    | 'question_generation_failed';
  path: string;
  message: string;
}>;

export type Phase11LaunchQaSnapshot = Readonly<{
  totalItems: number;
  totalDistractorSets: number;
  totalLessons: number;
  totalTopics: number;
  levelCounts: Record<'A1' | 'A2', number>;
  topicCounts: Record<string, number>;
  issueCount: number;
}>;

type NormalizedSourceEntry = Phase11SourceEntry & Readonly<{
  id: string;
  distractorSetId: string;
  frequencyScore: number;
  sourceOrder: number;
}>;

const normalizedEntries = normalizeSourceEntries([...phase11A1SourceList, ...phase11A2SourceList]);
const normalizedVocabItems = normalizedEntries.map(buildVocabItem);
const phase11DistractorSets = buildDistractorSets(normalizedVocabItems);
const phase11Lessons = buildLessons(normalizedEntries);
const phase11Levels = buildLevels();

export const phase11LaunchBundle: EditorialImportBundle = editorialImportBundleSchema.parse({
  version: 'phase11-launch-v1',
  exportedAt: PHASE11_TIMESTAMP,
  sourceLabel: 'phase11-a1-a2-launch-pack',
  levels: phase11Levels,
  topics: phase11TopicDefinitions.map((topic) => ({
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    description: topic.description,
    cefrLevels: [...topic.cefrLevels],
    status: 'approved',
    editorialMetadata: createEditorialMetadata(),
  })),
  lessons: phase11Lessons,
  vocabItems: normalizedVocabItems,
  distractorSets: phase11DistractorSets,
});

export const phase11LaunchIssues = findPhase11LaunchIssues(phase11LaunchBundle);

export const phase11LaunchQaSnapshot: Phase11LaunchQaSnapshot = {
  totalItems: phase11LaunchBundle.vocabItems.length,
  totalDistractorSets: phase11LaunchBundle.distractorSets.length,
  totalLessons: phase11LaunchBundle.lessons.length,
  totalTopics: phase11LaunchBundle.topics.length,
  levelCounts: {
    A1: phase11SourceLists.A1.length,
    A2: phase11SourceLists.A2.length,
  },
  topicCounts: Object.fromEntries(
    phase11LaunchBundle.topics.map((topic) => [
      topic.id,
      phase11LaunchBundle.vocabItems.filter((item) => item.topicId === topic.id).length,
    ]),
  ),
  issueCount: phase11LaunchIssues.length,
};

export function findPhase11LaunchIssues(bundle: EditorialImportBundle): readonly Phase11LaunchIssue[] {
  const validation = editorialImportBundleSchema.safeParse(bundle);
  if (!validation.success) {
    return validation.error.issues.map((issue) => ({
      code: 'schema_invalid',
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }

  const issues: Phase11LaunchIssue[] = [];
  const itemById = new Map(bundle.vocabItems.map((item) => [item.id, item]));

  for (const item of bundle.vocabItems) {
    if (item.status !== 'approved') {
      issues.push({
        code: 'status_not_approved',
        path: `vocabItems.${item.id}.status`,
        message: `Item "${item.id}" must be approved.`,
      });
    }

    if (item.translationRu.trim().length === 0 || /^(todo|tbd|xxx)$/i.test(item.translationRu)) {
      issues.push({
        code: 'translation_incomplete',
        path: `vocabItems.${item.id}.translationRu`,
        message: `Item "${item.id}" has incomplete Russian translation.`,
      });
    }

    if (isNounLike(item)) {
      if (!item.article || !item.gender) {
        issues.push({
          code: 'article_gender_inconsistent',
          path: `vocabItems.${item.id}.article`,
          message: `Noun-like item "${item.id}" must include article and gender.`,
        });
      } else {
        renderArticleNoun(item.article, item.lemma);
      }
    } else if (item.article || item.gender) {
      issues.push({
        code: 'article_gender_inconsistent',
        path: `vocabItems.${item.id}.article`,
        message: `Non-noun item "${item.id}" must not include article or gender.`,
      });
    }

    try {
      const question = generateQuestion({
        sourceItem: item,
        allVocabItems: bundle.vocabItems,
        distractorSets: bundle.distractorSets,
        promptLanguage: 'ru',
        answerLanguage: 'fr',
      });

      if (question.meta.distractorSource !== 'linked_set') {
        issues.push({
          code: 'distractor_invalid',
          path: `vocabItems.${item.id}.distractorSetId`,
          message: `Item "${item.id}" must resolve through an explicit linked distractor set.`,
        });
      }
    } catch (error) {
      issues.push({
        code: 'question_generation_failed',
        path: `vocabItems.${item.id}`,
        message: error instanceof Error ? error.message : `Question generation failed for "${item.id}".`,
      });
    }
  }

  for (const set of bundle.distractorSets) {
    if (set.status !== 'approved') {
      issues.push({
        code: 'status_not_approved',
        path: `distractorSets.${set.id}.status`,
        message: `Distractor set "${set.id}" must be approved.`,
      });
    }

    const sourceItem = set.sourceItemId ? itemById.get(set.sourceItemId) : undefined;
    if (!sourceItem) {
      issues.push({
        code: 'distractor_invalid',
        path: `distractorSets.${set.id}.sourceItemId`,
        message: `Distractor set "${set.id}" must link to an existing source item.`,
      });
      continue;
    }

    if (set.cardType !== mapItemTypeToCardType(sourceItem.itemType)) {
      issues.push({
        code: 'card_type_incompatible',
        path: `distractorSets.${set.id}.cardType`,
        message: `Distractor set "${set.id}" has incompatible card type for "${sourceItem.id}".`,
      });
    }

    const normalizedLabels = new Set<string>();
    let correctCount = 0;

    for (const option of set.options) {
      const normalizedLabel = normalizeOptionLabel(option.label);
      if (normalizedLabels.has(normalizedLabel)) {
        issues.push({
          code: 'distractor_invalid',
          path: `distractorSets.${set.id}.options`,
          message: `Distractor set "${set.id}" contains duplicate normalized labels.`,
        });
      }
      normalizedLabels.add(normalizedLabel);

      if (option.isCorrect) {
        correctCount += 1;
      }

      if (!option.isCorrect && option.linkedItemId === sourceItem.id) {
        issues.push({
          code: 'distractor_invalid',
          path: `distractorSets.${set.id}.options.${option.id}`,
          message: `Distractor set "${set.id}" links a wrong option back to its source item.`,
        });
      }
    }

    if (correctCount !== 1) {
      issues.push({
        code: 'distractor_invalid',
        path: `distractorSets.${set.id}.options`,
        message: `Distractor set "${set.id}" must contain exactly one correct option.`,
      });
    }
  }

  return issues;
}

function normalizeSourceEntries(entries: readonly Phase11SourceEntry[]): readonly NormalizedSourceEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    id: `vocab.${entry.levelId.toLowerCase()}.${entry.topicId.replace(/^topic\./, '')}.${entry.slug}`,
    distractorSetId: `distractor.${entry.levelId.toLowerCase()}.${entry.slug}`,
    frequencyScore: Math.max(1, 500 - index),
    sourceOrder: index + 1,
  }));
}

function buildVocabItem(entry: NormalizedSourceEntry): VocabItem {
  return vocabItemSchema.parse({
    id: entry.id,
    language: 'fr',
    itemType: entry.itemType,
    partOfSpeech: entry.partOfSpeech,
    cefrLevel: entry.levelId,
    lemma: entry.lemma,
    surfaceForm: entry.surfaceForm,
    ...(entry.article ? { article: entry.article } : {}),
    ...(entry.gender ? { gender: entry.gender } : {}),
    translationRu: entry.translationRu,
    translations: [],
    topicId: entry.topicId,
    tags: [entry.levelId.toLowerCase(), entry.topicId.replace(/^topic\./, '')],
    exampleSentence: resolveExample(entry),
    exampleSentences: [],
    distractorSetId: entry.distractorSetId,
    distractorHints: [],
    source: {
      label: PHASE11_SOURCE_LABEL,
      kind: 'editorial',
      citation: 'Internal launch normalization pass',
    },
    frequencyScore: entry.frequencyScore,
    status: 'approved',
    editorNotes: 'Phase 11 launch pack',
    editorialMetadata: createEditorialMetadata(),
  });
}

function buildLessons(entries: readonly NormalizedSourceEntry[]): readonly Lesson[] {
  return phase11LessonDefinitions.map((lesson) => {
    const lessonEntries = entries
      .filter((entry) => entry.lessonId === lesson.id)
      .sort((left, right) => left.sourceOrder - right.sourceOrder);

    return {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      description: lesson.description,
      cefrLevel: lesson.cefrLevel,
      topicIds: [...lesson.topicIds],
      contentRefs: lessonEntries.map((entry, index) => ({
        itemId: entry.id,
        order: index + 1,
        cardType: mapItemTypeToCardType(entry.itemType),
      })),
      status: 'approved',
      editorialMetadata: createEditorialMetadata(),
    };
  });
}

function buildLevels() {
  return (['A1', 'A2'] as const).map((levelId, index) => ({
    id: levelId,
    cefrLevel: levelId,
    title: levelId,
    description: levelId === 'A1' ? 'Стартовый уровень для запуска базовой лексики.' : 'Расширение стартовой лексики до устойчивого A2.',
    order: index + 1,
    topicIds: phase11TopicDefinitions
      .filter((topic) => topic.cefrLevels.includes(levelId))
      .map((topic) => topic.id),
    lessonIds: phase11LessonDefinitions
      .filter((lesson) => lesson.cefrLevel === levelId)
      .map((lesson) => lesson.id),
    status: 'approved' as const,
    editorialMetadata: createEditorialMetadata(),
  }));
}

function buildDistractorSets(vocabItems: readonly VocabItem[]): readonly DistractorSet[] {
  return vocabItems.map((item) => {
    const question = generateQuestion({
      sourceItem: item,
      allVocabItems: [...vocabItems],
      promptLanguage: 'ru',
      answerLanguage: 'fr',
      distractorSets: [],
    });

    return distractorSetSchema.parse({
      id: item.distractorSetId,
      cardType: mapItemTypeToCardType(item.itemType),
      promptLanguage: 'ru',
      answerLanguage: 'fr',
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        isCorrect: option.isCorrect,
        linkedItemId: option.linkedItemId,
      })),
      sourceItemId: item.id,
      cefrLevel: item.cefrLevel,
      status: 'approved',
      editorialMetadata: createEditorialMetadata(),
    });
  });
}

function resolveExample(entry: Phase11SourceEntry): Readonly<{ fr: string; ru: string }> {
  if (entry.exampleFr && entry.exampleRu) {
    return { fr: entry.exampleFr, ru: entry.exampleRu };
  }

  switch (entry.partOfSpeech) {
    case 'noun':
      return {
        fr: `C'est ${renderArticleNoun(entry.article ?? 'le', entry.surfaceForm)}.`,
        ru: `Это ${entry.translationRu}.`,
      };
    case 'adjective':
      return {
        fr: `C'est ${entry.surfaceForm}.`,
        ru: `Это ${entry.translationRu}.`,
      };
    case 'determiner':
      return {
        fr: `J'ai ${entry.surfaceForm} livres.`,
        ru: `У меня ${entry.translationRu} книги.`,
      };
    case 'expression':
      return {
        fr: punctuate(entry.surfaceForm),
        ru: punctuate(entry.translationRu),
      };
    default:
      return {
        fr: punctuate(entry.surfaceForm),
        ru: punctuate(entry.translationRu),
      };
  }
}

function createEditorialMetadata() {
  return {
    createdBy: PHASE11_ACTOR,
    updatedBy: PHASE11_ACTOR,
    publishedBy: PHASE11_ACTOR,
    createdAt: PHASE11_TIMESTAMP,
    updatedAt: PHASE11_TIMESTAMP,
    publishedAt: PHASE11_TIMESTAMP,
  };
}

function renderArticleNoun(article: string, lemma: string): string {
  const trimmedArticle = article.trim();
  const trimmedLemma = lemma.trim();
  return trimmedArticle.endsWith("'")
    ? `${trimmedArticle}${trimmedLemma}`
    : `${trimmedArticle} ${trimmedLemma}`;
}

function punctuate(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function mapItemTypeToCardType(itemType: VocabItem['itemType']): DistractorSet['cardType'] {
  switch (itemType) {
    case 'word':
      return 'single_word';
    case 'phrase':
      return 'phrase';
    case 'article_noun':
      return 'article_noun';
  }
}

function normalizeOptionLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}

function isNounLike(item: Readonly<{ partOfSpeech: VocabItem['partOfSpeech']; itemType: VocabItem['itemType'] }>): boolean {
  return item.partOfSpeech === 'noun' || item.itemType === 'article_noun';
}

export const phase11SourceListCounts = {
  A1: phase11A1SourceList.length,
  A2: phase11A2SourceList.length,
  total: phase11A1SourceList.length + phase11A2SourceList.length,
} as const;
