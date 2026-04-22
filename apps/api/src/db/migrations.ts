import type { DatabaseClient } from './client.js';

const phase7SchemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT,
      language_code TEXT,
      is_premium BOOLEAN NOT NULL,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users (id),
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS run_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id),
      level_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      hearts_remaining INTEGER NOT NULL,
      score INTEGER NOT NULL,
      combo INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      engine_state TEXT NOT NULL,
      current_question_state TEXT,
      answer_count INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      wrong_count INTEGER NOT NULL,
      move_count INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS run_answer_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES run_sessions (id),
      question_id TEXT NOT NULL,
      source_item_id TEXT NOT NULL,
      selected_option_id TEXT NOT NULL,
      correct_option_id TEXT NOT NULL,
      correctness BOOLEAN NOT NULL,
      timing_ms INTEGER,
      penalty_json TEXT,
      occurred_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS run_move_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES run_sessions (id),
      engine_turn INTEGER NOT NULL,
      tray_index INTEGER NOT NULL,
      piece_instance_id TEXT NOT NULL,
      piece_id TEXT NOT NULL,
      origin_x INTEGER NOT NULL,
      origin_y INTEGER NOT NULL,
      validation_result TEXT NOT NULL,
      cleared_line_count INTEGER NOT NULL,
      score_breakdown_json TEXT NOT NULL,
      resulting_score INTEGER NOT NULL,
      resulting_combo INTEGER NOT NULL,
      occurred_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS run_results (
      run_id TEXT PRIMARY KEY REFERENCES run_sessions (id),
      user_id TEXT NOT NULL REFERENCES users (id),
      level_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      final_score INTEGER NOT NULL,
      cleared_lines_total INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      wrong_count INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      mastery_applied_at TEXT
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS user_mastery (
      user_id TEXT NOT NULL REFERENCES users (id),
      source_item_id TEXT NOT NULL,
      cefr_level TEXT NOT NULL,
      mastery_state TEXT NOT NULL,
      seen_count INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      wrong_count INTEGER NOT NULL,
      success_streak INTEGER NOT NULL,
      failure_streak INTEGER NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_outcome TEXT NOT NULL,
      last_timing_ms INTEGER,
      average_timing_ms INTEGER,
      next_review_at TEXT NOT NULL,
      resurfacing_reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, source_item_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS review_answer_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id),
      source_item_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      selected_option_id TEXT NOT NULL,
      correct_option_id TEXT NOT NULL,
      correctness BOOLEAN NOT NULL,
      timing_ms INTEGER,
      mastery_state_before TEXT NOT NULL,
      mastery_state_after TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    )
  `,
  `
    ALTER TABLE run_results ADD COLUMN IF NOT EXISTS mastery_applied_at TEXT
  `,
] as const;

export async function migratePhase7Schema(client: Pick<DatabaseClient, 'query'>): Promise<void> {
  for (const statement of phase7SchemaStatements) {
    await client.query(statement);
  }
}
