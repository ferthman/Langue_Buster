import {
  createServer,
  type Server,
} from 'node:http';
import { URL } from 'node:url';

import { createAuthModule, createPostgresAuthRepositories } from './auth/index.js';
import { createUnavailableAuthController, type AuthController } from './auth/controller.js';
import { AuthDomainError } from './auth/errors.js';
import type { DatabaseClient } from './db/client.js';
import { createDatabaseRuntime, resolveDatabaseConnectionString } from './db/runtime.js';
import { applyCors, readJsonBody, sendJson } from './http.js';
import { createMasteryModule } from './mastery/index.js';
import { createUnavailableMasteryController, type MasteryController } from './mastery/controller.js';
import { createRunContentRepository } from './runs/content.js';
import { createRunModule } from './runs/index.js';
import { createUnavailableRunController, type RunController } from './runs/controller.js';
import { PostgresAnswerEventRepository, PostgresRunResultRepository } from './runs/repositories.js';

type CreateApiServerOptions = {
  env: Record<string, string | undefined>;
  now?: () => Date;
  sessionTtlSeconds?: number;
  maxAuthAgeSeconds?: number;
  pool?: DatabaseClient;
  seedGenerator?: () => number;
};

export type ApiRequest = AsyncIterable<Buffer | string> & {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export function createApiRequestHandler(options: CreateApiServerOptions) {
  const databaseRuntime = createDatabaseRuntime({
    pool: options.pool,
    connectionString: resolveDatabaseConnectionString(options.env),
  });
  const authConfigured = hasRequiredRuntime(options.env);
  const modules = createApiModules(options, databaseRuntime.client);

  return async (request: ApiRequest, response: ApiResponse) => {
    await databaseRuntime.ready;
    await routeRequest(request, response, {
      authController: modules.authController,
      runController: modules.runController,
      masteryController: modules.masteryController,
      authConfigured,
      miniAppBaseUrl: options.env.MINIAPP_BASE_URL,
    }).catch(() => {
      sendJson(response, 500, {
        code: 'run_unavailable',
        message: 'Internal server error.',
      });
    });
  };
}

export function createApiServer(options: CreateApiServerOptions): Server {
  const handler = createApiRequestHandler(options);

  return createServer((request, response) => {
    void handler(request, response);
  });
}

function createApiModules(
  options: CreateApiServerOptions,
  client: Pick<DatabaseClient, 'query'>,
): {
  authController: AuthController;
  runController: RunController;
  masteryController: MasteryController;
} {
  try {
    const authRepositories = createPostgresAuthRepositories(client, {
      now: options.now,
    });
    const authModule = createAuthModule({
      botToken: requireBotToken(options.env),
      userRepository: authRepositories.userRepository,
      sessionRepository: authRepositories.sessionRepository,
      now: options.now,
      sessionTtlSeconds: options.sessionTtlSeconds,
      maxAuthAgeSeconds: options.maxAuthAgeSeconds,
    });
    const runRepositories = {
      answerEventRepository: new PostgresAnswerEventRepository(client),
      runResultRepository: new PostgresRunResultRepository(client),
    };
    const contentRepository = createRunContentRepository();
    const masteryModule = createMasteryModule({
      client,
      sessionVerifier: authModule.sessionVerifier,
      answerEventRepository: runRepositories.answerEventRepository,
      runResultRepository: runRepositories.runResultRepository,
      contentRepository,
      now: options.now,
    });
    const runModule = createRunModule({
      client,
      sessionVerifier: authModule.sessionVerifier,
      now: options.now,
      seedGenerator: options.seedGenerator,
      masteryUpdater: masteryModule.service,
    });

    return {
      authController: authModule.controller,
      runController: runModule.controller,
      masteryController: masteryModule.controller,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'API runtime is unavailable.';
    return {
      authController: createUnavailableAuthController(message),
      runController: createUnavailableRunController(message),
      masteryController: createUnavailableMasteryController(message),
    };
  }
}

async function routeRequest(
  request: ApiRequest,
  response: ApiResponse,
  options: {
    authController: AuthController;
    runController: RunController;
    masteryController: MasteryController;
    authConfigured: boolean;
    miniAppBaseUrl?: string;
  },
) {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://localhost');
  const originHeader = request.headers.origin;
  const requestOrigin = typeof originHeader === 'string' ? originHeader : originHeader?.[0];
  const allowedOrigin = options.authConfigured ? options.miniAppBaseUrl : undefined;

  applyCors(response, {
    origin: requestOrigin,
    allowedOrigin,
  });

  if (method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }
  const authorization = request.headers.authorization;
  const authorizationHeader =
    typeof authorization === 'string' ? authorization : authorization?.[0];
  const runRoute = url.pathname.match(/^\/runs\/([^/]+)(?:\/(result|answer|move|finish))?$/);

  if (method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    sendJson(response, 200, {
      status: 'ok',
      service: 'langue-buster-api',
      authConfigured: options.authConfigured,
      routes: {
        telegramAuth: 'POST /auth/telegram',
        sessionLookup: 'GET /auth/session',
        runStart: 'POST /runs/start',
        runAnswer: 'POST /runs/:runId/answer',
        runMove: 'POST /runs/:runId/move',
        runFinish: 'POST /runs/:runId/finish',
        runState: 'GET /runs/:runId',
        runResult: 'GET /runs/:runId/result',
        reviewQueue: 'GET /review/queue',
        reviewAnswer: 'POST /review/answer',
      },
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/auth/telegram') {
    const body = await readJsonBody(request);
    const result = await options.authController.handleTelegramAuth(body);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/auth/session') {
    const result = await options.authController.handleSessionLookup(authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'POST' && url.pathname === '/runs/start') {
    const body = await readJsonBody(request);
    const result = await options.runController.handleStart(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/review/queue') {
    const result = await options.masteryController.handleGetQueue(
      Object.fromEntries(url.searchParams.entries()),
      authorizationHeader,
    );
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'POST' && url.pathname === '/review/answer') {
    const body = await readJsonBody(request);
    const result = await options.masteryController.handleAnswer(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (runRoute) {
    const [, runId, action] = runRoute;
    if (!runId) {
      sendJson(response, 404, {
        code: 'run_not_found',
        message: 'Run route not found.',
      });
      return;
    }

    if (method === 'GET' && !action) {
      const result = await options.runController.handleGetRun(runId, authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }

    if (method === 'GET' && action === 'result') {
      const result = await options.runController.handleGetResult(runId, authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }

    if (method === 'POST' && action === 'answer') {
      const body = await readJsonBody(request);
      const result = await options.runController.handleAnswer(runId, body, authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }

    if (method === 'POST' && action === 'move') {
      const body = await readJsonBody(request);
      const result = await options.runController.handleMove(runId, body, authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }

    if (method === 'POST' && action === 'finish') {
      const result = await options.runController.handleFinish(runId, authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }
  }

  sendJson(response, 404, {
    code: 'run_not_found',
    message: 'Route not found.',
  });
}

export async function startApiServer(options: CreateApiServerOptions): Promise<Server> {
  const server = createApiServer(options);
  const port = Number(options.env.PORT ?? 4000);

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  return server;
}

function hasRequiredRuntime(env: Record<string, string | undefined>): boolean {
  return Boolean(
    env.TELEGRAM_BOT_TOKEN?.trim().length
      && resolveDatabaseConnectionString(env),
  );
}

function requireBotToken(env: Record<string, string | undefined>): string {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    throw new AuthDomainError(
      'invalid_init_data',
      'API runtime environment is invalid or incomplete for auth startup. Missing required environment variable(s): TELEGRAM_BOT_TOKEN.',
    );
  }

  return botToken;
}
