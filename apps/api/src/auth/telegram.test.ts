import { describe, expect, it } from 'vitest';

import { computeTelegramInitDataHash, validateTelegramInitData } from './telegram.js';

const testBotToken = 'telegram-test-token';
const fixedNow = new Date('2026-04-22T00:00:00.000Z');

describe('validateTelegramInitData', () => {
  it('accepts valid signed Telegram launch data', () => {
    const initData = createSignedInitData({
      authDate: Math.floor(fixedNow.getTime() / 1000),
    });

    const result = validateTelegramInitData(initData, {
      botToken: testBotToken,
      now: () => fixedNow,
    });

    expect(result.user.id).toBe('123456');
    expect(result.user.firstName).toBe('Dmitriy');
  });

  it('rejects invalid signatures', () => {
    const initData = createSignedInitData({
      authDate: Math.floor(fixedNow.getTime() / 1000),
    }).replace('hash=', 'hash=deadbeef');

    expect(() =>
      validateTelegramInitData(initData, {
        botToken: testBotToken,
        now: () => fixedNow,
      }),
    ).toThrow(/signature is invalid/i);
  });

  it('rejects malformed payloads', () => {
    expect(() =>
      validateTelegramInitData('not-a-valid-query-string', {
        botToken: testBotToken,
        now: () => fixedNow,
      }),
    ).toThrow(/missing the hash/i);
  });

  it('rejects initData without a user payload', () => {
    const params = new URLSearchParams({
      auth_date: String(Math.floor(fixedNow.getTime() / 1000)),
      query_id: 'AAEAAAE',
    });
    const hash = computeTelegramInitDataHash(params.toString(), testBotToken);
    params.set('hash', hash);

    expect(() =>
      validateTelegramInitData(params.toString(), {
        botToken: testBotToken,
        now: () => fixedNow,
      }),
    ).toThrow(/missing the user payload/i);
  });

  it('falls back to username when Telegram user payload has no first_name', () => {
    const user = JSON.stringify({
      id: 123456,
      username: 'dmitriy',
    });
    const params = new URLSearchParams({
      auth_date: String(Math.floor(fixedNow.getTime() / 1000)),
      query_id: 'AAEAAAE',
      user,
    });
    const hash = computeTelegramInitDataHash(params.toString(), testBotToken);
    params.set('hash', hash);

    const result = validateTelegramInitData(params.toString(), {
      botToken: testBotToken,
      now: () => fixedNow,
    });

    expect(result.user.firstName).toBe('dmitriy');
  });

  it('falls back to a technical label when Telegram user payload has neither first_name nor username', () => {
    const user = JSON.stringify({
      id: 123456,
    });
    const params = new URLSearchParams({
      auth_date: String(Math.floor(fixedNow.getTime() / 1000)),
      query_id: 'AAEAAAE',
      user,
    });
    const hash = computeTelegramInitDataHash(params.toString(), testBotToken);
    params.set('hash', hash);

    const result = validateTelegramInitData(params.toString(), {
      botToken: testBotToken,
      now: () => fixedNow,
    });

    expect(result.user.firstName).toBe('Telegram 123456');
  });
});

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
