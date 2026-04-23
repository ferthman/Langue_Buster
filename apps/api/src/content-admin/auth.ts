import type { SessionVerificationResponse } from '@langue-buster/shared';

import type { SessionVerifier } from '../auth/session-verifier.js';
import { getBearerToken } from '../auth/session-verifier.js';
import { ContentAdminDomainError } from './errors.js';

export function createAdminSessionGuard(
  sessionVerifier: SessionVerifier,
  options: Readonly<{
    allowedUserIds: ReadonlySet<string>;
    allowedTelegramUserIds: ReadonlySet<string>;
  }>,
) {
  return {
    async verify(authorizationHeader: string | undefined): Promise<SessionVerificationResponse> {
      const token = getBearerToken(authorizationHeader);
      const session = await sessionVerifier.verifySessionToken(token);
      const allowedByUserId = options.allowedUserIds.has(session.user.id);
      const allowedByTelegramUserId = options.allowedTelegramUserIds.has(session.user.telegramUserId);

      if (!allowedByUserId && !allowedByTelegramUserId) {
        throw new ContentAdminDomainError('admin_forbidden', 'This session is not allowed to access the Admin CMS.');
      }

      return session;
    },
  };
}

export function parseCommaSeparatedEnv(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}
