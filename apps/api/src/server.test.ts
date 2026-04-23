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
        reviewQueue: 'GET /review/queue',
        reviewAnswer: 'POST /review/answer',
        analyticsEvents: 'POST /analytics/events',
        adminVocabItems: 'GET /admin/vocab-items',
        adminImport: 'POST /admin/import/validate',
        adminHistory: 'GET /admin/history',
        adminAnalyticsOverview: 'GET /admin/analytics/overview',
      },
    });
  });

  it('returns CORS headers for requests from the configured mini app origin', async () => {
    const handler = createHandler();

    const response = await dispatchJson(handler, {
      method: 'GET',
      url: '/',
      headers: {
        origin: 'http://localhost:3000',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('access-control-allow-methods')).toBe('GET,POST,OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'authorization,content-type',
    );
  });

  it('answers CORS preflight requests', async () => {
    const handler = createHandler();

    const response = await dispatchJson(handler, {
      method: 'OPTIONS',
      url: '/auth/telegram',
      headers: {
        origin: 'http://localhost:3000',
      },
    });

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
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

  it('accepts validated frontend analytics ingestion and persists the event', async () => {
    const poolContext = createTestPool();
    pools.push(poolContext);
    const handler = createHandler({ pool: poolContext });
    const authResponse = await authenticate(handler, '123456');
    const token = getToken(authResponse.body);

    const response = await dispatchJson(handler, {
      method: 'POST',
      url: '/analytics/events',
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        events: [
          {
            eventName: 'home_opened',
            source: 'frontend',
            occurredAt: fixedNow.toISOString(),
            payload: {
              route: '/home',
            },
          },
        ],
      },
    });

    expect(response.status).toBe(202);
    expect((response.body as { acceptedCount: number }).acceptedCount).toBe(1);

    const persisted = await poolContext.pool.query<{
      event_name: string;
      user_id: string | null;
    }>('SELECT event_name, user_id FROM analytics_events ORDER BY occurred_at ASC, id ASC');

    expect(persisted.rows).toHaveLength(2);
    expect(persisted.rows[persisted.rows.length - 1]).toMatchObject({
      event_name: 'home_opened',
    });
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

  it('emits backend analytics for runs and review, then serves admin analytics aggregations', async () => {
    const poolContext = createTestPool();
    pools.push(poolContext);
    const handler = createHandler({ pool: poolContext });
    const adminAuth = await authenticate(handler, '999999');
    const token = getToken(adminAuth.body);
    const run = await startRun(handler, token);
    const wrongOption = run.currentQuestionState.question.options.find(
      (option) => option.id !== run.currentQuestionState.question.correctOptionId,
    );

    expect(wrongOption).toBeTruthy();

    const answerResponse = await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/answer`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        selectedOptionId: wrongOption?.id,
        answeredAt: '2026-04-22T00:00:01.000Z',
      },
    });
    expect(answerResponse.status).toBe(200);

    const finishResponse = await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/finish`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(finishResponse.status).toBe(200);

    const reviewQueue = await dispatchJson(handler, {
      method: 'GET',
      url: '/review/queue?limit=20&direction=ru_to_fr',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(reviewQueue.status).toBe(200);

    const overviewResponse = await dispatchJson(handler, {
      method: 'GET',
      url: '/admin/analytics/overview',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(overviewResponse.status).toBe(200);
    expect((overviewResponse.body as { overview: { firstRunStartCount: number; runAbandonCount: number; reviewAdoptionCount: number } }).overview).toMatchObject({
      firstRunStartCount: 1,
      runAbandonCount: 1,
      reviewAdoptionCount: 1,
    });

    const contentResponse = await dispatchJson(handler, {
      method: 'GET',
      url: '/admin/analytics/content',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(contentResponse.status).toBe(200);
    expect(
      (contentResponse.body as { frequentlyFailedItems: Array<{ wrongAnswerCount: number }> }).frequentlyFailedItems[0]
        ?.wrongAnswerCount,
    ).toBeGreaterThanOrEqual(1);

    const retentionResponse = await dispatchJson(handler, {
      method: 'GET',
      url: '/admin/analytics/retention',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(retentionResponse.status).toBe(200);
    expect((retentionResponse.body as { totalUsers: number }).totalUsers).toBe(1);

    const analyticsRows = await poolContext.pool.query<{ event_name: string }>(
      'SELECT event_name FROM analytics_events ORDER BY occurred_at ASC, id ASC',
    );
    expect(analyticsRows.rows.filter((row) => row.event_name === 'run_started')).toHaveLength(1);
    expect(analyticsRows.rows.filter((row) => row.event_name === 'answer_wrong')).toHaveLength(1);
    expect(analyticsRows.rows.filter((row) => row.event_name === 'run_abandoned')).toHaveLength(1);
    expect(analyticsRows.rows.filter((row) => row.event_name === 'review_queue_opened')).toHaveLength(1);
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

  it('updates mastery at run end and exposes a backend review queue', async () => {
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
    await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/finish`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const queue = await dispatchJson(handler, {
      method: 'GET',
      url: '/review/queue?limit=5&levelId=A1',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(queue.status).toBe(200);
    const firstItem = (queue.body as {
      items: Array<{ sourceItemId: string; masteryState: string; question?: { id: string } }>;
    }).items[0];
    expect(firstItem?.sourceItemId).toBeDefined();
    expect(firstItem?.masteryState).toBe('learning');
    expect(firstItem?.question?.id).toBeDefined();
  });

  it('accepts review answers and returns updated mastery state', async () => {
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
    await dispatchJson(handler, {
      method: 'POST',
      url: `/runs/${run.id}/finish`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const queue = await dispatchJson(handler, {
      method: 'GET',
      url: '/review/queue?limit=5&levelId=A1',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const item = (queue.body as {
      items: Array<{
        sourceItemId: string;
        question: { id: string; correctOptionId: string };
      }>;
    }).items[0];
    if (!item) {
      throw new Error('Expected a review queue item.');
    }

    const reviewAnswer = await dispatchJson(handler, {
      method: 'POST',
      url: '/review/answer',
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        sourceItemId: item.sourceItemId,
        questionId: item.question.id,
        selectedOptionId: item.question.correctOptionId,
      },
    });

    expect(reviewAnswer.status).toBe(200);
    expect((reviewAnswer.body as { mastery: { masteryState: string } }).mastery.masteryState).toBe('learning');
    expect((reviewAnswer.body as { reviewQueueItem: { priority: number } }).reviewQueueItem.priority).toBeGreaterThan(0);
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

  it('rejects admin CMS access for authenticated non-admin users', async () => {
    const handler = createHandler();
    const token = getToken((await authenticate(handler, '123456')).body);

    const response = await dispatchJson(handler, {
      method: 'GET',
      url: '/admin/vocab-items',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(403);
    expect((response.body as { code: string }).code).toBe('admin_forbidden');
  });

  it('validates import bundles and rejects broken content clearly', async () => {
    const handler = createHandler();
    const adminToken = getToken((await authenticate(handler, '999999')).body);

    const response = await dispatchJson(handler, {
      method: 'POST',
      url: '/admin/import/validate',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        bundle: {
          version: 'phase10-cms-v1',
          exportedAt: fixedNow.toISOString(),
          sourceLabel: 'broken-bundle',
          levels: [],
          topics: [],
          lessons: [],
          vocabItems: [{ id: 'bonjour' }],
          distractorSets: [],
        },
      },
    });

    expect(response.status).toBe(200);
    expect((response.body as { success: boolean }).success).toBe(false);
    expect((response.body as { issues: Array<{ path: string }> }).issues.length).toBeGreaterThan(0);
  });

  it('applies valid imports, supports preview and QA flags, and records audit history', async () => {
    const handler = createHandler();
    const adminToken = getToken((await authenticate(handler, '999999')).body);
    const bundle = createValidImportBundle();

    const applyResponse = await dispatchJson(handler, {
      method: 'POST',
      url: '/admin/import/apply',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        bundle,
      },
    });

    expect(applyResponse.status).toBe(200);
    expect((applyResponse.body as { counts: { vocabItems: number } }).counts.vocabItems).toBe(3);

    const listResponse = await dispatchJson(handler, {
      method: 'GET',
      url: '/admin/vocab-items?levelId=A1&status=approved',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(listResponse.status).toBe(200);
    expect((listResponse.body as { items: Array<{ id: string }> }).items.map((item) => item.id)).toContain('bonjour');

    const previewResponse = await dispatchJson(handler, {
      method: 'GET',
      url: '/admin/preview/vocab-items/bonjour',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(previewResponse.status).toBe(200);
    expect((previewResponse.body as { question: { options: Array<unknown> } }).question.options.length).toBeGreaterThanOrEqual(2);

    const flagResponse = await dispatchJson(handler, {
      method: 'POST',
      url: '/admin/qa-flags',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        entityType: 'vocab_item',
        entityId: 'bonjour',
        flagType: 'needs_review',
        note: 'Check distractor quality.',
      },
    });

    expect(flagResponse.status).toBe(200);
    const flagId = (flagResponse.body as { flag: { id: string } }).flag.id;

    const resolveResponse = await dispatchJson(handler, {
      method: 'POST',
      url: `/admin/qa-flags/${flagId}/resolve`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(resolveResponse.status).toBe(200);

    const bulkResponse = await dispatchJson(handler, {
      method: 'POST',
      url: '/admin/vocab-items/bulk-update',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        ids: ['bonjour'],
        status: 'archived',
      },
    });

    expect(bulkResponse.status).toBe(200);
    expect((bulkResponse.body as { updatedIds: string[] }).updatedIds).toEqual(['bonjour']);

    const detailResponse = await dispatchJson(handler, {
      method: 'GET',
      url: '/admin/vocab-items/bonjour',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(detailResponse.status).toBe(200);
    expect((detailResponse.body as { item: { status: string } }).item.status).toBe('archived');

    const historyResponse = await dispatchJson(handler, {
      method: 'GET',
      url: '/admin/history?entityType=vocab_item&entityId=bonjour',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(historyResponse.status).toBe(200);
    expect((historyResponse.body as { entries: Array<{ actionType: string }> }).entries.some((entry) => entry.actionType === 'bulk_update')).toBe(true);
  });

  it('rejects malformed content updates and invalid status transitions', async () => {
    const handler = createHandler();
    const adminToken = getToken((await authenticate(handler, '999999')).body);
    const bundle = createValidImportBundle();

    await dispatchJson(handler, {
      method: 'POST',
      url: '/admin/import/apply',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        bundle,
      },
    });

    const malformedUpdate = await dispatchJson(handler, {
      method: 'PATCH',
      url: '/admin/vocab-items/bonjour',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        item: {
          ...bundle.vocabItems[0],
          translationRu: '',
        },
      },
    });

    expect(malformedUpdate.status).toBe(400);
    expect((malformedUpdate.body as { code: string }).code).toBe('content_validation_failed');

    const archiveResponse = await dispatchJson(handler, {
      method: 'PATCH',
      url: '/admin/vocab-items/bonjour',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        item: {
          ...bundle.vocabItems[0],
          status: 'archived',
        },
      },
    });

    expect(archiveResponse.status).toBe(200);

    const invalidTransition = await dispatchJson(handler, {
      method: 'PATCH',
      url: '/admin/vocab-items/bonjour',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        item: {
          ...bundle.vocabItems[0],
          status: 'draft',
        },
      },
    });

    expect(invalidTransition.status).toBe(409);
    expect((invalidTransition.body as { code: string }).code).toBe('content_conflict');
  });

  it('rejects invalid topic and lesson payloads through the editor API', async () => {
    const handler = createHandler();
    const adminToken = getToken((await authenticate(handler, '999999')).body);

    const invalidTopic = await dispatchJson(handler, {
      method: 'POST',
      url: '/admin/topics',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        item: {
          id: 'topic_bad',
          slug: 'Bad Slug',
          title: 'Broken topic',
          cefrLevels: ['A1', 'A1'],
          status: 'draft',
          editorialMetadata: {},
        },
      },
    });

    expect(invalidTopic.status).toBe(400);
    expect((invalidTopic.body as { code: string }).code).toBe('content_validation_failed');

    const invalidLesson = await dispatchJson(handler, {
      method: 'POST',
      url: '/admin/lessons',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      body: {
        item: {
          id: 'lesson_bad',
          slug: 'lesson-bad',
          title: 'Broken lesson',
          cefrLevel: 'A1',
          topicIds: ['topic_missing'],
          contentRefs: [
            { itemId: 'bonjour', order: 1, cardType: 'single_word' },
            { itemId: 'salut', order: 1, cardType: 'single_word' },
          ],
          status: 'draft',
          editorialMetadata: {},
        },
      },
    });

    expect(invalidLesson.status).toBe(400);
    expect((invalidLesson.body as { code: string }).code).toBe('content_validation_failed');
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
      ADMIN_BASE_URL: 'http://localhost:3001',
      ADMIN_ALLOWED_TELEGRAM_USER_IDS: '999999',
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

function createValidImportBundle() {
  return {
    version: 'phase10-cms-v1',
    exportedAt: fixedNow.toISOString(),
    sourceLabel: 'test-import',
    levels: [
      {
        id: 'A1',
        cefrLevel: 'A1',
        title: 'A1',
        description: 'Starter level',
        order: 1,
        topicIds: ['topic_greetings'],
        lessonIds: ['lesson_greetings'],
        status: 'approved',
        editorialMetadata: {},
      },
    ],
    topics: [
      {
        id: 'topic_greetings',
        slug: 'greetings',
        title: 'Приветствия',
        description: 'Basic greetings',
        cefrLevels: ['A1'],
        status: 'approved',
        editorialMetadata: {},
      },
    ],
    lessons: [
      {
        id: 'lesson_greetings',
        slug: 'greetings-intro',
        title: 'Первые слова',
        description: 'Lesson intro',
        cefrLevel: 'A1',
        topicIds: ['topic_greetings'],
        contentRefs: [
          { itemId: 'bonjour', order: 1, cardType: 'single_word' },
          { itemId: 'salut', order: 2, cardType: 'single_word' },
          { itemId: 'merci', order: 3, cardType: 'single_word' },
        ],
        status: 'approved',
        editorialMetadata: {},
      },
    ],
    vocabItems: [
      createVocabItem({
        id: 'bonjour',
        lemma: 'bonjour',
        surfaceForm: 'bonjour',
        translationRu: 'здравствуйте',
        distractorSetId: 'set_bonjour',
      }),
      createVocabItem({
        id: 'salut',
        lemma: 'salut',
        surfaceForm: 'salut',
        translationRu: 'привет',
      }),
      createVocabItem({
        id: 'merci',
        lemma: 'merci',
        surfaceForm: 'merci',
        translationRu: 'спасибо',
      }),
    ],
    distractorSets: [
      {
        id: 'set_bonjour',
        cardType: 'single_word',
        promptLanguage: 'ru',
        answerLanguage: 'fr',
        options: [
          { id: 'option:bonjour', label: 'bonjour', isCorrect: true, linkedItemId: 'bonjour' },
          { id: 'option:salut', label: 'salut', isCorrect: false, linkedItemId: 'salut' },
          { id: 'option:merci', label: 'merci', isCorrect: false, linkedItemId: 'merci' },
        ],
        sourceItemId: 'bonjour',
        cefrLevel: 'A1',
        status: 'approved',
        editorialMetadata: {},
      },
    ],
  } as const;
}

function createVocabItem(input: {
  id: string;
  lemma: string;
  surfaceForm: string;
  translationRu: string;
  distractorSetId?: string;
}) {
  return {
    id: input.id,
    language: 'fr',
    itemType: 'word',
    partOfSpeech: 'interjection',
    cefrLevel: 'A1',
    lemma: input.lemma,
    surfaceForm: input.surfaceForm,
    translationRu: input.translationRu,
    translations: [],
    topicId: 'topic_greetings',
    tags: [],
    exampleSentence: {
      fr: `${input.surfaceForm}!`,
      ru: `${input.translationRu}!`,
    },
    exampleSentences: [],
    distractorSetId: input.distractorSetId,
    distractorHints: [],
    source: {
      label: 'Editorial seed',
      kind: 'editorial',
    },
    frequencyScore: 10,
    status: 'approved',
    editorialMetadata: {},
  } as const;
}
