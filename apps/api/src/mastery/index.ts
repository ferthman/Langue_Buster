import type { DatabaseClient } from '../db/client.js';
import type { SessionVerifier } from '../auth/session-verifier.js';
import type { AnswerEventRepository, RunResultRepository } from '../runs/repositories.js';
import type { RunContentRepository } from '../runs/content.js';
import { createMasteryController } from './controller.js';
import { PostgresReviewAnswerEventRepository, PostgresUserMasteryRepository } from './repositories.js';
import { createMasteryService } from './service.js';

type CreateMasteryModuleOptions = {
  client: Pick<DatabaseClient, 'query'>;
  sessionVerifier: SessionVerifier;
  answerEventRepository: AnswerEventRepository;
  runResultRepository: RunResultRepository;
  contentRepository: RunContentRepository;
  now?: () => Date;
};

export function createMasteryModule(options: CreateMasteryModuleOptions) {
  const repositories = {
    userMasteryRepository: new PostgresUserMasteryRepository(options.client),
    reviewAnswerEventRepository: new PostgresReviewAnswerEventRepository(options.client),
  };
  const service = createMasteryService({
    ...repositories,
    answerEventRepository: options.answerEventRepository,
    runResultRepository: options.runResultRepository,
    contentRepository: options.contentRepository,
    now: options.now,
  });

  return {
    controller: createMasteryController(service, options.sessionVerifier),
    service,
    repositories,
  };
}

export * from './controller.js';
export * from './errors.js';
export * from './repositories.js';
export * from './scheduler.js';
export * from './service.js';
