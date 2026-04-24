import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SoftLaunchScreen } from './SoftLaunchScreen';

const stableSession = {
  state: {
    status: 'ready',
    token: 'token-1',
    session: {
      user: { id: 'user-1', telegramUserId: '999999', firstName: 'Mila' },
      session: { expiresAt: '2026-04-23T05:00:00.000Z' },
    },
  },
};

vi.mock('../lib/auth', () => ({
  useAdminSession: () => stableSession,
}));

const apiMocks = vi.hoisted(() => ({
  getSoftLaunchStatus: vi.fn(),
  getSoftLaunchLaunchReport: vi.fn(),
  getSoftLaunchRetentionReport: vi.fn(),
  getSoftLaunchContentReport: vi.fn(),
  getSoftLaunchTuningReport: vi.fn(),
  listAntiCheatAnomalies: vi.fn(),
  updateSoftLaunchSettings: vi.fn(),
  createQaFlag: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  adminApi: apiMocks,
}));

describe('SoftLaunchScreen', () => {
  it('renders overview and creates QA flag from top failed items', async () => {
    apiMocks.getSoftLaunchStatus.mockResolvedValue({
      enabled: true,
      launchLevels: ['A1', 'A2'],
      allowedUserIdsCount: 2,
      allowedTelegramUserIdsCount: 3,
      activeSettings: {
        id: 'soft_1',
        settings: {
          startingHearts: 3,
          wrongAnswerHeartLoss: 1,
          learningToStableSuccessStreak: 3,
          stableToMasteredSuccessStreak: 6,
          learningRequiresCorrectOverWrong: true,
          masteredMaxWrongCount: 2,
          weakReviewHours: 2,
          learningReviewHours: 12,
          stableReviewDays: 3,
          masteredReviewDays: 10,
          weakResurfaceWindowHours: 2,
        },
        isActive: true,
        createdAt: '2026-04-24T00:00:00.000Z',
      },
    });
    apiMocks.getSoftLaunchLaunchReport.mockResolvedValue({
      generatedAt: '2026-04-24T00:00:00.000Z',
      query: {},
      kpis: {
        onboardingCompletionCount: 4,
        onboardingCompletionRate: 0.5,
        firstRunStartCount: 3,
        firstRunFinishCount: 2,
        runCompletionCount: 2,
        runAbandonCount: 1,
        reviewAdoptionCount: 1,
        reviewAdoptionRate: 0.33,
        answerAccuracy: 0.8,
        averageRunLengthSeconds: 52,
        runtimeFailureCount: 0,
      },
      runtimeFailures: { count: 0, recent: [] },
      antiCheat: { totalCount: 0, byType: [] },
      markdownSummary: '# Launch',
    });
    apiMocks.getSoftLaunchRetentionReport.mockResolvedValue({
      generatedAt: '2026-04-24T00:00:00.000Z',
      query: {},
      cohortSize: 4,
      d1RetainedUsers: 2,
      d7RetainedUsers: 1,
      d1Rate: 0.5,
      d7Rate: 0.25,
      replayUsers: 2,
      replayRate: 0.5,
      markdownSummary: '# Retention',
    });
    apiMocks.getSoftLaunchContentReport.mockResolvedValue({
      generatedAt: '2026-04-24T00:00:00.000Z',
      query: {},
      topFailedItems: [
        {
          sourceItemId: 'vocab.a1.food.apple',
          topicId: 'topic.food',
          lessonIds: ['lesson.food.a1'],
          wrongAnswerCount: 3,
          reviewWrongCount: 1,
          weakMasteryCount: 2,
          resurfacingCount: 1,
          issueScore: 6.5,
        },
      ],
      weakTopicClusters: [],
      weakLessonClusters: [],
      markdownSummary: '# Content',
    });
    apiMocks.getSoftLaunchTuningReport.mockResolvedValue({
      generatedAt: '2026-04-24T00:00:00.000Z',
      query: {},
      activeSettings: {
        id: 'soft_1',
        settings: {
          startingHearts: 3,
          wrongAnswerHeartLoss: 1,
          learningToStableSuccessStreak: 3,
          stableToMasteredSuccessStreak: 6,
          learningRequiresCorrectOverWrong: true,
          masteredMaxWrongCount: 2,
          weakReviewHours: 2,
          learningReviewHours: 12,
          stableReviewDays: 3,
          masteredReviewDays: 10,
          weakResurfaceWindowHours: 2,
        },
        isActive: true,
        createdAt: '2026-04-24T00:00:00.000Z',
      },
      observedSignals: [],
      recommendedAdjustments: ['Keep current settings.'],
      openRisks: [],
      markdownSummary: '# Tuning',
    });
    apiMocks.listAntiCheatAnomalies.mockResolvedValue({ anomalies: [] });
    apiMocks.createQaFlag.mockResolvedValue({
      flag: {
        id: 'flag_1',
        entityType: 'vocab_item',
        entityId: 'vocab.a1.food.apple',
        flagType: 'needs_review',
        status: 'open',
        createdAt: '2026-04-24T00:00:00.000Z',
        createdByUserId: 'user-1',
        createdByTelegramUserId: '999999',
      },
    });

    render(<SoftLaunchScreen />);

    await waitFor(() => expect(screen.getByText('Контрольный режим')).toBeTruthy());
    expect(screen.getByText('vocab.a1.food.apple')).toBeTruthy();

    fireEvent.click(screen.getByText('QA-флаг'));

    await waitFor(() => expect(apiMocks.createQaFlag).toHaveBeenCalled());
    expect(apiMocks.createQaFlag).toHaveBeenCalledWith('token-1', expect.objectContaining({
      entityId: 'vocab.a1.food.apple',
      flagType: 'needs_review',
    }));
  });
});
