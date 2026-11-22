import { supabase } from '@/lib/supabase';
import { remoteEffortLevelSchema, remoteExperimentSchema, remoteHabitSchema, remoteJournalSchema, remoteLogSchema } from '../schemas/remote';
import {
  SyncRemoteError,
  type Cursor,
  type PullPage,
  type RemoteApi,
  type RemoteEffortLevel,
  type RemoteExperiment,
  type RemoteHabit,
  type RemoteJournalEntry,
  type RemoteLog,
} from '../types';

interface Failure {
  message: string;
  code?: string | null;
  status?: number;
}

/**
 * Transient (retry later): no response, 5xx, 401/408/429, PostgREST auth errors (PGRST3xx).
 * Rejected (data problem): any other 4xx / Postgres constraint, RLS, FK error.
 */
function toError(f: Failure): SyncRemoteError {
  const status = f.status ?? 0;
  const code = f.code ?? '';
  const transient =
    status === 0 || status >= 500 || status === 401 || status === 408 || status === 429 || code.startsWith('PGRST3');
  return new SyncRemoteError(f.message, transient);
}

async function pull<T>(
  table: 'habits' | 'habit_logs' | 'habit_effort_levels' | 'momentum_experiments' | 'journal_entries',
  cursor: Cursor | null,
  limit: number,
  parse: (row: unknown) => T | null,
): Promise<PullPage<T>> {
  let q = supabase
    .from(table)
    .select('*')
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit);

  if (cursor) {
    q = q.or(`updated_at.gt.${cursor.ts},and(updated_at.eq.${cursor.ts},id.gt.${cursor.id})`);
  }

  const { data, error, status } = await q;
  if (error) throw toError({ message: error.message, code: error.code, status });

  const raw = (data ?? []) as { updated_at: string; id: string }[];
  const rows: T[] = [];
  for (const r of raw) {
    const parsed = parse(r);
    if (parsed) rows.push(parsed);
  }
  const lastRaw = raw[raw.length - 1];
  return { rows, rawCount: raw.length, last: lastRaw ? { ts: lastRaw.updated_at, id: lastRaw.id } : null };
}

export const supabaseRemote: RemoteApi = {
  async upsertHabits(rows: RemoteHabit[]) {
    const { error, status } = await supabase.from('habits').upsert(rows, { onConflict: 'id' });
    if (error) throw toError({ message: error.message, code: error.code, status });
  },

  async upsertLogs(rows: RemoteLog[]) {
    // (habit_id, log_date) is the real identity of a log, so conflicts resolve on that, not on id.
    const { error, status } = await supabase.from('habit_logs').upsert(rows, { onConflict: 'habit_id,log_date' });
    if (error) throw toError({ message: error.message, code: error.code, status });
  },

  pullHabits: (cursor, limit) =>
    pull<RemoteHabit>('habits', cursor, limit, (r) => {
      const p = remoteHabitSchema.safeParse(r);
      return p.success ? (p.data as RemoteHabit) : null;
    }),

  pullLogs: (cursor, limit) =>
    pull<RemoteLog>('habit_logs', cursor, limit, (r) => {
      const p = remoteLogSchema.safeParse(r);
      return p.success ? (p.data as RemoteLog) : null;
    }),

  async upsertEffortLevels(rows: RemoteEffortLevel[]) {
    // Identity is (habit_id, level), like logs.
    const { error, status } = await supabase.from('habit_effort_levels').upsert(rows, { onConflict: 'habit_id,level' });
    if (error) throw toError({ message: error.message, code: error.code, status });
  },

  async upsertExperiments(rows: RemoteExperiment[]) {
    const { error, status } = await supabase.from('momentum_experiments').upsert(rows, { onConflict: 'id' });
    if (error) throw toError({ message: error.message, code: error.code, status });
  },

  pullEffortLevels: (cursor, limit) =>
    pull<RemoteEffortLevel>('habit_effort_levels', cursor, limit, (r) => {
      const p = remoteEffortLevelSchema.safeParse(r);
      return p.success ? (p.data as RemoteEffortLevel) : null;
    }),

  pullExperiments: (cursor, limit) =>
    pull<RemoteExperiment>('momentum_experiments', cursor, limit, (r) => {
      const p = remoteExperimentSchema.safeParse(r);
      return p.success ? (p.data as RemoteExperiment) : null;
    }),

  async upsertJournal(rows: RemoteJournalEntry[]) {
    // Identity is (user_id, entry_date), like logs.
    const { error, status } = await supabase.from('journal_entries').upsert(rows, { onConflict: 'user_id,entry_date' });
    if (error) throw toError({ message: error.message, code: error.code, status });
  },

  pullJournal: (cursor, limit) =>
    pull<RemoteJournalEntry>('journal_entries', cursor, limit, (r) => {
      const p = remoteJournalSchema.safeParse(r);
      return p.success ? (p.data as RemoteJournalEntry) : null;
    }),
};
