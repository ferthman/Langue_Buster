import type {
  AnalyticsError,
  AnalyticsIngestResponse,
  AnalyticsContentResponse,
  AnalyticsFunnelsResponse,
  AnalyticsOverviewResponse,
  AnalyticsRetentionResponse,
} from '@langue-buster/shared';
import { analyticsErrorSchema } from '@langue-buster/shared';
import { AuthDomainError } from '../auth/errors.js';
import { getBearerToken, mapSessionErrorStatus } from '../auth/session-verifier.js';
import { ContentAdminDomainError } from '../content-admin/errors.js';

import type { AnalyticsService } from './service.js';

export type AnalyticsHttpResult = {
  status: number;
  body:
    | AnalyticsError
    | AnalyticsIngestResponse
    | AnalyticsOverviewResponse
    | AnalyticsFunnelsResponse
    | AnalyticsContentResponse
    | AnalyticsRetentionResponse;
};

export type AnalyticsController = ReturnType<typeof createAnalyticsController>;

export function createAnalyticsController(service: AnalyticsService) {
  return {
    async handleIngest(body: unknown, authorizationHeader: string | undefined): Promise<AnalyticsHttpResult> {
      try {
        getBearerToken(authorizationHeader);
        const response = await service.ingestClientEvents(authorizationHeader, body);
        return {
          status: 202,
          body: response,
        };
      } catch (error) {
        return toAnalyticsError(error);
      }
    },

    async handleOverview(authorizationHeader: string | undefined): Promise<AnalyticsHttpResult> {
      return handleAdminRequest(service, authorizationHeader, () => service.getOverview());
    },

    async handleFunnels(authorizationHeader: string | undefined): Promise<AnalyticsHttpResult> {
      return handleAdminRequest(service, authorizationHeader, () => service.getFunnels());
    },

    async handleContent(authorizationHeader: string | undefined): Promise<AnalyticsHttpResult> {
      return handleAdminRequest(service, authorizationHeader, () => service.getContent());
    },

    async handleRetention(authorizationHeader: string | undefined): Promise<AnalyticsHttpResult> {
      return handleAdminRequest(service, authorizationHeader, () => service.getRetention());
    },
  };
}

async function handleAdminRequest(
  service: AnalyticsService,
  authorizationHeader: string | undefined,
  handler: () => Promise<AnalyticsOverviewResponse | AnalyticsFunnelsResponse | AnalyticsContentResponse | AnalyticsRetentionResponse>,
): Promise<AnalyticsHttpResult> {
  try {
    await service.verifyAdmin(authorizationHeader);
    return {
      status: 200,
      body: await handler(),
    };
  } catch (error) {
    return toAnalyticsError(error);
  }
}

function toAnalyticsError(error: unknown): AnalyticsHttpResult {
  if (error instanceof ContentAdminDomainError) {
    return {
      status: error.code === 'admin_forbidden' ? 403 : 400,
      body: analyticsErrorSchema.parse({
        code: 'analytics_forbidden',
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
      body: analyticsErrorSchema.parse({
        code: 'analytics_forbidden',
        message: error.message,
      }),
    };
  }

  if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ZodError') {
    return {
      status: 400,
      body: analyticsErrorSchema.parse({
        code: 'analytics_invalid_event',
        message: 'Analytics payload validation failed.',
      }),
    };
  }

  return {
    status: 503,
    body: analyticsErrorSchema.parse({
      code: 'analytics_unavailable',
      message: error instanceof Error ? error.message : 'Analytics service is unavailable.',
    }),
  };
}

export function createUnavailableAnalyticsController(message: string) {
  const body = analyticsErrorSchema.parse({
    code: 'analytics_unavailable',
    message,
  });

  return {
    handleIngest(): Promise<AnalyticsHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleOverview(): Promise<AnalyticsHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleFunnels(): Promise<AnalyticsHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleContent(): Promise<AnalyticsHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
    handleRetention(): Promise<AnalyticsHttpResult> {
      return Promise.resolve({ status: 503, body });
    },
  };
}
