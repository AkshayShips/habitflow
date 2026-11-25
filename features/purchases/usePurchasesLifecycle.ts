import { useEffect } from 'react';

import { useAuthStore } from '@/features/auth/store/authStore';
import { IS_DEMO } from '@/lib/demo';
import { getNativeDriver } from './purchasesDriver';
import { usePurchaseStore } from './purchaseStore';

/** Identifies the signed-in user to RevenueCat and keeps the Pro flag current. */
export function usePurchasesLifecycle() {
  const userId = useAuthStore((s) => s.session?.user.id);
  useEffect(() => {
    if (!userId || IS_DEMO) return;
    let alive = true;
    void getNativeDriver()
      .catch(() => null)
      .then(async (d) => {
        if (alive) await usePurchaseStore.getState().start(d, userId);
      });
    return () => {
      alive = false;
      void usePurchaseStore.getState().stop();
    };
  }, [userId]);
}
