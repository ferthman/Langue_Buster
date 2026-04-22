import type {
  AuthResponse,
  TelegramAuthRequest,
  AuthError,
} from '@langue-buster/shared';
import {
  authResponseSchema,
  telegramAuthRequestSchema,
} from '@langue-buster/shared';

import type { SessionRepository, UserRepository } from './repositories.js';
import { AuthDomainError } from './errors.js';
import { issueSession } from './session.js';
import { validateTelegramInitData } from './telegram.js';

type AuthServiceDependencies = {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  botToken: string;
  now?: () => Date;
  sessionTtlSeconds?: number;
  maxAuthAgeSeconds?: number;
};

export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService(dependencies: AuthServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());

  return {
    async authenticateTelegramLaunch(payload: TelegramAuthRequest): Promise<AuthResponse> {
      const request = telegramAuthRequestSchema.parse(payload);
      const validatedAuth = validateTelegramInitData(request.initData, {
        botToken: dependencies.botToken,
        now,
        maxAuthAgeSeconds: dependencies.maxAuthAgeSeconds,
      });

      const internalUser = await dependencies.userRepository.createOrUpdateFromTelegramUser(
        validatedAuth.user,
      );
      const session = issueSession(internalUser.id, {
        now,
        ttlSeconds: dependencies.sessionTtlSeconds,
      });
      const storedSession = await dependencies.sessionRepository.save(session);

      return authResponseSchema.parse({
        user: internalUser,
        session: storedSession,
      });
    },
  };
}

export function normalizeAuthError(error: unknown): AuthError {
  if (error instanceof AuthDomainError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (isZodLikeError(error)) {
    return {
      code: 'malformed_init_data',
      message: 'Authentication payload did not match the expected schema.',
    };
  }

  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    return error as AuthError;
  }

  return {
    code: 'invalid_init_data',
    message: 'Authentication failed due to an unexpected error.',
  };
}

function isZodLikeError(error: unknown): error is { name: string } {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'ZodError';
}
