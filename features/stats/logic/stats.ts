import { addDays, dayOfWeek, diffDays, weekStart, type DateStr } from '@/features/habits/logic/dates';
import type { Cadence } from '@/features/habits/logic/types';

/**
 * Completion statistics, computed locally from habits + logs (works offline, no server round trip).
 * Rules mirror the server views/Life Score (supabase/migrations/..0006) so numbers agree:
 *   expected per day: daily 1 | weekly_days 1 on chosen days | x_per_week times/7 | interval 1/every_days
 *   per habit, done is capped at expected;  rate = sum(capped done) / sum(expected)
 * Only ACTIVE (non-archived) habits are passed in by callers.
 */
export interface StatHabit {
  id: string;
  name: string;
  color: string;
  cadence: Cadence;
  startDate: DateStr;
}

export interface StatLog {
  habitId: string;
  date: DateStr;
  status: 'done' | 'skipped' | 'missed';
}

export type Period = 'week' | 'month' | 'year';

export interface Score {
  done: number;
  expected: number;
  /** null when nothing was expected (e.g. a rest day), so the UI can show "no data" not "0%". */
  rate: number | null;
}

export interface Bucket extends Score {
  label: string;
  from: DateStr;
  to: DateStr;
}

export type DoneIndex = Map<string, Set<DateStr>>;

export function buildIndex(logs: StatLog[]): DoneIndex {
  const idx: DoneIndex = new Map();
  for (const l of logs) {
    if (l.status !== 'done') continue;
    const set = idx.get(l.habitId);
    if (set) set.add(l.date);
    else idx.set(l.habitId, new Set([l.date]));
  }
  return idx;
}

export function expectedOnDay(h: StatHabit, date: DateStr): number {
  if (date < h.startDate) return 0;
  switch (h.cadence.type) {
    case 'daily':
      return 1;
    case 'weekly_days':
      return (h.cadence.config.days ?? []).includes(dayOfWeek(date)) ? 1 : 0;
    case 'x_per_week':
      return Math.max(h.cadence.config.times ?? 1, 1) / 7;
    case 'interval':
      return 1 / Math.max(h.cadence.config.every_days ?? 1, 1);
  }
}

function habitRange(h: StatHabit, index: DoneIndex, from: DateStr, to: DateStr): { done: number; expected: number } {
  const start = from < h.startDate ? h.startDate : from;
  if (diffDays(to, start) < 0) return { done: 0, expected: 0 };
  const doneSet = index.get(h.id);
  let expected = 0;
  let done = 0;
  for (let d = start; diffDays(to, d) >= 0; d = addDays(d, 1)) {
    expected += expectedOnDay(h, d);
    if (doneSet?.has(d)) done += 1;
  }
  return { done: Math.min(done, expected), expected };
}

export function scoreRange(habits: StatHabit[], index: DoneIndex, from: DateStr, to: DateStr): Score {
  let done = 0;
  let expected = 0;
  for (const h of habits) {
    const r = habitRange(h, index, from, to);
    done += r.done;
    expected += r.expected;
  }
  return { done, expected, rate: expected > 0 ? Math.min(1, done / expected) : null };
}

export function perHabit(habits: StatHabit[], index: DoneIndex, from: DateStr, to: DateStr) {
  return habits
    .map((h) => {
      const r = habitRange(h, index, from, to);
      return { habit: h, ...r, rate: r.expected > 0 ? Math.min(1, r.done / r.expected) : null };
    })
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
}

/** Days in [from, to] where something was expected and everything expected was completed. */
export function perfectDays(habits: StatHabit[], index: DoneIndex, from: DateStr, to: DateStr): number {
  let n = 0;
  for (let d = from; diffDays(to, d) >= 0; d = addDays(d, 1)) {
    const s = scoreRange(habits, index, d, d);
    // Fractional (flexible) habits can't make a single day "imperfect", so only count scheduled-day habits.
    if (s.expected > 0 && s.rate !== null && s.rate >= 0.999) n += 1;
  }
  return n;
}

export function rangeFor(period: Period, today: DateStr): { from: DateStr; to: DateStr } {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
  return { from: addDays(today, -(days - 1)), to: today };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekSeries(habits: StatHabit[], index: DoneIndex, today: DateStr): Bucket[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return { label: WEEKDAYS[dayOfWeek(d)] as string, from: d, to: d, ...scoreRange(habits, index, d, d) };
  });
}

/** Last 5 Monday-start weeks, the current one partial. */
export function monthSeries(habits: StatHabit[], index: DoneIndex, today: DateStr): Bucket[] {
  const current = weekStart(today);
  return Array.from({ length: 5 }, (_, i) => {
    const from = addDays(current, (i - 4) * 7);
    const to = i === 4 ? today : addDays(from, 6);
    const [, m, day] = from.split('-');
    return { label: `${MONTHS[Number(m) - 1]} ${Number(day)}`, from, to, ...scoreRange(habits, index, from, to) };
  });
}

/** Last 12 calendar months, the current one partial. */
export function yearSeries(habits: StatHabit[], index: DoneIndex, today: DateStr): Bucket[] {
  const [ty, tm] = today.split('-').map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, i) => {
    const offset = i - 11;
    const total = ty * 12 + (tm - 1) + offset;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const nextMonthStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const monthEnd = addDays(nextMonthStart, -1);
    const to = monthEnd > today ? today : monthEnd;
    return { label: MONTHS[m - 1] as string, from, to, ...scoreRange(habits, index, from, to) };
  });
}

export type Level = 0 | 1 | 2 | 3 | 4;

/** 0 = nothing expected / nothing done; 4 = everything done. */
export function levelFor(rate: number | null): Level {
  if (rate === null || rate <= 0) return 0;
  if (rate < 0.34) return 1;
  if (rate < 0.67) return 2;
  if (rate < 0.999) return 3;
  return 4;
}

export interface HeatCell {
  date: DateStr;
  rate: number | null;
  level: Level;
  future: boolean;
}

/** Columns are Monday-start weeks (oldest first); each has 7 cells Mon..Sun. */
export function heatmap(habits: StatHabit[], index: DoneIndex, today: DateStr, weeks = 15): HeatCell[][] {
  const lastWeek = weekStart(today);
  return Array.from({ length: weeks }, (_, w) => {
    const start = addDays(lastWeek, (w - (weeks - 1)) * 7);
    return Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, d);
      if (date > today) return { date, rate: null, level: 0 as Level, future: true };
      const { rate } = scoreRange(habits, index, date, date);
      return { date, rate, level: levelFor(rate), future: false };
    });
  });
}

/**
 * Free plan sees only the last 7 days of history. Returns the oldest visible date, or null if unlimited.
 * (Section 7 of the product spec: "7-day stats history".)
 */
export function historyLimit(today: DateStr, isPro: boolean): DateStr | null {
  return isPro ? null : addDays(today, -6);
}

export const percent = (rate: number | null) => (rate === null ? '–' : `${Math.round(rate * 100)}%`);
