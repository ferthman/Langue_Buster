import {
  authResponseSchema,
  runAnswerRequestSchema,
  runAnswerResponseSchema,
  runFinishResponseSchema,
  runMoveRequestSchema,
  runMoveResponseSchema,
  runResultResponseSchema,
  runStartRequestSchema,
  runStartResponseSchema,
  runStateResponseSchema,
  sessionPayloadSchema,
  sessionVerificationResponseSchema,
  telegramAuthRequestSchema,
  validatedTelegramAuthSchema,
} from '@langue-buster/shared';

import { createAuthModule, createAuthModuleFromEnvironment } from './auth/index.js';
import { createApiRequestHandler, createApiServer, startApiServer } from './server.js';

export const authApiSurface = {
  route: 'POST /auth/telegram',
  request: telegramAuthRequestSchema,
  response: authResponseSchema,
  validatedTelegramAuth: validatedTelegramAuthSchema,
  session: sessionPayloadSchema,
  sessionLookupRoute: 'GET /auth/session',
  sessionLookupResponse: sessionVerificationResponseSchema,
} as const;

export const runApiSurface = {
  startRoute: 'POST /runs/start',
  startRequest: runStartRequestSchema,
  startResponse: runStartResponseSchema,
  answerRoute: 'POST /runs/:runId/answer',
  answerRequest: runAnswerRequestSchema,
  answerResponse: runAnswerResponseSchema,
  moveRoute: 'POST /runs/:runId/move',
  moveRequest: runMoveRequestSchema,
  moveResponse: runMoveResponseSchema,
  finishRoute: 'POST /runs/:runId/finish',
  finishResponse: runFinishResponseSchema,
  stateRoute: 'GET /runs/:runId',
  stateResponse: runStateResponseSchema,
  resultRoute: 'GET /runs/:runId/result',
  resultResponse: runResultResponseSchema,
} as const;

export { createAuthModule };
export { createAuthModuleFromEnvironment, createApiRequestHandler, createApiServer, startApiServer };
export * from './runs/index.js';
