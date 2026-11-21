/**
 * Calendar-date helpers. Dates are 'YYYY-MM-DD' strings in the user's LOCAL timezone, never
 * Date instants. All arithmetic goes through UTC midnight so DST shifts can't skip or repeat a day.
 */
export type DateStr = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's date on the device clock, in the device timezone. */
export function todayStr(now: Date = new Date()): DateStr {
  return toDateStr(now);
}

function parse(s: DateStr): number {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function format(ms: number): DateStr {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const DAY = 86_400_000;

export const addDays = (s: DateStr, n: number): DateStr => format(parse(s) + n * DAY);
export const diffDays = (a: DateStr, b: DateStr): number => Math.round((parse(a) - parse(b)) / DAY);

/** 0 = Sunday ... 6 = Saturday (matches Postgres extract(dow)). */
export const dayOfWeek = (s: DateStr): number => new Date(parse(s)).getUTCDay();

/** Monday of the week containing `s` (matches Postgres date_trunc('week')). */
export const weekStart = (s: DateStr): DateStr => addDays(s, -((dayOfWeek(s) + 6) % 7));

/** Inclusive list of dates from `from` to `to`. Empty if to < from. */
export function eachDay(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; diffDays(to, d) >= 0; d = addDays(d, 1)) out.push(d);
  return out;
}
