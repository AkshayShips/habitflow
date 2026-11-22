import type { SQLiteDatabase } from 'expo-sqlite';

type Db = Pick<SQLiteDatabase, 'getAllAsync'>;

export type ExportSet = 'habits' | 'checkins' | 'journal';
export const EXPORT_SETS: { id: ExportSet; label: string }[] = [
  { id: 'habits', label: 'Habits' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'journal', label: 'Journal' },
];

export interface ExportFile {
  app: 'HabitFlow';
  formatVersion: 1;
  exportedAt: string;
  habits?: unknown[];
  habitEffortLevels?: unknown[];
  experiments?: unknown[];
  checkins?: unknown[];
  journal?: unknown[];
}

/**
 * Reads the user's own data from the local database (the source of truth) into a portable structure.
 * Deleted rows are excluded; internal sync flags (dirty) are not exported.
 */
export async function buildExport(db: Db, sets: ExportSet[], now: Date = new Date()): Promise<ExportFile> {
  const out: ExportFile = { app: 'HabitFlow', formatVersion: 1, exportedAt: now.toISOString() };

  if (sets.includes('habits')) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT id, name, icon, color, category, cadence_type, cadence_config, target_value, unit, start_date,
              archived_at, sort_order, created_at, updated_at
         FROM habits WHERE deleted_at IS NULL ORDER BY sort_order, created_at`,
    );
    out.habits = rows.map((r) => ({ ...r, cadence_config: safeJson(r.cadence_config) }));
    out.habitEffortLevels = await db.getAllAsync(
      `SELECT habit_id, level, target_value FROM habit_effort_levels WHERE deleted_at IS NULL ORDER BY habit_id, level`,
    );
    out.experiments = await db.getAllAsync(
      `SELECT habit_id, start_date, duration_days, baseline_target_value, trial_target_value, status, decided_at
         FROM momentum_experiments WHERE deleted_at IS NULL ORDER BY start_date`,
    );
  }
  if (sets.includes('checkins')) {
    out.checkins = await db.getAllAsync(
      `SELECT habit_id, log_date, status, value, note, mood, logged_at
         FROM habit_logs WHERE deleted_at IS NULL ORDER BY log_date, habit_id`,
    );
  }
  if (sets.includes('journal')) {
    out.journal = await db.getAllAsync(
      `SELECT entry_date, body, mood, created_at, updated_at FROM journal_entries WHERE deleted_at IS NULL ORDER BY entry_date`,
    );
  }
  return out;
}

function safeJson(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export const serializeExport = (e: ExportFile): string => JSON.stringify(e, null, 2);

export const exportFileName = (now: Date = new Date()): string => `habitflow-export-${now.toISOString().slice(0, 10)}.json`;
