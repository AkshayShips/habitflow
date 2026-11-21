import { IS_DEMO } from '@/lib/demo';
import { getDb } from '@/lib/localDb';
import { queryClient } from '@/lib/queryClient';
import { supabaseRemote } from './api/supabaseRemote';
import { SqliteLocalStore } from './api/sqliteLocalStore';
import { useSyncStore } from './store/syncStore';
import { runSync } from './syncEngine';
import type { SyncResult } from './types';

const inflight = new Map<string, Promise<SyncResult | null>>();
const rerun = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Runs a sync now. Never runs two passes at once per user; a request during a pass triggers one more pass after it. */
export function syncNow(userId: string): Promise<SyncResult | null> {
  if (IS_DEMO) return Promise.resolve(null); // preview build has no cloud
  const running = inflight.get(userId);
  if (running) {
    rerun.add(userId);
    return running;
  }

  const store = useSyncStore.getState();
  store.begin();

  const p = (async (): Promise<SyncResult | null> => {
    try {
      const db = await getDb(userId);
      const result = await runSync({ local: new SqliteLocalStore(db, userId), remote: supabaseRemote });
      useSyncStore.getState().succeed(result);
      if (result.pulled > 0 || result.pushed > 0) {
        void queryClient.invalidateQueries({ queryKey: ['habits', userId] });
        void queryClient.invalidateQueries({ queryKey: ['logs', userId] });
        void queryClient.invalidateQueries({ queryKey: ['momentum', userId] });
      }
      return result;
    } catch (e) {
      useSyncStore.getState().fail(e instanceof Error ? e.message : 'Sync failed');
      return null;
    } finally {
      inflight.delete(userId);
      if (rerun.delete(userId)) void syncNow(userId);
    }
  })();

  inflight.set(userId, p);
  return p;
}

/** Debounced sync after local edits, so rapid taps produce one network round trip. */
export function scheduleSync(userId: string, delayMs = 1500): void {
  const existing = timers.get(userId);
  if (existing) clearTimeout(existing);
  timers.set(
    userId,
    setTimeout(() => {
      timers.delete(userId);
      void syncNow(userId);
    }, delayMs),
  );
}

export function cancelScheduledSync(userId: string): void {
  const t = timers.get(userId);
  if (t) clearTimeout(t);
  timers.delete(userId);
}
