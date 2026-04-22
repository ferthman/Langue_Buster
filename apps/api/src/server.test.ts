import { afterEach, describe, expect, it } from 'vitest';

import { listLegalPlacements } from '@langue-buster/game-engine';
import type { PieceId } from '@langue-buster/shared';

import { createApiRequestHandler } from './server.js';
import { computeTelegramInitDataHash } from './auth/telegram.js';
import { createTestPool, dispatchJson } from './test-helpers.js';

const testBotToken = 'telegram-test-token';
const fixedNow = new Date('2026-04-22T00:00:00.000Z');
const servers = new Set<import('node:http').Server>();
const pools: Array<ReturnType<typeof createTestPool>> = [];

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

  while (pools.length > 0) {
    const pool = pools.pop();
    if (pool) {
      await pool.close();
    }
  }
});

describe('mounted auth and run routes', () => {
  it('returns service status from GET / with run routes mounted', async () => {
    const handler = createHandler();

    const response = await dispatchJson(handler, {
      method: 'GET',
      url: '/',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'langue-buster-api',
      authConfigured: true,
      routes: {
        telegramAuth: 'POST /auth/telegram',
        sessionLookup: 'GET /auth/session',
        runStart: 'POST /runs/start',
        runAnswer: 'POST /runs/:runId/answer',
        runMove: 'POST /runs/:runId/move',
        runFinish: 'POST /runs/:runId/finish',
        runState: 'GET /runs/:runId',
        runResult: 'GET /runs/:runId/result',
      },
    });
  });

  it('authenticates through POST /auth/telegram and verifies the persisted session', async () => {
    const handler = createHandler();
    const authResponse = await authenticate(handler, '123456');

    expect(authResponse.status).toBe(200);
    const payload = authResponse.body as {
      user: { telegramUserId: string };
      session: { token: string };
    };
    expect(payload.user.telegramUserId).toBe('123456');

    const sessionResponse = await dispatchJson(handler, {
      method: 'GET',
      url: '/auth/session',
      headers: {
        authorization: `Bearer ${payload.session.token}`,
      },
    });

    expect(sessionResponse.status).toBe(200);
    expect((sessionResponse.body as { user: { telegramUserId: string } }).user.telegramUserId).toBe('123456');
  });

  it('starts a run, persists it, and returns deterministic initial state for the same seed', async () => {
    const handler = createHandler();
    const auth = await authenticate(handler, '123456');
    const token = getToken(auth.body);

    const first = await dispatchJson(handler, {
      method: 'POST',
      url: '/runs/start',
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        levelId: 'A1',
      },
    });
    const second = await dispatchJson(handler, {
      method: 'POST',
      url: '/runs/start',
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        levelId: 'A1',
      },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstRun = (first.body as { run: { id: string; engineState: unknown; currentQuestionState: unknown } }).run;
    const secondRun = (second.body as { run: { engineState: unknown; currentQuestionState: unknown } }).run;
    expect(firstRun.engineState).toEqual(secondRun.engineState);
    expect(firstRun.currentQuestionState).toEqual(secondRun.currentQuestionState);

    const persisted = await dispatchJson(handler, {
      method: 'GET',
      url: `/runs/${firstRun.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(persisted.status).toBe(200);
    expect((persisted.body as { run: { id: string } }).run.id).toBe(firstRun.id);
  });

  it('rejects cross-user run access', async () => {
    const handler = createHandler();
    const firstAuth = await authenticate(handler, '123456');
    const secondAuth = await authenticate(handler, '654321');

    const firstToken = getToken(firstAuth.body);
    const secondToken = getToken(secondAuth.body);
    const started = await dispatchJson(handler, {
      method: 'POST',
      url: '/runs/start',
      headers: {
        authorization: `Bearer ${firstToken}`,
      },
      body: {
        levelId: 'A1',
      },
    });
    const runId = (started.body as { run: { id: string } }).run.id;

    const forbidden = await dispatchJson(handler, {
      method: 'GET',
      url: `/runs/${runId}`,
      headers: {
        authorization: `Bearer ${secondToken}`,
      },
    });

    expect(forbidden.status).toBe(403);
    expect((forbidden.body as { code: string }).code).toBe('run_forbidden');
  });

  it('accepts a correct answer and rejects duplicate answer submission in the awaiting_move state', async () => {
    const handler = createHandler();
    const token = getToken((await authenticate(handler, '123456')).body);
    const run = await startRun(handler, token);

    const answerResponse = await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/answer`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        selectedOptionId: run.currentQuestionState.question.correctOptionId,
        answeredAt: '2026-04-22T00:00:01.000Z',
      },
    });

    expect(answerResponse.status).toBe(200);
    expect((answerResponse.body as { run: { status: string } }).run.status).toBe('awaiting_move');

    const duplicate = await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/answer`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        selectedOptionId: run.currentQuestionState.question.correctOptionId,
      },
    });

    expect(duplicate.status).toBe(409);
    expect((duplicate.body as { code: string }).code).toBe('run_invalid_state');
  });

  it('rejects move submission before the move is unlocked', async () => {
    const handler = createHandler();
    const token = getToken((await authenticate(handler, '123456')).body);
    const run = await startRun(handler, token);

    const response = await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/move`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        trayIndex: 0,
        origin: { x: 0, y: 0 },
      },
    });

    expect(response.status).toBe(409);
    expect((response.body as { code: string }).code).toBe('run_invalid_state');
  });

  it('applies a legal move after a correct answer and recomputes score server-side', async () => {
    const handler = createHandler();
    const token = getToken((await authenticate(handler, '123456')).body);
    const run = await startRun(handler, token);

    const answered = await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/answer`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        selectedOptionId: run.currentQuestionState.question.correctOptionId,
      },
    });
    const answeredRun = (answered.body as { run: typeof run }).run;
    const placement = findLegalPlacement(answeredRun);

    const moved = await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/move`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: placement,
    });

    expect(moved.status).toBe(200);
    const movedBody = moved.body as {
      run: { score: number; combo: number; status: string };
      moveEvent: { scoreBreakdown: { totalPoints: number }; resultingScore: number };
    };
    expect(movedBody.run.score).toBe(movedBody.moveEvent.resultingScore);
    expect(movedBody.run.score).toBe(movedBody.moveEvent.scoreBreakdown.totalPoints);
    expect(movedBody.run.status).toBe('active');
  });

  it('rejects illegal move submissions', async () => {
    const handler = createHandler();
    const token = getToken((await authenticate(handler, '123456')).body);
    const run = await startRun(handler, token);

    await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/answer`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        selectedOptionId: run.currentQuestionState.question.correctOptionId,
      },
    });

    const illegal = await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/move`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        trayIndex: 0,
        origin: { x: 99, y: 99 },
      },
    });

    expect(illegal.status).toBe(409);
    expect((illegal.body as { code: string }).code).toBe('run_invalid_move');
  });

  it('finalizes a run and exposes the persisted terminal summary', async () => {
    const handler = createHandler();
    const token = getToken((await authenticate(handler, '123456')).body);
    const run = await startRun(handler, token);

    await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/finish`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const resultResponse = await dispatchJson(handler, {
      method: 'GET',
      url: `/runs/${run.id}/result`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(resultResponse.status).toBe(200);
    const result = (resultResponse.body as { result: { status: string; finalScore: number } }).result;
    expect(result.status).toBe('abandoned');
    expect(result.finalScore).toBe(0);
  });

  it('keeps auth/session data and run data available across repeated requests on the same persisted backend', async () => {
    const handler = createHandler();
    const auth = await authenticate(handler, '123456');
    const token = getToken(auth.body);
    const started = await startRun(handler, token);

    const sessionLookup = await dispatchJson(handler, {
      method: 'GET',
      url: '/auth/session',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const runLookup = await dispatchJson(handler, {
      method: 'GET',
      url: `/runs/${started.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(sessionLookup.status).toBe(200);
    expect(runLookup.status).toBe(200);
    expect((runLookup.body as { run: { id: string } }).run.id).toBe(started.id);
  });
});

