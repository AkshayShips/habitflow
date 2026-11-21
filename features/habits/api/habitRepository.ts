import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { todayStr, type DateStr } from '../logic/dates';
import type { Cadence, LogStatus } from '../logic/types';
import { habitInputSchema, parseStoredCadence, type HabitInput } from '../schemas/habit';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string | null;
  cadence: Cadence;
  targetValue: number;
  unit: string | null;
  startDate: DateStr;
  archivedAt: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface HabitLog {
  habitId: string;
  date: DateStr;
  status: LogStatus;
}

interface HabitRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string | null;
  cadence_type: string;
  cadence_config: string;
  target_value: number;
  unit: string | null;
  start_date: string;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
}

const HABIT_COLUMNS =
  'id, name, icon, color, category, cadence_type, cadence_config, target_value, unit, start_date, archived_at, sort_order, created_at';

const toHabit = (r: HabitRow): Habit => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  color: r.color,
  category: r.category,
  cadence: parseStoredCadence(r.cadence_type, r.cadence_config),
  targetValue: r.target_value,
  unit: r.unit,
  startDate: r.start_date,
  archivedAt: r.archived_at,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
});

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------
export async function listHabits(db: SQLiteDatabase): Promise<Habit[]> {
  const rows = await db.getAllAsync<HabitRow>(
    `SELECT ${HABIT_COLUMNS} FROM habits WHERE deleted_at IS NULL ORDER BY sort_order, created_at`,
  );
  return rows.map(toHabit);
}

export async function getHabit(db: SQLiteDatabase, id: string): Promise<Habit | null> {
  const row = await db.getFirstAsync<HabitRow>(
    `SELECT ${HABIT_COLUMNS} FROM habits WHERE id = ? AND deleted_at IS NULL`,
    id,
  );
  return row ? toHabit(row) : null;
}

export async function countActiveHabits(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM habits WHERE deleted_at IS NULL AND archived_at IS NULL',
  );
  return row?.n ?? 0;
}

export async function createHabit(db: SQLiteDatabase, input: HabitInput): Promise<Habit> {
  const data = habitInputSchema.parse(input);
  const id = Crypto.randomUUID();
  const now = nowIso();

  const max = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM habits WHERE deleted_at IS NULL',
  );

  await db.runAsync(
    `INSERT INTO habits (id, name, icon, color, category, cadence_type, cadence_config, target_value, unit,
                         start_date, sort_order, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    id,
    data.name,
    data.icon,
    data.color,
    data.category,
    data.cadence.type,
    JSON.stringify(data.cadence.config),
    data.targetValue,
    data.unit,
    todayStr(),
    (max?.m ?? -1) + 1,
    now,
    now,
  );

  const created = await getHabit(db, id);
  if (!created) throw new Error('Habit was not saved.');
  return created;
}

export async function updateHabit(db: SQLiteDatabase, id: string, input: HabitInput): Promise<void> {
  const data = habitInputSchema.parse(input);
  await db.runAsync(
    `UPDATE habits SET name = ?, icon = ?, color = ?, category = ?, cadence_type = ?, cadence_config = ?,
                       target_value = ?, unit = ?, updated_at = ?, dirty = 1
      WHERE id = ? AND deleted_at IS NULL`,
    data.name,
    data.icon,
    data.color,
    data.category,
    data.cadence.type,
    JSON.stringify(data.cadence.config),
    data.targetValue,
    data.unit,
    nowIso(),
    id,
  );
}

export async function setArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<void> {
  const now = nowIso();
  await db.runAsync(
    'UPDATE habits SET archived_at = ?, updated_at = ?, dirty = 1 WHERE id = ? AND deleted_at IS NULL',
    archived ? now : null,
    now,
    id,
  );
}

/** Soft delete: history is hidden but the tombstone can still sync. */
export async function deleteHabit(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE habits SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', now, now, id);
    await db.runAsync(
      'UPDATE habit_logs SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE habit_id = ? AND deleted_at IS NULL',
      now,
      now,
      id,
    );
  });
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------
export async function listLogs(db: SQLiteDatabase): Promise<HabitLog[]> {
  const rows = await db.getAllAsync<{ habit_id: string; log_date: string; status: LogStatus }>(
    `SELECT l.habit_id, l.log_date, l.status
       FROM habit_logs l JOIN habits h ON h.id = l.habit_id
      WHERE l.deleted_at IS NULL AND h.deleted_at IS NULL`,
  );
  return rows.map((r) => ({ habitId: r.habit_id, date: r.log_date, status: r.status }));
}

/** Sets a day's status, or clears it (status = null). One row per (habit, date). */
export async function setLog(
  db: SQLiteDatabase,
  habitId: string,
  date: DateStr,
  status: Exclude<LogStatus, 'missed'> | null,
): Promise<void> {
  const now = nowIso();
  if (status === null) {
    await db.runAsync(
      'UPDATE habit_logs SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE habit_id = ? AND log_date = ? AND deleted_at IS NULL',
      now,
      now,
      habitId,
      date,
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO habit_logs (id, habit_id, log_date, value, status, logged_at, updated_at, dirty)
     VALUES (?, ?, ?, 1, ?, ?, ?, 1)
     ON CONFLICT (habit_id, log_date) DO UPDATE
       SET status = excluded.status, deleted_at = NULL, logged_at = excluded.logged_at,
           updated_at = excluded.updated_at, dirty = 1`,
    Crypto.randomUUID(),
    habitId,
    date,
    status,
    now,
    now,
  );
}
