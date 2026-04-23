import type {
  AdminAuditLogEntry,
  AdminQaFlag,
  AdminQaFlagRequest,
  AdminQaFlagStatus,
  AdminVocabListQuery,
} from '@langue-buster/shared';
import { adminAuditLogEntrySchema, adminQaFlagSchema } from '@langue-buster/shared';
import type {
  EditorialImportBundle,
  Lesson,
  Topic,
  VocabItem,
} from '@langue-buster/content-core';
import {
  distractorSetSchema,
  lessonSchema,
  levelSchema,
  topicSchema,
  vocabItemSchema,
} from '@langue-buster/content-core';
import { randomUUID } from 'node:crypto';

import type { DatabaseClient } from '../db/client.js';
import { queryOne, queryRows, withTransaction } from '../db/client.js';

type Actor = Readonly<{
  userId: string;
  telegramUserId: string;
}>;

type StoredVocabRow = {
  id: string;
  lemma: string;
  surface_form: string;
  cefr_level: string;
  topic_id: string;
  status: string;
  frequency_score: number;
  payload_json: string;
  created_at: string;
  updated_at: string;
  last_actor_user_id: string;
  last_actor_telegram_user_id: string;
};

type StoredTopicRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  cefr_levels_text: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
  last_actor_user_id: string;
  last_actor_telegram_user_id: string;
};

type StoredLessonRow = {
  id: string;
  title: string;
  cefr_level: string;
  status: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
  last_actor_user_id: string;
  last_actor_telegram_user_id: string;
};

type StoredDistractorSetRow = {
  id: string;
  source_item_id: string | null;
  cefr_level: string;
  status: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
  last_actor_user_id: string;
  last_actor_telegram_user_id: string;
};

type StoredLevelRow = {
  id: string;
  cefr_level: string;
  status: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
  last_actor_user_id: string;
  last_actor_telegram_user_id: string;
};

type StoredQaFlagRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  flag_type: string;
  note: string | null;
  status: string;
  created_at: string;
  created_by_user_id: string;
  created_by_telegram_user_id: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolved_by_telegram_user_id: string | null;
};

type StoredAuditRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  actor_user_id: string;
  actor_telegram_user_id: string;
  summary: string;
  before_json: string | null;
  after_json: string | null;
  meta_json: string | null;
  occurred_at: string;
};

export type ContentAdminRepository = ReturnType<typeof createContentAdminRepository>;

