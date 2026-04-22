import { z } from 'zod';

import {
  cefrLevelSchema,
  contentStatusSchema,
  languageCodeSchema,
  type CefrLevelId,
  type LanguageCode,
} from '@langue-buster/shared';

export const vocabItemSchema = z.object({
  id: z.string(),
  lemma: z.string().min(1),
  surfaceForm: z.string().min(1),
  language: languageCodeSchema.or(z.literal('multi')),
  cefrLevel: cefrLevelSchema,
  partOfSpeech: z.string().min(1),
  translationPairs: z.array(
    z.object({
      language: languageCodeSchema,
      value: z.string().min(1),
    }),
  ),
  distractors: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  frequencyPriority: z.number().int().nonnegative().default(0),
  gender: z.string().optional(),
  article: z.string().optional(),
  examples: z.array(
    z.object({
      fr: z.string().min(1),
      ru: z.string().min(1),
    }),
  ).default([]),
  audioAssetId: z.string().optional(),
  reviewMetadata: z
    .object({
      source: z.string().min(1),
      editorNotes: z.string().optional(),
      lastReviewedAt: z.string().datetime().optional(),
    })
    .optional(),
  status: contentStatusSchema,
});
export type VocabItem = z.infer<typeof vocabItemSchema>;

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
    cardType: z.enum(['single_word', 'phrase', 'article_noun']),
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
  const prompt =
    input.promptLanguage === 'ru' ? 'яблоко' : 'pomme';

  const correct =
    input.answerLanguage === 'fr' ? 'la pomme' : 'яблоко';

  const distractors =
    input.answerLanguage === 'fr'
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
