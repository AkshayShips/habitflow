import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/lib/localMigrations';
import { deleteEntry, listEntries, saveEntry } from '@/features/journal/api/journalRepository';
import { adapt, Device, FakeServer } from './testing/harness';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `77777777-0000-4000-8000-${String(++n).padStart(12, '0')}` };
});

const setup = () => {
  const server = new FakeServer();
  const a = new Device('A', server);
  const b = new Device('B', server);
  return { server, a, b, dbA: adapt(a.raw) as never, dbB: adapt(b.raw) as never };
};

describe('journal local repository', () => {
  it('one entry per date: saving again updates it', async () => {
    const { dbA } = setup();
    await saveEntry(dbA, '2026-11-20', 'first', 3);
    await saveEntry(dbA, '2026-11-20', 'second', 4);
    expect(await listEntries(dbA)).toEqual([{ date: '2026-11-20', body: 'second', mood: 4 }]);
  });
  it('a mood alone is a valid entry; empty text and no mood removes the day', async () => {
    const { dbA } = setup();
    await saveEntry(dbA, '2026-11-20', '   ', 5);
    expect(await listEntries(dbA)).toEqual([{ date: '2026-11-20', body: '', mood: 5 }]);
    await saveEntry(dbA, '2026-11-20', '', null);
    expect(await listEntries(dbA)).toEqual([]);
  });
  it('rejects invalid input', async () => {
    const { dbA } = setup();
    await expect(saveEntry(dbA, '2026-11-20', 'x'.repeat(4001), null)).rejects.toThrow(/4000/);
    await expect(saveEntry(dbA, '2026-11-20', 'x', 9)).rejects.toThrow(/Mood/);
  });
  it('lists newest first', async () => {
    const { dbA } = setup();
    await saveEntry(dbA, '2026-11-18', 'a', null);
    await saveEntry(dbA, '2026-11-20', 'b', null);
    expect((await listEntries(dbA)).map((e) => e.date)).toEqual(['2026-11-20', '2026-11-18']);
  });
});

describe('journal sync', () => {
  it('migration v4 keeps existing data', () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec('PRAGMA foreign_keys = ON;');
    for (const m of MIGRATIONS.slice(0, 3)) raw.exec(m);
    raw.prepare("INSERT INTO habits (id, name, start_date, created_at, updated_at) VALUES ('h','Read','2026-11-01','x','x')").run();
    for (const m of MIGRATIONS.slice(3)) raw.exec(m);
    expect((raw.prepare('SELECT COUNT(*) AS n FROM habits').get() as { n: number }).n).toBe(1);
    expect(raw.prepare("SELECT name FROM sqlite_master WHERE name = 'journal_entries'").get()).toBeDefined();
  });

  it('converges across two devices, and a second pass moves nothing', async () => {
    const { a, b, dbA, dbB } = setup();
    await saveEntry(dbA, '2026-11-20', 'Good day', 4);
    expect((await a.sync()).pushed).toBe(1);
    await b.sync();
    expect(await listEntries(dbB)).toEqual([{ date: '2026-11-20', body: 'Good day', mood: 4 }]);
    const again = await a.sync();
    expect(again.pushed + again.pulled).toBe(0);
  });

  it('works without any habits (journal does not depend on them)', async () => {
    const { a, dbA, server } = setup();
    await saveEntry(dbA, '2026-11-20', 'x', null);
    await a.sync();
    expect(server.journal.size).toBe(1);
  });

  it('the same date written on two devices (different ids) converges to one entry', async () => {
    const { a, b, dbA, dbB, server } = setup();
    await saveEntry(dbA, '2026-11-20', 'from A', 3);
    await saveEntry(dbB, '2026-11-20', 'from B', 4);
    await a.sync();
    await b.sync();
    await a.sync();
    expect(server.journal.size).toBe(1);
    expect(await listEntries(dbA)).toEqual(await listEntries(dbB));
    expect(a.dirtyCount() + a.dirtyMomentum() + b.dirtyMomentum()).toBe(0);
  });

  it('an edit propagates, and so does a delete (soft)', async () => {
    const { a, b, dbA, dbB } = setup();
    await saveEntry(dbA, '2026-11-20', 'v1', 3);
    await a.sync();
    await b.sync();
    await saveEntry(dbA, '2026-11-20', 'v2', 3);
    await a.sync();
    await b.sync();
    expect((await listEntries(dbB))[0]?.body).toBe('v2');
    await deleteEntry(dbA, '2026-11-20');
    await a.sync();
    await b.sync();
    expect(await listEntries(dbB)).toEqual([]);
  });

  it('a delete then re-write of the same day revives the same row', async () => {
    const { a, dbA, server } = setup();
    await saveEntry(dbA, '2026-11-20', 'v1', 3);
    await a.sync();
    await deleteEntry(dbA, '2026-11-20');
    await saveEntry(dbA, '2026-11-20', 'again', 2);
    await a.sync();
    expect(server.journal.size).toBe(1);
    expect(server.journal.get('2026-11-20')).toMatchObject({ body: 'again', deleted_at: null });
  });

  it('a network failure loses nothing', async () => {
    const { a, dbA, server } = setup();
    await saveEntry(dbA, '2026-11-20', 'precious', 3);
    server.offline = true;
    await expect(a.sync()).rejects.toThrow();
    expect(a.dirtyMomentum()).toBe(1); // dirtyMomentum also counts journal rows
    server.offline = false;
    await a.sync();
    expect(a.dirtyMomentum()).toBe(0);
    expect(server.journal.get('2026-11-20')?.body).toBe('precious');
  });
});
