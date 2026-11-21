import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { DateStr } from '@/features/habits/logic/dates';
import type { DayMode } from '../logic/types';

/**
 * Lightweight, device-local preferences (not synced, not part of the habit data model):
 *  - today's optional "light / normal / full day" choice (expires with the date)
 *  - insight ids the user dismissed
 * Stored per user in AsyncStorage. Failures degrade to defaults; nothing here is critical.
 */
interface Persisted {
  dayMode: { date: DateStr; mode: DayMode } | null;
  dismissed: string[];
}

interface State extends Persisted {
  userId: string | null;
  load: (userId: string) => Promise<void>;
  setDayMode: (date: DateStr, mode: DayMode | null) => void;
  dismiss: (insightId: string) => void;
}

const key = (userId: string) => `habitflow:momentum:${userId}`;

async function save(userId: string | null, data: Persisted) {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(data));
  } catch {
    /* preferences are best-effort */
  }
}

export const useMomentumStore = create<State>((set, get) => ({
  userId: null,
  dayMode: null,
  dismissed: [],
  load: async (userId) => {
    if (get().userId === userId) return;
    set({ userId, dayMode: null, dismissed: [] });
    try {
      const raw = await AsyncStorage.getItem(key(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Persisted>;
      set({
        dayMode: parsed.dayMode ?? null,
        dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed.filter((x) => typeof x === 'string') : [],
      });
    } catch {
      /* corrupt or unavailable: keep defaults */
    }
  },
  setDayMode: (date, mode) => {
    set({ dayMode: mode ? { date, mode } : null });
    const { userId, dayMode, dismissed } = get();
    void save(userId, { dayMode, dismissed });
  },
  dismiss: (id) => {
    set((s) => ({ dismissed: s.dismissed.includes(id) ? s.dismissed : [...s.dismissed, id] }));
    const { userId, dayMode, dismissed } = get();
    void save(userId, { dayMode, dismissed });
  },
}));
