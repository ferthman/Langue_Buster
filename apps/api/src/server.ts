import {
  createServer,
  type Server,
} from 'node:http';
import { URL } from 'node:url';

import { createAuthModuleFromEnvironment } from './auth/index.js';
import { createUnavailableAuthController, type AuthController } from './auth/controller.js';
import { AuthDomainError } from './auth/errors.js';
import { readJsonBody, sendJson } from './http.js';

type CreateApiServerOptions = {
  env: Record<string, string | undefined>;
  now?: () => Date;
  sessionTtlSeconds?: number;
  maxAuthAgeSeconds?: number;
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
  const authController = createAuthControllerFromEnvironment(options);
  const authConfigured = typeof options.env.TELEGRAM_BOT_TOKEN === 'string'
    && options.env.TELEGRAM_BOT_TOKEN.trim().length > 0;

  return async (request: ApiRequest, response: ApiResponse) => {
    await routeRequest(request, response, authController, authConfigured).catch(() => {
      sendJson(response, 500, {
        code: 'invalid_init_data',
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

function createAuthControllerFromEnvironment(options: CreateApiServerOptions): AuthController {
  try {
    const authModule = createAuthModuleFromEnvironment(options.env, {
      now: options.now,
      sessionTtlSeconds: options.sessionTtlSeconds,
      maxAuthAgeSeconds: options.maxAuthAgeSeconds,
    });

    return authModule.controller;
  } catch (error) {
    if (error instanceof AuthDomainError && error.code === 'invalid_init_data') {
      return createUnavailableAuthController(error.message);
    }

    throw error;
  }
}

async function routeRequest(
  request: ApiRequest,
  response: ApiResponse,
  authController: AuthController,
  authConfigured: boolean,
) {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    sendJson(response, 200, {
      status: 'ok',
      service: 'langue-buster-api',
      authConfigured,
      routes: {
        telegramAuth: 'POST /auth/telegram',
        sessionLookup: 'GET /auth/session',
      },
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/auth/telegram') {
    const body = await readJsonBody(request);
    const result = await authController.handleTelegramAuth(body);
    sendJson(response, result.status, result.body);
    return;
  }

  if (method === 'GET' && url.pathname === '/auth/session') {
    const authorization = request.headers.authorization;
    const authorizationHeader =
      typeof authorization === 'string' ? authorization : authorization?.[0];
    const result = await authController.handleSessionLookup(authorizationHeader);
    sendJson(response, result.status, result.body);
    return;
  }

  sendJson(response, 404, {
    code: 'invalid_init_data',
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
