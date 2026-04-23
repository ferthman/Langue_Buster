import type {
  RunAnswerRequest,
  RunError,
  RunFinishResponse,
  RunMoveRequest,
  RunResultResponse,
  RunStateResponse,
} from '@langue-buster/shared';
import {
  runAnswerRequestSchema,
  runAnswerResponseSchema,
  runFinishResponseSchema,
  runMoveRequestSchema,
  runMoveResponseSchema,
  runResultResponseSchema,
  runStartRequestSchema,
  runStartResponseSchema,
  runStateResponseSchema,
} from '@langue-buster/shared';

import type { SessionVerifier } from '../auth/session-verifier.js';
import { getBearerToken } from '../auth/session-verifier.js';
import { normalizeAuthError } from '../auth/service.js';
import { RunDomainError } from './errors.js';
import type { RunService } from './service.js';

export type RunHttpResult = {
  status: number;
  body:
    | ReturnType<typeof runStartResponseSchema.parse>
    | ReturnType<typeof runAnswerResponseSchema.parse>
    | ReturnType<typeof runMoveResponseSchema.parse>
    | RunFinishResponse
    | RunStateResponse
    | RunResultResponse
    | RunError;
};

export type RunController = ReturnType<typeof createRunController>;

export function createRunController(runService: RunService, sessionVerifier: SessionVerifier) {
  return {
    async handleStart(body: unknown, authorizationHeader: string | undefined): Promise<RunHttpResult> {
      try {
        const session = await verifySession(authorizationHeader, sessionVerifier);
        const payload = runStartRequestSchema.parse(body);
        const run = await runService.startRun({
          userId: session.user.id,
          levelId: payload.levelId,
          direction: payload.direction,
        });

        return {
          status: 200,
          body: runStartResponseSchema.parse({
            run,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleAnswer(
      runId: string,
      body: unknown,
      authorizationHeader: string | undefined,
    ): Promise<RunHttpResult> {
      try {
        const session = await verifySession(authorizationHeader, sessionVerifier);
        const payload: RunAnswerRequest = runAnswerRequestSchema.parse(body);
        const response = await runService.submitAnswer({
          runId,
          userId: session.user.id,
          selectedOptionId: payload.selectedOptionId,
          answeredAt: payload.answeredAt,
        });

        return {
          status: 200,
          body: runAnswerResponseSchema.parse(response),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleMove(
      runId: string,
      body: unknown,
      authorizationHeader: string | undefined,
    ): Promise<RunHttpResult> {
      try {
        const session = await verifySession(authorizationHeader, sessionVerifier);
        const payload: RunMoveRequest = runMoveRequestSchema.parse(body);
        const response = await runService.submitMove({
          runId,
          userId: session.user.id,
          trayIndex: payload.trayIndex,
          origin: payload.origin,
        });

        return {
          status: 200,
          body: runMoveResponseSchema.parse(response),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleFinish(runId: string, authorizationHeader: string | undefined): Promise<RunHttpResult> {
      try {
        const session = await verifySession(authorizationHeader, sessionVerifier);
        const response = await runService.finishRun({
          runId,
          userId: session.user.id,
        });

        return {
          status: 200,
          body: runFinishResponseSchema.parse(response),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleGetRun(runId: string, authorizationHeader: string | undefined): Promise<RunHttpResult> {
      try {
        const session = await verifySession(authorizationHeader, sessionVerifier);
        const run = await runService.getRunForUser(runId, session.user.id);

        return {
          status: 200,
          body: runStateResponseSchema.parse({
            run,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleGetResult(runId: string, authorizationHeader: string | undefined): Promise<RunHttpResult> {
      try {
        const session = await verifySession(authorizationHeader, sessionVerifier);
        const result = await runService.getResultForUser(runId, session.user.id);

        return {
          status: 200,
          body: runResultResponseSchema.parse({
            result,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },
  };
}

export function createUnavailableRunController(message: string) {
  const body: RunError = {
    code: 'run_unavailable',
    message,
  };

  return {
    handleStart(): Promise<RunHttpResult> {
      return Promise.resolve({
        status: 503,
        body,
      });
    },
    handleAnswer(): Promise<RunHttpResult> {
      return Promise.resolve({
        status: 503,
        body,
      });
    },
    handleMove(): Promise<RunHttpResult> {
      return Promise.resolve({
        status: 503,
        body,
      });
    },
    handleFinish(): Promise<RunHttpResult> {
      return Promise.resolve({
        status: 503,
        body,
      });
    },
    handleGetRun(): Promise<RunHttpResult> {
      return Promise.resolve({
        status: 503,
        body,
      });
    },
    handleGetResult(): Promise<RunHttpResult> {
      return Promise.resolve({
        status: 503,
        body,
      });
    },
  };
}

async function verifySession(authorizationHeader: string | undefined, sessionVerifier: SessionVerifier) {
  const token = getBearerToken(authorizationHeader);
  return sessionVerifier.verifySessionToken(token);
}

function toErrorResult(error: unknown): RunHttpResult {
  if (error instanceof RunDomainError) {
    return {
      status: mapRunErrorStatus(error),
      body: {
        code: error.code,
        message: error.message,
      },
    };
  }

  const normalizedAuthError = normalizeAuthError(error);
  return {
    status: normalizedAuthError.code === 'invalid_session' || normalizedAuthError.code === 'missing_session'
      ? 401
      : 400,
    body: {
      code: 'run_unavailable',
      message: normalizedAuthError.message,
    },
  };
}

function mapRunErrorStatus(error: RunDomainError): number {
  switch (error.code) {
    case 'run_not_found':
      return 404;
    case 'run_forbidden':
      return 403;
    case 'run_invalid_state':
    case 'run_invalid_move':
    case 'run_invalid_answer':
      return 409;
    case 'run_result_unavailable':
      return 404;
    case 'run_integrity_error':
    case 'run_unavailable':
      return 500;
    default:
      return 400;
  }
}
