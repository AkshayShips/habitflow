import { useEffect } from 'react';

import { IS_DEMO } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { getDeviceTimezone } from '../api/auth';
import { useAuthStore } from '../store/authStore';

/**
 * Keeps profiles.timezone equal to the device timezone (travel, DST rule changes).
 * log_date is always computed from this zone, so it must not go stale.
 */
export function useSyncProfileTimezone() {
  const userId = useAuthStore((s) => s.session?.user.id);

  useEffect(() => {
    if (!userId || IS_DEMO) return;
    let cancelled = false;

    void (async () => {
      try {
        const tz = getDeviceTimezone();
        const { data } = await supabase.from('profiles').select('timezone').eq('id', userId).maybeSingle();
        if (cancelled || !data || data.timezone === tz) return;
        await supabase.from('profiles').update({ timezone: tz }).eq('id', userId);
      } catch {
        // Offline or transient failure: we'll retry next launch.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
