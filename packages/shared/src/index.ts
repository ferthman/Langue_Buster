import { z } from 'zod';

export * from './auth.js';

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

export const boardCellStateSchema = z.enum(['empty', 'filled']);
export type BoardCellState = z.infer<typeof boardCellStateSchema>;

export const coordinateSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});
export type Coordinate = z.infer<typeof coordinateSchema>;

export const pieceIdSchema = z.enum([
  'single_1',
  'bar_h_2',
  'bar_h_3',
  'bar_h_4',
  'bar_h_5',
  'bar_v_2',
  'bar_v_3',
  'bar_v_4',
  'bar_v_5',
  'square_2',
  'rect_2x3',
  'l3',
]);
export type PieceId = z.infer<typeof pieceIdSchema>;

export const pieceInstanceSchema = z.object({
  instanceId: z.string().min(1),
  pieceId: pieceIdSchema,
});
export type PieceInstance = z.infer<typeof pieceInstanceSchema>;

export const traySlotSchema = pieceInstanceSchema.nullable();
export type TraySlot = z.infer<typeof traySlotSchema>;

export const trayStateSchema = z.tuple([traySlotSchema, traySlotSchema, traySlotSchema]);
export type TrayState = z.infer<typeof trayStateSchema>;

export const boardStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  cells: z.array(boardCellStateSchema),
}).superRefine((value, context) => {
  if (value.cells.length !== value.width * value.height) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Board cell count must match width * height.',
      path: ['cells'],
    });
  }
});
export type BoardState = z.infer<typeof boardStateSchema>;

export const engineRngStateSchema = z.object({
  seed: z.number().int().nonnegative(),
  cursor: z.number().int().nonnegative(),
});
export type EngineRngState = z.infer<typeof engineRngStateSchema>;

export const engineStateSchema = z.object({
  board: boardStateSchema,
  tray: trayStateSchema,
  rng: engineRngStateSchema,
  score: z.number().int().nonnegative(),
  combo: z.number().int().nonnegative(),
  turn: z.number().int().nonnegative(),
  lastClearCount: z.number().int().nonnegative(),
  clearedLinesTotal: z.number().int().nonnegative(),
});
export type EngineState = z.infer<typeof engineStateSchema>;

export const questionCardTypeSchema = z.enum([
  'single_word_translation',
  'phrase_translation',
  'article_noun_selection',
]);
export type QuestionCardType = z.infer<typeof questionCardTypeSchema>;

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
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const answerPenaltySchema = z.object({
  applies: z.literal(true),
  penaltyType: z.literal('heart_loss'),
  amount: z.number().int().positive(),
});
export type AnswerPenalty = z.infer<typeof answerPenaltySchema>;

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

export const runStatusSchema = z.enum(['active', 'awaiting_move', 'completed', 'failed', 'abandoned']);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runQuestionAnswerStateSchema = z.enum(['awaiting_answer', 'answered_correct', 'answered_wrong']);
export type RunQuestionAnswerState = z.infer<typeof runQuestionAnswerStateSchema>;

export const runQuestionStateSchema = z.object({
  sequence: z.number().int().nonnegative(),
  shownAt: z.string().datetime(),
  answeredAt: z.string().datetime().optional(),
  answerState: runQuestionAnswerStateSchema,
  selectedOptionId: z.string().trim().min(1).optional(),
  question: generatedQuestionSchema,
});
export type RunQuestionState = z.infer<typeof runQuestionStateSchema>;

export const scoreBreakdownSchema = z.object({
  placementPoints: z.number().int().nonnegative(),
  lineClearPoints: z.number().int().nonnegative(),
  multiLineBonus: z.number().int().nonnegative(),
  comboBonus: z.number().int().nonnegative(),
  totalPoints: z.number().int().nonnegative(),
  clearedRowCount: z.number().int().nonnegative(),
  clearedColumnCount: z.number().int().nonnegative(),
});
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export const moveValidationResultSchema = z.enum(['accepted', 'rejected']);
export type MoveValidationResult = z.infer<typeof moveValidationResultSchema>;

