import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store/authStore';
import { IS_DEMO } from '@/lib/demo';
import { supabase } from '@/lib/supabase';

export interface AchievementRow {
  key: string;
  title: string;
  description: string;
  unlockedAt: string | null;
}

export interface GamificationData {
  xp: number;
  achievements: AchievementRow[];
}

/**
 * XP, level and unlocks are computed by database triggers when check-ins sync, so we only READ them.
 * Not available in the browser preview (no cloud) or while signed out.
 */
export function useGamification() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<GamificationData>({
    queryKey: ['gamification', userId],
    enabled: Boolean(userId) && !IS_DEMO,
    queryFn: async () => {
      const [progress, catalog, unlocked] = await Promise.all([
        supabase.from('user_progress').select('xp').maybeSingle(),
        supabase.from('achievements').select('id, key, title, description').order('key'),
        supabase.from('user_achievements').select('achievement_id, unlocked_at'),
      ]);
      const err = progress.error ?? catalog.error ?? unlocked.error;
      if (err) throw new Error(err.message);
      const when = new Map((unlocked.data ?? []).map((u) => [u.achievement_id as string, u.unlocked_at as string]));
      return {
        xp: Number(progress.data?.xp ?? 0),
        achievements: (catalog.data ?? []).map((a) => ({
          key: a.key as string,
          title: a.title as string,
          description: a.description as string,
          unlockedAt: when.get(a.id as string) ?? null,
        })),
      };
    },
  });
}
