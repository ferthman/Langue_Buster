import { createRunController } from './controller.js';
import { createRunContentRepository } from './content.js';
import { PostgresAnswerEventRepository, PostgresMoveEventRepository, PostgresRunResultRepository, PostgresRunSessionRepository } from './repositories.js';
import { createRunService } from './service.js';
import type { DatabaseClient } from '../db/client.js';
import type { SessionVerifier } from '../auth/session-verifier.js';

type CreateRunModuleOptions = {
  client: Pick<DatabaseClient, 'query'>;
  sessionVerifier: SessionVerifier;
  now?: () => Date;
  seedGenerator?: () => number;
};

export function createRunModule(options: CreateRunModuleOptions) {
  const contentRepository = createRunContentRepository();
  const repositories = {
    runSessionRepository: new PostgresRunSessionRepository(options.client),
    answerEventRepository: new PostgresAnswerEventRepository(options.client),
    moveEventRepository: new PostgresMoveEventRepository(options.client),
    runResultRepository: new PostgresRunResultRepository(options.client),
  };
  const service = createRunService({
    ...repositories,
    contentRepository,
    now: options.now,
    seedGenerator: options.seedGenerator,
  });

  return {
    controller: createRunController(service, options.sessionVerifier),
    service,
    repositories,
    contentRepository,
  };
}

export * from './content.js';
export * from './controller.js';
export * from './errors.js';
export * from './repositories.js';
export * from './scoring.js';
export * from './service.js';
