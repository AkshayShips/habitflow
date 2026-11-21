/**
 * Test harness: a fake Supabase server (with the same last-write-wins rule as lww_guard) and
 * "devices" backed by REAL SQLite (node:sqlite) running the REAL SqliteLocalStore and migrations.
 */
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '@/lib/localMigrations';
import { SqliteLocalStore } from '../api/sqliteLocalStore';
import { runSync } from '../syncEngine';
import {
  SyncRemoteError,
  type Cursor,
  type PullPage,
  type RemoteApi,
  type RemoteHabit,
  type RemoteLog,
} from '../types';

export const USER = '11111111-1111-4111-8111-111111111111';

const ms = (s: string) => Date.parse(s);
const afterCursor = (r: { updated_at: string; id: string }, c: Cursor | null) =>
  c === null || r.updated_at > c.ts || (r.updated_at === c.ts && r.id > c.id);

export class FakeServer implements RemoteApi {
  habits = new Map<string, RemoteHabit>();
  logs = new Map<string, RemoteLog>(); // key: habit_id|log_date
  offline = false;
  rejectHabit: (h: RemoteHabit) => boolean = () => false;
  /** Called after rows are received but before the response returns (lets a test race a local edit). */
  onUpsert: (() => void) | null = null;
  private tick = 0;
  upsertCalls = 0;

  private serverNow(): string {
    // Strictly increasing "server clock", far in the future so equal-timestamp bumps always win.
    return new Date(Date.UTC(2099, 0, 1, 0, 0, 0, this.tick++)).toISOString();
  }

  private guard() {
    if (this.offline) throw new SyncRemoteError('Network request failed', true);
  }

  async upsertHabits(rows: RemoteHabit[]) {
    this.guard();
    this.upsertCalls += 1;
    for (const r of rows) {
      if (this.rejectHabit(r)) throw new SyncRemoteError(`rejected habit ${r.name}`, false);
    }
    for (const r of rows) {
      const ex = this.habits.get(r.id);
      if (ex && ms(r.updated_at) < ms(ex.updated_at)) continue; // stale: dropped by lww_guard
      this.habits.set(r.id, ex && r.updated_at === ex.updated_at ? { ...r, updated_at: this.serverNow() } : { ...r });
    }
    this.onUpsert?.();
  }

  async upsertLogs(rows: RemoteLog[]) {
    this.guard();
    this.upsertCalls += 1;
    for (const r of rows) {
      if (!this.habits.has(r.habit_id)) throw new SyncRemoteError('FK violation', false);
    }
    for (const r of rows) {
      const key = `${r.habit_id}|${r.log_date}`;
      const ex = this.logs.get(key);
      if (ex && ms(r.updated_at) < ms(ex.updated_at)) continue;
      this.logs.set(key, ex && r.updated_at === ex.updated_at ? { ...r, updated_at: this.serverNow() } : { ...r });
    }
    this.onUpsert?.();
  }

  private page<T extends { updated_at: string; id: string }>(all: T[], cursor: Cursor | null, limit: number): PullPage<T> {
    this.guard();
    const rows = all
      .filter((r) => afterCursor(r, cursor))
      .sort((a, b) => (a.updated_at === b.updated_at ? a.id.localeCompare(b.id) : a.updated_at.localeCompare(b.updated_at)))
      .slice(0, limit);
    const last = rows[rows.length - 1];
    return { rows, rawCount: rows.length, last: last ? { ts: last.updated_at, id: last.id } : null };
  }

  async pullHabits(cursor: Cursor | null, limit: number) {
    return this.page([...this.habits.values()], cursor, limit);
  }
  async pullLogs(cursor: Cursor | null, limit: number) {
    return this.page([...this.logs.values()], cursor, limit);
  }
}

/** The subset of expo-sqlite's API the store uses, on top of node:sqlite. */
function adapt(raw: DatabaseSync) {
  return {
    async getAllAsync<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...(params as never[])).map((r) => ({ ...r })) as T[];
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []) {
      const r = raw.prepare(sql).get(...(params as never[]));
      return (r ? { ...r } : null) as T | null;
    },
    async runAsync(sql: string, params: unknown[] = []) {
      raw.prepare(sql).run(...(params as never[]));
    },
    async withTransactionAsync(fn: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

export class Device {
  raw = new DatabaseSync(':memory:');
  store: SqliteLocalStore;

  constructor(readonly name: string, readonly server: FakeServer) {
    this.raw.exec('PRAGMA foreign_keys = ON;');
    for (const m of MIGRATIONS) this.raw.exec(m);
    this.store = new SqliteLocalStore(adapt(this.raw) as never, USER);
  }

  sync() {
    return runSync({ local: this.store, remote: this.server });
  }

  addHabit(id: string, name: string, at: string) {
    this.raw
      .prepare(
        `INSERT INTO habits (id, name, start_date, created_at, updated_at, dirty) VALUES (?, ?, '2026-11-01', ?, ?, 1)`,
      )
      .run(id, name, at, at);
  }

  renameHabit(id: string, name: string, at: string) {
    this.raw.prepare('UPDATE habits SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?').run(name, at, id);
  }

  setLog(logId: string, habitId: string, date: string, status: string, at: string) {
    this.raw
      .prepare(
        `INSERT INTO habit_logs (id, habit_id, log_date, status, logged_at, updated_at, dirty)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT (habit_id, log_date) DO UPDATE SET status = excluded.status, deleted_at = NULL,
           updated_at = excluded.updated_at, dirty = 1`,
      )
      .run(logId, habitId, date, status, at, at);
  }

  clearLog(habitId: string, date: string, at: string) {
    this.raw
      .prepare('UPDATE habit_logs SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE habit_id = ? AND log_date = ?')
      .run(at, at, habitId, date);
  }

  habit(id: string) {
    return this.raw.prepare('SELECT name, dirty, updated_at FROM habits WHERE id = ?').get(id) as
      | { name: string; dirty: number; updated_at: string }
      | undefined;
  }

  logs(habitId: string) {
    return this.raw
      .prepare('SELECT id, log_date, status, deleted_at, dirty FROM habit_logs WHERE habit_id = ? ORDER BY log_date')
      .all(habitId)
      .map((r) => ({ ...r })) as { id: string; log_date: string; status: string; deleted_at: string | null; dirty: number }[];
  }

  dirtyCount() {
    const h = this.raw.prepare('SELECT COUNT(*) AS n FROM habits WHERE dirty = 1').get() as { n: number };
    const l = this.raw.prepare('SELECT COUNT(*) AS n FROM habit_logs WHERE dirty = 1').get() as { n: number };
    return h.n + l.n;
  }
}

export const t = (n: number) => new Date(Date.UTC(2026, 10, 18, 12, 0, n)).toISOString();
export const H1 = '22222222-2222-4222-8222-222222222222';
export const H2 = '33333333-3333-4333-8333-333333333333';
