/** Free-plan limits (Section 7 of the product spec). */
export const FREE_HABIT_LIMIT = 5;

/**
 * Placeholder until RevenueCat lands. Returns false for everyone, so the free limits apply.
 * Replace with the real entitlement check (client) backed by subscriptions_cache (server).
 */
export function useIsPro(): boolean {
  return false;
}
