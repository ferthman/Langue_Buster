import { afterEach, describe, expect, it } from 'vitest';

import { phase11LaunchBundle } from '@langue-buster/content-core/phase11-launch-pack';

import { migratePhase7Schema } from '../db/migrations.js';
import { createTestPool } from '../test-helpers.js';
import { createContentAdminRepository } from './repositories.js';
import { createContentAdminService } from './service.js';

const pools: Array<ReturnType<typeof createTestPool>> = [];

afterEach(async () => {
  while (pools.length > 0) {
    const pool = pools.pop();
    if (pool) {
      await pool.close();
    }
  }
});

describe('phase 11 CMS import path', () => {
  it('validates and applies the launch bundle through the content-admin service', async () => {
    const pool = createTestPool();
    pools.push(pool);
    await migratePhase7Schema(pool.pool);

    const repository = createContentAdminRepository(pool.pool);
    const service = createContentAdminService({
      repository,
      now: () => new Date('2026-04-23T00:00:00.000Z'),
    });

    const validation = service.validateImport(phase11LaunchBundle);
    expect(validation.success).toBe(true);

    const result = await service.applyImport(phase11LaunchBundle, {
      userId: 'admin-user',
      telegramUserId: '999999',
    });

    expect(result.counts).toEqual({
      levels: 2,
      topics: 12,
      lessons: 20,
      vocabItems: 336,
      distractorSets: 336,
    });

    const a1List = await service.listVocabItems({
      page: 1,
      pageSize: 500,
      levelId: 'A1',
      status: 'approved',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    expect(a1List.total).toBe(168);

    const history = await service.getHistory({ limit: 5 });
    expect(history.entries.some((entry) => entry.actionType === 'import_apply')).toBe(true);
  });
});
