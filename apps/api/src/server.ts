import {
  createServer,
  type Server,
} from 'node:http';
import { URL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { authErrorSchema, rateLimitedErrorSchema } from '@langue-buster/shared';

import { createAnalyticsModule } from './analytics/index.js';
import { createUnavailableAnalyticsController, type AnalyticsController } from './analytics/controller.js';
import { createErrorReporter } from './analytics/error-reporter.js';
import { createStructuredLogger } from './analytics/logger.js';
import { PostgresAnalyticsEventRepository } from './analytics/repository.js';
import { createAntiCheatModule } from './anti-cheat/index.js';
import { createUnavailableAntiCheatController, type AntiCheatController } from './anti-cheat/controller.js';
import {
  buildRateLimitIdentity,
  createFixedWindowRateLimiter,
  type RateLimitRule,
  type RateLimiter,
} from './anti-cheat/rate-limit.js';
import type { AntiCheatService } from './anti-cheat/service.js';
import { PostgresUserMasteryRepository } from './mastery/repositories.js';
import { createAuthModule, createPostgresAuthRepositories } from './auth/index.js';
import { createUnavailableAuthController, type AuthController } from './auth/controller.js';
import { AuthDomainError } from './auth/errors.js';
import { mapSessionErrorStatus } from './auth/session-verifier.js';
import type { DatabaseClient } from './db/client.js';
import { createDatabaseRuntime, resolveDatabaseConnectionString } from './db/runtime.js';
import { applyCors, readJsonBody, sendJson } from './http.js';
import { createMasteryModule } from './mastery/index.js';
import { createUnavailableMasteryController, type MasteryController } from './mastery/controller.js';
import { createRunContentRepository } from './runs/content.js';
import { createRunModule } from './runs/index.js';
import { createUnavailableRunController, type RunController } from './runs/controller.js';
import { PostgresAnswerEventRepository, PostgresMoveEventRepository, PostgresRunResultRepository } from './runs/repositories.js';
import { createContentAdminModule } from './content-admin/index.js';
import { createUnavailableContentAdminController, type ContentAdminController } from './content-admin/controller.js';
import { createSoftLaunchModule } from './soft-launch/index.js';
import { createUnavailableSoftLaunchController, type SoftLaunchController } from './soft-launch/controller.js';
import { createSoftLaunchAccessPolicy, type SoftLaunchService } from './soft-launch/service.js';
import { normalizeAuthError } from './auth/service.js';

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
    const requestId = `req_${randomUUID()}`;
    await routeRequest(request, response, {
      authController: modules.authController,
      runController: modules.runController,
      masteryController: modules.masteryController,
      contentAdminController: modules.contentAdminController,
      analyticsController: modules.analyticsController,
      antiCheatController: modules.antiCheatController,
      softLaunchController: modules.softLaunchController,
      authConfigured,
      rateLimiter: modules.rateLimiter,
      antiCheatService: modules.antiCheatService,
      softLaunchService: modules.softLaunchService,
      allowedOrigins: [options.env.MINIAPP_BASE_URL, options.env.ADMIN_BASE_URL]
        .map((origin) => origin?.trim())
        .filter((origin): origin is string => Boolean(origin)),
      requestId,
    }).catch((error) => {
      modules.logger.error('Unhandled API request failure.', {
        domain: 'http',
        requestId,
        extra: {
          method: request.method,
          url: request.url,
          error: error instanceof Error ? error.message : 'Unknown error.',
        },
      });
      modules.errorReporter.captureError(error, {
        domain: 'http',
        requestId,
        extra: {
          method: request.method,
          url: request.url,
        },
      });
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
  client: DatabaseClient,
): {
  authController: AuthController;
  runController: RunController;
  masteryController: MasteryController;
  contentAdminController: ContentAdminController;
  analyticsController: AnalyticsController;
  antiCheatController: AntiCheatController;
  softLaunchController: SoftLaunchController;
  rateLimiter: RateLimiter;
  antiCheatService?: AntiCheatService;
  softLaunchService?: SoftLaunchService;
  logger: ReturnType<typeof createAnalyticsModule>['logger'];
  errorReporter: ReturnType<typeof createAnalyticsModule>['errorReporter'];
} {
  try {
    const logger = createStructuredLogger({
      now: options.now,
    });
    const errorReporter = createErrorReporter(logger);
    const analyticsRepository = new PostgresAnalyticsEventRepository(client);
    const analyticsTracker = {
      recordEvent(event: import('@langue-buster/shared').AnalyticsEventEnvelope) {
        return analyticsRepository.save(event);
      },
    };
    const softLaunchAccess = createSoftLaunchAccessPolicy(options.env);
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
      analytics: analyticsTracker,
      softLaunchAccess,
      logger,
      errorReporter,
    });
    const runRepositories = {
      answerEventRepository: new PostgresAnswerEventRepository(client),
      moveEventRepository: new PostgresMoveEventRepository(client),
      runResultRepository: new PostgresRunResultRepository(client),
    };
    const antiCheatModule = createAntiCheatModule({
      client,
      sessionVerifier: authModule.sessionVerifier,
      env: options.env,
      answerEventRepository: runRepositories.answerEventRepository,
      moveEventRepository: runRepositories.moveEventRepository,
      now: options.now,
      logger,
      errorReporter,
    });
    const contentRepository = createRunContentRepository();
    const softLaunchModule = createSoftLaunchModule({
      client,
      sessionVerifier: authModule.sessionVerifier,
      env: options.env,
      analyticsRepository,
      antiCheatAnomalyRepository: antiCheatModule.anomalyRepository,
      userMasteryRepository: new PostgresUserMasteryRepository(client),
      now: options.now,
    });
    const masteryModule = createMasteryModule({
      client,
      sessionVerifier: authModule.sessionVerifier,
      answerEventRepository: runRepositories.answerEventRepository,
      runResultRepository: runRepositories.runResultRepository,
      contentRepository,
      now: options.now,
      analytics: analyticsTracker,
      softLaunchSettings: softLaunchModule.service,
      logger,
      errorReporter,
      verifyPlayerAccess: (authorizationHeader) => softLaunchModule.service.verifyPlayerAccess(authorizationHeader),
    });
    const runModule = createRunModule({
      client,
      sessionVerifier: authModule.sessionVerifier,
      now: options.now,
      seedGenerator: options.seedGenerator,
      masteryUpdater: masteryModule.service,
      analytics: analyticsTracker,
      softLaunchSettings: softLaunchModule.service,
      logger,
      errorReporter,
      antiCheat: antiCheatModule.service,
      verifyPlayerAccess: (authorizationHeader) => softLaunchModule.service.verifyPlayerAccess(authorizationHeader),
    });
    const contentAdminModule = createContentAdminModule({
      client,
      sessionVerifier: authModule.sessionVerifier,
      env: options.env,
      now: options.now,
      analytics: analyticsTracker,
    });
    const analyticsModule = createAnalyticsModule({
      client,
      sessionVerifier: authModule.sessionVerifier,
      env: options.env,
      now: options.now,
      repository: analyticsRepository,
      logger,
      errorReporter,
      userMasteryRepository: new PostgresUserMasteryRepository(client),
    });

    return {
      authController: authModule.controller,
      runController: runModule.controller,
      masteryController: masteryModule.controller,
      contentAdminController: contentAdminModule.controller,
      analyticsController: analyticsModule.controller,
      antiCheatController: antiCheatModule.controller,
      softLaunchController: softLaunchModule.controller,
      rateLimiter: antiCheatModule.rateLimiter,
      antiCheatService: antiCheatModule.service,
      softLaunchService: softLaunchModule.service,
      logger,
      errorReporter,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'API runtime is unavailable.';
    const logger = createStructuredLogger({
      now: options.now,
    });
    const errorReporter = createErrorReporter(logger);
    return {
      authController: createUnavailableAuthController(message),
      runController: createUnavailableRunController(message),
      masteryController: createUnavailableMasteryController(message),
      contentAdminController: createUnavailableContentAdminController(message),
      analyticsController: createUnavailableAnalyticsController(message),
      antiCheatController: createUnavailableAntiCheatController(message),
      softLaunchController: createUnavailableSoftLaunchController(message),
      rateLimiter: createFixedWindowRateLimiter({ now: options.now }),
      logger,
      errorReporter,
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
    contentAdminController: ContentAdminController;
    analyticsController: AnalyticsController;
    antiCheatController: AntiCheatController;
    softLaunchController: SoftLaunchController;
    authConfigured: boolean;
    rateLimiter: RateLimiter;
    antiCheatService?: AntiCheatService;
    softLaunchService?: SoftLaunchService;
    allowedOrigins: readonly string[];
    requestId: string;
  },
) {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://localhost');
  const originHeader = request.headers.origin;
  const requestOrigin = typeof originHeader === 'string' ? originHeader : originHeader?.[0];

  applyCors(response, {
    origin: requestOrigin,
    allowedOrigins: options.allowedOrigins,
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

  const rateLimitRule = resolveRateLimitRule(method, url.pathname, runRoute?.[1]);
  if (rateLimitRule) {
    const decision = options.rateLimiter.check({
      rule: rateLimitRule.rule,
      identity: buildRateLimitIdentity({
        authorizationHeader,
        ipAddress: getRequestIp(request.headers),
        routeScopedId: rateLimitRule.routeScopedId,
      }),
    });
    if (!decision.allowed) {
      await options.antiCheatService?.recordAnomaly({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        metadata: {
          routeId: rateLimitRule.rule.routeId,
          retryAfterSeconds: decision.retryAfterSeconds,
          routeScopedId: rateLimitRule.routeScopedId,
        },
      });
      sendJson(response, 429, rateLimitedErrorSchema.parse({
        code: 'rate_limited',
        message: 'Too many requests. Please retry shortly.',
        retryAfterSeconds: decision.retryAfterSeconds,
      }));
      return;
    }
  }

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
        analyticsEvents: 'POST /analytics/events',
        adminVocabItems: 'GET /admin/vocab-items',
        adminImport: 'POST /admin/import/validate',
        adminHistory: 'GET /admin/history',
        adminAnalyticsOverview: 'GET /admin/analytics/overview',
        adminAntiCheatAnomalies: 'GET /admin/anti-cheat/anomalies',
        adminSoftLaunch: 'GET /admin/soft-launch',
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
    if (options.softLaunchService) {
      try {
        await options.softLaunchService.verifyPlayerAccess(authorizationHeader);
      } catch (error) {
        const normalizedError = normalizeAuthError(error);
        sendJson(response, mapSessionErrorStatus(authErrorSchema.parse(normalizedError)), normalizedError);
        return;
      }
    }
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

  if (method === 'POST' && url.pathname === '/analytics/events') {
    if (options.softLaunchService) {
      try {
        await options.softLaunchService.verifyPlayerAccess(authorizationHeader);
      } catch (error) {
        const normalizedError = normalizeAuthError(error);
        sendJson(response, mapSessionErrorStatus(authErrorSchema.parse(normalizedError)), normalizedError);
        return;
      }
    }
    const body = await readJsonBody(request);
    const result = await options.analyticsController.handleIngest(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/analytics/overview') {
    const result = await options.analyticsController.handleOverview(Object.fromEntries(url.searchParams.entries()), authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/analytics/funnels') {
    const result = await options.analyticsController.handleFunnels(Object.fromEntries(url.searchParams.entries()), authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/analytics/content') {
    const result = await options.analyticsController.handleContent(Object.fromEntries(url.searchParams.entries()), authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/analytics/retention') {
    const result = await options.analyticsController.handleRetention(Object.fromEntries(url.searchParams.entries()), authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/soft-launch') {
    const result = await options.softLaunchController.handleStatus(authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'PATCH' && url.pathname === '/admin/soft-launch') {
    const body = await readJsonBody(request);
    const result = await options.softLaunchController.handleUpdate(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/soft-launch/reports/launch') {
    const result = await options.softLaunchController.handleLaunchReport(Object.fromEntries(url.searchParams.entries()), authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/soft-launch/reports/retention') {
    const result = await options.softLaunchController.handleRetentionReport(Object.fromEntries(url.searchParams.entries()), authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/soft-launch/reports/content') {
    const result = await options.softLaunchController.handleContentReport(Object.fromEntries(url.searchParams.entries()), authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/soft-launch/reports/tuning') {
    const result = await options.softLaunchController.handleTuningReport(Object.fromEntries(url.searchParams.entries()), authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/anti-cheat/anomalies') {
    const result = await options.antiCheatController.handleListAnomalies(
      Object.fromEntries(url.searchParams.entries()),
      authorizationHeader,
    );
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/vocab-items') {
    const result = await options.contentAdminController.handleListVocabItems(
      Object.fromEntries(url.searchParams.entries()),
      authorizationHeader,
    );
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'POST' && url.pathname === '/admin/vocab-items') {
    const body = await readJsonBody(request);
    const result = await options.contentAdminController.handleSaveVocabItem(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'POST' && url.pathname === '/admin/vocab-items/bulk-update') {
    const body = await readJsonBody(request);
    const result = await options.contentAdminController.handleBulkUpdateVocabItems(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/topics') {
    const result = await options.contentAdminController.handleListTopics(authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'POST' && url.pathname === '/admin/topics') {
    const body = await readJsonBody(request);
    const result = await options.contentAdminController.handleSaveTopic(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/lessons') {
    const result = await options.contentAdminController.handleListLessons(authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'POST' && url.pathname === '/admin/lessons') {
    const body = await readJsonBody(request);
    const result = await options.contentAdminController.handleSaveLesson(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'POST' && url.pathname === '/admin/import/validate') {
    const body = await readJsonBody(request);
    const result = await options.contentAdminController.handleValidateImport(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'POST' && url.pathname === '/admin/import/apply') {
    const body = await readJsonBody(request);
    const result = await options.contentAdminController.handleApplyImport(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/history') {
    const result = await options.contentAdminController.handleGetHistory(
      Object.fromEntries(url.searchParams.entries()),
      authorizationHeader,
    );
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'POST' && url.pathname === '/admin/qa-flags') {
    const body = await readJsonBody(request);
    const result = await options.contentAdminController.handleCreateQaFlag(body, authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  const qaFlagResolveRoute = url.pathname.match(/^\/admin\/qa-flags\/([^/]+)\/resolve$/);
  if (method === 'POST' && qaFlagResolveRoute) {
    const [, flagId] = qaFlagResolveRoute;
    const result = await options.contentAdminController.handleResolveQaFlag(flagId ?? '', authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  const adminEntityRoute = url.pathname.match(/^\/admin\/(vocab-items|topics|lessons)\/([^/]+)$/);
  if (adminEntityRoute) {
    const [, entityType, entityId] = adminEntityRoute;
    if (method === 'GET' && entityType === 'vocab-items') {
      const result = await options.contentAdminController.handleGetVocabItem(entityId ?? '', authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }

    if ((method === 'POST' || method === 'PATCH') && entityType === 'vocab-items') {
      const body = await readJsonBody(request);
      const result = await options.contentAdminController.handleSaveVocabItem(body, authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }

    if (method === 'GET' && entityType === 'topics') {
      const result = await options.contentAdminController.handleGetTopic(entityId ?? '', authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }

    if ((method === 'POST' || method === 'PATCH') && entityType === 'topics') {
      const body = await readJsonBody(request);
      const result = await options.contentAdminController.handleSaveTopic(body, authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }

    if (method === 'GET' && entityType === 'lessons') {
      const result = await options.contentAdminController.handleGetLesson(entityId ?? '', authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }

    if ((method === 'POST' || method === 'PATCH') && entityType === 'lessons') {
      const body = await readJsonBody(request);
      const result = await options.contentAdminController.handleSaveLesson(body, authorizationHeader);
      sendJson(response, result.status, result.body);
      return;
    }
  }

  const previewRoute = url.pathname.match(/^\/admin\/preview\/vocab-items\/([^/]+)$/);
  if (method === 'GET' && previewRoute) {
    const [, vocabItemId] = previewRoute;
    const result = await options.contentAdminController.handlePreviewVocabItem(vocabItemId ?? '', authorizationHeader);
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

function resolveRateLimitRule(
  method: string,
  pathname: string,
  runId: string | undefined,
): { rule: RateLimitRule; routeScopedId?: string } | null {
  if (method === 'POST' && pathname === '/auth/telegram') {
    return {
      rule: {
        routeId: 'POST /auth/telegram',
        limit: 10,
        windowMs: 60_000,
      },
    };
  }

  if (method === 'POST' && pathname === '/review/answer') {
    return {
      rule: {
        routeId: 'POST /review/answer',
        limit: 60,
        windowMs: 60_000,
      },
    };
  }

  if (method === 'POST' && pathname === '/analytics/events') {
    return {
      rule: {
        routeId: 'POST /analytics/events',
        limit: 120,
        windowMs: 60_000,
      },
    };
  }

  if (method === 'POST' && runId && pathname === `/runs/${runId}/answer`) {
    return {
      rule: {
        routeId: 'POST /runs/:runId/answer',
        limit: 60,
        windowMs: 60_000,
      },
      routeScopedId: runId,
    };
  }

  if (method === 'POST' && runId && pathname === `/runs/${runId}/move`) {
    return {
      rule: {
        routeId: 'POST /runs/:runId/move',
        limit: 60,
        windowMs: 60_000,
      },
      routeScopedId: runId,
    };
  }

  return null;
}

function getRequestIp(headers: ApiRequest['headers']): string {
  const forwarded = firstHeaderValue(headers['x-forwarded-for']);
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  return firstHeaderValue(headers['x-real-ip']) ?? 'unknown';
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}
