import { z } from 'zod';

export const telegramAuthRequestSchema = z.object({
  initData: z.string().min(1),
});
export type TelegramAuthRequest = z.infer<typeof telegramAuthRequestSchema>;

export const telegramUserSchema = z.object({
  id: z.string().regex(/^\d+$/),
  username: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1).optional(),
  languageCode: z.string().min(2).optional(),
  isPremium: z.boolean().default(false),
  allowsWriteToPm: z.boolean().optional(),
});
export type TelegramUser = z.infer<typeof telegramUserSchema>;

export const validatedTelegramAuthSchema = z.object({
  initData: z.string().min(1),
  queryId: z.string().min(1).optional(),
  authDate: z.string().datetime(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  user: telegramUserSchema,
});
export type ValidatedTelegramAuth = z.infer<typeof validatedTelegramAuthSchema>;

export const appUserSchema = z.object({
  id: z.string().min(1),
  telegramUserId: z.string().regex(/^\d+$/),
  username: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1).optional(),
  languageCode: z.string().min(2).optional(),
  isPremium: z.boolean(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime(),
});
export type AppUser = z.infer<typeof appUserSchema>;

export const sessionPayloadSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  userId: z.string().min(1),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export const authResponseSchema = z.object({
  user: appUserSchema,
  session: sessionPayloadSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const authErrorCodeSchema = z.enum([
  'invalid_init_data',
  'malformed_init_data',
  'invalid_signature',
  'missing_user',
  'auth_expired',
  'missing_session',
  'invalid_session',
  'soft_launch_unavailable',
  'auth_unavailable',
]);
export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;

export const authErrorSchema = z.object({
  code: authErrorCodeSchema,
  message: z.string().min(1),
});
export type AuthError = z.infer<typeof authErrorSchema>;

export const sessionVerificationResponseSchema = z.object({
  user: appUserSchema,
  session: sessionPayloadSchema,
});
export type SessionVerificationResponse = z.infer<typeof sessionVerificationResponseSchema>;
