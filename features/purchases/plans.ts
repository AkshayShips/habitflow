/**
 * Pure logic for turning RevenueCat data into what the paywall shows. No prices are written here:
 * every price string comes from the App Store via RevenueCat offerings.
 */
export const ENTITLEMENT_ID = 'pro'; // must match supabase/functions/revenuecat-webhook

export interface RcPackage {
  identifier: string;
  packageType: string; // 'ANNUAL' | 'MONTHLY' | ...
  product: { identifier: string; priceString: string };
}

export interface RcCustomerInfo {
  entitlements: { active: Record<string, unknown> };
}

export interface Plan {
  id: string; // RevenueCat package identifier
  title: string;
  priceString: string;
  per: 'year' | 'month';
  note: string;
}

const PLAN_META: Record<string, Pick<Plan, 'title' | 'per' | 'note'>> = {
  ANNUAL: { title: 'Yearly', per: 'year', note: 'Best value' },
  MONTHLY: { title: 'Monthly', per: 'month', note: 'Cancel anytime' },
};

export function isProFromCustomerInfo(info: RcCustomerInfo | null | undefined): boolean {
  return !!info && Object.prototype.hasOwnProperty.call(info.entitlements.active, ENTITLEMENT_ID);
}

/** Yearly first, then monthly. Package types we don't present (weekly, lifetime, custom) are skipped. */
export function toPlans(packages: RcPackage[]): Plan[] {
  const plans: Plan[] = [];
  for (const type of ['ANNUAL', 'MONTHLY']) {
    const p = packages.find((x) => x.packageType === type);
    const meta = PLAN_META[type];
    if (p && meta && p.product.priceString) plans.push({ id: p.identifier, priceString: p.product.priceString, ...meta });
  }
  return plans;
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'failed';

/** RevenueCat rejects with `userCancelled: true` when the person backs out of the Apple sheet. */
export function classifyPurchaseError(e: unknown): 'cancelled' | 'failed' {
  return typeof e === 'object' && e !== null && (e as { userCancelled?: unknown }).userCancelled === true ? 'cancelled' : 'failed';
}
