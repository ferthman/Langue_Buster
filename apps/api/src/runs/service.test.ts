import { afterEach, describe, expect, it } from 'vitest';

import { createEmptyBoard, setCellsFilled, type Coordinate } from '@langue-buster/game-engine';
import type { AppUser, RunSession } from '@langue-buster/shared';

import { PostgresUserRepository } from '../auth/repositories.js';
import { createDatabaseRuntime } from '../db/runtime.js';
import { createTestPool } from '../test-helpers.js';
import { createRunContentRepository } from './content.js';
import {
  PostgresAnswerEventRepository,
  PostgresMoveEventRepository,
  PostgresRunResultRepository,
  PostgresRunSessionRepository,
} from './repositories.js';
import { createRunService } from './service.js';

const pools: Array<Awaited<ReturnType<typeof createTestPool>>> = [];

afterEach(async () => {
  while (pools.length > 0) {
    const pool = pools.pop();
    if (pool) {
      await pool.close();
    }
  }
});

describe('run service', () => {
  it('produces deterministic initial tray and question state for the same injected seed', async () => {
    const context = await createServiceContext();

    const first = await context.runService.startRun({
      userId: context.user.id,
      levelId: 'A1',
      direction: 'ru_to_fr',
    });
    const second = await context.runService.startRun({
      userId: context.user.id,
      levelId: 'A1',
      direction: 'ru_to_fr',
    });

    expect(first.seed).toBe(777);
    expect(second.seed).toBe(777);
    expect(first.engineState).toEqual(second.engineState);
    expect(first.currentQuestionState?.question).toEqual(second.currentQuestionState?.question);
  });

  it('auto-finalizes a run as failed when hearts reach zero', async () => {
    const context = await createServiceContext();
    let run = await context.runService.startRun({
      userId: context.user.id,
      levelId: 'A1',
      direction: 'ru_to_fr',
    });

    for (let index = 0; index < 3; index += 1) {
      const wrongOptionId = getWrongOptionId(run);
      const response = await context.runService.submitAnswer({
        runId: run.id,
        userId: context.user.id,
        selectedOptionId: wrongOptionId,
        answeredAt: new Date(`2026-04-22T00:00:0${index + 1}.000Z`).toISOString(),
      });
      run = response.run;
    }

    expect(run.status).toBe('failed');
    expect(run.heartsRemaining).toBe(0);

    const result = await context.runService.getResultForUser(run.id, context.user.id);
    expect(result.status).toBe('failed');
    expect(result.wrongCount).toBe(3);
  });

  it('auto-finalizes a run as completed when the engine reports no legal placements', async () => {
    const context = await createServiceContext();
    const run = await context.runService.startRun({
      userId: context.user.id,
      levelId: 'A1',
      direction: 'ru_to_fr',
    });
    const trappedRun = await context.runSessionRepository.save({
      ...run,
      status: 'awaiting_move',
      currentQuestionState: {
        ...(run.currentQuestionState ?? fail('expected question state')),
        answerState: 'answered_correct',
        answeredAt: '2026-04-22T00:00:05.000Z',
        selectedOptionId: run.currentQuestionState?.question.correctOptionId,
      },
      engineState: {
        ...run.engineState,
        board: setCellsFilled(
          createEmptyBoard(),
          checkerboardFilledCoordinates(),
        ) as RunSession['engineState']['board'],
        tray: [
          { instanceId: 'p-trap-1', pieceId: 'single_1' },
          { instanceId: 'p-trap-2', pieceId: 'bar_h_5' },
          { instanceId: 'p-trap-3', pieceId: 'bar_v_5' },
        ],
      },
    });

    const response = await context.runService.submitMove({
      runId: trappedRun.id,
      userId: context.user.id,
      trayIndex: 0,
      origin: { x: 0, y: 0 },
    });

    expect(response.run.status).toBe('completed');
    expect(response.result?.status).toBe('completed');
  });

  it('persists run results across repository re-instantiation', async () => {
    const context = await createServiceContext();
    const run = await context.runService.startRun({
      userId: context.user.id,
      levelId: 'A1',
      direction: 'ru_to_fr',
    });
    const finished = await context.runService.finishRun({
      runId: run.id,
      userId: context.user.id,
    });

    const siblingPool = context.pool.createSiblingPool();
    try {
      const sessionRepository = new PostgresRunSessionRepository(siblingPool);
      const resultRepository = new PostgresRunResultRepository(siblingPool);

      const persistedRun = await sessionRepository.findById(finished.run.id);
      const persistedResult = await resultRepository.findByRunId(finished.run.id);

      expect(persistedRun?.status).toBe('abandoned');
      expect(persistedResult?.status).toBe('abandoned');
      expect(persistedResult?.durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      await siblingPool.end();
    }
  });
});

async function createServiceContext() {
  const pool = createTestPool();
  pools.push(pool);
  const runtime = createDatabaseRuntime({
    pool: pool.pool,
  });
  await runtime.ready;

  const userRepository = new PostgresUserRepository({
    client: pool.pool,
    now: () => new Date('2026-04-22T00:00:00.000Z'),
  });
  const user = await userRepository.save(createUser());

  const runSessionRepository = new PostgresRunSessionRepository(pool.pool);
  const answerEventRepository = new PostgresAnswerEventRepository(pool.pool);
  const moveEventRepository = new PostgresMoveEventRepository(pool.pool);
  const runResultRepository = new PostgresRunResultRepository(pool.pool);
  const runService = createRunService({
    runSessionRepository,
    answerEventRepository,
    moveEventRepository,
    runResultRepository,
    contentRepository: createRunContentRepository(),
    now: () => new Date('2026-04-22T00:00:00.000Z'),
    seedGenerator: () => 777,
  });

  return {
    pool,
    user,
    runService,
    runSessionRepository,
  };
}

function createUser(): AppUser {
  return {
    id: 'usr_service',
    telegramUserId: '999000',
    firstName: 'Service',
    isPremium: false,
    createdAt: '2026-04-22T00:00:00.000Z',
    lastLoginAt: '2026-04-22T00:00:00.000Z',
  };
}

function getWrongOptionId(run: RunSession): string {
  const question = run.currentQuestionState?.question;
  if (!question) {
    throw new Error('Expected an active question.');
  }

  const wrong = question.options.find((option) => option.id !== question.correctOptionId);
  if (!wrong) {
    throw new Error('Expected a wrong option.');
  }

  return wrong.id;
}

function allCellsExcept(excluded: readonly Coordinate[]): readonly Coordinate[] {
  const excludedKeys = new Set(excluded.map((coordinate) => `${coordinate.x},${coordinate.y}`));
  const coordinates: Coordinate[] = [];

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const key = `${x},${y}`;
      if (!excludedKeys.has(key)) {
        coordinates.push({ x, y });
      }
    }
  }

  return coordinates;
}

function checkerboardFilledCoordinates(): readonly Coordinate[] {
  const coordinates: Coordinate[] = [];

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if ((x + y) % 2 === 1) {
        coordinates.push({ x, y });
      }
    }
  }

  return coordinates;
}

function fail(message: string): never {
  throw new Error(message);
}
