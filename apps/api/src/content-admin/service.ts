import {
  generateQuestion,
  lessonSchema,
  parseEditorialImportBundle,
  topicSchema,
  validateEditorialImportBundle,
  vocabItemSchema,
  type EditorialImportBundle,
  type Lesson,
  type Topic,
  type VocabItem,
} from '@langue-buster/content-core';
import {
  adminAuditLogEntrySchema,
  adminBulkUpdateVocabItemsResponseSchema,
  adminImportApplyResponseSchema,
  adminImportValidateResponseSchema,
  adminLessonDetailResponseSchema,
  adminLessonListResponseSchema,
  adminPreviewResponseSchema,
  adminQaFlagResponseSchema,
  adminTopicDetailResponseSchema,
  adminTopicListResponseSchema,
  adminVocabDetailResponseSchema,
  adminVocabListResponseSchema,
  type AdminAuditLogEntry,
  type AdminBulkUpdateVocabItemsRequest,
  type AdminHistoryQuery,
  type AdminLessonUpsertRequest,
  type AdminQaFlagRequest,
  type AdminTopicUpsertRequest,
  type AdminVocabListQuery,
  type AdminVocabUpsertRequest,
} from '@langue-buster/shared';
import { randomUUID } from 'node:crypto';

import { ContentAdminDomainError } from './errors.js';
import type { ContentAdminRepository } from './repositories.js';

type Actor = Readonly<{
  userId: string;
  telegramUserId: string;
}>;

type ContentAdminServiceDependencies = {
  repository: ContentAdminRepository;
  now?: () => Date;
};

export type ContentAdminService = ReturnType<typeof createContentAdminService>;

