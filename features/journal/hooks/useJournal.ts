import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store/authStore';
import { scheduleSync } from '@/features/sync/syncManager';
import { getDb } from '@/lib/localDb';
import { deleteEntry, listEntries, saveEntry } from '../api/journalRepository';

function useUserId(): string {
  const id = useAuthStore((s) => s.session?.user.id);
  if (!id) throw new Error('useUserId called while signed out');
  return id;
}

export function useJournalEntries() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['journal', userId],
    networkMode: 'always',
    queryFn: async () => listEntries(await getDb(userId)),
  });
}

export function useSaveJournalEntry() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (v: { date: string; body: string; mood: number | null }) =>
      saveEntry(await getDb(userId), v.date, v.body, v.mood),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['journal', userId] });
      scheduleSync(userId);
    },
  });
}

export function useDeleteJournalEntry() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (date: string) => deleteEntry(await getDb(userId), date),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['journal', userId] });
      scheduleSync(userId);
    },
  });
}
