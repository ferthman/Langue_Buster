import type { StructuredLogger } from './logger.js';

export type ErrorReporter = ReturnType<typeof createErrorReporter>;

export function createErrorReporter(logger: StructuredLogger) {
  return {
    captureError(
      error: unknown,
      context: {
        domain: string;
        code?: string;
        requestId?: string;
        userId?: string;
        runId?: string;
        extra?: Record<string, unknown>;
      },
    ) {
      logger.error(error instanceof Error ? error.message : 'Unknown error.', {
        ...context,
        extra: {
          ...(context.extra ?? {}),
          errorName: error instanceof Error ? error.name : undefined,
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    },
    captureMessage(
      message: string,
      context: {
        domain: string;
        code?: string;
        requestId?: string;
        userId?: string;
        runId?: string;
        extra?: Record<string, unknown>;
      },
    ) {
      logger.warn(message, context);
    },
  };
}
