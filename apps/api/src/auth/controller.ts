import type {
  AuthError,
  AuthResponse,
  SessionVerificationResponse,
} from '@langue-buster/shared';
import { telegramAuthRequestSchema } from '@langue-buster/shared';

import type { AuthService } from './service.js';
import { normalizeAuthError } from './service.js';
import type { SessionVerifier } from './session-verifier.js';
import { getBearerToken, mapSessionErrorStatus } from './session-verifier.js';

export type AuthHttpResult = {
  status: number;
  body: AuthResponse | SessionVerificationResponse | AuthError;
};

export type AuthController = ReturnType<typeof createAuthController>;

export function createAuthController(authService: AuthService, sessionVerifier: SessionVerifier) {
  return {
    async handleTelegramAuth(body: unknown): Promise<AuthHttpResult> {
      try {
        const payload = telegramAuthRequestSchema.parse(body);
        const response = await authService.authenticateTelegramLaunch(payload);

        return {
          status: 200,
          body: response,
        };
      } catch (error) {
        const normalizedError = normalizeAuthError(error);
        console.error('[auth] telegram authentication failed', {
          code: normalizedError.code,
          message: normalizedError.message,
        });

        return {
          status: normalizedError.code === 'invalid_signature' ? 401 : 400,
          body: normalizedError,
        };
      }
    },

    async handleSessionLookup(authorizationHeader: string | undefined): Promise<AuthHttpResult> {
      try {
        const token = getBearerToken(authorizationHeader);
        const response = await sessionVerifier.verifySessionToken(token);

        return {
          status: 200,
          body: response,
        };
      } catch (error) {
        const normalizedError = normalizeAuthError(error);

        return {
          status: mapSessionErrorStatus(normalizedError),
          body: normalizedError,
        };
      }
    },
  };
}

export function createUnavailableAuthController(message: string) {
  const body: AuthError = {
    code: 'auth_unavailable',
    message,
  };

  return {
    async handleTelegramAuth(): Promise<AuthHttpResult> {
      return {
        status: 503,
        body,
      };
    },

    async handleSessionLookup(): Promise<AuthHttpResult> {
      return {
        status: 503,
        body,
      };
    },
  };
}
