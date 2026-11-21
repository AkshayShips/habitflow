import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuthStore } from '@/features/auth/store/authStore';
import { cancelScheduledSync, syncNow } from '../syncManager';

/** Syncs on sign-in/app start, whenever the app returns to the foreground, and when connectivity returns. */
export function useSyncLifecycle() {
  const userId = useAuthStore((s) => s.session?.user.id);

  useEffect(() => {
    if (!userId) return;
    void syncNow(userId);

    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow(userId);
    });

    let wasOffline = false;
    const unsubscribeNet = NetInfo.addEventListener((st) => {
      const online = st.isConnected !== false && st.isInternetReachable !== false;
      if (online && wasOffline) void syncNow(userId);
      wasOffline = !online;
    });

    return () => {
      appState.remove();
      unsubscribeNet();
      cancelScheduledSync(userId);
    };
  }, [userId]);
}
