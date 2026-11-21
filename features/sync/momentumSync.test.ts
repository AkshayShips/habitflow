import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/lib/localMigrations';
import {
  clearEffortLevel, decideExperiment, listEffortLevels, listExperiments, setEffortLevel, startExperiment,
} from '@/features/momentum/api/momentumRepository';
import { adapt, Device, FakeServer, H1, t } from './testing/harness';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
});

const setup = () => {
  const server = new FakeServer();
  const a = new Device('A', server);
  const b = new Device('B', server);
  return { server, a, b, dbA: adapt(a.raw) as never, dbB: adapt(b.raw) as never };
};

describe('local migration v3', () => {
  it('upgrades an existing v2 database without touching habits or logs', () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec('PRAGMA foreign_keys = ON;');
    for (const m of MIGRATIONS.slice(0, 2)) raw.exec(m);
    raw.prepare("INSERT INTO habits (id, name, start_date, created_at, updated_at) VALUES ('h','Read','2026-11-01','x','x')").run();
    raw.prepare("INSERT INTO habit_logs (id, habit_id, log_date, logged_at, updated_at) VALUES ('l','h','2026-11-02','x','x')").run();
    for (const m of MIGRATIONS.slice(2)) raw.exec(m);
    expect((raw.prepare('SELECT COUNT(*) AS n FROM habits').get() as { n: number }).n).toBe(1);
    expect((raw.prepare('SELECT COUNT(*) AS n FROM habit_logs').get() as { n: number }).n).toBe(1);
    expect(raw.prepare("SELECT name FROM sqlite_master WHERE name = 'habit_effort_levels'").get()).toBeDefined();
  });
});

