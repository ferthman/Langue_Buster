import {
  authResponseSchema,
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

export { createAuthModule };
export { createAuthModuleFromEnvironment, createApiRequestHandler, createApiServer, startApiServer };