function createHandler(options?: {
  pool?: ReturnType<typeof createTestPool>;
}) {
  const poolContext = options?.pool ?? createTestPool();
  if (!options?.pool) {
    pools.push(poolContext);
  }

  return createApiRequestHandler({
    env: {
      TELEGRAM_BOT_TOKEN: testBotToken,
      PORT: '0',
      API_BASE_URL: 'http://localhost:4000',
      MINIAPP_BASE_URL: 'http://localhost:3000',
      POSTGRES_URL: 'postgres://test/test',
    },
    now: () => fixedNow,
    seedGenerator: () => 777,
    pool: poolContext.pool,
  });
}

async function authenticate(
  handler: ReturnType<typeof createApiRequestHandler>,
  telegramUserId: string,
) {
  return dispatchJson(handler, {
    method: 'POST',
    url: '/auth/telegram',
    body: {
      initData: createSignedInitData({
        telegramUserId,
        authDate: Math.floor(fixedNow.getTime() / 1000),
      }),
    },
  });
}

async function startRun(handler: ReturnType<typeof createApiRequestHandler>, token: string) {
  const response = await dispatchJson(handler, {
    method: 'POST',
    url: '/runs/start',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: {
      levelId: 'A1',
    },
  });

  if (response.status !== 200) {
    throw new Error(`Expected run start to succeed. Received ${response.status}.`);
  }

  return (response.body as {
    run: {
      id: string;
      engineState: {
        board: { width: number; height: number; cells: Array<'empty' | 'filled'> };
        tray: Array<{ instanceId: string; pieceId: PieceId } | null>;
      };
      currentQuestionState: {
        question: {
          correctOptionId: string;
          options: Array<{ id: string }>;
        };
      };
    };
  }).run;
}

function getToken(body: unknown): string {
  return (body as { session: { token: string } }).session.token;
}

function findLegalPlacement(run: Awaited<ReturnType<typeof startRun>>) {
  const piece = run.engineState.tray.find((entry) => entry !== null);
  const trayIndex = run.engineState.tray.findIndex((entry) => entry?.instanceId === piece?.instanceId);
  if (!piece || trayIndex < 0) {
    throw new Error('Expected an active tray piece.');
  }

  const placements = listLegalPlacements(run.engineState.board, piece);
  const origin = placements[0];
  if (!origin) {
    throw new Error('Expected a legal placement.');
  }

  return {
    trayIndex,
    origin,
  };
}

function createSignedInitData(input: {
  authDate: number;
  telegramUserId?: string;
}) {
  const user = encodeURIComponent(
    JSON.stringify({
      id: input.telegramUserId ?? '123456',
      first_name: 'Dmitriy',
      last_name: 'Tester',
      username: `tester_${input.telegramUserId ?? '123456'}`,
      language_code: 'ru',
      is_premium: false,
    }),
  );
  const initDataWithoutHash = [
    `auth_date=${input.authDate}`,
    'query_id=AAEAAAE',
    `user=${user}`,
  ].join('&');
  const hash = computeTelegramInitDataHash(initDataWithoutHash, testBotToken);

  return `${initDataWithoutHash}&hash=${hash}`;
}
