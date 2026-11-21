import { addDays, dayOfWeek, weekStart } from './dates';
import { computeStreak } from './streak';
import type { Cadence, LogEntry, LogStatus } from './types';

const TODAY = '2026-11-13'; // a Friday
const daily: Cadence = { type: 'daily', config: {} };
const off = (n: number) => addDays(TODAY, -n);
const logs = (offsets: number[], status: LogStatus = 'done'): LogEntry[] =>
  offsets.map((o) => ({ date: off(o), status }));

describe('dates', () => {
  it('computes weekday and Monday week start', () => {
    expect(dayOfWeek(TODAY)).toBe(5);
    expect(weekStart(TODAY)).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // Sunday belongs to the Monday-start week
  });

  it('is DST-safe across a clock change', () => {
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('daily streaks', () => {
  const base = { cadence: daily, startDate: off(10), today: TODAY };

  it('a miss resets the run; an unfinished today does not break it', () => {
    const r = computeStreak({ ...base, logs: logs([9, 8, 7, 5, 4, 3, 2, 1]) });
    expect(r).toEqual({ current: 5, longest: 5, lastCompleted: off(1) });
  });

  it('completing today extends the streak', () => {
    expect(computeStreak({ ...base, logs: logs([9, 8, 7, 5, 4, 3, 2, 1, 0]) }).current).toBe(6);
  });

  it('keeps longest after a later break', () => {
    const r = computeStreak({ ...base, logs: logs([9, 8, 7, 6, 5, 4, 1]) });
    expect(r.longest).toBe(6);
    expect(r.current).toBe(1);
  });

  it('skipped days are neutral', () => {
    const l = [...logs([9, 8, 7, 5, 4, 3, 2, 1]), ...logs([6], 'skipped')];
    expect(computeStreak({ ...base, logs: l }).current).toBe(8);
  });

  it('freeze days bridge a gap', () => {
    const r = computeStreak({ ...base, logs: logs([9, 8, 7, 5, 4, 3, 2, 1]), freezeDates: [off(6)] });
    expect(r.current).toBe(8);
  });

  it('missed status is treated as a miss', () => {
    const l = [...logs([9, 8, 7, 5, 4, 3, 2, 1]), ...logs([6], 'missed')];
    expect(computeStreak({ ...base, logs: l }).current).toBe(5);
  });

  it('is 0 with no logs', () => {
    expect(computeStreak({ ...base, logs: [] })).toEqual({ current: 0, longest: 0, lastCompleted: null });
  });
});

describe('weekly_days streaks', () => {
  it('only counts scheduled days (Mon/Wed/Fri)', () => {
    const cadence: Cadence = { type: 'weekly_days', config: { days: [1, 3, 5] } };
    const scheduled: number[] = [];
    for (let i = 1; i <= 14; i++) if ([1, 3, 5].includes(dayOfWeek(off(i)))) scheduled.push(i);
    const r = computeStreak({ cadence, startDate: off(14), logs: logs(scheduled), today: TODAY });
    expect(r.current).toBe(scheduled.length);
  });

  it('unscheduled days never break the streak', () => {
    const cadence: Cadence = { type: 'weekly_days', config: { days: [1] } };
    // Mondays: 2026-11-09, 11-02, 10-26
    const l: LogEntry[] = ['2026-11-09', '2026-11-02', '2026-10-26'].map((date) => ({ date, status: 'done' }));
    expect(computeStreak({ cadence, startDate: '2026-10-20', logs: l, today: TODAY }).current).toBe(3);
  });
});

describe('x_per_week streaks', () => {
  const cadence: Cadence = { type: 'x_per_week', config: { times: 2 } };
  const w0 = weekStart(TODAY);

  it('counts consecutive met weeks and ignores the open week', () => {
    const l: LogEntry[] = [];
    for (const wk of [7, 14, 21]) for (const d of [0, 1]) l.push({ date: addDays(w0, -wk + d), status: 'done' });
    const r = computeStreak({ cadence, startDate: addDays(w0, -28), logs: l, today: TODAY });
    expect(r).toMatchObject({ current: 3, longest: 3 });
  });

  it('an unmet past week resets the run', () => {
    const l: LogEntry[] = [
      { date: addDays(w0, -7), status: 'done' }, // only 1 of 2 last week
      { date: addDays(w0, -14), status: 'done' },
      { date: addDays(w0, -13), status: 'done' },
    ];
    const r = computeStreak({ cadence, startDate: addDays(w0, -14), logs: l, today: TODAY });
    expect(r).toMatchObject({ current: 0, longest: 1 });
  });

  it('the open week counts once the target is reached', () => {
    const l: LogEntry[] = [
      { date: w0, status: 'done' },
      { date: addDays(w0, 1), status: 'done' },
    ];
    expect(computeStreak({ cadence, startDate: w0, logs: l, today: TODAY }).current).toBe(1);
  });
});

describe('interval streaks', () => {
  const cadence: Cadence = { type: 'interval', config: { every_days: 3 } };
  const base = { cadence, startDate: off(12), today: TODAY };

  it('keeps the run while gaps are within the interval', () => {
    expect(computeStreak({ ...base, logs: logs([10, 8, 5, 3]) })).toMatchObject({ current: 4, longest: 4 });
  });

  it('lapses to 0 once today is past the interval, remembering longest', () => {
    expect(computeStreak({ ...base, logs: logs([6]) })).toMatchObject({ current: 0, longest: 1 });
  });

  it('a gap larger than the interval restarts the run', () => {
    expect(computeStreak({ ...base, logs: logs([11, 4, 3]) })).toMatchObject({ current: 2, longest: 2 });
  });
});
