import { Device, FakeServer, H1, H2, t } from './testing/harness';

describe('sync engine (real SQLite store, fake server with LWW)', () => {
  it('pushes local data and a second device pulls it', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    const b = new Device('B', server);

    a.addHabit(H1, 'Read', t(1));
    a.setLog('aaaaaaa1-0000-4000-8000-000000000001', H1, '2026-11-17', 'done', t(2));
    a.setLog('aaaaaaa2-0000-4000-8000-000000000002', H1, '2026-11-18', 'done', t(3));

    const ra = await a.sync();
    expect(ra).toMatchObject({ pushed: 3, rejected: 0 });
    expect(a.dirtyCount()).toBe(0);
    expect(server.habits.size).toBe(1);
    expect(server.logs.size).toBe(2);

    const rb = await b.sync();
    expect(rb.pulled).toBe(3);
    expect(b.habit(H1)?.name).toBe('Read');
    expect(b.logs(H1)).toHaveLength(2);
    expect(b.dirtyCount()).toBe(0);
  });

  it('is idempotent: a second pass moves nothing', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    const again = await a.sync();
    expect(again.pushed).toBe(0);
    // The server may echo our own row back once; it must apply cleanly and not re-dirty anything.
    expect(a.dirtyCount()).toBe(0);
    const third = await a.sync();
    expect(third.pulled).toBe(0);
  });

  it('concurrent offline edits: the newer edit wins on both devices', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    const b = new Device('B', server);
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    await b.sync();

    a.renameHabit(H1, 'Read (A)', t(10));
    b.renameHabit(H1, 'Read (B)', t(20)); // newer
    await a.sync();
    await b.sync();
    await a.sync();

    expect(server.habits.get(H1)?.name).toBe('Read (B)');
    expect(a.habit(H1)?.name).toBe('Read (B)');
    expect(b.habit(H1)?.name).toBe('Read (B)');
    expect(a.dirtyCount() + b.dirtyCount()).toBe(0);
  });

  it('an older local edit loses to a newer server version', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    const b = new Device('B', server);
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    await b.sync();

    b.renameHabit(H1, 'Newer', t(50));
    await b.sync();
    a.renameHabit(H1, 'Older', t(30)); // made earlier in real time, synced later
    await a.sync();

    expect(server.habits.get(H1)?.name).toBe('Newer');
    expect(a.habit(H1)?.name).toBe('Newer');
  });

  it('a local edit newer than the server is kept and pushed', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    a.renameHabit(H1, 'Edited', t(99));
    await a.sync();
    expect(server.habits.get(H1)?.name).toBe('Edited');
    expect(a.habit(H1)?.name).toBe('Edited');
  });

  it('the same log created on two devices (different ids) converges to one row', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    const b = new Device('B', server);
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    await b.sync();

    a.setLog('aaaaaaaa-0000-4000-8000-00000000000a', H1, '2026-11-18', 'done', t(10));
    b.setLog('bbbbbbbb-0000-4000-8000-00000000000b', H1, '2026-11-18', 'skipped', t(20));
    await a.sync();
    await b.sync();
    await a.sync();

    expect(server.logs.size).toBe(1);
    for (const d of [a, b]) {
      const rows = d.logs(H1);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: 'skipped', dirty: 0 });
    }
    expect(a.logs(H1)[0]?.id).toBe(b.logs(H1)[0]?.id);
  });

  it('an un-check (soft delete) propagates to other devices', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    const b = new Device('B', server);
    a.addHabit(H1, 'Read', t(1));
    a.setLog('aaaaaaaa-0000-4000-8000-00000000000a', H1, '2026-11-18', 'done', t(2));
    await a.sync();
    await b.sync();
    expect(b.logs(H1)[0]?.deleted_at).toBeNull();

    a.clearLog(H1, '2026-11-18', t(30));
    await a.sync();
    await b.sync();
    expect(b.logs(H1)[0]?.deleted_at).not.toBeNull();

    // and re-checking later revives it everywhere
    b.setLog('bbbbbbbb-0000-4000-8000-00000000000b', H1, '2026-11-18', 'done', t(40));
    await b.sync();
    await a.sync();
    expect(a.logs(H1)[0]).toMatchObject({ status: 'done', deleted_at: null });
  });

  it('one rejected row never blocks the rest', async () => {
    const server = new FakeServer();
    server.rejectHabit = (h) => h.name === 'BAD';
    const a = new Device('A', server);
    a.addHabit(H1, 'Good', t(1));
    a.addHabit(H2, 'BAD', t(2));
    a.setLog('aaaaaaaa-0000-4000-8000-00000000000a', H1, '2026-11-18', 'done', t(3));

    const r = await a.sync();
    expect(r.rejected).toBe(1);
    expect(server.habits.has(H1)).toBe(true);
    expect(server.habits.has(H2)).toBe(false);
    expect(server.logs.size).toBe(1); // the good habit's log still synced
    expect(a.habit(H2)?.dirty).toBe(1); // kept for retry
    expect(a.habit(H1)?.dirty).toBe(0);

    // later fix (server accepts), and it goes through
    server.rejectHabit = () => false;
    const r2 = await a.sync();
    expect(r2.rejected).toBe(0);
    expect(server.habits.has(H2)).toBe(true);
  });

  it('a network failure aborts the pass and loses nothing', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    a.addHabit(H1, 'Read', t(1));
    server.offline = true;
    await expect(a.sync()).rejects.toThrow('Network request failed');
    expect(a.dirtyCount()).toBe(1);

    server.offline = false;
    const r = await a.sync();
    expect(r.pushed).toBe(1);
    expect(a.dirtyCount()).toBe(0);
  });

  it('an edit made while a push is in flight is not lost (pushed again in the same pass)', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    a.addHabit(H1, 'Read', t(1));
    server.onUpsert = () => {
      server.onUpsert = null;
      a.renameHabit(H1, 'Edited mid-flight', t(5)); // user edits while the request is out
    };
    const r = await a.sync();
    expect(server.upsertCalls).toBe(2); // first push + re-push of the mid-flight edit
    expect(r.pushed).toBe(2);
    expect(server.habits.get(H1)?.name).toBe('Edited mid-flight');
    expect(a.habit(H1)).toMatchObject({ name: 'Edited mid-flight', dirty: 0 });
  });

  it('markPushed never clears a row that changed after it was read', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    a.addHabit(H1, 'Read', t(1));
    const [row] = await a.store.getDirtyHabits(10, []);
    a.renameHabit(H1, 'Changed', t(9)); // edit after the read
    await a.store.markPushed('habits', [{ id: H1, updated_at: row!.updated_at }]);
    expect(a.habit(H1)?.dirty).toBe(1);
  });

  it('pulls many rows that share one timestamp (keyset pagination)', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    a.addHabit(H1, 'Read', t(1));
    await a.sync();

    for (let i = 0; i < 1200; i++) {
      const date = new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10);
      server.logs.set(`${H1}|${date}`, {
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        habit_id: H1, user_id: 'u', log_date: date, value: 1, status: 'done', note: null, mood: null,
        logged_at: t(2), updated_at: t(2), deleted_at: null,
      });
    }

    const b = new Device('B', server);
    const r = await b.sync();
    expect(r.pulled).toBe(1201); // habit + 1200 logs
    expect(b.logs(H1)).toHaveLength(1200);
  });

  it('counts rows dropped by validation and still advances the cursor', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    a.addHabit(H1, 'Read', t(1));
    await a.sync();
    const b = new Device('B', server);
    const original = server.pullHabits.bind(server);
    server.pullHabits = async (c, l) => {
      const p = await original(c, l);
      return { ...p, rows: [], rawCount: p.rawCount }; // pretend every row failed validation
    };
    const r = await b.sync();
    expect(r.pulled).toBe(0);
    expect(r.skipped).toBeGreaterThanOrEqual(1);
    expect(await b.store.getCursor('habits')).not.toBeNull();
  });

  it('logs for an unknown local habit are skipped instead of crashing', async () => {
    const server = new FakeServer();
    const a = new Device('A', server);
    const r = await a.store.applyRemoteLogs([
      {
        id: 'cccccccc-0000-4000-8000-00000000000c', habit_id: H2, user_id: 'u', log_date: '2026-11-18', value: 1,
        status: 'done', note: null, mood: null, logged_at: t(1), updated_at: t(1), deleted_at: null,
      },
    ]);
    expect(r).toEqual({ applied: 0, skipped: 1 });
  });
});
