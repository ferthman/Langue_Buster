import type { DatabaseClient } from '../db/client.js';
import type { SessionVerifier } from '../auth/session-verifier.js';
import { PostgresUserMasteryRepository } from '../mastery/repositories.js';

import { createAnalyticsController } from './controller.js';
import { createErrorReporter } from './error-reporter.js';
import { createStructuredLogger } from './logger.js';
import { PostgresAnalyticsEventRepository } from './repository.js';
import { createAnalyticsService } from './service.js';

type CreateAnalyticsModuleOptions = {
  client: Pick<DatabaseClient, 'query'>;
  sessionVerifier: SessionVerifier;
  env: Record<string, string | undefined>;
  now?: () => Date;
  repository?: PostgresAnalyticsEventRepository;
  logger?: ReturnType<typeof createStructuredLogger>;
  errorReporter?: ReturnType<typeof createErrorReporter>;
  userMasteryRepository?: PostgresUserMasteryRepository;
};

export function createAnalyticsModule(options: CreateAnalyticsModuleOptions) {
  const logger = options.logger ?? createStructuredLogger({
    now: options.now,
  });
  const errorReporter = options.errorReporter ?? createErrorReporter(logger);
  const repository = options.repository ?? new PostgresAnalyticsEventRepository(options.client);
  const service = createAnalyticsService({
    repository,
    userMasteryRepository: options.userMasteryRepository ?? new PostgresUserMasteryRepository(options.client),
    sessionVerifier: options.sessionVerifier,
    env: options.env,
    logger,
    errorReporter,
    now: options.now,
  });

  return {
    controller: createAnalyticsController(service),
    service,
    repository,
    logger,
    errorReporter,
  };
}

export * from './controller.js';
export * from './error-reporter.js';
export * from './logger.js';
export * from './repository.js';
export * from './service.js';
