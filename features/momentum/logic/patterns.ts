import { addDays, dayOfWeek, eachDay, type DateStr } from '@/features/habits/logic/dates';
import { isScheduledOn } from '@/features/habits/logic/schedule';
import type { DayState, MHabit, MLog } from './types';

/**
 * Habits whose expected days are fixed by the calendar. x_per_week and interval habits are "available" every day,
 * so a day without a log is not a miss; we don't count them in per-day rates.
 */
export const hasFixedSchedule = (h: Pick<MHabit, 'cadence'>): boolean =>
  h.cadence.type === 'daily' || h.cadence.type === 'weekly_days';

export function dayState(habit: MHabit, logs: MLog[], date: DateStr, today: DateStr): DayState {
  const entry = logs.find((l) => l.habitId === habit.id && l.date === date);
  if (entry?.status === 'done') return 'done';
  if (entry?.status === 'skipped') return 'skipped';
  if (!hasFixedSchedule(habit) || !isScheduledOn(habit.cadence, date, habit.startDate)) return 'not_scheduled';
  if (date > today) return 'upcoming';
  if (date === today) return 'upcoming'; // today is still open; never called a miss
  return 'missed';
}

export interface RateSummary {
  scheduled: number;
  done: number;
  skipped: number;
  /** done / (scheduled - skipped), or null if nothing countable. Skipped days are deliberate, so they don't count against you. */
  rate: number | null;
}

/** Completion over [from, to] (inclusive, capped at yesterday so an unfinished today isn't counted). */
export function summarize(habit: MHabit, logs: MLog[], from: DateStr, to: DateStr, today: DateStr): RateSummary {
  const end = to < addDays(today, -1) ? to : addDays(today, -1);
  const mine = new Map(logs.filter((l) => l.habitId === habit.id).map((l) => [l.date, l.status]));
  let scheduled = 0;
  let done = 0;
  let skipped = 0;
  if (hasFixedSchedule(habit) && from <= end) {
    for (const d of eachDay(from, end)) {
      if (!isScheduledOn(habit.cadence, d, habit.startDate)) continue;
      scheduled++;
      const s = mine.get(d);
      if (s === 'done') done++;
      else if (s === 'skipped') skipped++;
    }
  }
  const countable = scheduled - skipped;
  return { scheduled, done, skipped, rate: countable > 0 ? done / countable : null };
}

const isWeekend = (d: DateStr) => {
  const w = dayOfWeek(d);
  return w === 0 || w === 6;
};

export interface WeekdaySplit {
  weekend: RateSummary;
  weekday: RateSummary;
}

/** Weekend vs weekday completion over the last `days` days (ending yesterday). */
export function weekdayWeekendSplit(habit: MHabit, logs: MLog[], today: DateStr, days: number): WeekdaySplit {
  const to = addDays(today, -1);
  const from = addDays(today, -days);
  const mine = new Map(logs.filter((l) => l.habitId === habit.id).map((l) => [l.date, l.status]));
  const blank = (): RateSummary => ({ scheduled: 0, done: 0, skipped: 0, rate: null });
  const out = { weekend: blank(), weekday: blank() };
  if (!hasFixedSchedule(habit)) return out;
  for (const d of eachDay(from, to)) {
    if (!isScheduledOn(habit.cadence, d, habit.startDate)) continue;
    const bucket = isWeekend(d) ? out.weekend : out.weekday;
    bucket.scheduled++;
    const s = mine.get(d);
    if (s === 'done') bucket.done++;
    else if (s === 'skipped') bucket.skipped++;
  }
  for (const b of [out.weekend, out.weekday]) {
    const c = b.scheduled - b.skipped;
    b.rate = c > 0 ? b.done / c : null;
  }
  return out;
}
