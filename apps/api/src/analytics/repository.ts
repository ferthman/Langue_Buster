import type {
  AnalyticsEventEnvelope,
  AnalyticsEventName,
} from '@langue-buster/shared';
import { analyticsEventEnvelopeSchema } from '@langue-buster/shared';
import { randomUUID } from 'node:crypto';

import type { DatabaseClient } from '../db/client.js';
import { queryRows } from '../db/client.js';

type AnalyticsEventRow = {
  id: string;
  event_name: AnalyticsEventName;
  user_id: string | null;
  session_id: string | null;
  run_id: string | null;
  level_id: string | null;
  source_item_id: string | null;
  topic_id: string | null;
  lesson_id: string | null;
  occurred_at: string;
  payload_json: string;
};

export type StoredAnalyticsEvent = AnalyticsEventEnvelope & { id: string };

export class PostgresAnalyticsEventRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;

  constructor(client: Pick<DatabaseClient, 'query'>) {
    this.#client = client;
  }

  async save(event: AnalyticsEventEnvelope): Promise<StoredAnalyticsEvent> {
    const parsed = analyticsEventEnvelopeSchema.parse(event);
    const id = `evt_${randomUUID()}`;
    const rows = await queryRows<AnalyticsEventRow>(
      this.#client,
      `
        INSERT INTO analytics_events (
          id, event_name, user_id, session_id, run_id, level_id, source_item_id, topic_id, lesson_id, occurred_at, payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        id,
        parsed.eventName,
        parsed.userId ?? null,
        parsed.sessionId ?? null,
        parsed.runId ?? null,
        parsed.levelId ?? null,
        parsed.sourceItemId ?? null,
        parsed.topicId ?? null,
        parsed.lessonId ?? null,
        parsed.occurredAt,
        JSON.stringify(parsed),
      ],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Expected analytics event insert to return a row.');
    }

    return mapAnalyticsEventRow(row);
  }

  async saveMany(events: readonly AnalyticsEventEnvelope[]): Promise<readonly StoredAnalyticsEvent[]> {
    const stored: StoredAnalyticsEvent[] = [];
    for (const event of events) {
      stored.push(await this.save(event));
    }
    return stored;
  }

  async listAll(): Promise<readonly StoredAnalyticsEvent[]> {
    const rows = await queryRows<AnalyticsEventRow>(
      this.#client,
      'SELECT * FROM analytics_events ORDER BY occurred_at ASC, id ASC',
    );
    return rows.map(mapAnalyticsEventRow);
  }
}

function mapAnalyticsEventRow(row: AnalyticsEventRow): StoredAnalyticsEvent {
  const parsed = JSON.parse(row.payload_json) as AnalyticsEventEnvelope;
  return {
    id: row.id,
    ...analyticsEventEnvelopeSchema.parse({
      ...parsed,
      eventName: row.event_name,
      userId: row.user_id ?? parsed.userId,
      sessionId: row.session_id ?? parsed.sessionId,
      runId: row.run_id ?? parsed.runId,
      levelId: row.level_id ?? parsed.levelId,
      sourceItemId: row.source_item_id ?? parsed.sourceItemId,
      topicId: row.topic_id ?? parsed.topicId,
      lessonId: row.lesson_id ?? parsed.lessonId,
      occurredAt: row.occurred_at,
    }),
  };
}
