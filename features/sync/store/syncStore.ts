import { create } from 'zustand';

import type { SyncResult } from '../types';

interface SyncState {
  status: 'idle' | 'syncing' | 'error';
  lastSyncedAt: number | null;
  lastResult: SyncResult | null;
  error: string | null;
  begin: () => void;
  succeed: (r: SyncResult) => void;
  fail: (message: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  lastResult: null,
  error: null,
  begin: () => set({ status: 'syncing', error: null }),
  succeed: (r) => set({ status: 'idle', lastSyncedAt: Date.now(), lastResult: r, error: null }),
  fail: (message) => set({ status: 'error', error: message }),
}));
