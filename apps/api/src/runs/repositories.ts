import type {
  AnswerEvent,
  MoveEvent,
  RunQuestionState,
  RunResult,
  RunSession,
} from '@langue-buster/shared';
import {
  answerEventSchema,
  moveEventSchema,
  runQuestionStateSchema,
  runResultSchema,
  runSessionSchema,
} from '@langue-buster/shared';

import type { DatabaseClient } from '../db/client.js';
import { queryOne, queryRows } from '../db/client.js';

export type RunSessionRepository = {
  save(run: RunSession): Promise<RunSession>;
  findById(runId: string): Promise<RunSession | null>;
};

export type AnswerEventRepository = {
  save(event: AnswerEvent): Promise<AnswerEvent>;
  findByRunId(runId: string): Promise<readonly AnswerEvent[]>;
};

export type MoveEventRepository = {
  save(event: MoveEvent): Promise<MoveEvent>;
  findByRunId(runId: string): Promise<readonly MoveEvent[]>;
};

export type RunResultRepository = {
  save(result: RunResult): Promise<RunResult>;
  findByRunId(runId: string): Promise<RunResult | null>;
  markMasteryApplied(runId: string, occurredAt: string): Promise<RunResult>;
};

type RunSessionRow = {
  id: string;
  user_id: string;
  level_id: string;
  direction: string;
  status: string;
  hearts_remaining: number;
  score: number;
  combo: number;
  seed: number;
  engine_state: string;
  current_question_state: string | null;
  answer_count: number;
  correct_count: number;
  wrong_count: number;
  move_count: number;
  started_at: string;
  finished_at: string | null;
};

type AnswerEventRow = {
  id: string;
  run_id: string;
  question_id: string;
  source_item_id: string;
  selected_option_id: string;
  correct_option_id: string;
  correctness: boolean;
  timing_ms: number | null;
  penalty_json: string | null;
  occurred_at: string;
};

type MoveEventRow = {
  id: string;
  run_id: string;
  engine_turn: number;
  tray_index: number;
  piece_instance_id: string;
  piece_id: string;
  origin_x: number;
  origin_y: number;
  validation_result: string;
  cleared_line_count: number;
  score_breakdown_json: string;
  resulting_score: number;
  resulting_combo: number;
  occurred_at: string;
};

type RunResultRow = {
  run_id: string;
  user_id: string;
  level_id: string;
  direction: string;
  status: string;
  final_score: number;
  cleared_lines_total: number;
  correct_count: number;
  wrong_count: number;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  mastery_applied_at: string | null;
};

export class PostgresRunSessionRepository implements RunSessionRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;

  constructor(client: Pick<DatabaseClient, 'query'>) {
    this.#client = client;
  }

  async save(run: RunSession): Promise<RunSession> {
    const parsed = runSessionSchema.parse(run);
    const row = await queryOne<RunSessionRow>(
      this.#client,
      `
        INSERT INTO run_sessions (
          id, user_id, level_id, direction, status, hearts_remaining, score, combo, seed, engine_state,
          current_question_state, answer_count, correct_count, wrong_count, move_count, started_at, finished_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          level_id = EXCLUDED.level_id,
          direction = EXCLUDED.direction,
          status = EXCLUDED.status,
          hearts_remaining = EXCLUDED.hearts_remaining,
          score = EXCLUDED.score,
          combo = EXCLUDED.combo,
          seed = EXCLUDED.seed,
          engine_state = EXCLUDED.engine_state,
          current_question_state = EXCLUDED.current_question_state,
          answer_count = EXCLUDED.answer_count,
          correct_count = EXCLUDED.correct_count,
          wrong_count = EXCLUDED.wrong_count,
          move_count = EXCLUDED.move_count,
          started_at = EXCLUDED.started_at,
          finished_at = EXCLUDED.finished_at
        RETURNING *
      `,
      [
        parsed.id,
        parsed.userId,
        parsed.levelId,
        parsed.direction,
        parsed.status,
        parsed.heartsRemaining,
        parsed.score,
        parsed.combo,
        parsed.seed,
        JSON.stringify(parsed.engineState),
        parsed.currentQuestionState ? JSON.stringify(parsed.currentQuestionState) : null,
        parsed.answerCount,
        parsed.correctCount,
        parsed.wrongCount,
        parsed.moveCount,
        parsed.startedAt,
        parsed.finishedAt ?? null,
      ],
    );

    if (!row) {
      throw new Error('Expected run session upsert to return a row.');
    }

    return mapRunSessionRow(row);
  }

  async findById(runId: string): Promise<RunSession | null> {
    const row = await queryOne<RunSessionRow>(
      this.#client,
      'SELECT * FROM run_sessions WHERE id = $1',
      [runId],
    );
    return row ? mapRunSessionRow(row) : null;
  }
}

