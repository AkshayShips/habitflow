import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  ApplyCount,
  Cursor,
  LocalStore,
  RemoteEffortLevel,
  RemoteExperiment,
  RemoteHabit,
  RemoteJournalEntry,
  RemoteLog,
  SyncTable,
} from '../types';

type Db = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'>;

interface HabitDbRow {
  id: string; name: string; icon: string; color: string; category: string | null;
  cadence_type: RemoteHabit['cadence_type']; cadence_config: string; target_value: number;
  unit: string | null; start_date: string; archived_at: string | null; sort_order: number;
  reminder_times: string; created_at: string; updated_at: string; deleted_at: string | null;
}
interface LogDbRow {
  id: string; habit_id: string; log_date: string; value: number; status: RemoteLog['status'];
  note: string | null; mood: number | null; logged_at: string; updated_at: string; deleted_at: string | null;
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

const newer = (a: string, b: string) => Date.parse(a) >= Date.parse(b);

/** SQLite implementation of LocalStore. `userId` is stamped onto outgoing rows (the local DB is per-user). */
export class SqliteLocalStore implements LocalStore {
  constructor(private readonly db: Db, private readonly userId: string) {}

  private notIn(exclude: string[]): { clause: string; params: string[] } {
    if (exclude.length === 0) return { clause: '', params: [] };
    return { clause: ` AND id NOT IN (${exclude.map(() => '?').join(',')})`, params: exclude };
  }

  async getDirtyHabits(limit: number, exclude: string[]): Promise<RemoteHabit[]> {
    const { clause, params } = this.notIn(exclude);
    const rows = await this.db.getAllAsync<HabitDbRow>(
      `SELECT id, name, icon, color, category, cadence_type, cadence_config, target_value, unit, start_date,
              archived_at, sort_order, reminder_times, created_at, updated_at, deleted_at
         FROM habits WHERE dirty = 1${clause} ORDER BY updated_at, id LIMIT ?`,
      [...params, limit],
    );
    return rows.map((r) => ({
      ...r,
      user_id: this.userId,
      cadence_config: parseJson<Record<string, unknown>>(r.cadence_config, {}),
      reminder_times: parseJson<unknown[]>(r.reminder_times, []),
    }));
  }

  async getDirtyLogs(limit: number, exclude: string[]): Promise<RemoteLog[]> {
    const { clause, params } = this.notIn(exclude);
    const rows = await this.db.getAllAsync<LogDbRow>(
      `SELECT id, habit_id, log_date, value, status, note, mood, logged_at, updated_at, deleted_at
         FROM habit_logs WHERE dirty = 1${clause} ORDER BY updated_at, id LIMIT ?`,
      [...params, limit],
    );
    return rows.map((r) => ({ ...r, user_id: this.userId }));
  }

  async getDirtyEffortLevels(limit: number, exclude: string[]): Promise<RemoteEffortLevel[]> {
    const { clause, params } = this.notIn(exclude);
    const rows = await this.db.getAllAsync<Omit<RemoteEffortLevel, 'user_id'>>(
      `SELECT id, habit_id, level, target_value, created_at, updated_at, deleted_at
         FROM habit_effort_levels WHERE dirty = 1${clause} ORDER BY updated_at, id LIMIT ?`,
      [...params, limit],
    );
    return rows.map((r) => ({ ...r, user_id: this.userId }));
  }

  async getDirtyExperiments(limit: number, exclude: string[]): Promise<RemoteExperiment[]> {
    const { clause, params } = this.notIn(exclude);
    const rows = await this.db.getAllAsync<Omit<RemoteExperiment, 'user_id'>>(
      `SELECT id, habit_id, start_date, duration_days, baseline_target_value, trial_target_value, status, decided_at,
              created_at, updated_at, deleted_at
         FROM momentum_experiments WHERE dirty = 1${clause} ORDER BY updated_at, id LIMIT ?`,
      [...params, limit],
    );
    return rows.map((r) => ({ ...r, user_id: this.userId }));
  }

  async getDirtyJournal(limit: number, exclude: string[]): Promise<RemoteJournalEntry[]> {
    const { clause, params } = this.notIn(exclude);
    const rows = await this.db.getAllAsync<Omit<RemoteJournalEntry, 'user_id'>>(
      `SELECT id, entry_date, body, mood, created_at, updated_at, deleted_at
         FROM journal_entries WHERE dirty = 1${clause} ORDER BY updated_at, id LIMIT ?`,
      [...params, limit],
    );
    return rows.map((r) => ({ ...r, user_id: this.userId }));
  }

  async markPushed(table: SyncTable, rows: { id: string; updated_at: string }[]): Promise<void> {
    // Table name comes from a closed union, never from user input.
    await this.db.withTransactionAsync(async () => {
      for (const r of rows) {
        await this.db.runAsync(`UPDATE ${table} SET dirty = 0 WHERE id = ? AND updated_at = ?`, [r.id, r.updated_at]);
      }
    });
  }