export const runSessionSchema = z.object({
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  levelId: cefrLevelSchema,
  direction: answerDirectionSchema,
  status: runStatusSchema,
  heartsRemaining: z.number().int().nonnegative(),
  score: z.number().int().nonnegative(),
  combo: z.number().int().nonnegative(),
  seed: z.number().int().nonnegative(),
  engineState: engineStateSchema,
  currentQuestionState: runQuestionStateSchema.nullable(),
  answerCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  moveCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
});
export type RunSession = z.infer<typeof runSessionSchema>;

export const answerEventSchema = z.object({
  id: z.string().trim().min(1),
  runId: z.string().trim().min(1),
  questionId: z.string().trim().min(1),
  sourceItemId: z.string().trim().min(1),
  selectedOptionId: z.string().trim().min(1),
  correctOptionId: z.string().trim().min(1),
  correctness: z.boolean(),
  timingMs: z.number().int().nonnegative().optional(),
  penalty: answerPenaltySchema.nullable(),
  occurredAt: z.string().datetime(),
});
export type AnswerEvent = z.infer<typeof answerEventSchema>;

export const moveEventSchema = z.object({
  id: z.string().trim().min(1),
  runId: z.string().trim().min(1),
  engineTurn: z.number().int().nonnegative(),
  trayIndex: z.number().int().min(0).max(2),
  pieceInstanceId: z.string().trim().min(1),
  pieceId: pieceIdSchema,
  origin: coordinateSchema,
  validationResult: moveValidationResultSchema,
  clearedLineCount: z.number().int().nonnegative(),
  scoreBreakdown: scoreBreakdownSchema,
  resultingScore: z.number().int().nonnegative(),
  resultingCombo: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
});
export type MoveEvent = z.infer<typeof moveEventSchema>;

export const runResultSchema = z.object({
  runId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  levelId: cefrLevelSchema,
  direction: answerDirectionSchema,
  status: runStatusSchema,
  finalScore: z.number().int().nonnegative(),
  clearedLinesTotal: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
});
export type RunResult = z.infer<typeof runResultSchema>;

export const launchLevelSchema = z.enum(launchLevels);
export type LaunchLevelId = z.infer<typeof launchLevelSchema>;

export const runStartRequestSchema = z.object({
  levelId: launchLevelSchema,
  direction: answerDirectionSchema.default('ru_to_fr'),
});
export type RunStartRequest = z.infer<typeof runStartRequestSchema>;

export const runStartResponseSchema = z.object({
  run: runSessionSchema,
});
export type RunStartResponse = z.infer<typeof runStartResponseSchema>;

export const runAnswerRequestSchema = z.object({
  selectedOptionId: z.string().trim().min(1),
  answeredAt: z.string().datetime().optional(),
});
export type RunAnswerRequest = z.infer<typeof runAnswerRequestSchema>;

export const runAnswerResponseSchema = z.object({
  run: runSessionSchema,
  evaluation: answerEvaluationSchema,
  result: runResultSchema.optional(),
});
export type RunAnswerResponse = z.infer<typeof runAnswerResponseSchema>;

export const runMoveRequestSchema = z.object({
  trayIndex: z.number().int().min(0).max(2),
  origin: coordinateSchema,
});
export type RunMoveRequest = z.infer<typeof runMoveRequestSchema>;

export const runMoveResponseSchema = z.object({
  run: runSessionSchema,
  moveEvent: moveEventSchema,
  result: runResultSchema.optional(),
});
export type RunMoveResponse = z.infer<typeof runMoveResponseSchema>;

export const runFinishResponseSchema = z.object({
  run: runSessionSchema,
  result: runResultSchema,
});
export type RunFinishResponse = z.infer<typeof runFinishResponseSchema>;

export const runStateResponseSchema = z.object({
  run: runSessionSchema,
});
export type RunStateResponse = z.infer<typeof runStateResponseSchema>;

export const runResultResponseSchema = z.object({
  result: runResultSchema,
});
export type RunResultResponse = z.infer<typeof runResultResponseSchema>;

export const runErrorCodeSchema = z.enum([
  'run_not_found',
  'run_forbidden',
  'run_invalid_state',
  'run_invalid_move',
  'run_invalid_answer',
  'run_result_unavailable',
  'run_integrity_error',
  'run_unavailable',
]);
export type RunErrorCode = z.infer<typeof runErrorCodeSchema>;

export const runErrorSchema = z.object({
  code: runErrorCodeSchema,
  message: z.string().min(1),
});
export type RunError = z.infer<typeof runErrorSchema>;
