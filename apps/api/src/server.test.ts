import { afterEach, describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';

import type { ApiResponse } from './server.js';
import { createApiRequestHandler, createApiServer } from './server.js';
import { computeTelegramInitDataHash } from './auth/telegram.js';

const testBotToken = 'telegram-test-token';
const fixedNow = new Date('2026-04-22T00:00:00.000Z');
const servers = new Set<import('node:http').Server>();

afterEach(async () => {
  await Promise.all(
    Array.from(servers).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
  servers.clear();
});

describe('mounted auth routes', () => {
  it('authenticates through POST /auth/telegram', async () => {
    const handler = createHandler();

    const response = await dispatchJson(handler, {
      method: 'POST',
      url: '/auth/telegram',
      body: {
        initData: createSignedInitData({
          authDate: Math.floor(fixedNow.getTime() / 1000),
        }),
      },
    });

    expect(response.status).toBe(200);
    const payload = response.body as {
      user: { telegramUserId: string };
      session: { token: string };
    };
    expect(payload.user.telegramUserId).toBe('123456');
    expect(payload.session.token.length).toBeGreaterThan(10);
  });

  it('rejects invalid Telegram signatures through the mounted route', async () => {
    const handler = createHandler();

    const response = await dispatchJson(handler, {
      method: 'POST',
      url: '/auth/telegram',
      body: {
        initData: createSignedInitData({
          authDate: Math.floor(fixedNow.getTime() / 1000),
        }).replace('hash=', 'hash=deadbeef'),
      },
    });

    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe('invalid_signature');
  });

  it('verifies a valid session through GET /auth/session', async () => {
    const handler = createHandler();
    const authResponse = await dispatchJson(handler, {
      method: 'POST',
      url: '/auth/telegram',
      body: {
        initData: createSignedInitData({
          authDate: Math.floor(fixedNow.getTime() / 1000),
        }),
      },
    });
    const authPayload = authResponse.body as {
      session: { token: string };
    };

    const sessionResponse = await dispatchJson(handler, {
      method: 'GET',
      url: '/auth/session',
      headers: {
        authorization: `Bearer ${authPayload.session.token}`,
      },
    });

    expect(sessionResponse.status).toBe(200);
    const payload = sessionResponse.body as {
      user: { telegramUserId: string };
      session: { token: string };
    };
    expect(payload.user.telegramUserId).toBe('123456');
    expect(payload.session.token).toBe(authPayload.session.token);
  });

  it('rejects expired sessions through GET /auth/session', async () => {
    const clock = {
      current: fixedNow,
    };
    const handler = createHandler({
      now: () => clock.current,
      sessionTtlSeconds: 1,
    });
    const authResponse = await dispatchJson(handler, {
      method: 'POST',
      url: '/auth/telegram',
      body: {
        initData: createSignedInitData({
          authDate: Math.floor(fixedNow.getTime() / 1000),
        }),
      },
    });
    const authPayload = authResponse.body as {
      session: { token: string };
    };

    clock.current = new Date(fixedNow.getTime() + 5_000);

    const response = await dispatchJson(handler, {
      method: 'GET',
      url: '/auth/session',
      headers: {
        authorization: `Bearer ${authPayload.session.token}`,
      },
    });

    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe('invalid_session');
  });

  it('returns 503 from auth routes when bot token is missing', async () => {
    const handler = createApiRequestHandler({
      env: {
        PORT: '4000',
      },
    });

    const response = await dispatchJson(handler, {
      method: 'POST',
      url: '/auth/telegram',
      body: {
        initData: 'ignored-for-disabled-auth',
      },
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: 'auth_unavailable',
      message: expect.stringMatching(/TELEGRAM_BOT_TOKEN/i),
    });
  });

  it('rejects invalid session tokens through GET /auth/session', async () => {
    const handler = createHandler();

    const response = await dispatchJson(handler, {
      method: 'GET',
      url: '/auth/session',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe('invalid_session');
  });
});

function createHandler(options?: {
  now?: () => Date;
  sessionTtlSeconds?: number;
}) {
  return createApiRequestHandler({
    env: {
      TELEGRAM_BOT_TOKEN: testBotToken,
      PORT: '0',
      API_BASE_URL: 'http://localhost:4000',
      MINIAPP_BASE_URL: 'http://localhost:3000',
    },
    now: options?.now ?? (() => fixedNow),
    sessionTtlSeconds: options?.sessionTtlSeconds,
  });
}

async function dispatchJson(
  handler: ReturnType<typeof createApiRequestHandler>,
  input: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  },
) {
  const responseState = {
    status: 200,
    headers: new Map<string, string>(),
    body: '',
  };

  const response: ApiResponse = {
    statusCode: 200,
    setHeader(name, value) {
      responseState.headers.set(name, value);
    },
    end(body) {
      responseState.status = response.statusCode;
      responseState.body = body ?? '';
    },
  };

  const requestBody = input.body === undefined ? '' : JSON.stringify(input.body);
  const request = Readable.from([requestBody]) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string | undefined>;
  };
  request.method = input.method;
  request.url = input.url;
  request.headers = input.headers ?? {};

  await handler(request, response);

  return {
    status: responseState.status,
    headers: responseState.headers,
    body: responseState.body.length > 0 ? (JSON.parse(responseState.body) as unknown) : null,
  };
}

function createSignedInitData(input: { authDate: number }) {
  const user = JSON.stringify({
    id: 123456,
    first_name: 'Dmitriy',
    username: 'dmitriy',
    language_code: 'ru',
    is_premium: true,
  });

  const params = new URLSearchParams({
    auth_date: String(input.authDate),
    query_id: 'AAEAAAE',
    user,
  });
  const hash = computeTelegramInitDataHash(params.toString(), testBotToken);
  params.set('hash', hash);

  return params.toString();
}
