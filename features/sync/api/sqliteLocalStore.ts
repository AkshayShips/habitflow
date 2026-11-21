import type { SQLiteDatabase } from 'expo-sqlite';

import type { ApplyCount, Cursor, LocalStore, RemoteHabit, RemoteLog, SyncTable } from '../types';

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
