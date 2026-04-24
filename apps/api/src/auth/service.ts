import type {
  AnalyticsEventEnvelope,
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
  analytics?: {
    recordEvent(event: AnalyticsEventEnvelope): Promise<unknown>;
  };
  softLaunchAccess?: {
    assertUserAccess(userId: string, telegramUserId: string): void;
  };
};

type ZodLikeIssue = Readonly<{
  path?: readonly unknown[];
  message?: unknown;
}>;

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
      dependencies.softLaunchAccess?.assertUserAccess(internalUser.id, internalUser.telegramUserId);
      const session = issueSession(internalUser.id, {
        now,
        ttlSeconds: dependencies.sessionTtlSeconds,
      });
      const storedSession = await dependencies.sessionRepository.save(session);
      await dependencies.analytics?.recordEvent({
        eventName: 'auth_bootstrap_succeeded',
        source: 'backend',
        occurredAt: storedSession.issuedAt,
        userId: internalUser.id,
        sessionId: storedSession.id,
        payload: {
          method: 'telegram_auth',
          route: '/auth/telegram',
        },
      });

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
      message: buildZodIssueMessage(error),
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

function isZodLikeError(error: unknown): error is { name: string; issues?: unknown } {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'ZodError';
}

function buildZodIssueMessage(error: unknown) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('issues' in error) ||
    !Array.isArray(error.issues)
  ) {
    return 'Authentication payload did not match the expected schema.';
  }

  const issues = (error.issues as readonly unknown[])
    .map((issue) => {
      if (typeof issue !== 'object' || issue === null) {
        return null;
      }

      const zodIssue = issue as ZodLikeIssue;
      const path =
        Array.isArray(zodIssue.path) && zodIssue.path.length > 0
          ? zodIssue.path.join('.')
          : 'root';
      const message = typeof zodIssue.message === 'string'
        ? zodIssue.message
        : 'Invalid value.';

      return `${path}: ${message}`;
    })
    .filter((value): value is string => Boolean(value));

  if (issues.length === 0) {
    return 'Authentication payload did not match the expected schema.';
  }

  return `Authentication payload validation failed: ${issues.join('; ')}`;
}
