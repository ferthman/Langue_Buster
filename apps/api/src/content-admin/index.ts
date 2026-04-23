import type { DatabaseClient } from '../db/client.js';
import type { SessionVerifier } from '../auth/session-verifier.js';
import { createAdminSessionGuard, parseCommaSeparatedEnv } from './auth.js';
import { createContentAdminController } from './controller.js';
import { createContentAdminRepository } from './repositories.js';
import { createContentAdminService } from './service.js';

type CreateContentAdminModuleOptions = {
  client: DatabaseClient;
  sessionVerifier: SessionVerifier;
  env: Record<string, string | undefined>;
  now?: () => Date;
};

export function createContentAdminModule(options: CreateContentAdminModuleOptions) {
  const repository = createContentAdminRepository(options.client);
  const service = createContentAdminService({
    repository,
    now: options.now,
  });
  const verifier = createAdminSessionGuard(options.sessionVerifier, {
    allowedUserIds: parseCommaSeparatedEnv(options.env.ADMIN_ALLOWED_USER_IDS),
    allowedTelegramUserIds: parseCommaSeparatedEnv(options.env.ADMIN_ALLOWED_TELEGRAM_USER_IDS),
  });

  return {
    controller: createContentAdminController(service, verifier),
    service,
    repository,
  };
}

export * from './controller.js';
export * from './errors.js';
export * from './repositories.js';
export * from './service.js';
