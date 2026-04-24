import {
  InMemorySessionRepository,
  InMemoryUserRepository,
  PostgresSessionRepository,
  PostgresUserRepository,
  type SessionRepository,
  type UserRepository,
} from './repositories.js';
import { createAuthController } from './controller.js';
import { createSessionVerifier } from './session-verifier.js';
import { createAuthService } from './service.js';
import { parseApiRuntimeEnvironment } from './runtime.js';
import type { DatabaseClient } from '../db/client.js';

type CreateAuthModuleOptions = {
  botToken: string;
  now?: () => Date;
  sessionTtlSeconds?: number;
  maxAuthAgeSeconds?: number;
  userRepository?: UserRepository;
  sessionRepository?: SessionRepository;
  analytics?: {
    recordEvent(event: import('@langue-buster/shared').AnalyticsEventEnvelope): Promise<unknown>;
  };
  softLaunchAccess?: {
    assertUserAccess(userId: string, telegramUserId: string): void;
  };
  logger?: {
    warn(message: string, context: Record<string, unknown>): void;
  };
  errorReporter?: {
    captureError(error: unknown, context: Record<string, unknown>): void;
  };
};

export function createAuthModule(options: CreateAuthModuleOptions) {
  const userRepository = options.userRepository ?? new InMemoryUserRepository({ now: options.now });
  const sessionRepository = options.sessionRepository ?? new InMemorySessionRepository();

  const authService = createAuthService({
    botToken: options.botToken,
    userRepository,
    sessionRepository,
    now: options.now,
    sessionTtlSeconds: options.sessionTtlSeconds,
    maxAuthAgeSeconds: options.maxAuthAgeSeconds,
    analytics: options.analytics,
    softLaunchAccess: options.softLaunchAccess,
  });
  const sessionVerifier = createSessionVerifier({
    userRepository,
    sessionRepository,
    now: options.now,
  });

  return {
    controller: createAuthController(authService, sessionVerifier, {
      analytics: options.analytics,
      logger: options.logger,
      errorReporter: options.errorReporter,
    }),
    service: authService,
    sessionVerifier,
    repositories: {
      userRepository,
      sessionRepository,
    },
  };
}

export * from './controller.js';
export * from './errors.js';
export * from './repositories.js';
export * from './runtime.js';
export * from './service.js';
export * from './session.js';
export * from './session-verifier.js';
export * from './telegram.js';

export function createAuthModuleFromEnvironment(
  source: Record<string, string | undefined>,
  options: Omit<CreateAuthModuleOptions, 'botToken'> = {},
) {
  const runtime = parseApiRuntimeEnvironment(source);

  return createAuthModule({
    ...options,
    botToken: runtime.TELEGRAM_BOT_TOKEN,
  });
}

export function createPostgresAuthRepositories(
  client: Pick<DatabaseClient, 'query'>,
  options: Readonly<{ now?: () => Date }> = {},
) {
  return {
    userRepository: new PostgresUserRepository({
      client,
      now: options.now,
    }),
    sessionRepository: new PostgresSessionRepository({
      client,
    }),
  };
}