export function createContentAdminService(dependencies: ContentAdminServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());

  return {
    async listVocabItems(query: AdminVocabListQuery) {
      const response = await dependencies.repository.listVocabItems(query);
      return adminVocabListResponseSchema.parse({
        items: response.items,
        total: response.total,
        page: query.page,
        pageSize: query.pageSize,
      });
    },

    async getVocabItem(id: string) {
      const item = await dependencies.repository.findVocabItem(id);
      if (!item) {
        throw new ContentAdminDomainError('content_not_found', `Vocab item "${id}" could not be found.`);
      }

      const flags = await dependencies.repository.listQaFlagsForEntity('vocab_item', id);
      const history = await dependencies.repository.listAuditEntries({
        entityType: 'vocab_item',
        entityId: id,
        limit: 20,
      });

      return adminVocabDetailResponseSchema.parse({
        item,
        qaFlags: flags,
        history,
        validationIssues: await collectEntityValidationIssues(dependencies.repository, 'vocab_item', id, item),
      });
    },

    async saveVocabItem(input: AdminVocabUpsertRequest, actor: Actor) {
      const previous = await dependencies.repository.findVocabItem(extractEntityId(input.item));
      const item = finalizeEditorialMetadata(vocabItemSchema.parse(input.item), {
        previous,
        actor,
        nowIso: now().toISOString(),
      });
      assertStatusTransition(previous?.status, item.status);
      await ensureApprovalIsValid(dependencies.repository, 'vocab_item', item.id, item);
      await dependencies.repository.saveVocabItem(item, actor);
      await dependencies.repository.saveAuditEntry(createAuditEntry({
        entityType: 'vocab_item',
        entityId: item.id,
        actionType: previous ? 'update' : 'create',
        actor,
        summary: previous ? `Updated vocab item ${item.id}.` : `Created vocab item ${item.id}.`,
        before: previous ?? undefined,
        after: item,
        occurredAt: now().toISOString(),
      }));

      return this.getVocabItem(item.id);
    },

    async listTopics() {
      const topics = await dependencies.repository.listTopics();
      return adminTopicListResponseSchema.parse({
        items: topics.map((topic) => ({
          id: topic.id,
          title: topic.title,
          slug: topic.slug,
          status: topic.status,
          cefrLevels: topic.cefrLevels,
          updatedAt: topic.editorialMetadata.updatedAt ?? topic.editorialMetadata.createdAt ?? now().toISOString(),
        })),
      });
    },

    async getTopic(id: string) {
      const topic = await dependencies.repository.findTopic(id);
      if (!topic) {
        throw new ContentAdminDomainError('content_not_found', `Topic "${id}" could not be found.`);
      }

      const flags = await dependencies.repository.listQaFlagsForEntity('topic', id);
      const history = await dependencies.repository.listAuditEntries({
        entityType: 'topic',
        entityId: id,
        limit: 20,
      });

      return adminTopicDetailResponseSchema.parse({
        item: topic,
        qaFlags: flags,
        history,
        validationIssues: await collectEntityValidationIssues(dependencies.repository, 'topic', id, topic),
      });
    },

    async saveTopic(input: AdminTopicUpsertRequest, actor: Actor) {
      const previous = await dependencies.repository.findTopic(extractEntityId(input.item));
      const item = finalizeEditorialMetadata(topicSchema.parse(input.item), {
        previous,
        actor,
        nowIso: now().toISOString(),
      });
      assertStatusTransition(previous?.status, item.status);
      await ensureApprovalIsValid(dependencies.repository, 'topic', item.id, item);
      await dependencies.repository.saveTopic(item, actor);
      await dependencies.repository.saveAuditEntry(createAuditEntry({
        entityType: 'topic',
        entityId: item.id,
        actionType: previous ? 'update' : 'create',
        actor,
        summary: previous ? `Updated topic ${item.id}.` : `Created topic ${item.id}.`,
        before: previous ?? undefined,
        after: item,
        occurredAt: now().toISOString(),
      }));

      return this.getTopic(item.id);
    },

    async listLessons() {
      const lessons = await dependencies.repository.listLessons();
      return adminLessonListResponseSchema.parse({
        items: lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          cefrLevel: lesson.cefrLevel,
          status: lesson.status,
          topicIds: lesson.topicIds,
          updatedAt: lesson.editorialMetadata.updatedAt ?? lesson.editorialMetadata.createdAt ?? now().toISOString(),
        })),
      });
    },

    async getLesson(id: string) {
      const lesson = await dependencies.repository.findLesson(id);
      if (!lesson) {
        throw new ContentAdminDomainError('content_not_found', `Lesson "${id}" could not be found.`);
      }

      const flags = await dependencies.repository.listQaFlagsForEntity('lesson', id);
      const history = await dependencies.repository.listAuditEntries({
        entityType: 'lesson',
        entityId: id,
        limit: 20,
      });

      return adminLessonDetailResponseSchema.parse({
        item: lesson,
        qaFlags: flags,
        history,
        validationIssues: await collectEntityValidationIssues(dependencies.repository, 'lesson', id, lesson),
      });
    },

    async saveLesson(input: AdminLessonUpsertRequest, actor: Actor) {
      const previous = await dependencies.repository.findLesson(extractEntityId(input.item));
      const item = finalizeEditorialMetadata(lessonSchema.parse(input.item), {
        previous,
        actor,
        nowIso: now().toISOString(),
      });
      assertStatusTransition(previous?.status, item.status);
      await ensureApprovalIsValid(dependencies.repository, 'lesson', item.id, item);
      await dependencies.repository.saveLesson(item, actor);
      await dependencies.repository.saveAuditEntry(createAuditEntry({
        entityType: 'lesson',
        entityId: item.id,
        actionType: previous ? 'update' : 'create',
        actor,
        summary: previous ? `Updated lesson ${item.id}.` : `Created lesson ${item.id}.`,
        before: previous ?? undefined,
        after: item,
        occurredAt: now().toISOString(),
      }));

      return this.getLesson(item.id);
    },

    validateImport(bundle: unknown) {
      const result = validateEditorialImportBundle(bundle);
      return adminImportValidateResponseSchema.parse(result);
    },

    async applyImport(bundle: unknown, actor: Actor) {
      let parsed: EditorialImportBundle;
      try {
        parsed = parseEditorialImportBundle(bundle);
      } catch (error) {
        if (isValidationError(error)) {
          throw new ContentAdminDomainError(
            'content_import_invalid',
            error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' | '),
          );
        }

        throw error;
      }
      await dependencies.repository.applyImport(parsed, actor, now().toISOString());

      return adminImportApplyResponseSchema.parse({
        counts: {
          levels: parsed.levels.length,
          topics: parsed.topics.length,
          lessons: parsed.lessons.length,
          vocabItems: parsed.vocabItems.length,
          distractorSets: parsed.distractorSets.length,
        },
      });
    },

    async bulkUpdateVocabItems(input: AdminBulkUpdateVocabItemsRequest, actor: Actor) {
      const updatedIds: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];

      for (const id of input.ids) {
        const item = await dependencies.repository.findVocabItem(id);
        if (!item) {
          skipped.push({ id, reason: 'Item was not found.' });
          continue;
        }

        const nextItem = finalizeEditorialMetadata(
          vocabItemSchema.parse({
            ...item,
            topicId: input.topicId ?? item.topicId,
            cefrLevel: input.levelId ?? item.cefrLevel,
            status: input.archive ? 'archived' : input.status ?? item.status,
          }),
          {
            previous: item,
            actor,
            nowIso: now().toISOString(),
          },
        );

        try {
          assertStatusTransition(item.status, nextItem.status);
          await ensureApprovalIsValid(dependencies.repository, 'vocab_item', nextItem.id, nextItem);
          await dependencies.repository.saveVocabItem(nextItem, actor);
          await dependencies.repository.saveAuditEntry(createAuditEntry({
            entityType: 'vocab_item',
            entityId: nextItem.id,
            actionType: 'bulk_update',
            actor,
            summary: `Bulk updated vocab item ${nextItem.id}.`,
            before: item,
            after: nextItem,
            occurredAt: now().toISOString(),
            meta: {
              requestedStatus: input.status,
              requestedTopicId: input.topicId,
              requestedLevelId: input.levelId,
              archive: input.archive ?? false,
            },
          }));
          updatedIds.push(nextItem.id);
        } catch (error) {
          skipped.push({
            id,
            reason: error instanceof Error ? error.message : 'Bulk update failed.',
          });
        }
      }

      return adminBulkUpdateVocabItemsResponseSchema.parse({
        updatedIds,
        skipped,
      });
    },

    async addQaFlag(input: AdminQaFlagRequest, actor: Actor) {
      await assertEntityExists(dependencies.repository, input.entityType, input.entityId);
      const flag = await dependencies.repository.saveQaFlag(input, actor, now().toISOString());
      await dependencies.repository.saveAuditEntry(createAuditEntry({
        entityType: input.entityType,
        entityId: input.entityId,
        actionType: 'qa_flag_add',
        actor,
        summary: `Added QA flag ${input.flagType} to ${input.entityType} ${input.entityId}.`,
        after: flag,
        occurredAt: now().toISOString(),
      }));
      return adminQaFlagResponseSchema.parse({ flag });
    },

    async resolveQaFlag(flagId: string, actor: Actor) {
      const existingFlag = await dependencies.repository.findQaFlag(flagId);
      if (!existingFlag) {
        throw new ContentAdminDomainError('content_not_found', `QA flag "${flagId}" could not be found.`);
      }

      const resolvedAt = now().toISOString();
      await dependencies.repository.resolveQaFlag(flagId, actor, resolvedAt);
      await dependencies.repository.saveAuditEntry(createAuditEntry({
        entityType: existingFlag.entityType,
        entityId: existingFlag.entityId,
        actionType: 'qa_flag_resolve',
        actor,
        summary: `Resolved QA flag ${flagId}.`,
        before: existingFlag,
        after: {
          ...existingFlag,
          status: 'resolved',
          resolvedAt,
          resolvedByUserId: actor.userId,
          resolvedByTelegramUserId: actor.telegramUserId,
        },
        occurredAt: resolvedAt,
      }));
      return { success: true as const };
    },

    async previewVocabItem(id: string) {
      const item = await dependencies.repository.findVocabItem(id);
      if (!item) {
        throw new ContentAdminDomainError('content_not_found', `Vocab item "${id}" could not be found.`);
      }

      const bundle = await buildBundle(dependencies.repository);
      const question = generateQuestion({
        sourceItem: item,
        allVocabItems: bundle.vocabItems,
        distractorSets: bundle.distractorSets,
        promptLanguage: 'ru',
        answerLanguage: 'fr',
        generatorVersion: 'phase10-preview-v1',
      });

      return adminPreviewResponseSchema.parse({
        item,
        question,
      });
    },

    async getHistory(query: AdminHistoryQuery) {
      const entries = await dependencies.repository.listAuditEntries({
        entityType: query.entityType,
        entityId: query.entityId,
        limit: query.limit,
      });

      return {
        entries: entries.map((entry) => adminAuditLogEntrySchema.parse(entry)),
      };
    },
  };
}

