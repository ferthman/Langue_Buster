import type { RunErrorCode } from '@langue-buster/shared';

export class RunDomainError extends Error {
  readonly code: RunErrorCode;

  constructor(code: RunErrorCode, message: string) {
    super(message);
    this.name = 'RunDomainError';
    this.code = code;
  }
}
