import type { StructuredLogEntry, StructuredLogLevel } from '@langue-buster/shared';
import { structuredLogEntrySchema } from '@langue-buster/shared';

export type LoggerContext = {
  domain: string;
  code?: string;
  requestId?: string;
  userId?: string;
  runId?: string;
  extra?: Record<string, unknown>;
};

export type StructuredLogger = ReturnType<typeof createStructuredLogger>;

export function createStructuredLogger(options: {
  now?: () => Date;
  sink?: (entry: StructuredLogEntry) => void;
} = {}) {
  const now = options.now ?? (() => new Date());
  const sink = options.sink ?? ((entry: StructuredLogEntry) => {
    const serialized = JSON.stringify(entry);
    if (entry.level === 'error' || entry.level === 'warn') {
      console.error(serialized);
      return;
    }

    console.log(serialized);
  });

  function write(level: StructuredLogLevel, message: string, context: LoggerContext) {
    sink(structuredLogEntrySchema.parse({
      level,
      message,
      timestamp: now().toISOString(),
      domain: context.domain,
      code: context.code,
      requestId: context.requestId,
      userId: context.userId,
      runId: context.runId,
      extra: context.extra,
    }));
  }

  return {
    debug(message: string, context: LoggerContext) {
      write('debug', message, context);
    },
    info(message: string, context: LoggerContext) {
      write('info', message, context);
    },
    warn(message: string, context: LoggerContext) {
      write('warn', message, context);
    },
    error(message: string, context: LoggerContext) {
      write('error', message, context);
    },
  };
}
