import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store/authStore';
import { scheduleSync } from '@/features/sync/syncManager';
import type { EffortLevelName } from '@/features/sync/types';
import { getDb } from '@/lib/localDb';
import {
  clearEffortLevel, decideExperiment, keepExperiment, listEffortLevels, listExperiments, setEffortLevel, startExperiment,
} from '../api/momentumRepository';

function useUserId(): string {
  const id = useAuthStore((s) => s.session?.user.id);
  if (!id) throw new Error('useUserId called while signed out');
  return id;
}

const key = (u: string, what: 'levels' | 'experiments') => ['momentum', u, what] as const;

export function useEffortLevels() {
  const userId = useUserId();
  return useQuery({
    queryKey: key(userId, 'levels'),
    networkMode: 'always',
    queryFn: async () => listEffortLevels(await getDb(userId)),
  });
}

export function useExperiments() {
  const userId = useUserId();
  return useQuery({
    queryKey: key(userId, 'experiments'),
    networkMode: 'always',
    queryFn: async () => listExperiments(await getDb(userId)),
  });
}

/** Saves the minimum/extended targets for a habit in one go. A null value removes that level. */
export function useSaveEffortLevels(habitId: string) {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (v: Partial<Record<Exclude<EffortLevelName, 'standard'>, number | null>>) => {
      const db = await getDb(userId);
      for (const level of ['minimum', 'extended'] as const) {
        if (!(level in v)) continue;
        const value = v[level];
        if (value === null || value === undefined) await clearEffortLevel(db, habitId, level);
        else await setEffortLevel(db, habitId, level, value);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(userId, 'levels') });
      scheduleSync(userId);
    },
  });
}

export function useStartExperiment() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: Parameters<typeof startExperiment>[1]) => startExperiment(await getDb(userId), input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(userId, 'experiments') });
      scheduleSync(userId);
    },
  });
}

export function useDecideExperiment() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ id, decision }: { id: string; decision: 'kept' | 'discarded' }) => {
      const db = await getDb(userId);
      if (decision === 'kept') await keepExperiment(db, id);
      else await decideExperiment(db, id, 'discarded');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(userId, 'experiments') });
      void qc.invalidateQueries({ queryKey: ['habits', userId] }); // a kept trial changes the habit's target
      scheduleSync(userId);
    },
  });
}
