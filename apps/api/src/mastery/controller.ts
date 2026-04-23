import type {
  ReviewAnswerRequest,
  ReviewAnswerResponse,
  ReviewError,
  ReviewQueueQuery,
  ReviewQueueResponse,
} from '@langue-buster/shared';
import {
  reviewAnswerRequestSchema,
  reviewAnswerResponseSchema,
  reviewQueueQuerySchema,
  reviewQueueResponseSchema,
} from '@langue-buster/shared';

import type { SessionVerifier } from '../auth/session-verifier.js';
import { getBearerToken } from '../auth/session-verifier.js';
import { normalizeAuthError } from '../auth/service.js';
import { MasteryDomainError } from './errors.js';
import type { MasteryService } from './service.js';

export type MasteryHttpResult = {
  status: number;
  body: ReviewQueueResponse | ReviewAnswerResponse | ReviewError;
};

export type MasteryController = ReturnType<typeof createMasteryController>;

export function createMasteryController(masteryService: MasteryService, sessionVerifier: SessionVerifier) {
  return {
    async handleGetQueue(query: unknown, authorizationHeader: string | undefined): Promise<MasteryHttpResult> {
      try {
        const session = await verifySession(authorizationHeader, sessionVerifier);
        const payload: ReviewQueueQuery = reviewQueueQuerySchema.parse(query);
        const items = await masteryService.getReviewQueue({
          userId: session.user.id,
          limit: payload.limit,
          levelId: payload.levelId,
          direction: payload.direction,
        });

        return {
          status: 200,
          body: reviewQueueResponseSchema.parse({
            items,
          }),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },

    async handleAnswer(body: unknown, authorizationHeader: string | undefined): Promise<MasteryHttpResult> {
      try {
        const session = await verifySession(authorizationHeader, sessionVerifier);
        const payload: ReviewAnswerRequest = reviewAnswerRequestSchema.parse(body);
        const response = await masteryService.submitReviewAnswer({
          userId: session.user.id,
          sourceItemId: payload.sourceItemId,
          questionId: payload.questionId,
          selectedOptionId: payload.selectedOptionId,
          answeredAt: payload.answeredAt,
          direction: payload.direction,
        });

        return {
          status: 200,
          body: reviewAnswerResponseSchema.parse(response),
        };
      } catch (error) {
        return toErrorResult(error);
      }
    },
  };
}

export function createUnavailableMasteryController(message: string) {
  const body: ReviewError = {
    code: 'review_unavailable',
    message,
  };

  return {
    handleGetQueue(): Promise<MasteryHttpResult> {
      return Promise.resolve({
        status: 503,
        body,
      });
    },
    handleAnswer(): Promise<MasteryHttpResult> {
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

function toErrorResult(error: unknown): MasteryHttpResult {
  if (error instanceof MasteryDomainError) {
    return {
      status: mapMasteryErrorStatus(error),
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
      code: 'review_unavailable',
      message: normalizedAuthError.message,
    },
  };
}

function mapMasteryErrorStatus(error: MasteryDomainError): number {
  switch (error.code) {
    case 'review_item_not_found':
      return 404;
    case 'review_question_mismatch':
    case 'review_invalid_answer':
      return 409;
    case 'review_unavailable':
      return 500;
    default:
      return 400;
  }
}
