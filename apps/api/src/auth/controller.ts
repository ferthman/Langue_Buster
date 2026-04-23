import type {
  AnalyticsEventEnvelope,
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

export function createAuthController(
  authService: AuthService,
  sessionVerifier: SessionVerifier,
  options: {
    analytics?: {
      recordEvent(event: AnalyticsEventEnvelope): Promise<unknown>;
    };
    logger?: {
      warn(message: string, context: Record<string, unknown>): void;
    };
    errorReporter?: {
      captureError(error: unknown, context: Record<string, unknown>): void;
    };
  } = {},
) {
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
        options.logger?.warn('Telegram authentication failed.', {
          domain: 'auth',
          code: normalizedError.code,
          message: normalizedError.message,
        });
        options.errorReporter?.captureError(error, {
          domain: 'auth',
          code: normalizedError.code,
          extra: {
            route: '/auth/telegram',
          },
        });
        await options.analytics?.recordEvent({
          eventName: 'auth_bootstrap_failed',
          source: 'backend',
          occurredAt: new Date().toISOString(),
          payload: {
            route: '/auth/telegram',
            code: normalizedError.code,
            message: normalizedError.message,
          },
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
        await options.analytics?.recordEvent({
          eventName: 'auth_bootstrap_succeeded',
          source: 'backend',
          occurredAt: response.session.issuedAt,
          userId: response.user.id,
          sessionId: response.session.id,
          payload: {
            method: 'stored_session',
            route: '/auth/session',
          },
        });

        return {
          status: 200,
          body: response,
        };
      } catch (error) {
        const normalizedError = normalizeAuthError(error);
        await options.analytics?.recordEvent({
          eventName: 'auth_bootstrap_failed',
          source: 'backend',
          occurredAt: new Date().toISOString(),
          payload: {
            route: '/auth/session',
            code: normalizedError.code,
            message: normalizedError.message,
          },
        });

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
