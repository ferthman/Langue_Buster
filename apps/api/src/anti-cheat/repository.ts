import type {
  AntiCheatAnomaly,
  AntiCheatAnomalyListQuery,
} from '@langue-buster/shared';
import {
  antiCheatAnomalyListQuerySchema,
  antiCheatAnomalySchema,
} from '@langue-buster/shared';

import type { DatabaseClient } from '../db/client.js';
import { queryOne, queryRows } from '../db/client.js';

export type AntiCheatAnomalyRepository = {
  save(anomaly: AntiCheatAnomaly): Promise<AntiCheatAnomaly>;
  list(query: AntiCheatAnomalyListQuery): Promise<readonly AntiCheatAnomaly[]>;
};

type AntiCheatAnomalyRow = {
  id: string;
  user_id: string | null;
  run_id: string | null;
  source_item_id: string | null;
  anomaly_type: string;
  severity: string;
  metadata_json: string;
  occurred_at: string;
};

export class PostgresAntiCheatAnomalyRepository implements AntiCheatAnomalyRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;

  constructor(client: Pick<DatabaseClient, 'query'>) {
    this.#client = client;
  }

  async save(anomaly: AntiCheatAnomaly): Promise<AntiCheatAnomaly> {
    const parsed = antiCheatAnomalySchema.parse(anomaly);
    const row = await queryOne<AntiCheatAnomalyRow>(
      this.#client,
      `
        INSERT INTO anti_cheat_anomalies (
          id, user_id, run_id, source_item_id, anomaly_type, severity, metadata_json, occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        parsed.id,
        parsed.userId ?? null,
        parsed.runId ?? null,
        parsed.sourceItemId ?? null,
        parsed.type,
        parsed.severity,
        JSON.stringify(parsed.metadata),
        parsed.occurredAt,
      ],
    );

    if (!row) {
      throw new Error('Expected anti-cheat anomaly insert to return a row.');
    }

    return mapAntiCheatAnomalyRow(row);
  }

  async list(input: AntiCheatAnomalyListQuery): Promise<readonly AntiCheatAnomaly[]> {
    const query = antiCheatAnomalyListQuerySchema.parse(input);
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.userId) {
      values.push(query.userId);
      where.push(`user_id = $${values.length}`);
    }
    if (query.runId) {
      values.push(query.runId);
      where.push(`run_id = $${values.length}`);
    }
    if (query.type) {
      values.push(query.type);
      where.push(`anomaly_type = $${values.length}`);
    }
    if (query.severity) {
      values.push(query.severity);
      where.push(`severity = $${values.length}`);
    }

    values.push(query.limit);
    const rows = await queryRows<AntiCheatAnomalyRow>(
      this.#client,
      `
        SELECT * FROM anti_cheat_anomalies
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY occurred_at DESC, id DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return rows.map(mapAntiCheatAnomalyRow);
  }
}

function mapAntiCheatAnomalyRow(row: AntiCheatAnomalyRow): AntiCheatAnomaly {
  return antiCheatAnomalySchema.parse({
    id: row.id,
    userId: row.user_id ?? undefined,
    runId: row.run_id ?? undefined,
    sourceItemId: row.source_item_id ?? undefined,
    type: row.anomaly_type,
    severity: row.severity,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    occurredAt: row.occurred_at,
  });
}
