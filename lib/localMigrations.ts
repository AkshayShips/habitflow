/**
 * Local SQLite = source of truth (offline-first). One database file PER USER ID, so account
 * switches can never mix data. A guest upgrading to a full account keeps the same user id, hence
 * the same file: nothing to migrate.
 *
 * Sync columns (used by the Phase 3 sync engine): every row has updated_at (client clock, ISO) and
 * dirty (1 = changed locally since the last successful push). Deletes are soft (deleted_at).
 * Schema mirrors the Supabase tables so rows can be pushed as-is.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE habits (
    id             TEXT PRIMARY KEY NOT NULL,
    name           TEXT NOT NULL,
    icon           TEXT NOT NULL DEFAULT 'checkmark-circle',
    color          TEXT NOT NULL DEFAULT '#5B8DEF',
    category       TEXT,
    cadence_type   TEXT NOT NULL DEFAULT 'daily',
    cadence_config TEXT NOT NULL DEFAULT '{}',
    target_value   REAL NOT NULL DEFAULT 1,
    unit           TEXT,
    start_date     TEXT NOT NULL,
    archived_at    TEXT,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    reminder_times TEXT NOT NULL DEFAULT '[]',
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    deleted_at     TEXT,
    dirty          INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX habits_sort_idx ON habits (sort_order) WHERE deleted_at IS NULL;

  CREATE TABLE habit_logs (
    id         TEXT PRIMARY KEY NOT NULL,
    habit_id   TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    log_date   TEXT NOT NULL,
    value      REAL NOT NULL DEFAULT 1,
    status     TEXT NOT NULL DEFAULT 'done',
    note       TEXT,
    mood       INTEGER,
    logged_at  TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    dirty      INTEGER NOT NULL DEFAULT 1,
    UNIQUE (habit_id, log_date)
  );
  CREATE INDEX habit_logs_date_idx ON habit_logs (log_date);
  `,
  // v2: sync cursors (one JSON value per remote table)
  `
  CREATE TABLE sync_state (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];
