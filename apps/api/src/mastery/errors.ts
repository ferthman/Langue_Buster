import type { ReviewErrorCode } from '@langue-buster/shared';

export class MasteryDomainError extends Error {
  readonly code: ReviewErrorCode;

  constructor(code: ReviewErrorCode, message: string) {
    super(message);
    this.name = 'MasteryDomainError';
    this.code = code;
  }
}
