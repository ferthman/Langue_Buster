import type { AuthErrorCode } from '@langue-buster/shared';

export class AuthDomainError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthDomainError';
    this.code = code;
  }
}