  async applyRemoteHabits(rows: RemoteHabit[]): Promise<ApplyCount> {
    const count: ApplyCount = { applied: 0, skipped: 0 };
    await this.db.withTransactionAsync(async () => {
      for (const r of rows) {
        const ex = await this.db.getFirstAsync<{ updated_at: string; dirty: number }>(
          'SELECT updated_at, dirty FROM habits WHERE id = ?',
          [r.id],
        );
        // Local unsynced edit that is at least as new as the server's wins; it gets pushed next pass.
        if (ex && ex.dirty === 1 && newer(ex.updated_at, r.updated_at)) {
          count.skipped += 1;
          continue;
        }
        await this.db.runAsync(
          `INSERT INTO habits (id, name, icon, color, category, cadence_type, cadence_config, target_value, unit,
                               start_date, archived_at, sort_order, reminder_times, created_at, updated_at, deleted_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
           ON CONFLICT (id) DO UPDATE SET
             name = excluded.name, icon = excluded.icon, color = excluded.color, category = excluded.category,
             cadence_type = excluded.cadence_type, cadence_config = excluded.cadence_config,
             target_value = excluded.target_value, unit = excluded.unit, start_date = excluded.start_date,
             archived_at = excluded.archived_at, sort_order = excluded.sort_order,
             reminder_times = excluded.reminder_times, updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at, dirty = 0`,
          [
            r.id, r.name, r.icon, r.color, r.category, r.cadence_type, JSON.stringify(r.cadence_config),
            r.target_value, r.unit, r.start_date, r.archived_at, r.sort_order, JSON.stringify(r.reminder_times),
            r.created_at, r.updated_at, r.deleted_at,
          ],
        );
        count.applied += 1;
      }
    });
    return count;
  }

  async applyRemoteLogs(rows: RemoteLog[]): Promise<ApplyCount> {
    const count: ApplyCount = { applied: 0, skipped: 0 };
    await this.db.withTransactionAsync(async () => {
      for (const r of rows) {
        const parent = await this.db.getFirstAsync<{ id: string }>('SELECT id FROM habits WHERE id = ?', [r.habit_id]);
        if (!parent) {
          count.skipped += 1; // parent habit unknown locally (can't satisfy the foreign key)
          continue;
        }

        // A log's identity is (habit_id, log_date); two devices may have created it with different ids.
        let ex = await this.db.getFirstAsync<{ id: string; updated_at: string; dirty: number }>(
          'SELECT id, updated_at, dirty FROM habit_logs WHERE habit_id = ? AND log_date = ?',
          [r.habit_id, r.log_date],
        );
        let matchedById = false;
        if (!ex) {
          ex = await this.db.getFirstAsync<{ id: string; updated_at: string; dirty: number }>(
            'SELECT id, updated_at, dirty FROM habit_logs WHERE id = ?',
            [r.id],
          );
          matchedById = ex !== null;
        }

        if (ex && ex.dirty === 1 && newer(ex.updated_at, r.updated_at)) {
          count.skipped += 1;
          continue;
        }

        if (ex) {
          await this.db.runAsync(
            `UPDATE habit_logs SET id = ?, habit_id = ?, log_date = ?, value = ?, status = ?, note = ?, mood = ?,
                    logged_at = ?, updated_at = ?, deleted_at = ?, dirty = 0
              WHERE id = ?`,
            [r.id, r.habit_id, r.log_date, r.value, r.status, r.note, r.mood, r.logged_at, r.updated_at, r.deleted_at, ex.id],
          );
        } else {
          await this.db.runAsync(
            `INSERT INTO habit_logs (id, habit_id, log_date, value, status, note, mood, logged_at, updated_at, deleted_at, dirty)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [r.id, r.habit_id, r.log_date, r.value, r.status, r.note, r.mood, r.logged_at, r.updated_at, r.deleted_at],
          );
        }
        void matchedById;
        count.applied += 1;
      }
    });
    return count;
  }

  /** Identity of an effort level is (habit_id, level); two devices may have created it with different ids. */
  async applyRemoteEffortLevels(rows: RemoteEffortLevel[]): Promise<ApplyCount> {
    const count: ApplyCount = { applied: 0, skipped: 0 };
    await this.db.withTransactionAsync(async () => {
      for (const r of rows) {
        const parent = await this.db.getFirstAsync<{ id: string }>('SELECT id FROM habits WHERE id = ?', [r.habit_id]);
        if (!parent) {
          count.skipped += 1;
          continue;
        }
        let ex = await this.db.getFirstAsync<{ id: string; updated_at: string; dirty: number }>(
          'SELECT id, updated_at, dirty FROM habit_effort_levels WHERE habit_id = ? AND level = ?',
          [r.habit_id, r.level],
        );
        if (!ex) {
          ex = await this.db.getFirstAsync<{ id: string; updated_at: string; dirty: number }>(
            'SELECT id, updated_at, dirty FROM habit_effort_levels WHERE id = ?',
            [r.id],
          );
        }
        if (ex && ex.dirty === 1 && newer(ex.updated_at, r.updated_at)) {
          count.skipped += 1;
          continue;
        }
        try {
          if (ex) {
            await this.db.runAsync(
              `UPDATE habit_effort_levels SET id = ?, habit_id = ?, level = ?, target_value = ?, updated_at = ?,
                      deleted_at = ?, dirty = 0 WHERE id = ?`,
              [r.id, r.habit_id, r.level, r.target_value, r.updated_at, r.deleted_at, ex.id],
            );
          } else {
            await this.db.runAsync(
              `INSERT INTO habit_effort_levels (id, habit_id, level, target_value, created_at, updated_at, deleted_at, dirty)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
              [r.id, r.habit_id, r.level, r.target_value, r.created_at, r.updated_at, r.deleted_at],
            );
          }
          count.applied += 1;
        } catch {
          count.skipped += 1; // a bad row must not abort the whole page (the cursor would never advance)
        }
      }
    });
    return count;
  }

