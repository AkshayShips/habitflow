import { addDays, diffDays, eachDay, weekStart, type DateStr } from './dates';
import { isScheduledOn } from './schedule';
import type { Cadence, LogEntry, StreakResult } from './types';

/**
 * Streak calculation. MUST stay in lock-step with public.recompute_streak() in
 * supabase/migrations/20261113000005_streaks.sql (same rules, same tests).
 *
 *  daily / weekly_days : consecutive scheduled days; 'skipped' and frozen days are neutral;
 *                        today not yet done never breaks the streak.
 *  x_per_week          : consecutive Monday-start weeks with >= times completions;
 *                        the current open week never breaks it.
 *  interval            : consecutive completions whose gap is <= every_days; resets to 0 once
 *                        today is more than every_days after the last completion.
 */
export interface StreakInput {
  cadence: Cadence;
  startDate: DateStr;
  logs: LogEntry[];
  /** Dates on which a streak freeze was used (applies to every habit). */
  freezeDates?: DateStr[];
  today: DateStr;
}

const MAX_LOOKBACK_DAYS = 3650;

export function computeStreak({ cadence, startDate, logs, freezeDates = [], today }: StreakInput): StreakResult {
  const done = new Set<DateStr>();
  const skipped = new Set<DateStr>();
  for (const l of logs) {
    if (l.status === 'done') done.add(l.date);
    else if (l.status === 'skipped') skipped.add(l.date);
  }
  const frozen = new Set(freezeDates);

  const doneDates = [...done].sort();
  const lastCompleted = doneDates.length > 0 ? (doneDates[doneDates.length - 1] as DateStr) : null;

  const earliestLog = logs.reduce<DateStr | null>((min, l) => (min === null || l.date < min ? l.date : min), null);
  let from = earliestLog !== null && earliestLog < startDate ? earliestLog : startDate;
  const floor = addDays(today, -MAX_LOOKBACK_DAYS);
  if (from < floor) from = floor;

  let run = 0;
  let longest = 0;

  switch (cadence.type) {
    case 'daily':
    case 'weekly_days': {
      for (const d of eachDay(from, today)) {
        if (cadence.type === 'weekly_days' && !isScheduledOn(cadence, d, '0000-01-01')) continue;
        if (done.has(d)) {
          run += 1;
          longest = Math.max(longest, run);
        } else if (skipped.has(d) || frozen.has(d)) {
          // protected day: neither adds nor breaks
        } else if (d === today) {
          // today is still in progress
        } else {
          run = 0;
        }
      }
      break;
    }

    case 'x_per_week': {
      const target = Math.max(cadence.config.times ?? 1, 1);
      const currentWeek = weekStart(today);
      for (let w = weekStart(from); diffDays(currentWeek, w) >= 0; w = addDays(w, 7)) {
        let count = 0;
        for (let i = 0; i < 7; i++) if (done.has(addDays(w, i))) count += 1;
        if (count >= target) {
          run += 1;
          longest = Math.max(longest, run);
        } else if (w === currentWeek) {
          // current week still open
        } else {
          run = 0;
        }
      }
      break;
    }

    case 'interval': {
      const gap = Math.max(cadence.config.every_days ?? 1, 1);
      let prev: DateStr | null = null;
      for (const d of doneDates) {
        run = prev === null || diffDays(d, prev) <= gap ? run + 1 : 1;
        longest = Math.max(longest, run);
        prev = d;
      }
      if (lastCompleted === null || diffDays(today, lastCompleted) > gap) run = 0;
      break;
    }
  }

  return { current: run, longest, lastCompleted };
}