async function ensureApprovalIsValid(
  repository: ContentAdminRepository,
  entityType: 'vocab_item' | 'topic' | 'lesson',
  entityId: string,
  candidate: VocabItem | Topic | Lesson,
) {
  if (candidate.status !== 'approved') {
    return;
  }

  const issues = await collectEntityValidationIssues(repository, entityType, entityId, candidate);
  if (issues.length > 0) {
    throw new ContentAdminDomainError(
      'content_publish_blocked',
      issues.map((issue) => `${issue.path}: ${issue.message}`).join(' | '),
    );
  }
}

async function collectEntityValidationIssues(
  repository: ContentAdminRepository,
  entityType: 'vocab_item' | 'topic' | 'lesson',
  entityId: string,
  candidate: VocabItem | Topic | Lesson,
) {
  const bundle = await buildBundle(repository, { entityType, entityId, candidate });
  const validation = validateEditorialImportBundle(bundle);
  if (validation.success) {
    return [];
  }

  const key = entityType === 'vocab_item' ? 'vocabItems' : entityType === 'topic' ? 'topics' : 'lessons';
  const index = key === 'vocabItems'
    ? bundle.vocabItems.findIndex((item) => item.id === entityId)
    : key === 'topics'
      ? bundle.topics.findIndex((item) => item.id === entityId)
      : bundle.lessons.findIndex((item) => item.id === entityId);

  if (index < 0) {
    return [];
  }

  const prefix = `${key}.${index}`;
  return validation.issues.filter((issue) => issue.path === prefix || issue.path.startsWith(`${prefix}.`));
}

