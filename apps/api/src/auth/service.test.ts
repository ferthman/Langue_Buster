import { describe, expect, it } from 'vitest';

import {
  InMemorySessionRepository,
  InMemoryUserRepository,
} from './repositories.js';
import { createAuthService } from './service.js';
import { computeTelegramInitDataHash } from './telegram.js';

const testBotToken = 'telegram-test-token';
const fixedNow = new Date('2026-04-22T00:00:00.000Z');

describe('createAuthService', () => {
  it('creates an internal user and issues a session', async () => {
    const userRepository = new InMemoryUserRepository({
      now: () => fixedNow,
    });
    const sessionRepository = new InMemorySessionRepository();
    const service = createAuthService({
      botToken: testBotToken,
      userRepository,
      sessionRepository,
      now: () => fixedNow,
    });

    const response = await service.authenticateTelegramLaunch({
      initData: createSignedInitData(),
    });

    expect(response.user.telegramUserId).toBe('123456');
    expect(response.session.userId).toBe(response.user.id);
    await expect(sessionRepository.findById(response.session.id)).resolves.toEqual(response.session);
  });
});

function createSignedInitData() {
  const user = JSON.stringify({
    id: 123456,
    first_name: 'Dmitriy',
    username: 'dmitriy',
    language_code: 'ru',
    is_premium: true,
  });

  const params = new URLSearchParams({
    auth_date: String(Math.floor(fixedNow.getTime() / 1000)),
    query_id: 'AAEAAAE',
    user,
  });
  const hash = computeTelegramInitDataHash(params.toString(), testBotToken);
  params.set('hash', hash);

  return params.toString();
}
