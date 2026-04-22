import type { ApiRuntimeEnvironment } from '@langue-buster/config';
import { apiRuntimeEnvironmentSchema } from '@langue-buster/config';

import { AuthDomainError } from './errors.js';

export function parseApiRuntimeEnvironment(source: Record<string, string | undefined>): ApiRuntimeEnvironment {
  const parsed = apiRuntimeEnvironmentSchema.safeParse(source);

  if (!parsed.success) {
    throw new AuthDomainError(
      'invalid_init_data',
      'API runtime environment is invalid or incomplete for auth startup.',
    );
  }

  return parsed.data;
}