describe('Adaptive Momentum sync', () => {
  it('effort levels converge across two devices', async () => {
    const { a, b, dbA, dbB } = setup();
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    await b.sync();
    await setEffortLevel(dbA, H1, 'minimum', 2);
    await setEffortLevel(dbA, H1, 'extended', 30);
    const r = await a.sync();
    expect(r.pushed).toBe(2);
    await b.sync();
    const levels = await listEffortLevels(dbB);
    expect(levels.map((l) => `${l.level}:${l.targetValue}`).sort()).toEqual(['extended:30', 'minimum:2']);
    expect(a.dirtyMomentum()).toBe(0);
  });

  it('is idempotent: a second pass moves nothing', async () => {
    const { a, dbA } = setup();
    a.addHabit(H1, 'Read', t(1));
    await setEffortLevel(dbA, H1, 'minimum', 2);
    await a.sync();
    const again = await a.sync();
    expect(again.pushed).toBe(0);
    expect(again.pulled).toBe(0);
  });

  it('removing and re-adding a level reuses the same row and propagates', async () => {
    const { a, b, dbA, dbB } = setup();
    a.addHabit(H1, 'Read', t(1));
    await setEffortLevel(dbA, H1, 'minimum', 2);
    await a.sync();
    await b.sync();
    await clearEffortLevel(dbA, H1, 'minimum');
    await a.sync();
    await b.sync();
    expect(await listEffortLevels(dbB)).toEqual([]);
    await setEffortLevel(dbA, H1, 'minimum', 5);
    await a.sync();
    await b.sync();
    expect((await listEffortLevels(dbB))[0]?.targetValue).toBe(5);
    expect(a.raw.prepare('SELECT COUNT(*) AS n FROM habit_effort_levels').get()).toEqual({ n: 1 });
  });

  it('the same level created on two devices (different ids) converges to one row', async () => {
    const { a, b, dbA, dbB, server } = setup();
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    await b.sync();
    await setEffortLevel(dbA, H1, 'minimum', 2);
    await setEffortLevel(dbB, H1, 'minimum', 3);
    await a.sync();
    await b.sync();
    await a.sync();
    expect(server.effort.size).toBe(1);
    const va = (await listEffortLevels(dbA))[0]?.targetValue;
    const vb = (await listEffortLevels(dbB))[0]?.targetValue;
    expect(va).toBe(vb);
    expect(a.dirtyMomentum() + b.dirtyMomentum()).toBe(0);
  });

  it('experiments: start, sync, decide on another device, and the habit itself is untouched', async () => {
    const { a, b, dbA, dbB } = setup();
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    await b.sync();
    const exp = await startExperiment(dbA, { habitId: H1, startDate: '2026-11-18', durationDays: 7, baselineTargetValue: 20, trialTargetValue: 10 });
    await a.sync();
    await b.sync();
    expect((await listExperiments(dbB))[0]).toMatchObject({ id: exp.id, status: 'running', trialTargetValue: 10 });

    await decideExperiment(dbB, exp.id, 'kept');
    await b.sync();
    await a.sync();
    expect((await listExperiments(dbA))[0]).toMatchObject({ status: 'kept' });
    expect(a.habit(H1)?.name).toBe('Read');
    expect(a.raw.prepare('SELECT target_value FROM habits WHERE id = ?').get(H1)).toEqual({ target_value: 1 }); // unchanged
  });

  it('only one running experiment per habit (locally), and a new one is allowed after deciding', async () => {
    const { a, dbA } = setup();
    a.addHabit(H1, 'Read', t(1));
    const input = { habitId: H1, startDate: '2026-11-18', durationDays: 7, baselineTargetValue: 20, trialTargetValue: 10 };
    const e1 = await startExperiment(dbA, input);
    await expect(startExperiment(dbA, input)).rejects.toThrow(/already has a running/);
    await decideExperiment(dbA, e1.id, 'discarded');
    await expect(startExperiment(dbA, input)).resolves.toBeDefined();
  });

  it('deciding twice does not overwrite the first decision', async () => {
    const { a, dbA } = setup();
    a.addHabit(H1, 'Read', t(1));
    const e = await startExperiment(dbA, { habitId: H1, startDate: '2026-11-18', durationDays: 7, baselineTargetValue: 20, trialTargetValue: 10 });
    await decideExperiment(dbA, e.id, 'kept');
    await decideExperiment(dbA, e.id, 'discarded');
    expect((await listExperiments(dbA))[0]?.status).toBe('kept');
  });

  it('a server rejection of one experiment never blocks effort levels or other rows', async () => {
    const { a, b, dbA, server } = setup();
    a.addHabit(H1, 'Read', t(1));
    a.addHabit('33333333-3333-4333-8333-333333333333', 'Walk', t(2));
    await a.sync();
    // Plant a running experiment on the server that the local one will collide with.
    server.experiments.set('99999999-9999-4999-8999-999999999999', {
      id: '99999999-9999-4999-8999-999999999999', user_id: '11111111-1111-4111-8111-111111111111', habit_id: H1,
      start_date: '2026-11-10', duration_days: 7, baseline_target_value: 20, trial_target_value: 10, status: 'running',
      decided_at: null, created_at: t(3), updated_at: '2099-01-01T00:00:00.000Z', deleted_at: null,
    });
    await startExperiment(dbA, { habitId: H1, startDate: '2026-11-18', durationDays: 7, baselineTargetValue: 20, trialTargetValue: 5 });
    await setEffortLevel(dbA, H1, 'minimum', 2);
    const r = await a.sync();
    expect(r.rejected).toBe(1);
    expect(server.effort.size).toBe(1);
    void b;
  });

  it('a network failure loses nothing', async () => {
    const { a, dbA, server } = setup();
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    await setEffortLevel(dbA, H1, 'minimum', 2);
    server.offline = true;
    await expect(a.sync()).rejects.toThrow();
    expect(a.dirtyMomentum()).toBe(1);
    server.offline = false;
    await a.sync();
    expect(a.dirtyMomentum()).toBe(0);
    expect(server.effort.size).toBe(1);
  });

  it('rows for a habit unknown locally are skipped instead of crashing', async () => {
    const { b, server } = setup();
    server.effort.set(`${H1}|minimum`, {
      id: '44444444-4444-4444-8444-444444444444', user_id: '11111111-1111-4111-8111-111111111111', habit_id: H1,
      level: 'minimum', target_value: 2, created_at: t(1), updated_at: t(2), deleted_at: null,
    });
    const r = await b.sync();
    expect(r.skipped).toBe(1);
  });
});
