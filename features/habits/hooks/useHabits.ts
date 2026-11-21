import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FREE_HABIT_LIMIT, useIsPro } from '@/lib/entitlements';
import { getDb } from '@/lib/localDb';
import { useAuthStore } from '@/features/auth/store/authStore';
import { scheduleSync } from '@/features/sync/syncManager';
import {
  countActiveHabits,
  createHabit,
  deleteHabit,
  getHabit,
  listHabits,
  listLogs,
  setArchived,
  setLog,
  updateHabit,
  type Habit,
  type HabitLog,
} from '../api/habitRepository';
import { todayStr, type DateStr } from '../logic/dates';
import { computeStreak } from '../logic/streak';
import type { StreakResult } from '../logic/types';
import type { HabitInput } from '../schemas/habit';

export class HabitLimitError extends Error {
  constructor() {
    super(`The free plan includes up to ${FREE_HABIT_LIMIT} active habits. Archive one, or upgrade to Pro for unlimited habits.`);
    this.name = 'HabitLimitError';
  }
}

function useUserId(): string {
  const id = useAuthStore((s) => s.session?.user.id);
  if (!id) throw new Error('useUserId called while signed out');
  return id;
}

const keys = {
  habits: (u: string) => ['habits', u] as const,
  logs: (u: string) => ['logs', u] as const,
};

/** Current local date; refreshes when the app returns to the foreground or midnight passes. */
export function useTodayStr(): DateStr {
  const [today, setToday] = useState(() => todayStr());
  useEffect(() => {
    const refresh = () => setToday((prev) => {
      const next = todayStr();
      return next === prev ? prev : next;
    });
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const timer = setInterval(refresh, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return today;
}

export function useHabits() {
  const userId = useUserId();
  return useQuery({
    queryKey: keys.habits(userId),
    queryFn: async () => listHabits(await getDb(userId)),
    networkMode: 'always', // local DB: never "paused" for lack of network
  });
}

export function useHabit(id: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...keys.habits(userId), id],
    queryFn: async () => getHabit(await getDb(userId), id),
    networkMode: 'always',
  });
}

export function useLogs() {
  const userId = useUserId();
  return useQuery({
    queryKey: keys.logs(userId),
    queryFn: async () => listLogs(await getDb(userId)),
    networkMode: 'always',
  });
}

/** habitId -> StreakResult, derived from local logs (no extra storage to keep consistent). */
export function useStreaks(habits: Habit[] | undefined, logs: HabitLog[] | undefined, today: DateStr) {
  return useMemo(() => {
    const out = new Map<string, StreakResult>();
    if (!habits || !logs) return out;
    const byHabit = new Map<string, HabitLog[]>();
    for (const l of logs) {
      const arr = byHabit.get(l.habitId);
      if (arr) arr.push(l);
      else byHabit.set(l.habitId, [l]);
    }
    for (const h of habits) {
      out.set(
        h.id,
        computeStreak({
          cadence: h.cadence,
          startDate: h.startDate,
          logs: (byHabit.get(h.id) ?? []).map((l) => ({ date: l.date, status: l.status })),
          today,
        }),
      );
    }
    return out;
  }, [habits, logs, today]);
}

/** One-tap check-in. Optimistic: the checkbox flips instantly, then the DB write confirms. */
export function useToggleDone() {
  const userId = useUserId();
  const qc = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ habitId, date, done }: { habitId: string; date: DateStr; done: boolean }) => {
      await setLog(await getDb(userId), habitId, date, done ? 'done' : null);
    },
    onMutate: async ({ habitId, date, done }) => {
      await qc.cancelQueries({ queryKey: keys.logs(userId) });
      const previous = qc.getQueryData<HabitLog[]>(keys.logs(userId));
      qc.setQueryData<HabitLog[]>(keys.logs(userId), (old = []) => {
        const rest = old.filter((l) => !(l.habitId === habitId && l.date === date));
        return done ? [...rest, { habitId, date, status: 'done' }] : rest;
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.logs(userId), ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.logs(userId) });
      scheduleSync(userId);
    },
  });
}

export function useCreateHabit() {
  const userId = useUserId();
  const qc = useQueryClient();
  const isPro = useIsPro();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: HabitInput) => {
      const db = await getDb(userId);
      if (!isPro && (await countActiveHabits(db)) >= FREE_HABIT_LIMIT) throw new HabitLimitError();
      return createHabit(db, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.habits(userId) });
      scheduleSync(userId);
    },
  });
}

export function useUpdateHabit(id: string) {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: HabitInput) => updateHabit(await getDb(userId), id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.habits(userId) });
      scheduleSync(userId);
    },
  });
}

export function useArchiveHabit() {
  const userId = useUserId();
  const qc = useQueryClient();
  const isPro = useIsPro();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const db = await getDb(userId);
      // Restoring counts against the free limit just like creating.
      if (!archived && !isPro && (await countActiveHabits(db)) >= FREE_HABIT_LIMIT) throw new HabitLimitError();
      await setArchived(db, id, archived);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.habits(userId) });
      scheduleSync(userId);
    },
  });
}

export function useDeleteHabit() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (id: string) => deleteHabit(await getDb(userId), id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.habits(userId) });
      void qc.invalidateQueries({ queryKey: keys.logs(userId) });
      scheduleSync(userId);
    },
  });
}
