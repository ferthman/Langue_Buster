import type {
  AntiCheatAnomalyListResponse,
  AdminError,
} from '@langue-buster/shared';
import {
  adminErrorSchema,
  antiCheatAnomalyListQuerySchema,
  antiCheatAnomalyListResponseSchema,
} from '@langue-buster/shared';

import { AuthDomainError } from '../auth/errors.js';
import { mapSessionErrorStatus } from '../auth/session-verifier.js';
import { ContentAdminDomainError } from '../content-admin/errors.js';
import type { AntiCheatService } from './service.js';

export type AntiCheatHttpResult = {
  status: number;
  body: AntiCheatAnomalyListResponse | AdminError;
};

export type AntiCheatController = ReturnType<typeof createAntiCheatController>;

export function createAntiCheatController(input: {
  service: AntiCheatService;
  verifyAdmin(authorizationHeader: string | undefined): Promise<unknown>;
}) {
  return {
    async handleListAnomalies(
      query: Record<string, string>,
      authorizationHeader: string | undefined,
    ): Promise<AntiCheatHttpResult> {
      try {
        await input.verifyAdmin(authorizationHeader);
        const parsed = antiCheatAnomalyListQuerySchema.parse(query);
        const anomalies = await input.service.listAnomalies(parsed);

        return {
          status: 200,
          body: antiCheatAnomalyListResponseSchema.parse({ anomalies }),
        };
      } catch (error) {
        return toAntiCheatError(error);
      }
    },
  };
}

export function createUnavailableAntiCheatController(message: string): AntiCheatController {
  const body = adminErrorSchema.parse({
    code: 'admin_unavailable',
    message,
  });

  return {
    handleListAnomalies(): Promise<AntiCheatHttpResult> {
      return Promise.resolve({
        status: 503,
        body,
      });
    },
  };
}

function toAntiCheatError(error: unknown): AntiCheatHttpResult {
  if (error instanceof ContentAdminDomainError) {
    return {
      status: error.code === 'admin_forbidden' ? 403 : 400,
      body: adminErrorSchema.parse({
        code: error.code,
        message: error.message,
      }),
    };
  }

  if (error instanceof AuthDomainError) {
    return {
      status: mapSessionErrorStatus({
        code: error.code,
        message: error.message,
      }),
      body: adminErrorSchema.parse({
        code: 'admin_forbidden',
        message: error.message,
      }),
    };
  }

  return {
    status: 503,
    body: adminErrorSchema.parse({
      code: 'admin_unavailable',
      message: error instanceof Error ? error.message : 'Anti-cheat service is unavailable.',
    }),
  };
}
