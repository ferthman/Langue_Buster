import { randomUUID } from 'node:crypto';

import type {
  SoftLaunchSettings,
  SoftLaunchSettingsSnapshot,
} from '@langue-buster/shared';
import {
  softLaunchSettingsSchema,
  softLaunchSettingsSnapshotSchema,
} from '@langue-buster/shared';

import type { DatabaseClient } from '../db/client.js';
import { queryOne, withTransaction } from '../db/client.js';

type SoftLaunchSettingsRow = {
  id: string;
  settings_json: string;
  note: string | null;
  is_active: boolean;
  created_at: string;
  created_by_user_id: string | null;
  created_by_telegram_user_id: string | null;
};

export type SoftLaunchSettingsRepository = {
  findActive(): Promise<SoftLaunchSettingsSnapshot | null>;
  activateSnapshot(input: {
    settings: SoftLaunchSettings;
    note?: string;
    createdAt: string;
    createdByUserId?: string;
    createdByTelegramUserId?: string;
  }): Promise<SoftLaunchSettingsSnapshot>;
};

export class PostgresSoftLaunchSettingsRepository implements SoftLaunchSettingsRepository {
  readonly #client: Pick<DatabaseClient, 'query' | 'connect'>;

  constructor(client: Pick<DatabaseClient, 'query' | 'connect'>) {
    this.#client = client;
  }

  async findActive(): Promise<SoftLaunchSettingsSnapshot | null> {
    const row = await queryOne<SoftLaunchSettingsRow>(
      this.#client,
      `
        SELECT * FROM soft_launch_settings_snapshots
        WHERE is_active = TRUE
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
    );

    return row ? mapSettingsSnapshotRow(row) : null;
  }

  async activateSnapshot(input: {
    settings: SoftLaunchSettings;
    note?: string;
    createdAt: string;
    createdByUserId?: string;
    createdByTelegramUserId?: string;
  }): Promise<SoftLaunchSettingsSnapshot> {
    const settings = softLaunchSettingsSchema.parse(input.settings);
    const id = `soft_${randomUUID()}`;

    return withTransaction(this.#client, async (transaction) => {
      await transaction.query(
        `
          UPDATE soft_launch_settings_snapshots
          SET is_active = FALSE
          WHERE is_active = TRUE
        `,
      );

      const result = await transaction.query<SoftLaunchSettingsRow>(
        `
          INSERT INTO soft_launch_settings_snapshots (
            id,
            settings_json,
            note,
            is_active,
            created_at,
            created_by_user_id,
            created_by_telegram_user_id
          )
          VALUES ($1, $2, $3, TRUE, $4, $5, $6)
          RETURNING *
        `,
        [
          id,
          JSON.stringify(settings),
          input.note ?? null,
          input.createdAt,
          input.createdByUserId ?? null,
          input.createdByTelegramUserId ?? null,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error('Expected soft-launch settings insert to return a row.');
      }

      return mapSettingsSnapshotRow(row);
    });
  }
}

function mapSettingsSnapshotRow(row: SoftLaunchSettingsRow): SoftLaunchSettingsSnapshot {
  return softLaunchSettingsSnapshotSchema.parse({
    id: row.id,
    settings: JSON.parse(row.settings_json) as SoftLaunchSettings,
    note: row.note ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdByTelegramUserId: row.created_by_telegram_user_id ?? undefined,
  });
}
