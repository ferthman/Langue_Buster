import type {
  SessionVerificationResponse,
  AuthError,
} from '@langue-buster/shared';
import { sessionVerificationResponseSchema } from '@langue-buster/shared';

import type { SessionRepository, UserRepository } from './repositories.js';
import { AuthDomainError } from './errors.js';

type SessionVerifierDependencies = {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  now?: () => Date;
};

export type SessionVerifier = ReturnType<typeof createSessionVerifier>;

export function createSessionVerifier(dependencies: SessionVerifierDependencies) {
  const now = dependencies.now ?? (() => new Date());

  return {
    async verifySessionToken(token: string): Promise<SessionVerificationResponse> {
      if (token.trim().length === 0) {
        throw new AuthDomainError('missing_session', 'Authorization token is required.');
      }

      const session = await dependencies.sessionRepository.findByToken(token);
      if (!session) {
        throw new AuthDomainError('invalid_session', 'Session token is not recognized.');
      }

      if (new Date(session.expiresAt).getTime() <= now().getTime()) {
        throw new AuthDomainError('invalid_session', 'Session token has expired.');
      }

      const user = await dependencies.userRepository.findById(session.userId);
      if (!user) {
        throw new AuthDomainError('invalid_session', 'Session user could not be resolved.');
      }

      return sessionVerificationResponseSchema.parse({
        user,
        session,
      });
    },
  };
}

export function getBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    throw new AuthDomainError('missing_session', 'Authorization header is required.');
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AuthDomainError('invalid_session', 'Authorization header must use Bearer token format.');
  }

  return token;
}

export function mapSessionErrorStatus(error: AuthError): number {
  return error.code === 'missing_session' || error.code === 'invalid_session' ? 401 : 400;
}
