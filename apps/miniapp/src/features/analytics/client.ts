import type { AnalyticsEventEnvelope } from '@langue-buster/shared';
import { createFrontendAnalyticsEvent } from '@langue-buster/analytics';

import { apiClient } from '../api/client';

export type ClientErrorReporter = ReturnType<typeof createClientErrorReporter>;

export async function trackAnalyticsEvent(
  token: string | null | undefined,
  event: Omit<AnalyticsEventEnvelope, 'source'>,
) {
  if (!token) {
    return;
  }

  try {
    const enrichedEvent = createFrontendAnalyticsEvent(event) as AnalyticsEventEnvelope;
    await apiClient.ingestAnalyticsEvents(token, [
      enrichedEvent,
    ]);
  } catch {
    // Analytics must never break the main flow.
  }
}

export function createClientErrorReporter() {
  return {
    captureError(error: unknown, context: Record<string, unknown> = {}) {
      console.error('[miniapp-error]', {
        message: error instanceof Error ? error.message : 'Unknown error.',
        name: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined,
        ...context,
      });
    },
    captureMessage(message: string, context: Record<string, unknown> = {}) {
      console.warn('[miniapp-message]', {
        message,
        ...context,
      });
    },
  };
}
