import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AntiCheatScreen } from './AntiCheatScreen';

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
  listAntiCheatAnomalies: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  adminApi: {
    listAntiCheatAnomalies: apiMocks.listAntiCheatAnomalies,
  },
}));

describe('AntiCheatScreen', () => {
  it('renders anomaly rows from the admin API', async () => {
    apiMocks.listAntiCheatAnomalies.mockResolvedValue({
      anomalies: [
        {
          id: 'ac_1',
          type: 'impossible_answer_timing',
          severity: 'medium',
          metadata: { timingMs: 100 },
          occurredAt: '2026-04-22T00:00:00.000Z',
          userId: 'usr_1',
          runId: 'run_1',
        },
      ],
    });

    render(<AntiCheatScreen />);

    await waitFor(() => expect(screen.getByText('impossible_answer_timing')).toBeTruthy());
    expect(screen.getByText('run_1')).toBeTruthy();
  });
});