async function buildBundle(
  repository: ContentAdminRepository,
  replacement?: Readonly<{
    entityType: 'vocab_item' | 'topic' | 'lesson';
    entityId: string;
    candidate: VocabItem | Topic | Lesson;
  }>,
): Promise<EditorialImportBundle> {
  const levels = await repository.listLevels();
  const topics = await repository.listTopics();
  const lessons = await repository.listLessons();
  const vocabItems = (await repository.listVocabItems({
    page: 1,
    pageSize: 1000,
    sortBy: 'updatedAt',
    sortDirection: 'desc',
  })).items;
  const fullVocabItems: VocabItem[] = [];
  for (const summary of vocabItems) {
    const item = await repository.findVocabItem(summary.id);
    if (item) {
      fullVocabItems.push(item);
    }
  }
  const distractorSets = await repository.listDistractorSets();

  return {
    version: 'phase10-cms-v1',
    exportedAt: new Date().toISOString(),
    sourceLabel: 'admin-cms',
    levels,
    topics: replacement?.entityType === 'topic'
      ? replaceById(topics, replacement.entityId, replacement.candidate as Topic)
      : topics,
    lessons: replacement?.entityType === 'lesson'
      ? replaceById(lessons, replacement.entityId, replacement.candidate as Lesson)
      : lessons,
    vocabItems: replacement?.entityType === 'vocab_item'
      ? replaceById(fullVocabItems, replacement.entityId, replacement.candidate as VocabItem)
      : fullVocabItems,
    distractorSets,
  };
}

