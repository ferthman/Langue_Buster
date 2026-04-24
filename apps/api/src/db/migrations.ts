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
      recovery_state TEXT,
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
    ALTER TABLE run_sessions ADD COLUMN IF NOT EXISTS recovery_state TEXT
  `,
  `
    ALTER TABLE run_results ADD COLUMN IF NOT EXISTS mastery_applied_at TEXT
  `,
  `
    CREATE TABLE IF NOT EXISTS content_vocab_items (
      id TEXT PRIMARY KEY,
      lemma TEXT NOT NULL,
      surface_form TEXT NOT NULL,
      cefr_level TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      status TEXT NOT NULL,
      frequency_score INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_actor_user_id TEXT NOT NULL,
      last_actor_telegram_user_id TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS content_topics (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      cefr_levels_text TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_actor_user_id TEXT NOT NULL,
      last_actor_telegram_user_id TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS content_lessons (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cefr_level TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_actor_user_id TEXT NOT NULL,
      last_actor_telegram_user_id TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS content_distractor_sets (
      id TEXT PRIMARY KEY,
      source_item_id TEXT,
      cefr_level TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_actor_user_id TEXT NOT NULL,
      last_actor_telegram_user_id TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS content_levels (
      id TEXT PRIMARY KEY,
      cefr_level TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_actor_user_id TEXT NOT NULL,
      last_actor_telegram_user_id TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS content_qa_flags (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      flag_type TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      created_by_telegram_user_id TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by_user_id TEXT,
      resolved_by_telegram_user_id TEXT
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS content_audit_log (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      actor_telegram_user_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      meta_json TEXT,
      occurred_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      user_id TEXT REFERENCES users (id),
      session_id TEXT,
      run_id TEXT,
      level_id TEXT,
      source_item_id TEXT,
      topic_id TEXT,
      lesson_id TEXT,
      occurred_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx ON analytics_events (event_name)
  `,
  `
    CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx ON analytics_events (occurred_at)
  `,
  `
    CREATE INDEX IF NOT EXISTS analytics_events_user_occurred_at_idx ON analytics_events (user_id, occurred_at)
  `,
  `
    CREATE INDEX IF NOT EXISTS analytics_events_run_id_idx ON analytics_events (run_id)
  `,
  `
    CREATE TABLE IF NOT EXISTS soft_launch_settings_snapshots (
      id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      note TEXT,
      is_active BOOLEAN NOT NULL,
      created_at TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES users (id),
      created_by_telegram_user_id TEXT
    )
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS soft_launch_settings_snapshots_active_idx
    ON soft_launch_settings_snapshots (is_active)
    WHERE is_active = TRUE
  `,
  `
    CREATE INDEX IF NOT EXISTS analytics_events_source_item_id_idx ON analytics_events (source_item_id)
  `,
  `
    CREATE TABLE IF NOT EXISTS anti_cheat_anomalies (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users (id),
      run_id TEXT REFERENCES run_sessions (id),
      source_item_id TEXT,
      anomaly_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS anti_cheat_anomalies_user_id_idx ON anti_cheat_anomalies (user_id)
  `,
  `
    CREATE INDEX IF NOT EXISTS anti_cheat_anomalies_run_id_idx ON anti_cheat_anomalies (run_id)
  `,
  `
    CREATE INDEX IF NOT EXISTS anti_cheat_anomalies_type_idx ON anti_cheat_anomalies (anomaly_type)
  `,
  `
    CREATE INDEX IF NOT EXISTS anti_cheat_anomalies_occurred_at_idx ON anti_cheat_anomalies (occurred_at)
  `,
] as const;

export async function migratePhase7Schema(client: Pick<DatabaseClient, 'query'>): Promise<void> {
  for (const statement of phase7SchemaStatements) {
    await client.query(statement);
  }
}