export class PostgresAnswerEventRepository implements AnswerEventRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;

  constructor(client: Pick<DatabaseClient, 'query'>) {
    this.#client = client;
  }

  async save(event: AnswerEvent): Promise<AnswerEvent> {
    const parsed = answerEventSchema.parse(event);
    const row = await queryOne<AnswerEventRow>(
      this.#client,
      `
        INSERT INTO run_answer_events (
          id, run_id, question_id, source_item_id, selected_option_id, correct_option_id,
          correctness, timing_ms, penalty_json, occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        parsed.id,
        parsed.runId,
        parsed.questionId,
        parsed.sourceItemId,
        parsed.selectedOptionId,
        parsed.correctOptionId,
        parsed.correctness,
        parsed.timingMs ?? null,
        parsed.penalty ? JSON.stringify(parsed.penalty) : null,
        parsed.occurredAt,
      ],
    );

    if (!row) {
      throw new Error('Expected answer event insert to return a row.');
    }

    return mapAnswerEventRow(row);
  }

  async findByRunId(runId: string): Promise<readonly AnswerEvent[]> {
    const rows = await queryRows<AnswerEventRow>(
      this.#client,
      'SELECT * FROM run_answer_events WHERE run_id = $1 ORDER BY occurred_at ASC, id ASC',
      [runId],
    );
    return rows.map(mapAnswerEventRow);
  }
}

export class PostgresMoveEventRepository implements MoveEventRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;

  constructor(client: Pick<DatabaseClient, 'query'>) {
    this.#client = client;
  }

  async save(event: MoveEvent): Promise<MoveEvent> {
    const parsed = moveEventSchema.parse(event);
    const row = await queryOne<MoveEventRow>(
      this.#client,
      `
        INSERT INTO run_move_events (
          id, run_id, engine_turn, tray_index, piece_instance_id, piece_id, origin_x, origin_y,
          validation_result, cleared_line_count, score_breakdown_json, resulting_score, resulting_combo, occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `,
      [
        parsed.id,
        parsed.runId,
        parsed.engineTurn,
        parsed.trayIndex,
        parsed.pieceInstanceId,
        parsed.pieceId,
        parsed.origin.x,
        parsed.origin.y,
        parsed.validationResult,
        parsed.clearedLineCount,
        JSON.stringify(parsed.scoreBreakdown),
        parsed.resultingScore,
        parsed.resultingCombo,
        parsed.occurredAt,
      ],
    );

    if (!row) {
      throw new Error('Expected move event insert to return a row.');
    }

    return mapMoveEventRow(row);
  }

  async findByRunId(runId: string): Promise<readonly MoveEvent[]> {
    const rows = await queryRows<MoveEventRow>(
      this.#client,
      'SELECT * FROM run_move_events WHERE run_id = $1 ORDER BY engine_turn ASC, occurred_at ASC, id ASC',
      [runId],
    );
    return rows.map(mapMoveEventRow);
  }
}

export class PostgresRunResultRepository implements RunResultRepository {
  readonly #client: Pick<DatabaseClient, 'query'>;

  constructor(client: Pick<DatabaseClient, 'query'>) {
    this.#client = client;
  }

  async save(result: RunResult): Promise<RunResult> {
    const parsed = runResultSchema.parse(result);
    const row = await queryOne<RunResultRow>(
      this.#client,
      `
        INSERT INTO run_results (
          run_id, user_id, level_id, direction, status, final_score, cleared_lines_total,
          correct_count, wrong_count, started_at, finished_at, duration_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (run_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          level_id = EXCLUDED.level_id,
          direction = EXCLUDED.direction,
          status = EXCLUDED.status,
          final_score = EXCLUDED.final_score,
          cleared_lines_total = EXCLUDED.cleared_lines_total,
          correct_count = EXCLUDED.correct_count,
          wrong_count = EXCLUDED.wrong_count,
          started_at = EXCLUDED.started_at,
          finished_at = EXCLUDED.finished_at,
          duration_ms = EXCLUDED.duration_ms,
          mastery_applied_at = EXCLUDED.mastery_applied_at
        RETURNING *
      `,
      [
        parsed.runId,
        parsed.userId,
        parsed.levelId,
        parsed.direction,
        parsed.status,
        parsed.finalScore,
        parsed.clearedLinesTotal,
        parsed.correctCount,
        parsed.wrongCount,
        parsed.startedAt,
        parsed.finishedAt,
        parsed.durationMs,
        parsed.masteryAppliedAt ?? null,
      ],
    );

    if (!row) {
      throw new Error('Expected run result upsert to return a row.');
    }

    return mapRunResultRow(row);
  }

  async findByRunId(runId: string): Promise<RunResult | null> {
    const row = await queryOne<RunResultRow>(
      this.#client,
      'SELECT * FROM run_results WHERE run_id = $1',
      [runId],
    );
    return row ? mapRunResultRow(row) : null;
  }

  async markMasteryApplied(runId: string, occurredAt: string): Promise<RunResult> {
    const row = await queryOne<RunResultRow>(
      this.#client,
      `
        UPDATE run_results
        SET mastery_applied_at = $2
        WHERE run_id = $1
        RETURNING *
      `,
      [runId, occurredAt],
    );

    if (!row) {
      throw new Error('Expected run result mastery update to return a row.');
    }

    return mapRunResultRow(row);
  }
}

function mapRunSessionRow(row: RunSessionRow): RunSession {
  return runSessionSchema.parse({
    id: row.id,
    userId: row.user_id,
    levelId: row.level_id,
    direction: row.direction,
    status: row.status,
    heartsRemaining: row.hearts_remaining,
    score: row.score,
    combo: row.combo,
    seed: row.seed,
    engineState: JSON.parse(row.engine_state),
    currentQuestionState: row.current_question_state
      ? runQuestionStateSchema.parse(JSON.parse(row.current_question_state))
      : null,
    answerCount: row.answer_count,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    moveCount: row.move_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
  });
}

function mapAnswerEventRow(row: AnswerEventRow): AnswerEvent {
  return answerEventSchema.parse({
    id: row.id,
    runId: row.run_id,
    questionId: row.question_id,
    sourceItemId: row.source_item_id,
    selectedOptionId: row.selected_option_id,
    correctOptionId: row.correct_option_id,
    correctness: row.correctness,
    timingMs: row.timing_ms ?? undefined,
    penalty: row.penalty_json ? JSON.parse(row.penalty_json) : null,
    occurredAt: row.occurred_at,
  });
}

function mapMoveEventRow(row: MoveEventRow): MoveEvent {
  return moveEventSchema.parse({
    id: row.id,
    runId: row.run_id,
    engineTurn: row.engine_turn,
    trayIndex: row.tray_index,
    pieceInstanceId: row.piece_instance_id,
    pieceId: row.piece_id,
    origin: {
      x: row.origin_x,
      y: row.origin_y,
    },
    validationResult: row.validation_result,
    clearedLineCount: row.cleared_line_count,
    scoreBreakdown: JSON.parse(row.score_breakdown_json),
    resultingScore: row.resulting_score,
    resultingCombo: row.resulting_combo,
    occurredAt: row.occurred_at,
  });
}

function mapRunResultRow(row: RunResultRow): RunResult {
  return runResultSchema.parse({
    runId: row.run_id,
    userId: row.user_id,
    levelId: row.level_id,
    direction: row.direction,
    status: row.status,
    finalScore: row.final_score,
    clearedLinesTotal: row.cleared_lines_total,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    masteryAppliedAt: row.mastery_applied_at ?? undefined,
  });
}
