import type {
  ReviewAnswerEvent,
  UserMastery,
} from '@langue-buster/shared';
import {
  reviewAnswerEventSchema,
  userMasterySchema,
} from '@langue-buster/shared';

import type { DatabaseClient } from '../db/client.js';
import { queryOne, queryRows } from '../db/client.js';

export type UserMasteryRepository = {
  save(record: UserMastery): Promise<UserMastery>;
  findByUserAndItem(userId: string, sourceItemId: string): Promise<UserMastery | null>;
  listByUser(userId: string, levelId?: UserMastery['cefrLevel']): Promise<readonly UserMastery[]>;
  listAll(): Promise<readonly UserMastery[]>;
};

export type ReviewAnswerEventRepository = {
  save(event: ReviewAnswerEvent): Promise<ReviewAnswerEvent>;
  listByUser(userId: string): Promise<readonly ReviewAnswerEvent[]>;
};

type UserMasteryRow = {
  user_id: string;
  source_item_id: string;
  cefr_level: string;
  mastery_state: string;
  seen_count: number;
  correct_count: number;
  wrong_count: number;
  success_streak: number;
  failure_streak: number;
  last_seen_at: string;
  last_outcome: string;
  last_timing_ms: number | null;
  average_timing_ms: number | null;
  next_review_at: string;
  resurfacing_reason: string;
  created_at: string;
  updated_at: string;
};

type ReviewAnswerEventRow = {
  id: string;
  user_id: string;
  source_item_id: string;
  question_id: string;
  selected_option_id: string;
  correct_option_id: string;
  correctness: boolean;
  timing_ms: number | null;
  mastery_state_before: string;
  mastery_state_after: string;
  occurred_at: string;
};

export class PostgresUserMasteryRepository implements UserMasteryRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;

  constructor(client: Pick<DatabaseClient, 'query'>) {
    this.#client = client;
  }

  async save(record: UserMastery): Promise<UserMastery> {
    const parsed = userMasterySchema.parse(record);
    const row = await queryOne<UserMasteryRow>(
      this.#client,
      `
        INSERT INTO user_mastery (
          user_id, source_item_id, cefr_level, mastery_state, seen_count, correct_count, wrong_count,
          success_streak, failure_streak, last_seen_at, last_outcome, last_timing_ms, average_timing_ms,
          next_review_at, resurfacing_reason, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (user_id, source_item_id) DO UPDATE SET
          cefr_level = EXCLUDED.cefr_level,
          mastery_state = EXCLUDED.mastery_state,
          seen_count = EXCLUDED.seen_count,
          correct_count = EXCLUDED.correct_count,
          wrong_count = EXCLUDED.wrong_count,
          success_streak = EXCLUDED.success_streak,
          failure_streak = EXCLUDED.failure_streak,
          last_seen_at = EXCLUDED.last_seen_at,
          last_outcome = EXCLUDED.last_outcome,
          last_timing_ms = EXCLUDED.last_timing_ms,
          average_timing_ms = EXCLUDED.average_timing_ms,
          next_review_at = EXCLUDED.next_review_at,
          resurfacing_reason = EXCLUDED.resurfacing_reason,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `,
      [
        parsed.userId,
        parsed.sourceItemId,
        parsed.cefrLevel,
        parsed.masteryState,
        parsed.seenCount,
        parsed.correctCount,
        parsed.wrongCount,
        parsed.successStreak,
        parsed.failureStreak,
        parsed.lastSeenAt,
        parsed.lastOutcome,
        parsed.lastTimingMs ?? null,
        parsed.averageTimingMs ?? null,
        parsed.nextReviewAt,
        parsed.resurfacingReason,
        parsed.createdAt,
        parsed.updatedAt,
      ],
    );

    if (!row) {
      throw new Error('Expected user mastery upsert to return a row.');
    }

    return mapUserMasteryRow(row);
  }

  async findByUserAndItem(userId: string, sourceItemId: string): Promise<UserMastery | null> {
    const row = await queryOne<UserMasteryRow>(
      this.#client,
      'SELECT * FROM user_mastery WHERE user_id = $1 AND source_item_id = $2',
      [userId, sourceItemId],
    );

    return row ? mapUserMasteryRow(row) : null;
  }

  async listByUser(userId: string, levelId?: UserMastery['cefrLevel']): Promise<readonly UserMastery[]> {
    const rows = levelId
      ? await queryRows<UserMasteryRow>(
        this.#client,
        'SELECT * FROM user_mastery WHERE user_id = $1 AND cefr_level = $2 ORDER BY next_review_at ASC, source_item_id ASC',
        [userId, levelId],
      )
      : await queryRows<UserMasteryRow>(
        this.#client,
        'SELECT * FROM user_mastery WHERE user_id = $1 ORDER BY next_review_at ASC, source_item_id ASC',
        [userId],
      );

    return rows.map(mapUserMasteryRow);
  }

  async listAll(): Promise<readonly UserMastery[]> {
    const rows = await queryRows<UserMasteryRow>(
      this.#client,
      'SELECT * FROM user_mastery ORDER BY updated_at DESC, source_item_id ASC',
    );
    return rows.map(mapUserMasteryRow);
  }
}

