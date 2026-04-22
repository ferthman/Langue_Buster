import { z } from 'zod';

export * from './auth';

export const cefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export type CefrLevelId = z.infer<typeof cefrLevelSchema>;

export const launchLevels = ['A1', 'A2'] as const satisfies readonly CefrLevelId[];

export const cefrLevels = [
  { id: 'A1', label: 'A1 · Старт' },
  { id: 'A2', label: 'A2 · База' },
  { id: 'B1', label: 'B1 · Самостоятельность' },
  { id: 'B2', label: 'B2 · Свободное общение' },
  { id: 'C1', label: 'C1 · Продвинутый уровень' },
  { id: 'C2', label: 'C2 · Почти носитель' },
] as const satisfies ReadonlyArray<{ id: CefrLevelId; label: string }>;

export const languageCodeSchema = z.enum(['ru', 'fr']);
export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const contentStatusSchema = z.enum(['draft', 'on_review', 'approved', 'archived']);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const answerDirectionSchema = z.enum(['ru_to_fr', 'fr_to_ru']);
export type AnswerDirection = z.infer<typeof answerDirectionSchema>;

export const runSessionSchema = z.object({
  id: z.string(),
  levelId: cefrLevelSchema,
  direction: answerDirectionSchema,
  heartsRemaining: z.number().int().nonnegative(),
  score: z.number().int().nonnegative(),
  combo: z.number().int().nonnegative(),
});
export type RunSession = z.infer<typeof runSessionSchema>;
