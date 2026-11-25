import { create } from 'zustand';

import { classifyPurchaseError, isProFromCustomerInfo, toPlans, type Plan, type PurchaseOutcome, type RcCustomerInfo } from './plans';
import type { PurchasesDriver } from './purchasesDriver';

/** 'unavailable' = no RevenueCat key or not iOS (web, Expo Go without key): the paywall shows no prices. */
export type PurchasesStatus = 'idle' | 'unavailable' | 'loading' | 'ready' | 'error';

interface PurchaseState {
  status: PurchasesStatus;
  isPro: boolean;
  plans: Plan[];
  start: (driver: PurchasesDriver | null, userId: string) => Promise<void>;
  stop: () => Promise<void>;
  buy: (planId: string) => Promise<PurchaseOutcome>;
  restore: () => Promise<'restored' | 'nothing' | 'failed'>;
}

let driver: PurchasesDriver | null = null;
let listening = false;

export const usePurchaseStore = create<PurchaseState>((set, get) => {
  const apply = (info: RcCustomerInfo) => set({ isPro: isProFromCustomerInfo(info) });
  return {
    status: 'idle',
    isPro: false,
    plans: [],
    async start(d, userId) {
      driver = d;
      if (!d) return set({ status: 'unavailable', isPro: false, plans: [] });
      set({ status: 'loading' });
      try {
        // appUserID = Supabase user id, which is what the webhook uses to update subscriptions_cache.
        apply(await d.logIn(userId));
        if (!listening) {
          listening = true;
          d.onCustomerInfo((info) => apply(info));
        }
        set({ plans: toPlans(await d.getOfferingPackages()), status: 'ready' });
      } catch {
        set({ status: 'error' });
      }
    },
    async stop() {
      await driver?.logOut();
      set({ isPro: false, plans: [], status: 'idle' });
    },
    async buy(planId) {
      if (!driver) return 'failed';
      try {
        const info = await driver.purchase(planId);
        apply(info);
        return get().isPro ? 'purchased' : 'failed';
      } catch (e) {
        return classifyPurchaseError(e);
      }
    },
    async restore() {
      if (!driver) return 'failed';
      try {
        apply(await driver.restore());
        return get().isPro ? 'restored' : 'nothing';
      } catch {
        return 'failed';
      }
    },
  };
});
