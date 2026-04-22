import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

vi.mock('@twa-dev/sdk', () => ({
  default: {
    initData: 'query_id=test',
    colorScheme: 'dark',
    themeParams: {
      bg_color: '#101010',
      text_color: '#ffffff',
    },
    HapticFeedback: {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
    },
    ready: vi.fn(),
    expand: vi.fn(),
  },
}));

describe('App bootstrap and routing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('uses a valid stored session and redirects to onboarding', async () => {
    window.localStorage.setItem('langue-buster.sessionToken', 'token-1');
    mockFetchSequence([
      {
        user: {
          id: 'user-1',
          telegramUserId: '123',
          firstName: 'Mila',
          isPremium: false,
          createdAt: '2026-04-23T00:00:00.000Z',
          lastLoginAt: '2026-04-23T00:00:00.000Z',
        },
        session: {
          id: 'session-1',
          token: 'token-1',
          userId: 'user-1',
          issuedAt: '2026-04-23T00:00:00.000Z',
          expiresAt: '2026-04-23T05:00:00.000Z',
        },
      },
    ]);

    renderApp('/');

    expect(await screen.findByText('Как работает петля игры')).toBeTruthy();
  });

  it('falls back from invalid stored session to Telegram auth', async () => {
    window.localStorage.setItem('langue-buster.sessionToken', 'stale-token');
    mockFetchSequence(
      [{ status: 401, body: { code: 'invalid_session', message: 'invalid' } }],
      [
        {
          user: {
            id: 'user-1',
            telegramUserId: '123',
            firstName: 'Mila',
            isPremium: false,
            createdAt: '2026-04-23T00:00:00.000Z',
            lastLoginAt: '2026-04-23T00:00:00.000Z',
          },
          session: {
            id: 'session-1',
            token: 'fresh-token',
            userId: 'user-1',
            issuedAt: '2026-04-23T00:00:00.000Z',
            expiresAt: '2026-04-23T05:00:00.000Z',
          },
        },
      ],
    );

    renderApp('/');

    expect(await screen.findByText('Как работает петля игры')).toBeTruthy();
    expect(window.localStorage.getItem('langue-buster.sessionToken')).toBe('fresh-token');
  });

  it('shows auth failure state when bootstrap fails', async () => {
    mockFetchSequence([{ status: 503, body: { code: 'auth_unavailable', message: 'down' } }]);

    renderApp('/');

    expect(await screen.findByText('Не удалось открыть приложение')).toBeTruthy();
    expect(screen.getByText('down')).toBeTruthy();
  });

  it('redirects authenticated users without focus level to placement', async () => {
    window.localStorage.setItem('langue-buster.onboardingSeen', 'true');
    mockFetchSequence([
      {
        user: {
          id: 'user-1',
          telegramUserId: '123',
          firstName: 'Mila',
          isPremium: false,
          createdAt: '2026-04-23T00:00:00.000Z',
          lastLoginAt: '2026-04-23T00:00:00.000Z',
        },
        session: {
          id: 'session-1',
          token: 'token-1',
          userId: 'user-1',
          issuedAt: '2026-04-23T00:00:00.000Z',
          expiresAt: '2026-04-23T05:00:00.000Z',
        },
      },
    ]);

    renderApp('/');

    expect(await screen.findByText('Выберите стартовый уровень')).toBeTruthy();
  });

  it('renders home after bootstrap when onboarding and focus level are set', async () => {
    window.localStorage.setItem('langue-buster.onboardingSeen', 'true');
    window.localStorage.setItem('langue-buster.focusLevel', 'A1');
    mockFetchSequence(
      [
        {
          user: {
            id: 'user-1',
            telegramUserId: '123',
            firstName: 'Mila',
            isPremium: false,
            createdAt: '2026-04-23T00:00:00.000Z',
            lastLoginAt: '2026-04-23T00:00:00.000Z',
          },
          session: {
            id: 'session-1',
            token: 'token-1',
            userId: 'user-1',
            issuedAt: '2026-04-23T00:00:00.000Z',
            expiresAt: '2026-04-23T05:00:00.000Z',
          },
        },
      ],
      [{ items: [] }],
    );

    renderApp('/');

    expect(await screen.findByText('Привет, Mila')).toBeTruthy();
  });

  it('loads the review empty state', async () => {
    window.localStorage.setItem('langue-buster.onboardingSeen', 'true');
    window.localStorage.setItem('langue-buster.focusLevel', 'A1');
    mockFetchSequence(
      [
        {
          user: {
            id: 'user-1',
            telegramUserId: '123',
            firstName: 'Mila',
            isPremium: false,
            createdAt: '2026-04-23T00:00:00.000Z',
            lastLoginAt: '2026-04-23T00:00:00.000Z',
          },
          session: {
            id: 'session-1',
            token: 'token-1',
            userId: 'user-1',
            issuedAt: '2026-04-23T00:00:00.000Z',
            expiresAt: '2026-04-23T05:00:00.000Z',
          },
        },
      ],
      [{ items: [] }],
    );

    renderApp('/review');

    expect(await screen.findByText('Пока ничего не нужно повторять')).toBeTruthy();
  });

  it('renders run loading and then terminal result state', async () => {
    window.localStorage.setItem('langue-buster.onboardingSeen', 'true');
    window.localStorage.setItem('langue-buster.focusLevel', 'A1');
    mockFetchSequence(
      [
        {
          user: {
            id: 'user-1',
            telegramUserId: '123',
            firstName: 'Mila',
            isPremium: false,
            createdAt: '2026-04-23T00:00:00.000Z',
            lastLoginAt: '2026-04-23T00:00:00.000Z',
          },
          session: {
            id: 'session-1',
            token: 'token-1',
            userId: 'user-1',
            issuedAt: '2026-04-23T00:00:00.000Z',
            expiresAt: '2026-04-23T05:00:00.000Z',
          },
        },
      ],
      [
        {
          run: {
            id: 'run-1',
            userId: 'user-1',
            levelId: 'A1',
            direction: 'ru_to_fr',
            status: 'completed',
            heartsRemaining: 2,
            score: 10,
            combo: 1,
            seed: 1,
            engineState: {
              board: { width: 8, height: 8, cells: Array.from({ length: 64 }, () => 'empty') },
              tray: [null, null, null],
              rng: { seed: 1, cursor: 3 },
              score: 10,
              combo: 1,
              turn: 1,
              lastClearCount: 1,
              clearedLinesTotal: 1,
            },
            currentQuestionState: null,
            answerCount: 1,
            correctCount: 1,
            wrongCount: 0,
            moveCount: 1,
            startedAt: '2026-04-23T00:00:00.000Z',
            finishedAt: '2026-04-23T00:01:00.000Z',
          },
        },
      ],
      [
        {
          result: {
            runId: 'run-1',
            userId: 'user-1',
            levelId: 'A1',
            direction: 'ru_to_fr',
            status: 'completed',
            finalScore: 10,
            clearedLinesTotal: 1,
            correctCount: 1,
            wrongCount: 0,
            startedAt: '2026-04-23T00:00:00.000Z',
            finishedAt: '2026-04-23T00:01:00.000Z',
            durationMs: 60000,
          },
        },
      ],
    );

    renderApp('/run/run-1');

    expect(await screen.findByText('Ран завершён')).toBeTruthy();
  });

  it('submits a review answer and advances after feedback', async () => {
    window.localStorage.setItem('langue-buster.onboardingSeen', 'true');
    window.localStorage.setItem('langue-buster.focusLevel', 'A1');
    mockFetchSequence(
      [
        {
          user: {
            id: 'user-1',
            telegramUserId: '123',
            firstName: 'Mila',
            isPremium: false,
            createdAt: '2026-04-23T00:00:00.000Z',
            lastLoginAt: '2026-04-23T00:00:00.000Z',
          },
          session: {
            id: 'session-1',
            token: 'token-1',
            userId: 'user-1',
            issuedAt: '2026-04-23T00:00:00.000Z',
            expiresAt: '2026-04-23T05:00:00.000Z',
          },
        },
      ],
      [
        {
          items: [
            {
              userId: 'user-1',
              sourceItemId: 'vocab.a1.apple',
              cefrLevel: 'A1',
              masteryState: 'weak',
              nextReviewAt: '2026-04-23T00:00:00.000Z',
              priority: 100,
              reason: 'weak_item',
              topicId: 'topic.food',
              question: {
                id: 'q-1',
                cardType: 'single_word_translation',
                promptLanguage: 'ru',
                answerLanguage: 'fr',
                promptText: 'яблоко',
                options: [
                  { id: 'opt-1', label: 'pomme', isCorrect: true },
                  { id: 'opt-2', label: 'poire', isCorrect: false },
                ],
                correctOptionId: 'opt-1',
                sourceItemIds: ['vocab.a1.apple'],
                cefrLevel: 'A1',
                meta: {
                  sourceItemId: 'vocab.a1.apple',
                  topicId: 'topic.food',
                  distractorSource: 'linked_set',
                  generatorVersion: 'phase8-v1',
                },
              },
              createdAt: '2026-04-22T00:00:00.000Z',
              updatedAt: '2026-04-22T00:00:00.000Z',
            },
          ],
        },
      ],
      [
        {
          evaluation: {
            questionId: 'q-1',
            selectedOptionId: 'opt-1',
            correctOptionId: 'opt-1',
            isCorrect: true,
            moveUnlocked: true,
            penalty: null,
            cardType: 'single_word_translation',
            sourceItemId: 'vocab.a1.apple',
            cefrLevel: 'A1',
          },
          mastery: {
            userId: 'user-1',
            sourceItemId: 'vocab.a1.apple',
            cefrLevel: 'A1',
            masteryState: 'learning',
            seenCount: 1,
            correctCount: 1,
            wrongCount: 0,
            successStreak: 1,
            failureStreak: 0,
            lastSeenAt: '2026-04-23T00:00:00.000Z',
            lastOutcome: 'correct',
            nextReviewAt: '2026-04-23T12:00:00.000Z',
            resurfacingReason: 'new_item',
            createdAt: '2026-04-23T00:00:00.000Z',
            updatedAt: '2026-04-23T00:00:00.000Z',
          },
          reviewQueueItem: {
            userId: 'user-1',
            sourceItemId: 'vocab.a1.apple',
            cefrLevel: 'A1',
            masteryState: 'learning',
            nextReviewAt: '2026-04-23T12:00:00.000Z',
            priority: 70,
            reason: 'scheduled_review',
            topicId: 'topic.food',
            question: {
              id: 'q-1',
              cardType: 'single_word_translation',
              promptLanguage: 'ru',
              answerLanguage: 'fr',
              promptText: 'яблоко',
              options: [
                { id: 'opt-1', label: 'pomme', isCorrect: true },
                { id: 'opt-2', label: 'poire', isCorrect: false },
              ],
              correctOptionId: 'opt-1',
              sourceItemIds: ['vocab.a1.apple'],
              cefrLevel: 'A1',
              meta: {
                sourceItemId: 'vocab.a1.apple',
                topicId: 'topic.food',
                distractorSource: 'linked_set',
                generatorVersion: 'phase8-v1',
              },
            },
            createdAt: '2026-04-23T00:00:00.000Z',
            updatedAt: '2026-04-23T00:00:00.000Z',
          },
        },
      ],
    );

    renderApp('/review');

    expect(await screen.findByText('яблоко')).toBeTruthy();
    await userEvent.click(screen.getByText('pomme'));
    expect(await screen.findByText(/Следующий показ/)).toBeTruthy();
    await userEvent.click(screen.getByText('Следующая карточка'));
    expect(await screen.findByText('Пока ничего не нужно повторять')).toBeTruthy();
  });
});

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function mockFetchSequence(...responses: Array<ArrayLikeResponse | ArrayLikeResponse[]>) {
  const fetchMock = vi.mocked(fetch);
  for (const entry of responses.flat()) {
    if ('status' in entry) {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(entry.body), {
          status: entry.status as number,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      continue;
    }

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(entry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
}

type ArrayLikeResponse =
  | {
      status: number;
      body: unknown;
    }
  | Record<string, unknown>;
