import { z } from 'zod';

export const environmentSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  MINIAPP_BASE_URL: z.string().url().default('http://localhost:3000'),
  POSTGRES_URL: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  PGHOST: z.string().min(1).optional(),
  PGPORT: z.string().min(1).optional(),
  PGDATABASE: z.string().min(1).optional(),
  PGUSER: z.string().min(1).optional(),
  PGPASSWORD: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export const apiRuntimeEnvironmentSchema = environmentSchema.extend({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  PORT: z.coerce.number().int().nonnegative().default(4000),
});

export type ApiRuntimeEnvironment = z.infer<typeof apiRuntimeEnvironmentSchema>;
