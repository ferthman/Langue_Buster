import { z } from 'zod';

const booleanishSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === '') {
      return false;
    }
  }
  return value;
}, z.boolean());

const numberishSchema = (fallback: number) =>
  z.preprocess((value) => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return Number(value);
    }
    return fallback;
  }, z.number());

export const environmentSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  MINIAPP_BASE_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_BASE_URL: z.string().url().default('http://localhost:3001'),
  POSTGRES_URL: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  PGHOST: z.string().min(1).optional(),
  PGPORT: z.string().min(1).optional(),
  PGDATABASE: z.string().min(1).optional(),
  PGUSER: z.string().min(1).optional(),
  PGPASSWORD: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  ADMIN_ALLOWED_USER_IDS: z.string().optional(),
  ADMIN_ALLOWED_TELEGRAM_USER_IDS: z.string().optional(),
  SOFT_LAUNCH_ENABLED: booleanishSchema.default(false),
  SOFT_LAUNCH_ALLOWED_USER_IDS: z.string().optional(),
  SOFT_LAUNCH_ALLOWED_TELEGRAM_USER_IDS: z.string().optional(),
  SOFT_LAUNCH_STARTING_HEARTS: numberishSchema(3).pipe(z.number().int().positive()).default(3),
  SOFT_LAUNCH_WRONG_ANSWER_HEART_LOSS: numberishSchema(1).pipe(z.number().int().positive()).default(1),
  SOFT_LAUNCH_LEARNING_TO_STABLE_SUCCESS_STREAK: numberishSchema(3).pipe(z.number().int().positive()).default(3),
  SOFT_LAUNCH_STABLE_TO_MASTERED_SUCCESS_STREAK: numberishSchema(6).pipe(z.number().int().positive()).default(6),
  SOFT_LAUNCH_LEARNING_REQUIRES_CORRECT_OVER_WRONG: booleanishSchema.default(true),
  SOFT_LAUNCH_MASTERED_MAX_WRONG_COUNT: numberishSchema(2).pipe(z.number().int().nonnegative()).default(2),
  SOFT_LAUNCH_WEAK_REVIEW_HOURS: numberishSchema(2).pipe(z.number().positive()).default(2),
  SOFT_LAUNCH_LEARNING_REVIEW_HOURS: numberishSchema(12).pipe(z.number().positive()).default(12),
  SOFT_LAUNCH_STABLE_REVIEW_DAYS: numberishSchema(3).pipe(z.number().positive()).default(3),
  SOFT_LAUNCH_MASTERED_REVIEW_DAYS: numberishSchema(10).pipe(z.number().positive()).default(10),
  SOFT_LAUNCH_WEAK_RESURFACE_WINDOW_HOURS: numberishSchema(2).pipe(z.number().positive()).default(2),
});

export type Environment = z.infer<typeof environmentSchema>;

export const apiRuntimeEnvironmentSchema = environmentSchema.extend({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  PORT: z.coerce.number().int().nonnegative().default(4000),
});

export type ApiRuntimeEnvironment = z.infer<typeof apiRuntimeEnvironmentSchema>;
