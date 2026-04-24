import type {
  AdminError,
  SoftLaunchContentIssueReport,
  SoftLaunchLaunchReport,
  SoftLaunchRetentionReport,
  SoftLaunchStatus,
  SoftLaunchTuningBacklogReport,
} from '@langue-buster/shared';
import {
  adminErrorSchema,
  authErrorSchema,
  softLaunchContentIssueReportSchema,
  softLaunchLaunchReportSchema,
  softLaunchRetentionReportSchema,
  softLaunchStatusSchema,
  softLaunchTuningBacklogReportSchema,
} from '@langue-buster/shared';

import { AuthDomainError } from '../auth/errors.js';
import { mapSessionErrorStatus } from '../auth/session-verifier.js';
import { ContentAdminDomainError } from '../content-admin/errors.js';
import type { SoftLaunchService } from './service.js';

export type SoftLaunchHttpResult = {
  status: number;
  body:
    | AdminError
    | SoftLaunchStatus
    | SoftLaunchLaunchReport
    | SoftLaunchRetentionReport
    | SoftLaunchContentIssueReport
    | SoftLaunchTuningBacklogReport;
};

export type SoftLaunchController = ReturnType<typeof createSoftLaunchController>;

export function createSoftLaunchController(input: {
  service: SoftLaunchService;
  verifyAdmin(authorizationHeader: string | undefined): Promise<import('@langue-buster/shared').SessionVerificationResponse>;
}) {
  return {
    async handleStatus(authorizationHeader: string | undefined): Promise<SoftLaunchHttpResult> {
      try {
        await input.verifyAdmin(authorizationHeader);
        return {
          status: 200,
          body: softLaunchStatusSchema.parse(await input.service.getStatus()),
        };
      } catch (error) {
        return toAdminError(error);
      }
    },

    async handleUpdate(body: unknown, authorizationHeader: string | undefined): Promise<SoftLaunchHttpResult> {
      try {
        const actor = await input.verifyAdmin(authorizationHeader);
        return {
          status: 200,
          body: softLaunchStatusSchema.parse(await input.service.updateSettings(actor, body)),
        };
      } catch (error) {
        return toAdminError(error);
      }
    },

    async handleLaunchReport(query: Record<string, string>, authorizationHeader: string | undefined): Promise<SoftLaunchHttpResult> {
      return handleReport(input, authorizationHeader, () => input.service.getLaunchReport(query), softLaunchLaunchReportSchema);
    },

    async handleRetentionReport(query: Record<string, string>, authorizationHeader: string | undefined): Promise<SoftLaunchHttpResult> {
      return handleReport(input, authorizationHeader, () => input.service.getRetentionReport(query), softLaunchRetentionReportSchema);
    },

    async handleContentReport(query: Record<string, string>, authorizationHeader: string | undefined): Promise<SoftLaunchHttpResult> {
      return handleReport(input, authorizationHeader, () => input.service.getContentIssueReport(query), softLaunchContentIssueReportSchema);
    },

    async handleTuningReport(query: Record<string, string>, authorizationHeader: string | undefined): Promise<SoftLaunchHttpResult> {
      return handleReport(input, authorizationHeader, () => input.service.getTuningBacklogReport(query), softLaunchTuningBacklogReportSchema);
    },
  };
}

export function createUnavailableSoftLaunchController(message: string): SoftLaunchController {
  const body = adminErrorSchema.parse({
    code: 'admin_unavailable',
    message,
  });

  return {
    handleStatus: () => Promise.resolve({ status: 503, body }),
    handleUpdate: () => Promise.resolve({ status: 503, body }),
    handleLaunchReport: () => Promise.resolve({ status: 503, body }),
    handleRetentionReport: () => Promise.resolve({ status: 503, body }),
    handleContentReport: () => Promise.resolve({ status: 503, body }),
    handleTuningReport: () => Promise.resolve({ status: 503, body }),
  };
}

async function handleReport<T>(
  input: {
    verifyAdmin(authorizationHeader: string | undefined): Promise<unknown>;
  },
  authorizationHeader: string | undefined,
  handler: () => Promise<T>,
  schema: { parse(input: unknown): T },
): Promise<SoftLaunchHttpResult> {
  try {
    await input.verifyAdmin(authorizationHeader);
    return {
      status: 200,
      body: schema.parse(await handler()) as SoftLaunchHttpResult['body'],
    };
  } catch (error) {
    return toAdminError(error);
  }
}

function toAdminError(error: unknown): SoftLaunchHttpResult {
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
      status: mapSessionErrorStatus(authErrorSchema.parse({
        code: error.code,
        message: error.message,
      })),
      body: adminErrorSchema.parse({
        code: error.code === 'soft_launch_unavailable' ? 'soft_launch_unavailable' : 'admin_forbidden',
        message: error.message,
      }),
    };
  }

  return {
    status: 503,
    body: adminErrorSchema.parse({
      code: 'admin_unavailable',
      message: error instanceof Error ? error.message : 'Soft-launch service is unavailable.',
    }),
  };
}
