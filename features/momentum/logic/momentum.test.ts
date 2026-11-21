import { addDays } from '@/features/habits/logic/dates';
import type { Cadence } from '@/features/habits/logic/types';
import { evaluateExperiment } from './experiments';
import { generateInsights, confidenceFor } from './insights';
import { dayState, summarize, weekdayWeekendSplit } from './patterns';
import { recoveryFor, topRecovery } from './recovery';
import { describeTarget, minimumTarget, suggestForToday } from './suggestions';
import type { MHabit, MLog } from './types';

const TODAY = '2026-11-18'; // Wednesday
const daily: Cadence = { type: 'daily', config: {} };
const off = (n: number) => addDays(TODAY, -n);

const habit = (over: Partial<MHabit> = {}): MHabit => ({
  id: 'h1', name: 'Read', cadence: daily, startDate: off(120), archivedAt: null, targetValue: 20, unit: 'min', ...over,
});
const done = (offsets: number[], id = 'h1'): MLog[] => offsets.map((o) => ({ habitId: id, date: off(o), status: 'done' as const }));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('dayState', () => {
  const h = habit();
  it('distinguishes done, skipped, missed, upcoming', () => {
    const logs: MLog[] = [...done([1]), { habitId: 'h1', date: off(2), status: 'skipped' }];
    expect(dayState(h, logs, off(1), TODAY)).toBe('done');
    expect(dayState(h, logs, off(2), TODAY)).toBe('skipped');
    expect(dayState(h, logs, off(3), TODAY)).toBe('missed');
    expect(dayState(h, logs, TODAY, TODAY)).toBe('upcoming');
    expect(dayState(h, logs, addDays(TODAY, 1), TODAY)).toBe('upcoming');
  });
  it('days before the start date and off-schedule days are not_scheduled, never missed', () => {
    expect(dayState(habit({ startDate: off(0) }), [], off(3), TODAY)).toBe('not_scheduled');
    const mwf = habit({ cadence: { type: 'weekly_days', config: { days: [1] } } }); // Mondays
    expect(dayState(mwf, [], off(1), TODAY)).toBe('not_scheduled'); // Tuesday
  });
  it('flexible cadences are never "missed" per day', () => {
    expect(dayState(habit({ cadence: { type: 'x_per_week', config: { times: 3 } } }), [], off(2), TODAY)).toBe('not_scheduled');
  });
});

describe('summarize', () => {
  it('counts scheduled/done and excludes skipped from the denominator; ignores today', () => {
    const logs: MLog[] = [...done([1, 2, 3]), { habitId: 'h1', date: off(4), status: 'skipped' }];
    const r = summarize(habit(), logs, off(5), TODAY, TODAY);
    expect(r).toEqual({ scheduled: 5, done: 3, skipped: 1, rate: 3 / 4 });
  });
  it('returns null rate when nothing is countable', () => {
    expect(summarize(habit({ startDate: TODAY }), [], off(5), TODAY, TODAY).rate).toBeNull();
  });
});

describe('weekdayWeekendSplit', () => {
  it('splits correctly over 56 days (8 weekends)', () => {
    const s = weekdayWeekendSplit(habit(), [], TODAY, 56);
    expect(s.weekend.scheduled).toBe(16);
    expect(s.weekday.scheduled).toBe(40);
  });
});

describe('insights', () => {
  it('returns nothing without enough data', () => {
    expect(generateInsights([habit({ startDate: off(5) })], done([1, 2, 3]), TODAY)).toEqual([]);
  });

  it('reports a weekend gap with evidence, sample size and no causal claim', () => {
    // done every weekday, never on weekends, for the last 56 days
    const wk = range(1, 56).filter((o) => { const d = new Date(`${off(o)}T00:00:00Z`).getUTCDay(); return d !== 0 && d !== 6; });
    const ins = generateInsights([habit()], done(wk), TODAY).find((i) => i.id === 'weekend-gap:h1');
    expect(ins).toBeDefined();
    expect(ins?.observation).toMatch(/less often on weekends/);
    expect(ins?.evidence).toMatch(/0 of 16 weekend days \(0%\) vs 40 of 40 weekdays \(100%\)/);
    expect(ins?.sampleSize).toBe(56);
    expect(ins?.confidence).toBe('high');
    expect(`${ins?.observation} ${ins?.suggestedAction}`).not.toMatch(/because|caused/i);
  });

  it('does not report a gap when weekdays and weekends are similar', () => {
    expect(generateInsights([habit()], done(range(1, 56)), TODAY).find((i) => i.id.startsWith('weekend-gap'))).toBeUndefined();
  });

  it('detects an improving and a declining trend', () => {
    const up = generateInsights([habit()], done(range(1, 25)), TODAY).find((i) => i.id === 'trend-up:h1');
    expect(up?.evidence).toMatch(/up from/);
    const down = generateInsights([habit()], done(range(30, 56)), TODAY).find((i) => i.id === 'trend-down:h1');
    expect(down?.suggestedAction).toMatch(/nothing changes unless you edit/);
  });

  it('skips archived habits and qualifies confidence by sample size', () => {
    expect(generateInsights([habit({ archivedAt: '2026-01-01' })], done(range(1, 25)), TODAY)).toEqual([]);
    expect([confidenceFor(10), confidenceFor(20), confidenceFor(40)]).toEqual(['low', 'medium', 'high']);
  });
});

