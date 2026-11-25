import { usePurchaseStore } from '@/features/purchases/purchaseStore';

/** Free-plan limits (Section 7 of the product spec). Only apply while PAYMENTS_ENABLED. */
export const FREE_HABIT_LIMIT = 5;

/**
 * HabitFlow is a website, and Apple's in-app purchases don't work there. Until a web payment
 * provider is chosen, everything is free and no Pro/upgrade UI is shown. Flip this when payments exist.
 * (The AI Coach's daily cap is enforced on the server regardless: it protects the API bill.)
 */
export const PAYMENTS_ENABLED = false;

/** Server-side Pro (RevenueCat entitlement). Used for the Coach's daily cap. */
export function useHasPaidPlan(): boolean {
  return usePurchaseStore((s) => s.isPro);
}

/** Full access to every feature: everyone while payments are off, otherwise only paying users. */
export function useIsPro(): boolean {
  const paid = useHasPaidPlan();
  return !PAYMENTS_ENABLED || paid;
}
