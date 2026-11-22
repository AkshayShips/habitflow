import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import type { EffortLevelName, ExperimentStatus } from '@/features/sync/types';

type Db = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'>;

export interface EffortLevel {
  habitId: string;
  level: EffortLevelName;
  targetValue: number;
}

export interface Experiment {
  id: string;
  habitId: string;
  startDate: string;
  durationDays: number;
  baselineTargetValue: number;
  trialTargetValue: number;
  status: ExperimentStatus;
  decidedAt: string | null;
}

const now = () => new Date().toISOString();

export async function listEffortLevels(db: Db): Promise<EffortLevel[]> {
  const rows = await db.getAllAsync<{ habit_id: string; level: EffortLevelName; target_value: number }>(
    'SELECT habit_id, level, target_value FROM habit_effort_levels WHERE deleted_at IS NULL',
  );
  return rows.map((r) => ({ habitId: r.habit_id, level: r.level, targetValue: r.target_value }));
}

/** Creates or updates (and revives, if previously removed) the user's target for one level of one habit. */
export async function setEffortLevel(db: Db, habitId: string, level: EffortLevelName, targetValue: number): Promise<void> {
  if (!(targetValue > 0)) throw new Error('Target must be greater than zero.');
  const at = now();
  await db.runAsync(
    `INSERT INTO habit_effort_levels (id, habit_id, level, target_value, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT (habit_id, level) DO UPDATE SET target_value = excluded.target_value, deleted_at = NULL,
       updated_at = excluded.updated_at, dirty = 1`,
    [Crypto.randomUUID(), habitId, level, targetValue, at, at],
  );
}

export async function clearEffortLevel(db: Db, habitId: string, level: EffortLevelName): Promise<void> {
  const at = now();
  await db.runAsync(
    'UPDATE habit_effort_levels SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE habit_id = ? AND level = ? AND deleted_at IS NULL',
    [at, at, habitId, level],
  );
}

interface ExpRow {
  id: string; habit_id: string; start_date: string; duration_days: number; baseline_target_value: number;
  trial_target_value: number; status: ExperimentStatus; decided_at: string | null;
}
const toExperiment = (r: ExpRow): Experiment => ({
  id: r.id, habitId: r.habit_id, startDate: r.start_date, durationDays: r.duration_days,
  baselineTargetValue: r.baseline_target_value, trialTargetValue: r.trial_target_value,
  status: r.status, decidedAt: r.decided_at,
});

export async function listExperiments(db: Db): Promise<Experiment[]> {
  const rows = await db.getAllAsync<ExpRow>(
    `SELECT id, habit_id, start_date, duration_days, baseline_target_value, trial_target_value, status, decided_at
       FROM momentum_experiments WHERE deleted_at IS NULL ORDER BY start_date DESC`,
  );
  return rows.map(toExperiment);
}

/** Starts a trial. Only one may run per habit; the habit itself is NOT changed until the user chooses to keep it. */
export async function startExperiment(
  db: Db,
  input: { habitId: string; startDate: string; durationDays: number; baselineTargetValue: number; trialTargetValue: number },
): Promise<Experiment> {
  const running = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM momentum_experiments WHERE habit_id = ? AND status = 'running' AND deleted_at IS NULL",
    [input.habitId],
  );
  if (running) throw new Error('This habit already has a running experiment.');
  const id = Crypto.randomUUID();
  const at = now();
  await db.runAsync(
    `INSERT INTO momentum_experiments (id, habit_id, start_date, duration_days, baseline_target_value,
            trial_target_value, status, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, 1)`,
    [id, input.habitId, input.startDate, input.durationDays, input.baselineTargetValue, input.trialTargetValue, at, at],
  );
  return {
    id, habitId: input.habitId, startDate: input.startDate, durationDays: input.durationDays,
    baselineTargetValue: input.baselineTargetValue, trialTargetValue: input.trialTargetValue, status: 'running', decidedAt: null,
  };
}

/** Records the user's decision. Applying a kept target to the habit is a separate, explicit habit edit. */
export async function decideExperiment(db: Db, id: string, decision: 'kept' | 'discarded'): Promise<void> {
  const at = now();
  await db.runAsync(
    "UPDATE momentum_experiments SET status = ?, decided_at = ?, updated_at = ?, dirty = 1 WHERE id = ? AND status = 'running'",
    [decision, at, at, id],
  );
}

/**
 * The user chose to keep the trial target: records the decision AND updates the habit's target in one transaction,
 * so the two can never disagree. Past logs are not touched.
 */
export async function keepExperiment(db: Db, experimentId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    const exp = await db.getFirstAsync<{ habit_id: string; trial_target_value: number }>(
      "SELECT habit_id, trial_target_value FROM momentum_experiments WHERE id = ? AND status = 'running' AND deleted_at IS NULL",
      [experimentId],
    );
    if (!exp) return;
    const at = now();
    await db.runAsync(
      "UPDATE momentum_experiments SET status = 'kept', decided_at = ?, updated_at = ?, dirty = 1 WHERE id = ?",
      [at, at, experimentId],
    );
    await db.runAsync('UPDATE habits SET target_value = ?, updated_at = ?, dirty = 1 WHERE id = ? AND deleted_at IS NULL', [
      exp.trial_target_value, at, exp.habit_id,
    ]);
  });
}