describe('suggestions', () => {
  it('minimumTarget is a quarter, at least 1, never above the target', () => {
    expect([minimumTarget(20), minimumTarget(8), minimumTarget(2), minimumTarget(1), minimumTarget(0)]).toEqual([5, 2, 1, 1, 1]);
    expect(describeTarget(5, 'min')).toBe('5 min');
    expect(describeTarget(5, null)).toBe('5');
  });
  it('light day suggests a smaller version without changing anything', () => {
    const s = suggestForToday([habit()], [], TODAY, 'light');
    expect(s.kind).toBe('light_day');
    expect(s.text).toMatch(/Read \(5 min\)/);
  });
  it('light day with no targets gives a generic light suggestion', () => {
    expect(suggestForToday([habit({ targetValue: 1 })], [], TODAY, 'light').text).toMatch(/easiest/);
  });
  it('says all done only when something was due and finished', () => {
    expect(suggestForToday([habit()], done([0]), TODAY, null).kind).toBe('all_done');
    expect(suggestForToday([], [], TODAY, null).kind).toBe('generic');
  });
  it('full day and default modes', () => {
    expect(suggestForToday([habit()], [], TODAY, 'full').kind).toBe('full_day');
    expect(suggestForToday([habit()], [], TODAY, 'normal').kind).toBe('generic');
  });
});

describe('recovery', () => {
  it('offers support after 3+ misses in the last 7 days, without touching history', () => {
    const logs = done([1, 2]);
    const p = recoveryFor(habit(), logs, TODAY);
    expect(p?.missed).toBe(5);
    expect(p?.actions.map((a) => a.id)).toEqual(['restart_smaller', 'adjust_schedule', 'review']);
    expect(p?.headline).not.toMatch(/fail|lazy|shame/i);
    expect(logs).toHaveLength(2);
  });
  it('stays quiet when things are fine, and skipped days are not misses', () => {
    expect(recoveryFor(habit(), done([1, 2, 3, 4, 5]), TODAY)).toBeNull();
    const skipped: MLog[] = [1, 2, 3, 4, 5, 6, 7].map((o) => ({ habitId: 'h1', date: off(o), status: 'skipped' as const }));
    expect(recoveryFor(habit(), skipped, TODAY)).toBeNull();
  });
  it('skips the smaller-target option when the target is already 1', () => {
    expect(recoveryFor(habit({ targetValue: 1 }), [], TODAY)?.actions.map((a) => a.id)).not.toContain('restart_smaller');
  });
  it('flags a weekly habit that cannot reach its target', () => {
    // Wednesday: today plus Thu-Sun = 5 chances left this Monday-start week.
    const reachable = habit({ cadence: { type: 'x_per_week', config: { times: 5 } } });
    expect(recoveryFor(reachable, [], TODAY)).toBeNull();
    const unreachable = habit({ cadence: { type: 'x_per_week', config: { times: 7 } } });
    expect(recoveryFor(unreachable, [], TODAY)?.actions[0]?.id).toBe('adjust_schedule');
  });
  it('topRecovery picks the habit with the most misses', () => {
    const a = habit({ id: 'a', name: 'A' });
    const b = habit({ id: 'b', name: 'B' });
    // a is done on 4 of the last 7 days (3 misses); b has no check-ins (7 misses).
    expect(topRecovery([a, b], done([1, 2, 3, 4], 'a'), TODAY)?.habitId).toBe('b');
    expect(topRecovery([a], done(range(1, 7), 'a'), TODAY)).toBeNull();
  });
});

describe('experiments', () => {
  const exp = { habitId: 'h1', startDate: off(14), durationDays: 14 };
  it('reports too_early with little data', () => {
    const r = evaluateExperiment(habit(), [], { ...exp, startDate: off(2) }, TODAY);
    expect(r.verdict).toBe('too_early');
  });
  it('compares against the equally long window before, and always includes a caveat', () => {
    // before (off 28..15): 3 of 14 done; during (off 14..1): 12 of 14 done
    const logs = [...done([20, 22, 25]), ...done(range(3, 14))];
    const r = evaluateExperiment(habit(), logs, exp, TODAY);
    expect(r.before.done).toBe(3);
    expect(r.during.done).toBe(12);
    expect(r.verdict).toBe('better');
    expect(r.deltaPoints).toBe(Math.round((12 / 14 - 3 / 14) * 100));
    expect(r.caveat).toMatch(/hint, not proof/);
  });
  it('says similar for small differences and worse for drops', () => {
    expect(evaluateExperiment(habit(), [...done(range(15, 28)), ...done(range(1, 14))], exp, TODAY).verdict).toBe('similar');
    expect(evaluateExperiment(habit(), done(range(15, 28)), exp, TODAY).verdict).toBe('worse');
  });
});
