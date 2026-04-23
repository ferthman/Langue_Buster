import type { DatabaseClient } from '../db/client.js';
import type { SessionVerifier } from '../auth/session-verifier.js';
import { createAdminSessionGuard, parseCommaSeparatedEnv } from '../content-admin/auth.js';
import type { AnswerEventRepository, MoveEventRepository } from '../runs/repositories.js';
import { createAntiCheatController } from './controller.js';
import { createFixedWindowRateLimiter } from './rate-limit.js';
import { PostgresAntiCheatAnomalyRepository } from './repository.js';
import { createAntiCheatService } from './service.js';

type CreateAntiCheatModuleOptions = {
  client: Pick<DatabaseClient, 'query'>;
  sessionVerifier: SessionVerifier;
  env: Record<string, string | undefined>;
  answerEventRepository: AnswerEventRepository;
  moveEventRepository: MoveEventRepository;
  now?: () => Date;
  logger?: {
    warn(message: string, context: Record<string, unknown>): void;
  };
  errorReporter?: {
    captureError(error: unknown, context: Record<string, unknown>): void;
  };
};

export function createAntiCheatModule(options: CreateAntiCheatModuleOptions) {
  const anomalyRepository = new PostgresAntiCheatAnomalyRepository(options.client);
  const service = createAntiCheatService({
    anomalyRepository,
    answerEventRepository: options.answerEventRepository,
    moveEventRepository: options.moveEventRepository,
    now: options.now,
    logger: options.logger,
    errorReporter: options.errorReporter,
  });
  const adminGuard = createAdminSessionGuard(options.sessionVerifier, {
    allowedUserIds: parseCommaSeparatedEnv(options.env.ADMIN_ALLOWED_USER_IDS),
    allowedTelegramUserIds: parseCommaSeparatedEnv(options.env.ADMIN_ALLOWED_TELEGRAM_USER_IDS),
  });
  const rateLimiter = createFixedWindowRateLimiter({
    now: options.now,
  });

  return {
    anomalyRepository,
    service,
    rateLimiter,
    controller: createAntiCheatController({
      service,
      verifyAdmin: (authorizationHeader) => adminGuard.verify(authorizationHeader),
    }),
  };
}

export * from './controller.js';
export * from './rate-limit.js';
export * from './repository.js';
export * from './service.js';