export class PostgresReviewAnswerEventRepository implements ReviewAnswerEventRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;

  constructor(client: Pick<DatabaseClient, 'query'>) {
    this.#client = client;
  }

  async save(event: ReviewAnswerEvent): Promise<ReviewAnswerEvent> {
    const parsed = reviewAnswerEventSchema.parse(event);
    const row = await queryOne<ReviewAnswerEventRow>(
      this.#client,
      `
        INSERT INTO review_answer_events (
          id, user_id, source_item_id, question_id, selected_option_id, correct_option_id,
          correctness, timing_ms, mastery_state_before, mastery_state_after, occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        parsed.id,
        parsed.userId,
        parsed.sourceItemId,
        parsed.questionId,
        parsed.selectedOptionId,
        parsed.correctOptionId,
        parsed.correctness,
        parsed.timingMs ?? null,
        parsed.masteryStateBefore,
        parsed.masteryStateAfter,
        parsed.occurredAt,
      ],
    );

    if (!row) {
      throw new Error('Expected review answer event insert to return a row.');
    }

    return mapReviewAnswerEventRow(row);
  }

  async listByUser(userId: string): Promise<readonly ReviewAnswerEvent[]> {
    const rows = await queryRows<ReviewAnswerEventRow>(
      this.#client,
      'SELECT * FROM review_answer_events WHERE user_id = $1 ORDER BY occurred_at ASC, id ASC',
      [userId],
    );

    return rows.map(mapReviewAnswerEventRow);
  }
}

function mapUserMasteryRow(row: UserMasteryRow): UserMastery {
  return userMasterySchema.parse({
    userId: row.user_id,
    sourceItemId: row.source_item_id,
    cefrLevel: row.cefr_level,
    masteryState: row.mastery_state,
    seenCount: row.seen_count,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    successStreak: row.success_streak,
    failureStreak: row.failure_streak,
    lastSeenAt: row.last_seen_at,
    lastOutcome: row.last_outcome,
    lastTimingMs: row.last_timing_ms ?? undefined,
    averageTimingMs: row.average_timing_ms ?? undefined,
    nextReviewAt: row.next_review_at,
    resurfacingReason: row.resurfacing_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapReviewAnswerEventRow(row: ReviewAnswerEventRow): ReviewAnswerEvent {
  return reviewAnswerEventSchema.parse({
    id: row.id,
    userId: row.user_id,
    sourceItemId: row.source_item_id,
    questionId: row.question_id,
    selectedOptionId: row.selected_option_id,
    correctOptionId: row.correct_option_id,
    correctness: row.correctness,
    timingMs: row.timing_ms ?? undefined,
    masteryStateBefore: row.mastery_state_before,
    masteryStateAfter: row.mastery_state_after,
    occurredAt: row.occurred_at,
  });
}
