import type { DatabaseClient } from '../db/client.js';
import type { SessionVerifier } from '../auth/session-verifier.js';
import { createAdminSessionGuard, parseCommaSeparatedEnv } from '../content-admin/auth.js';
import type { PostgresAnalyticsEventRepository } from '../analytics/repository.js';
import type { AntiCheatAnomalyRepository } from '../anti-cheat/repository.js';
import type { UserMasteryRepository } from '../mastery/repositories.js';
import { createSoftLaunchController } from './controller.js';
import { PostgresSoftLaunchSettingsRepository } from './repository.js';
import { createSoftLaunchService } from './service.js';

type CreateSoftLaunchModuleOptions = {
  client: Pick<DatabaseClient, 'query' | 'connect'>;
  sessionVerifier: SessionVerifier;
  env: Record<string, string | undefined>;
  analyticsRepository: PostgresAnalyticsEventRepository;
  antiCheatAnomalyRepository: AntiCheatAnomalyRepository;
  userMasteryRepository: UserMasteryRepository;
  now?: () => Date;
};

export function createSoftLaunchModule(options: CreateSoftLaunchModuleOptions) {
  const settingsRepository = new PostgresSoftLaunchSettingsRepository(options.client);
  const service = createSoftLaunchService({
    settingsRepository,
    analyticsRepository: options.analyticsRepository,
    antiCheatAnomalyRepository: options.antiCheatAnomalyRepository,
    userMasteryRepository: options.userMasteryRepository,
    sessionVerifier: options.sessionVerifier,
    env: options.env,
    now: options.now,
  });
  const adminGuard = createAdminSessionGuard(options.sessionVerifier, {
    allowedUserIds: parseCommaSeparatedEnv(options.env.ADMIN_ALLOWED_USER_IDS),
    allowedTelegramUserIds: parseCommaSeparatedEnv(options.env.ADMIN_ALLOWED_TELEGRAM_USER_IDS),
  });

  return {
    settingsRepository,
    service,
    controller: createSoftLaunchController({
      service,
      verifyAdmin: (authorizationHeader) => adminGuard.verify(authorizationHeader),
    }),
  };
}

export * from './controller.js';
export * from './repository.js';
export * from './service.js';
