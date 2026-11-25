import { usePurchaseStore } from '@/features/purchases/purchaseStore';

/** Free-plan limits (Section 7 of the product spec). */
export const FREE_HABIT_LIMIT = 5;

/**
 * True when RevenueCat reports an active "pro" entitlement for this user. Without a RevenueCat key
 * (web preview, Expo Go) this is always false, so the free limits apply. The server decides Pro for
 * AI limits independently, from subscriptions_cache, which the revenuecat-webhook function fills.
 */
export function useIsPro(): boolean {
  return usePurchaseStore((s) => s.isPro);
}
