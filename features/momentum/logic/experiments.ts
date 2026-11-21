import { addDays, diffDays, type DateStr } from '@/features/habits/logic/dates';
import { summarize, type RateSummary } from './patterns';
import type { MHabit, MLog } from './types';

export interface Experiment {
  habitId: string;
  /** First day of the trial (inclusive). */
  startDate: DateStr;
  durationDays: number;
}

export type Verdict = 'too_early' | 'better' | 'similar' | 'worse';

export interface ExperimentResult {
  before: RateSummary;
  during: RateSummary;
  /** Percentage points, during minus before. null when either side has no data. */
  deltaPoints: number | null;
  verdict: Verdict;
  daysElapsed: number;
  /** Always shown with the result: what this can and cannot tell you. */
  caveat: string;
}

/**
 * Compares completion during the trial with an equally long window right before it. Descriptive only: it does not
 * say the change caused anything. Original history is untouched; this just reads the log.
 */
export function evaluateExperiment(habit: MHabit, logs: MLog[], exp: Experiment, today: DateStr): ExperimentResult {
  const trialEnd = addDays(exp.startDate, exp.durationDays - 1);
  const duringTo = trialEnd < addDays(today, -1) ? trialEnd : addDays(today, -1);
  const during = summarize(habit, logs, exp.startDate, duringTo, today);
  const before = summarize(habit, logs, addDays(exp.startDate, -exp.durationDays), addDays(exp.startDate, -1), today);
  const daysElapsed = Math.max(0, Math.min(exp.durationDays, diffDays(today, exp.startDate)));

  const enough = during.scheduled - during.skipped >= 5 && before.scheduled - before.skipped >= 5;
  const deltaPoints = during.rate !== null && before.rate !== null ? Math.round((during.rate - before.rate) * 100) : null;
  let verdict: Verdict = 'too_early';
  if (enough && deltaPoints !== null && daysElapsed >= Math.min(exp.durationDays, 7)) {
    verdict = deltaPoints >= 10 ? 'better' : deltaPoints <= -10 ? 'worse' : 'similar';
  }
  return {
    before,
    during,
    deltaPoints,
    verdict,
    daysElapsed,
    caveat: 'A short trial is a small sample, and many things change from week to week. Treat this as a hint, not proof.',
  };
}
