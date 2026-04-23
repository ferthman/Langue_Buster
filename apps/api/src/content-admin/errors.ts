import type { AdminErrorCode } from '@langue-buster/shared';

export class ContentAdminDomainError extends Error {
  readonly code: AdminErrorCode;

  constructor(code: AdminErrorCode, message: string) {
    super(message);
    this.name = 'ContentAdminDomainError';
    this.code = code;
  }
}