export function createContentAdminRepository(client: DatabaseClient) {
  return {
    async listVocabItems(query: AdminVocabListQuery) {
      const filters: string[] = [];
      const values: unknown[] = [];
      const search = query.search?.trim().toLowerCase();
      if (search) {
        values.push(`%${search}%`);
        filters.push(`(LOWER(lemma) LIKE $${values.length} OR LOWER(surface_form) LIKE $${values.length} OR LOWER(id) LIKE $${values.length})`);
      }
      if (query.levelId) {
        values.push(query.levelId);
        filters.push(`cefr_level = $${values.length}`);
      }
      if (query.topicId) {
        values.push(query.topicId);
        filters.push(`topic_id = $${values.length}`);
      }
      if (query.status) {
        values.push(query.status);
        filters.push(`status = $${values.length}`);
      }

      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
      const sortColumn = query.sortBy === 'lemma'
        ? 'lemma'
        : query.sortBy === 'frequencyScore'
          ? 'frequency_score'
          : query.sortBy === 'status'
            ? 'status'
            : 'updated_at';
      const sortDirection = query.sortDirection === 'asc' ? 'ASC' : 'DESC';
      values.push(query.pageSize);
      values.push((query.page - 1) * query.pageSize);

      const rows = await queryRows<
        StoredVocabRow & {
          open_flag_count: number;
        }
      >(
        client,
        `
          SELECT
            content_vocab_items.*,
            COALESCE(flag_counts.open_flag_count, 0)::INTEGER AS open_flag_count
          FROM content_vocab_items
          LEFT JOIN (
            SELECT entity_id, COUNT(*)::INTEGER AS open_flag_count
            FROM content_qa_flags
            WHERE entity_type = 'vocab_item' AND status = 'active'
            GROUP BY entity_id
          ) AS flag_counts
            ON flag_counts.entity_id = content_vocab_items.id
          ${whereClause}
          ORDER BY ${sortColumn} ${sortDirection}, id ASC
          LIMIT $${values.length - 1}
          OFFSET $${values.length}
        `,
        values,
      );
      const totalRow = await queryOne<{ count: string }>(
        client,
        `SELECT COUNT(*)::TEXT AS count FROM content_vocab_items ${whereClause}`,
        values.slice(0, values.length - 2),
      );

      return {
        items: rows.map((row) => ({
          id: row.id,
          lemma: row.lemma,
          surfaceForm: row.surface_form,
          cefrLevel: row.cefr_level as VocabItem['cefrLevel'],
          topicId: row.topic_id,
          status: row.status as VocabItem['status'],
          frequencyScore: row.frequency_score,
          updatedAt: row.updated_at,
          openQaFlagCount: row.open_flag_count,
        })),
        total: Number(totalRow?.count ?? 0),
      };
    },

    async listTopics() {
      const rows = await queryRows<StoredTopicRow>(
        client,
        'SELECT * FROM content_topics ORDER BY title ASC, id ASC',
      );
      return rows.map(parseStoredTopicRow);
    },

    async listLessons() {
      const rows = await queryRows<StoredLessonRow>(
        client,
        'SELECT * FROM content_lessons ORDER BY title ASC, id ASC',
      );
      return rows.map(parseStoredLessonRow);
    },

    async listLevels() {
      const rows = await queryRows<StoredLevelRow>(
        client,
        'SELECT * FROM content_levels ORDER BY cefr_level ASC, id ASC',
      );
      return rows.map(parseStoredLevelRow);
    },

    async listDistractorSets() {
      const rows = await queryRows<StoredDistractorSetRow>(
        client,
        'SELECT * FROM content_distractor_sets ORDER BY id ASC',
      );
      return rows.map(parseStoredDistractorSetRow);
    },

    async listAuditEntries(input: Readonly<{ entityType?: string; entityId?: string; limit: number }>) {
      const values: unknown[] = [];
      const filters: string[] = [];
      if (input.entityType) {
        values.push(input.entityType);
        filters.push(`entity_type = $${values.length}`);
      }
      if (input.entityId) {
        values.push(input.entityId);
        filters.push(`entity_id = $${values.length}`);
      }
      values.push(input.limit);
      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
      const rows = await queryRows<StoredAuditRow>(
        client,
        `
          SELECT *
          FROM content_audit_log
          ${whereClause}
          ORDER BY occurred_at DESC, id DESC
          LIMIT $${values.length}
        `,
        values,
      );

      return rows.map(parseAuditRow);
    },

    async listQaFlagsForEntity(entityType: string, entityId: string) {
      const rows = await queryRows<StoredQaFlagRow>(
        client,
        `
          SELECT *
          FROM content_qa_flags
          WHERE entity_type = $1 AND entity_id = $2
          ORDER BY created_at DESC, id DESC
        `,
        [entityType, entityId],
      );
      return rows.map(parseQaFlagRow);
    },

    async findQaFlag(flagId: string) {
      const row = await queryOne<StoredQaFlagRow>(
        client,
        `
          SELECT *
          FROM content_qa_flags
          WHERE id = $1
        `,
        [flagId],
      );

      return row ? parseQaFlagRow(row) : null;
    },

    async findVocabItem(id: string) {
      const row = await queryOne<StoredVocabRow>(
        client,
        'SELECT * FROM content_vocab_items WHERE id = $1',
        [id],
      );
      return row ? parseStoredVocabRow(row) : null;
    },

    async findTopic(id: string) {
      const row = await queryOne<StoredTopicRow>(
        client,
        'SELECT * FROM content_topics WHERE id = $1',
        [id],
      );
      return row ? parseStoredTopicRow(row) : null;
    },

    async findLesson(id: string) {
      const row = await queryOne<StoredLessonRow>(
        client,
        'SELECT * FROM content_lessons WHERE id = $1',
        [id],
      );
      return row ? parseStoredLessonRow(row) : null;
    },

    async saveVocabItem(item: VocabItem, actor: Actor) {
      await client.query(
        `
          INSERT INTO content_vocab_items (
            id, lemma, surface_form, cefr_level, topic_id, status, frequency_score, payload_json,
            created_at, updated_at, last_actor_user_id, last_actor_telegram_user_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (id) DO UPDATE SET
            lemma = EXCLUDED.lemma,
            surface_form = EXCLUDED.surface_form,
            cefr_level = EXCLUDED.cefr_level,
            topic_id = EXCLUDED.topic_id,
            status = EXCLUDED.status,
            frequency_score = EXCLUDED.frequency_score,
            payload_json = EXCLUDED.payload_json,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at,
            last_actor_user_id = EXCLUDED.last_actor_user_id,
            last_actor_telegram_user_id = EXCLUDED.last_actor_telegram_user_id
        `,
        [
          item.id,
          item.lemma,
          item.surfaceForm,
          item.cefrLevel,
          item.topicId,
          item.status,
          item.frequencyScore,
          JSON.stringify(item),
          item.editorialMetadata.createdAt ?? item.editorialMetadata.updatedAt ?? new Date().toISOString(),
          item.editorialMetadata.updatedAt ?? item.editorialMetadata.createdAt ?? new Date().toISOString(),
          actor.userId,
          actor.telegramUserId,
        ],
      );
    },

    async saveTopic(topic: Topic, actor: Actor) {
      await client.query(
        `
          INSERT INTO content_topics (
            id, slug, title, status, cefr_levels_text, payload_json, created_at, updated_at,
            last_actor_user_id, last_actor_telegram_user_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (id) DO UPDATE SET
            slug = EXCLUDED.slug,
            title = EXCLUDED.title,
            status = EXCLUDED.status,
            cefr_levels_text = EXCLUDED.cefr_levels_text,
            payload_json = EXCLUDED.payload_json,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at,
            last_actor_user_id = EXCLUDED.last_actor_user_id,
            last_actor_telegram_user_id = EXCLUDED.last_actor_telegram_user_id
        `,
        [
          topic.id,
          topic.slug,
          topic.title,
          topic.status,
          joinLevels(topic.cefrLevels),
          JSON.stringify(topic),
          topic.editorialMetadata.createdAt ?? topic.editorialMetadata.updatedAt ?? new Date().toISOString(),
          topic.editorialMetadata.updatedAt ?? topic.editorialMetadata.createdAt ?? new Date().toISOString(),
          actor.userId,
          actor.telegramUserId,
        ],
      );
    },

    async saveLesson(lesson: Lesson, actor: Actor) {
      await client.query(
        `
          INSERT INTO content_lessons (
            id, title, cefr_level, status, payload_json, created_at, updated_at,
            last_actor_user_id, last_actor_telegram_user_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            cefr_level = EXCLUDED.cefr_level,
            status = EXCLUDED.status,
            payload_json = EXCLUDED.payload_json,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at,
            last_actor_user_id = EXCLUDED.last_actor_user_id,
            last_actor_telegram_user_id = EXCLUDED.last_actor_telegram_user_id
        `,
        [
          lesson.id,
          lesson.title,
          lesson.cefrLevel,
          lesson.status,
          JSON.stringify(lesson),
          lesson.editorialMetadata.createdAt ?? lesson.editorialMetadata.updatedAt ?? new Date().toISOString(),
          lesson.editorialMetadata.updatedAt ?? lesson.editorialMetadata.createdAt ?? new Date().toISOString(),
          actor.userId,
          actor.telegramUserId,
        ],
      );
    },

    async saveQaFlag(input: AdminQaFlagRequest, actor: Actor, nowIso: string) {
      const flag = adminQaFlagSchema.parse({
        id: `qaf_${randomUUID()}`,
        entityType: input.entityType,
        entityId: input.entityId,
        flagType: input.flagType,
        note: input.note,
        status: 'active',
        createdAt: nowIso,
        createdByUserId: actor.userId,
        createdByTelegramUserId: actor.telegramUserId,
      });

      await client.query(
        `
          INSERT INTO content_qa_flags (
            id, entity_type, entity_id, flag_type, note, status, created_at,
            created_by_user_id, created_by_telegram_user_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          flag.id,
          flag.entityType,
          flag.entityId,
          flag.flagType,
          flag.note ?? null,
          flag.status,
          flag.createdAt,
          flag.createdByUserId,
          flag.createdByTelegramUserId,
        ],
      );

      return flag;
    },

    async resolveQaFlag(flagId: string, actor: Actor, nowIso: string) {
      await client.query(
        `
          UPDATE content_qa_flags
          SET status = $2,
              resolved_at = $3,
              resolved_by_user_id = $4,
              resolved_by_telegram_user_id = $5
          WHERE id = $1
        `,
        [flagId, 'resolved', nowIso, actor.userId, actor.telegramUserId],
      );
    },

    async saveAuditEntry(entry: AdminAuditLogEntry) {
      const parsed = adminAuditLogEntrySchema.parse(entry);
      await client.query(
        `
          INSERT INTO content_audit_log (
            id, entity_type, entity_id, action_type, actor_user_id, actor_telegram_user_id,
            summary, before_json, after_json, meta_json, occurred_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `,
        [
          parsed.id,
          parsed.entityType,
          parsed.entityId,
          parsed.actionType,
          parsed.actorUserId,
          parsed.actorTelegramUserId,
          parsed.summary,
          parsed.before ? JSON.stringify(parsed.before) : null,
          parsed.after ? JSON.stringify(parsed.after) : null,
          parsed.meta ? JSON.stringify(parsed.meta) : null,
          parsed.occurredAt,
        ],
      );
    },

    async applyImport(bundle: EditorialImportBundle, actor: Actor, occurredAt: string) {
      return withTransaction(client, async (transaction) => {
        for (const level of bundle.levels) {
          const parsed = levelSchema.parse(level);
          await transaction.query(
            `
              INSERT INTO content_levels (
                id, cefr_level, status, payload_json, created_at, updated_at,
                last_actor_user_id, last_actor_telegram_user_id
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
              ON CONFLICT (id) DO UPDATE SET
                cefr_level = EXCLUDED.cefr_level,
                status = EXCLUDED.status,
                payload_json = EXCLUDED.payload_json,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at,
                last_actor_user_id = EXCLUDED.last_actor_user_id,
                last_actor_telegram_user_id = EXCLUDED.last_actor_telegram_user_id
            `,
            [
              parsed.id,
              parsed.cefrLevel,
              parsed.status,
              JSON.stringify(parsed),
              parsed.editorialMetadata.createdAt ?? parsed.editorialMetadata.updatedAt ?? bundle.exportedAt,
              parsed.editorialMetadata.updatedAt ?? parsed.editorialMetadata.createdAt ?? bundle.exportedAt,
              actor.userId,
              actor.telegramUserId,
            ],
          );
        }

        for (const topic of bundle.topics) {
          const parsed = topicSchema.parse(topic);
          await transaction.query(
            `
              INSERT INTO content_topics (
                id, slug, title, status, cefr_levels_text, payload_json, created_at, updated_at,
                last_actor_user_id, last_actor_telegram_user_id
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
              ON CONFLICT (id) DO UPDATE SET
                slug = EXCLUDED.slug,
                title = EXCLUDED.title,
                status = EXCLUDED.status,
                cefr_levels_text = EXCLUDED.cefr_levels_text,
                payload_json = EXCLUDED.payload_json,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at,
                last_actor_user_id = EXCLUDED.last_actor_user_id,
                last_actor_telegram_user_id = EXCLUDED.last_actor_telegram_user_id
            `,
            [
              parsed.id,
              parsed.slug,
              parsed.title,
              parsed.status,
              joinLevels(parsed.cefrLevels),
              JSON.stringify(parsed),
              parsed.editorialMetadata.createdAt ?? parsed.editorialMetadata.updatedAt ?? bundle.exportedAt,
              parsed.editorialMetadata.updatedAt ?? parsed.editorialMetadata.createdAt ?? bundle.exportedAt,
              actor.userId,
              actor.telegramUserId,
            ],
          );
        }

        for (const lesson of bundle.lessons) {
          const parsed = lessonSchema.parse(lesson);
          await transaction.query(
            `
              INSERT INTO content_lessons (
                id, title, cefr_level, status, payload_json, created_at, updated_at,
                last_actor_user_id, last_actor_telegram_user_id
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
              ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                cefr_level = EXCLUDED.cefr_level,
                status = EXCLUDED.status,
                payload_json = EXCLUDED.payload_json,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at,
                last_actor_user_id = EXCLUDED.last_actor_user_id,
                last_actor_telegram_user_id = EXCLUDED.last_actor_telegram_user_id
            `,
            [
              parsed.id,
              parsed.title,
              parsed.cefrLevel,
              parsed.status,
              JSON.stringify(parsed),
              parsed.editorialMetadata.createdAt ?? parsed.editorialMetadata.updatedAt ?? bundle.exportedAt,
              parsed.editorialMetadata.updatedAt ?? parsed.editorialMetadata.createdAt ?? bundle.exportedAt,
              actor.userId,
              actor.telegramUserId,
            ],
          );
        }

        for (const item of bundle.vocabItems) {
          const parsed = vocabItemSchema.parse(item);
          await transaction.query(
            `
              INSERT INTO content_vocab_items (
                id, lemma, surface_form, cefr_level, topic_id, status, frequency_score, payload_json,
                created_at, updated_at, last_actor_user_id, last_actor_telegram_user_id
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
              ON CONFLICT (id) DO UPDATE SET
                lemma = EXCLUDED.lemma,
                surface_form = EXCLUDED.surface_form,
                cefr_level = EXCLUDED.cefr_level,
                topic_id = EXCLUDED.topic_id,
                status = EXCLUDED.status,
                frequency_score = EXCLUDED.frequency_score,
                payload_json = EXCLUDED.payload_json,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at,
                last_actor_user_id = EXCLUDED.last_actor_user_id,
                last_actor_telegram_user_id = EXCLUDED.last_actor_telegram_user_id
            `,
            [
              parsed.id,
              parsed.lemma,
              parsed.surfaceForm,
              parsed.cefrLevel,
              parsed.topicId,
              parsed.status,
              parsed.frequencyScore,
              JSON.stringify(parsed),
              parsed.editorialMetadata.createdAt ?? parsed.editorialMetadata.updatedAt ?? bundle.exportedAt,
              parsed.editorialMetadata.updatedAt ?? parsed.editorialMetadata.createdAt ?? bundle.exportedAt,
              actor.userId,
              actor.telegramUserId,
            ],
          );
        }

        for (const set of bundle.distractorSets) {
          const parsed = distractorSetSchema.parse(set);
          await transaction.query(
            `
              INSERT INTO content_distractor_sets (
                id, source_item_id, cefr_level, status, payload_json, created_at, updated_at,
                last_actor_user_id, last_actor_telegram_user_id
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
              ON CONFLICT (id) DO UPDATE SET
                source_item_id = EXCLUDED.source_item_id,
                cefr_level = EXCLUDED.cefr_level,
                status = EXCLUDED.status,
                payload_json = EXCLUDED.payload_json,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at,
                last_actor_user_id = EXCLUDED.last_actor_user_id,
                last_actor_telegram_user_id = EXCLUDED.last_actor_telegram_user_id
            `,
            [
              parsed.id,
              parsed.sourceItemId ?? null,
              parsed.cefrLevel,
              parsed.status,
              JSON.stringify(parsed),
              parsed.editorialMetadata.createdAt ?? parsed.editorialMetadata.updatedAt ?? bundle.exportedAt,
              parsed.editorialMetadata.updatedAt ?? parsed.editorialMetadata.createdAt ?? bundle.exportedAt,
              actor.userId,
              actor.telegramUserId,
            ],
          );
        }

        await transaction.query(
          `
            INSERT INTO content_audit_log (
              id, entity_type, entity_id, action_type, actor_user_id, actor_telegram_user_id,
              summary, before_json, after_json, meta_json, occurred_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          `,
          [
            `audit_${randomUUID()}`,
            'level',
            'bundle',
            'import_apply',
            actor.userId,
            actor.telegramUserId,
            `Applied content import bundle ${bundle.sourceLabel}.`,
            null,
            JSON.stringify({
              counts: {
                levels: bundle.levels.length,
                topics: bundle.topics.length,
                lessons: bundle.lessons.length,
                vocabItems: bundle.vocabItems.length,
                distractorSets: bundle.distractorSets.length,
              },
            }),
            JSON.stringify({
              sourceLabel: bundle.sourceLabel,
              exportedAt: bundle.exportedAt,
            }),
            occurredAt,
          ],
        );
      });
    },
  };
}

function parseStoredVocabRow(row: StoredVocabRow) {
  return vocabItemSchema.parse(JSON.parse(row.payload_json) as unknown);
}

function parseStoredTopicRow(row: StoredTopicRow) {
  return topicSchema.parse(JSON.parse(row.payload_json) as unknown);
}

function parseStoredLessonRow(row: StoredLessonRow) {
  return lessonSchema.parse(JSON.parse(row.payload_json) as unknown);
}

function parseStoredDistractorSetRow(row: StoredDistractorSetRow) {
  return distractorSetSchema.parse(JSON.parse(row.payload_json) as unknown);
}

function parseStoredLevelRow(row: StoredLevelRow) {
  return levelSchema.parse(JSON.parse(row.payload_json) as unknown);
}

function parseQaFlagRow(row: StoredQaFlagRow): AdminQaFlag {
  return adminQaFlagSchema.parse({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    flagType: row.flag_type,
    note: row.note ?? undefined,
    status: row.status as AdminQaFlagStatus,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    createdByTelegramUserId: row.created_by_telegram_user_id,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedByUserId: row.resolved_by_user_id ?? undefined,
    resolvedByTelegramUserId: row.resolved_by_telegram_user_id ?? undefined,
  });
}

function parseAuditRow(row: StoredAuditRow): AdminAuditLogEntry {
  return adminAuditLogEntrySchema.parse({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionType: row.action_type,
    actorUserId: row.actor_user_id,
    actorTelegramUserId: row.actor_telegram_user_id,
    summary: row.summary,
    before: row.before_json ? JSON.parse(row.before_json) as unknown : undefined,
    after: row.after_json ? JSON.parse(row.after_json) as unknown : undefined,
    meta: row.meta_json ? JSON.parse(row.meta_json) as unknown : undefined,
    occurredAt: row.occurred_at,
  });
}

function joinLevels(levels: readonly string[]) {
  return `|${levels.join('|')}|`;
}
