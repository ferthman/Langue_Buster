import {
  distractorSetSchema,
  vocabItemSchema,
  type DistractorSet,
  type VocabItem,
} from '@langue-buster/content-core';
import type { CefrLevelId } from '@langue-buster/shared';

type SeedBundle = Readonly<{
  vocabItems: readonly VocabItem[];
  distractorSets: readonly DistractorSet[];
}>;

export type RunContentRepository = ReturnType<typeof createRunContentRepository>;

const seedBundles = new Map<CefrLevelId, SeedBundle>([
  ['A1', createA1Bundle()],
  ['A2', createA2Bundle()],
]);

export function createRunContentRepository() {
  const itemIndex = new Map<string, VocabItem>();
  const distractorIndex = new Map<CefrLevelId, readonly DistractorSet[]>();

  for (const [levelId, bundle] of seedBundles.entries()) {
    distractorIndex.set(levelId, bundle.distractorSets);
    for (const item of bundle.vocabItems) {
      itemIndex.set(item.id, item);
    }
  }

  return {
    getLevelBundle(levelId: CefrLevelId): SeedBundle {
      const bundle = seedBundles.get(levelId);
      if (!bundle) {
        throw new Error(`No approved run content bundle exists for ${levelId}.`);
      }

      return bundle;
    },

    findItemById(sourceItemId: string): VocabItem | null {
      return itemIndex.get(sourceItemId) ?? null;
    },

    getBundleForItem(sourceItemId: string): SeedBundle | null {
      const item = itemIndex.get(sourceItemId);
      if (!item) {
        return null;
      }

      return seedBundles.get(item.cefrLevel) ?? null;
    },

    listItemsByLevel(levelId: CefrLevelId): readonly VocabItem[] {
      return this.getLevelBundle(levelId).vocabItems;
    },

    listDistractorSetsByLevel(levelId: CefrLevelId): readonly DistractorSet[] {
      return distractorIndex.get(levelId) ?? [];
    },
  };
}

function createA1Bundle(): SeedBundle {
  const vocabItems = [
    createItem({
      id: 'vocab.a1.apple',
      cefrLevel: 'A1',
      lemma: 'pomme',
      surfaceForm: 'pomme',
      translationRu: 'яблоко',
      gender: 'feminine',
      article: 'la',
      topicId: 'topic.food',
      exampleFr: 'Je mange une pomme.',
      exampleRu: 'Я ем яблоко.',
    }),
    createItem({
      id: 'vocab.a1.pear',
      cefrLevel: 'A1',
      lemma: 'poire',
      surfaceForm: 'poire',
      translationRu: 'груша',
      gender: 'feminine',
      article: 'la',
      topicId: 'topic.food',
      exampleFr: 'La poire est verte.',
      exampleRu: 'Груша зелёная.',
    }),
    createItem({
      id: 'vocab.a1.orange',
      cefrLevel: 'A1',
      lemma: 'orange',
      surfaceForm: 'orange',
      translationRu: 'апельсин',
      gender: 'feminine',
      article: "l'",
      topicId: 'topic.food',
      exampleFr: 'J’achète une orange.',
      exampleRu: 'Я покупаю апельсин.',
    }),
    createItem({
      id: 'vocab.a1.bread',
      cefrLevel: 'A1',
      lemma: 'pain',
      surfaceForm: 'pain',
      translationRu: 'хлеб',
      gender: 'masculine',
      article: 'le',
      topicId: 'topic.food',
      exampleFr: 'Le pain est frais.',
      exampleRu: 'Хлеб свежий.',
    }),
    createItem({
      id: 'vocab.a1.water',
      cefrLevel: 'A1',
      lemma: 'eau',
      surfaceForm: 'eau',
      translationRu: 'вода',
      gender: 'feminine',
      article: "l'",
      topicId: 'topic.food',
      exampleFr: 'Je bois de l’eau.',
      exampleRu: 'Я пью воду.',
    }),
    createItem({
      id: 'vocab.a1.hello',
      cefrLevel: 'A1',
      lemma: 'bonjour',
      surfaceForm: 'bonjour',
      translationRu: 'здравствуйте',
      topicId: 'topic.greetings',
      exampleFr: 'Bonjour, Marie.',
      exampleRu: 'Здравствуйте, Мари.',
      partOfSpeech: 'expression',
      itemType: 'phrase',
    }),
  ];

  return {
    vocabItems,
    distractorSets: [
      createDistractorSet('distractor.a1.apple', 'vocab.a1.apple', 'A1', [
        { id: 'opt.apple', label: 'pomme', isCorrect: true, linkedItemId: 'vocab.a1.apple' },
        { id: 'opt.pear', label: 'poire', isCorrect: false, linkedItemId: 'vocab.a1.pear' },
        { id: 'opt.orange', label: 'orange', isCorrect: false, linkedItemId: 'vocab.a1.orange' },
        { id: 'opt.bread', label: 'pain', isCorrect: false, linkedItemId: 'vocab.a1.bread' },
      ]),
      createDistractorSet('distractor.a1.bread', 'vocab.a1.bread', 'A1', [
        { id: 'opt.bread', label: 'pain', isCorrect: true, linkedItemId: 'vocab.a1.bread' },
        { id: 'opt.water', label: 'eau', isCorrect: false, linkedItemId: 'vocab.a1.water' },
        { id: 'opt.apple', label: 'pomme', isCorrect: false, linkedItemId: 'vocab.a1.apple' },
        { id: 'opt.hello', label: 'bonjour', isCorrect: false, linkedItemId: 'vocab.a1.hello' },
      ]),
    ],
  };
}