function replaceById<T extends { id: string }>(items: readonly T[], id: string, candidate: T) {
  const without = items.filter((item) => item.id !== id);
  return [...without, candidate];
}

function finalizeEditorialMetadata<T extends { status: string; editorialMetadata: Record<string, string | undefined> }>(
  entity: T,
  input: Readonly<{
    previous: T | null;
    actor: Actor;
    nowIso: string;
  }>,
): T {
  const previouslyApproved = input.previous?.status === 'approved';
  const nowApproved = entity.status === 'approved';

  return {
    ...entity,
    editorialMetadata: {
      ...entity.editorialMetadata,
      createdBy: input.previous?.editorialMetadata.createdBy ?? input.actor.userId,
      createdAt: input.previous?.editorialMetadata.createdAt ?? input.nowIso,
      updatedBy: input.actor.userId,
      updatedAt: input.nowIso,
      publishedBy: nowApproved && !previouslyApproved
        ? input.actor.userId
        : entity.editorialMetadata.publishedBy,
      publishedAt: nowApproved && !previouslyApproved
        ? input.nowIso
        : entity.editorialMetadata.publishedAt,
    },
  };
}

function createAuditEntry(input: {
  entityType: AdminAuditLogEntry['entityType'];
  entityId: string;
  actionType: string;
  actor: Actor;
  summary: string;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  occurredAt: string;
}): AdminAuditLogEntry {
  return adminAuditLogEntrySchema.parse({
    id: `audit_${randomUUID()}`,
    entityType: input.entityType,
    entityId: input.entityId,
    actionType: input.actionType,
    actorUserId: input.actor.userId,
    actorTelegramUserId: input.actor.telegramUserId,
    summary: input.summary,
    before: input.before,
    after: input.after,
    meta: input.meta,
    occurredAt: input.occurredAt,
  });
}

function extractEntityId(payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    typeof (payload as { id?: unknown }).id === 'string' &&
    (payload as { id: string }).id.trim().length > 0
  ) {
    return (payload as { id: string }).id;
  }

  throw new ContentAdminDomainError('content_validation_failed', 'Item id is required.');
}

function assertStatusTransition(previousStatus: string | undefined, nextStatus: string) {
  if (!previousStatus || previousStatus === nextStatus) {
    return;
  }

  const allowedTransitions: Record<string, readonly string[]> = {
    draft: ['on_review', 'archived'],
    on_review: ['draft', 'approved', 'archived'],
    approved: ['on_review', 'archived'],
    archived: [],
  };

  if (!allowedTransitions[previousStatus]?.includes(nextStatus)) {
    throw new ContentAdminDomainError(
      'content_conflict',
      `Status transition "${previousStatus}" -> "${nextStatus}" is not allowed.`,
    );
  }
}

function isValidationError(
  error: unknown,
): error is Readonly<{ issues: ReadonlyArray<Readonly<{ path: readonly (string | number)[]; message: string }>> }> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

async function assertEntityExists(
  repository: ContentAdminRepository,
  entityType: AdminQaFlagRequest['entityType'],
  entityId: string,
) {
  const exists = entityType === 'vocab_item'
    ? await repository.findVocabItem(entityId)
    : entityType === 'topic'
      ? await repository.findTopic(entityId)
      : await repository.findLesson(entityId);

  if (!exists) {
    throw new ContentAdminDomainError('content_not_found', `${entityType} "${entityId}" could not be found.`);
  }
}