  async applyRemoteExperiments(rows: RemoteExperiment[]): Promise<ApplyCount> {
    const count: ApplyCount = { applied: 0, skipped: 0 };
    await this.db.withTransactionAsync(async () => {
      for (const r of rows) {
        const parent = await this.db.getFirstAsync<{ id: string }>('SELECT id FROM habits WHERE id = ?', [r.habit_id]);
        if (!parent) {
          count.skipped += 1;
          continue;
        }
        const ex = await this.db.getFirstAsync<{ updated_at: string; dirty: number }>(
          'SELECT updated_at, dirty FROM momentum_experiments WHERE id = ?',
          [r.id],
        );
        if (ex && ex.dirty === 1 && newer(ex.updated_at, r.updated_at)) {
          count.skipped += 1;
          continue;
        }
        try {
          await this.db.runAsync(
            `INSERT INTO momentum_experiments (id, habit_id, start_date, duration_days, baseline_target_value,
                    trial_target_value, status, decided_at, created_at, updated_at, deleted_at, dirty)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
             ON CONFLICT (id) DO UPDATE SET
               habit_id = excluded.habit_id, start_date = excluded.start_date, duration_days = excluded.duration_days,
               baseline_target_value = excluded.baseline_target_value, trial_target_value = excluded.trial_target_value,
               status = excluded.status, decided_at = excluded.decided_at, updated_at = excluded.updated_at,
               deleted_at = excluded.deleted_at, dirty = 0`,
            [
              r.id, r.habit_id, r.start_date, r.duration_days, r.baseline_target_value, r.trial_target_value,
              r.status, r.decided_at, r.created_at, r.updated_at, r.deleted_at,
            ],
          );
          count.applied += 1;
        } catch {
          count.skipped += 1; // e.g. a second "running" experiment for the same habit
        }
      }
    });
    return count;
  }

  /** Identity of a journal entry is its date; two devices may have created it with different ids. */
  async applyRemoteJournal(rows: RemoteJournalEntry[]): Promise<ApplyCount> {
    const count: ApplyCount = { applied: 0, skipped: 0 };
    await this.db.withTransactionAsync(async () => {
      for (const r of rows) {
        let ex = await this.db.getFirstAsync<{ id: string; updated_at: string; dirty: number }>(
          'SELECT id, updated_at, dirty FROM journal_entries WHERE entry_date = ?',
          [r.entry_date],
        );
        if (!ex) {
          ex = await this.db.getFirstAsync<{ id: string; updated_at: string; dirty: number }>(
            'SELECT id, updated_at, dirty FROM journal_entries WHERE id = ?',
            [r.id],
          );
        }
        if (ex && ex.dirty === 1 && newer(ex.updated_at, r.updated_at)) {
          count.skipped += 1;
          continue;
        }
        try {
          if (ex) {
            await this.db.runAsync(
              `UPDATE journal_entries SET id = ?, entry_date = ?, body = ?, mood = ?, updated_at = ?, deleted_at = ?, dirty = 0
                WHERE id = ?`,
              [r.id, r.entry_date, r.body, r.mood, r.updated_at, r.deleted_at, ex.id],
            );
          } else {
            await this.db.runAsync(
              `INSERT INTO journal_entries (id, entry_date, body, mood, created_at, updated_at, deleted_at, dirty)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
              [r.id, r.entry_date, r.body, r.mood, r.created_at, r.updated_at, r.deleted_at],
            );
          }
          count.applied += 1;
        } catch {
          count.skipped += 1;
        }
      }
    });
    return count;
  }

  async getCursor(table: SyncTable): Promise<Cursor | null> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [`cursor:${table}`]);
    return row ? parseJson<Cursor | null>(row.value, null) : null;
  }

  async setCursor(table: SyncTable, cursor: Cursor): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [`cursor:${table}`, JSON.stringify(cursor)],
    );
  }
}