function createA2Bundle(): SeedBundle {
  const vocabItems = [
    createItem({
      id: 'vocab.a2.travel',
      cefrLevel: 'A2',
      lemma: 'voyage',
      surfaceForm: 'voyage',
      translationRu: 'путешествие',
      gender: 'masculine',
      article: 'le',
      topicId: 'topic.travel',
      exampleFr: 'Le voyage est long.',
      exampleRu: 'Путешествие длинное.',
    }),
    createItem({
      id: 'vocab.a2.station',
      cefrLevel: 'A2',
      lemma: 'gare',
      surfaceForm: 'gare',
      translationRu: 'вокзал',
      gender: 'feminine',
      article: 'la',
      topicId: 'topic.travel',
      exampleFr: 'La gare est proche.',
      exampleRu: 'Вокзал рядом.',
    }),
    createItem({
      id: 'vocab.a2.ticket',
      cefrLevel: 'A2',
      lemma: 'billet',
      surfaceForm: 'billet',
      translationRu: 'билет',
      gender: 'masculine',
      article: 'le',
      topicId: 'topic.travel',
      exampleFr: 'Je cherche mon billet.',
      exampleRu: 'Я ищу свой билет.',
    }),
    createItem({
      id: 'vocab.a2.train',
      cefrLevel: 'A2',
      lemma: 'train',
      surfaceForm: 'train',
      translationRu: 'поезд',
      gender: 'masculine',
      article: 'le',
      topicId: 'topic.travel',
      exampleFr: 'Le train part à huit heures.',
      exampleRu: 'Поезд отправляется в восемь.',
    }),
    createItem({
      id: 'vocab.a2.room',
      cefrLevel: 'A2',
      lemma: 'chambre',
      surfaceForm: 'chambre',
      translationRu: 'комната',
      gender: 'feminine',
      article: 'la',
      topicId: 'topic.home',
      exampleFr: 'La chambre est claire.',
      exampleRu: 'Комната светлая.',
    }),
    createItem({
      id: 'vocab.a2.arrive',
      cefrLevel: 'A2',
      lemma: 'arriver',
      surfaceForm: 'arriver',
      translationRu: 'прибывать',
      topicId: 'topic.travel',
      exampleFr: 'Le train va arriver.',
      exampleRu: 'Поезд скоро прибудет.',
      partOfSpeech: 'verb',
    }),
  ];

  return {
    vocabItems,
    distractorSets: [
      createDistractorSet('distractor.a2.station', 'vocab.a2.station', 'A2', [
        { id: 'opt.station', label: 'gare', isCorrect: true, linkedItemId: 'vocab.a2.station' },
        { id: 'opt.ticket', label: 'billet', isCorrect: false, linkedItemId: 'vocab.a2.ticket' },
        { id: 'opt.train', label: 'train', isCorrect: false, linkedItemId: 'vocab.a2.train' },
        { id: 'opt.room', label: 'chambre', isCorrect: false, linkedItemId: 'vocab.a2.room' },
      ]),
      createDistractorSet('distractor.a2.travel', 'vocab.a2.travel', 'A2', [
        { id: 'opt.travel', label: 'voyage', isCorrect: true, linkedItemId: 'vocab.a2.travel' },
        { id: 'opt.arrive', label: 'arriver', isCorrect: false, linkedItemId: 'vocab.a2.arrive' },
        { id: 'opt.train', label: 'train', isCorrect: false, linkedItemId: 'vocab.a2.train' },
        { id: 'opt.ticket', label: 'billet', isCorrect: false, linkedItemId: 'vocab.a2.ticket' },
      ]),
    ],
  };
}

function createItem(input: {
  id: string;
  cefrLevel: 'A1' | 'A2';
  lemma: string;
  surfaceForm: string;
  translationRu: string;
  topicId: string;
  exampleFr: string;
  exampleRu: string;
  itemType?: 'word' | 'phrase' | 'article_noun';
  partOfSpeech?: 'noun' | 'verb' | 'expression';
  article?: string;
  gender?: 'masculine' | 'feminine';
}): VocabItem {
  return vocabItemSchema.parse({
    id: input.id,
    language: 'fr',
    itemType: input.itemType ?? 'word',
    partOfSpeech: input.partOfSpeech ?? 'noun',
    cefrLevel: input.cefrLevel,
    lemma: input.lemma,
    surfaceForm: input.surfaceForm,
    article: input.article,
    gender: input.gender,
    translationRu: input.translationRu,
    topicId: input.topicId,
    exampleSentence: {
      fr: input.exampleFr,
      ru: input.exampleRu,
    },
    source: {
      label: 'Phase 7 approved seed bundle',
      kind: 'internal',
    },
    frequencyScore: 1,
    status: 'approved',
    editorialMetadata: {
      createdBy: 'system.phase7',
      publishedBy: 'system.phase7',
      createdAt: '2026-04-22T00:00:00.000Z',
      publishedAt: '2026-04-22T00:00:00.000Z',
    },
  });
}

function createDistractorSet(
  id: string,
  sourceItemId: string,
  cefrLevel: 'A1' | 'A2',
  options: ReadonlyArray<{
    id: string;
    label: string;
    isCorrect: boolean;
    linkedItemId: string;
  }>,
): DistractorSet {
  return distractorSetSchema.parse({
    id,
    cardType: 'single_word',
    promptLanguage: 'ru',
    answerLanguage: 'fr',
    options,
    sourceItemId,
    cefrLevel,
    status: 'approved',
    editorialMetadata: {
      createdBy: 'system.phase7',
      publishedBy: 'system.phase7',
      createdAt: '2026-04-22T00:00:00.000Z',
      publishedAt: '2026-04-22T00:00:00.000Z',
    },
  });
}
