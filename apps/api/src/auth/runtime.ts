import type { ApiRuntimeEnvironment } from '@langue-buster/config';
import { apiRuntimeEnvironmentSchema } from '@langue-buster/config';

import { AuthDomainError } from './errors.js';

export function parseApiRuntimeEnvironment(source: Record<string, string | undefined>): ApiRuntimeEnvironment {
  const parsed = apiRuntimeEnvironmentSchema.safeParse(source);

  if (!parsed.success) {
    const missingKeys = parsed.error.issues
      .filter((issue) => issue.code === 'invalid_type' && issue.received === 'undefined')
      .map((issue) => issue.path.join('.'))
      .filter((key) => key.length > 0);
    const issueSummary = missingKeys.length > 0
      ? ` Missing required environment variable(s): ${missingKeys.join(', ')}.`
      : ` ${parsed.error.issues.map((issue) => issue.message).join(' ')}`;

    throw new AuthDomainError(
      'invalid_init_data',
      `API runtime environment is invalid or incomplete for auth startup.${issueSummary}`,
    );
  }

  return parsed.data;
}
