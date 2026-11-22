/**
 * Sync model: SQLite is the source of truth; Supabase is the replica that lets devices converge.
 * Conflict rule: last-write-wins on updated_at (the server also enforces this in lww_guard()).
 */
export type SyncTable = 'habits' | 'habit_logs' | 'habit_effort_levels' | 'momentum_experiments' | 'journal_entries';

export interface RemoteHabit {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  category: string | null;
  cadence_type: 'daily' | 'weekly_days' | 'x_per_week' | 'interval';
  cadence_config: Record<string, unknown>;
  target_value: number;
  unit: string | null;
  start_date: string;
  archived_at: string | null;
  sort_order: number;
  reminder_times: unknown[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteLog {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  value: number;
  status: 'done' | 'skipped' | 'missed';
  note: string | null;
  mood: number | null;
  logged_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type EffortLevelName = 'minimum' | 'standard' | 'extended';

export interface RemoteEffortLevel {
  id: string;
  user_id: string;
  habit_id: string;
  level: EffortLevelName;
  target_value: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ExperimentStatus = 'running' | 'kept' | 'discarded';

export interface RemoteExperiment {
  id: string;
  user_id: string;
  habit_id: string;
  start_date: string;
  duration_days: number;
  baseline_target_value: number;
  trial_target_value: number;
  status: ExperimentStatus;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteJournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  body: string;
  mood: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Keyset cursor over (updated_at, id): stable even when many rows share a timestamp. */
export interface Cursor {
  ts: string;
  id: string;
}

export interface PullPage<T> {
  rows: T[];
  /** Number of rows the server returned BEFORE client-side validation dropped any. */
  rawCount: number;
  /** Cursor of the last raw row, even if that row failed validation. */
  last: Cursor | null;
}

/** Thrown by RemoteApi. `retryable` = transient (network/auth/5xx); false = the server rejected the data. */
export class SyncRemoteError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'SyncRemoteError';
  }
}

export interface RemoteApi {
  upsertHabits(rows: RemoteHabit[]): Promise<void>;
  upsertLogs(rows: RemoteLog[]): Promise<void>;
  pullHabits(cursor: Cursor | null, limit: number): Promise<PullPage<RemoteHabit>>;
  pullLogs(cursor: Cursor | null, limit: number): Promise<PullPage<RemoteLog>>;
  /** Adaptive Momentum tables. Optional so older RemoteApi implementations keep working; both ends must provide them. */
  upsertEffortLevels?(rows: RemoteEffortLevel[]): Promise<void>;
  pullEffortLevels?(cursor: Cursor | null, limit: number): Promise<PullPage<RemoteEffortLevel>>;
  upsertExperiments?(rows: RemoteExperiment[]): Promise<void>;
  pullExperiments?(cursor: Cursor | null, limit: number): Promise<PullPage<RemoteExperiment>>;
  /** Journal (one entry per user and date). Optional for the same reason. */
  upsertJournal?(rows: RemoteJournalEntry[]): Promise<void>;
  pullJournal?(cursor: Cursor | null, limit: number): Promise<PullPage<RemoteJournalEntry>>;
}

export interface LocalStore {
  /** `exclude`: ids the server already rejected in this pass, so they can't crowd out other changes. */
  getDirtyHabits(limit: number, exclude: string[]): Promise<RemoteHabit[]>;
  getDirtyLogs(limit: number, exclude: string[]): Promise<RemoteLog[]>;
  /** Clears dirty only if the row is unchanged since it was read (compares updated_at). */
  markPushed(table: SyncTable, rows: { id: string; updated_at: string }[]): Promise<void>;
  /** Applies rows with last-write-wins. Returns how many were applied vs skipped. */
  applyRemoteHabits(rows: RemoteHabit[]): Promise<ApplyCount>;
  applyRemoteLogs(rows: RemoteLog[]): Promise<ApplyCount>;
  getDirtyEffortLevels?(limit: number, exclude: string[]): Promise<RemoteEffortLevel[]>;
  getDirtyExperiments?(limit: number, exclude: string[]): Promise<RemoteExperiment[]>;
  applyRemoteEffortLevels?(rows: RemoteEffortLevel[]): Promise<ApplyCount>;
  applyRemoteExperiments?(rows: RemoteExperiment[]): Promise<ApplyCount>;
  getDirtyJournal?(limit: number, exclude: string[]): Promise<RemoteJournalEntry[]>;
  applyRemoteJournal?(rows: RemoteJournalEntry[]): Promise<ApplyCount>;
  getCursor(table: SyncTable): Promise<Cursor | null>;
  setCursor(table: SyncTable, cursor: Cursor): Promise<void>;
}

export interface ApplyCount {
  applied: number;
  skipped: number;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  skipped: number;
  /** Rows the server rejected (validation/RLS). They stay dirty and are retried next sync. */
  rejected: number;
}
