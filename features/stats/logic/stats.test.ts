import { addDays } from '@/features/habits/logic/dates';
import {
  buildIndex, expectedOnDay, heatmap, historyLimit, levelFor, monthSeries, perHabit, perfectDays,
  percent, rangeFor, scoreRange, weekSeries, yearSeries, type StatHabit, type StatLog,
} from './stats';

const TODAY = '2026-11-18'; // Wednesday
const off = (n: number) => addDays(TODAY, -n);
const daily = (id: string, startOff = 100): StatHabit => ({
  id, name: id, color: '#000', cadence: { type: 'daily', config: {} }, startDate: off(startOff),
});
const done = (id: string, ...offs: number[]): StatLog[] => offs.map((o) => ({ habitId: id, date: off(o), status: 'done' }));

describe('expectedOnDay', () => {
  it('follows each cadence', () => {
    expect(expectedOnDay(daily('a'), TODAY)).toBe(1);
    const mwf: StatHabit = { ...daily('b'), cadence: { type: 'weekly_days', config: { days: [1, 3, 5] } } };
    expect(expectedOnDay(mwf, TODAY)).toBe(1); // Wednesday
    expect(expectedOnDay(mwf, off(1))).toBe(0); // Tuesday
    const x3: StatHabit = { ...daily('c'), cadence: { type: 'x_per_week', config: { times: 3 } } };
    expect(expectedOnDay(x3, TODAY)).toBeCloseTo(3 / 7);
    const every2: StatHabit = { ...daily('d'), cadence: { type: 'interval', config: { every_days: 2 } } };
    expect(expectedOnDay(every2, TODAY)).toBe(0.5);
  });

  it('is 0 before the habit started', () => {
    expect(expectedOnDay(daily('a', 3), off(4))).toBe(0);
  });
});

describe('scoreRange', () => {
  it('computes done / expected across habits', () => {
    const habits = [daily('a'), daily('b')];
    const idx = buildIndex([...done('a', 0, 1, 2), ...done('b', 0)]);
    const s = scoreRange(habits, idx, off(2), TODAY); // 3 days x 2 habits = 6 expected, 4 done
    expect(s).toEqual({ done: 4, expected: 6, rate: 4 / 6 });
  });

  it('returns rate null when nothing was expected (not 0%)', () => {
    const tue: StatHabit = { ...daily('t'), cadence: { type: 'weekly_days', config: { days: [2] } } };
    expect(scoreRange([tue], buildIndex([]), TODAY, TODAY).rate).toBeNull();
    expect(percent(null)).toBe('–');
  });

  it('only counts days on/after the start date', () => {
    const h = daily('a', 2); // started 2 days ago => 3 expected days (off2, off1, today)
    expect(scoreRange([h], buildIndex([]), off(10), TODAY).expected).toBe(3);
  });

  it('caps flexible habits at their expected amount', () => {
    const x3: StatHabit = { ...daily('x'), cadence: { type: 'x_per_week', config: { times: 3 } } };
    const idx = buildIndex(done('x', 0, 1, 2, 3, 4, 5, 6)); // done 7 times in a 7-day window
    const s = scoreRange([x3], idx, off(6), TODAY);
    expect(s.expected).toBeCloseTo(3);
    expect(s.done).toBeCloseTo(3);
    expect(s.rate).toBe(1);
  });

  it('ignores skipped/missed logs as completions', () => {
    const idx = buildIndex([{ habitId: 'a', date: TODAY, status: 'skipped' }]);
    expect(scoreRange([daily('a')], idx, TODAY, TODAY).done).toBe(0);
  });
});

describe('series', () => {
  const habits = [daily('a')];
  const idx = buildIndex(done('a', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));

  it('weekSeries: 7 days ending today, oldest first', () => {
    const s = weekSeries(habits, idx, TODAY);
    expect(s).toHaveLength(7);
    expect(s[6]).toMatchObject({ label: 'Wed', from: TODAY, to: TODAY, rate: 1 });
    expect(s[0]?.from).toBe(off(6));
  });

  it('monthSeries: 5 Monday-start weeks, current one partial', () => {
    const s = monthSeries(habits, idx, TODAY);
    expect(s).toHaveLength(5);
    expect(s[4]).toMatchObject({ from: '2026-11-16', to: TODAY }); // Monday .. Wednesday
    expect(s[0]?.from).toBe('2026-10-19');
  });

  it('yearSeries: 12 months ending this month, current one partial', () => {
    const s = yearSeries(habits, idx, TODAY);
    expect(s).toHaveLength(12);
    expect(s[0]).toMatchObject({ label: 'Dec', from: '2025-12-01', to: '2025-12-31' });
    expect(s[11]).toMatchObject({ label: 'Nov', from: '2026-11-01', to: TODAY });
    expect(s[10]).toMatchObject({ label: 'Oct', to: '2026-10-31' });
  });
});

describe('heatmap', () => {
  it('has 15 Monday-first week columns of 7 cells, flags the future', () => {
    const h = heatmap([daily('a')], buildIndex(done('a', 0)), TODAY);
    expect(h).toHaveLength(15);
    for (const col of h) expect(col).toHaveLength(7);
    const last = h[14]!;
    expect(last[0]?.date).toBe('2026-11-16'); // Monday
    expect(last[2]).toMatchObject({ date: TODAY, future: false, level: 4 });
    expect(last[3]).toMatchObject({ date: '2026-11-19', future: true });
  });
});

describe('levels, perfect days, range, limits', () => {
  it('levelFor thresholds', () => {
    expect(levelFor(null)).toBe(0);
    expect(levelFor(0)).toBe(0);
    expect(levelFor(0.2)).toBe(1);
    expect(levelFor(0.5)).toBe(2);
    expect(levelFor(0.8)).toBe(3);
    expect(levelFor(1)).toBe(4);
  });

  it('perfectDays counts only fully completed days', () => {
    const habits = [daily('a'), daily('b')];
    const idx = buildIndex([...done('a', 0, 1, 2), ...done('b', 0, 2)]);
    expect(perfectDays(habits, idx, off(2), TODAY)).toBe(2); // off(2) and today
  });

  it('perHabit sorts best first', () => {
    const idx = buildIndex(done('b', 0, 1));
    const rows = perHabit([daily('a'), daily('b')], idx, off(1), TODAY);
    expect(rows.map((r) => r.habit.id)).toEqual(['b', 'a']);
  });

  it('rangeFor and historyLimit', () => {
    expect(rangeFor('week', TODAY)).toEqual({ from: off(6), to: TODAY });
    expect(rangeFor('month', TODAY).from).toBe(off(29));
    expect(rangeFor('year', TODAY).from).toBe(off(364));
    expect(historyLimit(TODAY, false)).toBe(off(6));
    expect(historyLimit(TODAY, true)).toBeNull();
  });
});
