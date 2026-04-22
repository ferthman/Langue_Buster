import type {
  AuthError,
  TelegramUser,
  ValidatedTelegramAuth,
} from '@langue-buster/shared';
import {
  authErrorSchema,
  telegramUserSchema,
  validatedTelegramAuthSchema,
} from '@langue-buster/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { AuthDomainError } from './errors.js';

type RawTelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
};

type ValidateTelegramInitDataOptions = {
  botToken: string;
  now?: () => Date;
  maxAuthAgeSeconds?: number;
};

const defaultMaxAuthAgeSeconds = 60 * 60;

export function parseTelegramInitData(initData: string): URLSearchParams {
  if (initData.trim().length === 0) {
    createAuthError('invalid_init_data', 'Telegram initData payload is empty.');
  }

  return new URLSearchParams(initData);
}

export function validateTelegramInitData(
  initData: string,
  options: ValidateTelegramInitDataOptions,
): ValidatedTelegramAuth {
  const params = parseTelegramInitData(initData);
  const hash = params.get('hash');

  if (!hash) {
    createAuthError('malformed_init_data', 'Telegram initData is missing the hash parameter.');
  }

  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) {
    createAuthError('malformed_init_data', 'Telegram initData is missing auth_date.');
  }

  const authDateSeconds = Number(authDateRaw);
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0) {
    createAuthError('malformed_init_data', 'Telegram auth_date must be a positive integer.');
  }

  const expectedHash = computeTelegramInitDataHash(initData, options.botToken);
  const receivedHashBuffer = Buffer.from(hash, 'hex');
  const expectedHashBuffer = Buffer.from(expectedHash, 'hex');

  if (
    receivedHashBuffer.length !== expectedHashBuffer.length ||
    !timingSafeEqual(receivedHashBuffer, expectedHashBuffer)
  ) {
    createAuthError('invalid_signature', 'Telegram initData signature is invalid.');
  }

  const now = options.now ?? (() => new Date());
  const maxAuthAgeSeconds = options.maxAuthAgeSeconds ?? defaultMaxAuthAgeSeconds;
  const nowSeconds = Math.floor(now().getTime() / 1000);

  if (nowSeconds - authDateSeconds > maxAuthAgeSeconds) {
    createAuthError('auth_expired', 'Telegram initData is too old to authenticate.');
  }

  const rawUser = params.get('user');
  if (!rawUser) {
    createAuthError('missing_user', 'Telegram initData is missing the user payload.');
  }

  const user = parseTelegramUser(rawUser);

  return validatedTelegramAuthSchema.parse({
    initData,
    queryId: params.get('query_id') ?? undefined,
    authDate: new Date(authDateSeconds * 1000).toISOString(),
    hash,
    user,
  });
}

export function computeTelegramInitDataHash(initData: string, botToken: string): string {
  const params = parseTelegramInitData(initData);
  const entries = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);

  const dataCheckString = entries.join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();

  return createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

export function parseTelegramUser(rawUserJson: string): TelegramUser {
  let rawUser: RawTelegramUser;

  try {
    rawUser = JSON.parse(rawUserJson) as RawTelegramUser;
  } catch {
    createAuthError('malformed_init_data', 'Telegram user payload is not valid JSON.');
  }

  return telegramUserSchema.parse({
    id: String(rawUser.id),
    username: rawUser.username,
    firstName: rawUser.first_name,
    lastName: rawUser.last_name,
    languageCode: rawUser.language_code,
    isPremium: rawUser.is_premium ?? false,
    allowsWriteToPm: rawUser.allows_write_to_pm,
  });
}

export function createAuthError(code: AuthError['code'], message: string): never {
  const parsed = authErrorSchema.parse({ code, message });
  throw new AuthDomainError(parsed.code, parsed.message);
}
