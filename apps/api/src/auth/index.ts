import {
  InMemorySessionRepository,
  InMemoryUserRepository,
} from './repositories.js';
import { createAuthController } from './controller.js';
import { createSessionVerifier } from './session-verifier.js';
import { createAuthService } from './service.js';
import { parseApiRuntimeEnvironment } from './runtime.js';

type CreateAuthModuleOptions = {
  botToken: string;
  now?: () => Date;
  sessionTtlSeconds?: number;
  maxAuthAgeSeconds?: number;
};

export function createAuthModule(options: CreateAuthModuleOptions) {
  const userRepository = new InMemoryUserRepository({ now: options.now });
  const sessionRepository = new InMemorySessionRepository();

  const authService = createAuthService({
    botToken: options.botToken,
    userRepository,
    sessionRepository,
    now: options.now,
    sessionTtlSeconds: options.sessionTtlSeconds,
    maxAuthAgeSeconds: options.maxAuthAgeSeconds,
  });
  const sessionVerifier = createSessionVerifier({
    userRepository,
    sessionRepository,
    now: options.now,
  });

  return {
    controller: createAuthController(authService, sessionVerifier),
    service: authService,
    sessionVerifier,
    repositories: {
      userRepository,
      sessionRepository,
    },
  };
}

export * from './controller.js';
export * from './errors.js';
export * from './repositories.js';
export * from './runtime.js';
export * from './service.js';
export * from './session.js';
export * from './session-verifier.js';
export * from './telegram.js';

export function createAuthModuleFromEnvironment(
  source: Record<string, string | undefined>,
  options: Omit<CreateAuthModuleOptions, 'botToken'> = {},
) {
  const runtime = parseApiRuntimeEnvironment(source);

  return createAuthModule({
    ...options,
    botToken: runtime.TELEGRAM_BOT_TOKEN,
  });
}
