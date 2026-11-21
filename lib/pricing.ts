/**
 * PLACEHOLDER PRICING, UI ONLY. Real prices come from RevenueCat offerings
 * (localized by the App Store). Do not ship these numbers; confirm pricing first.
 */
export const PLACEHOLDER_PLANS = [
  { id: 'yearly', title: 'Yearly', price: '$—', per: 'year', note: 'Best value', badge: 'Save most' },
  { id: 'monthly', title: 'Monthly', price: '$—', per: 'month', note: 'Cancel anytime', badge: undefined },
] as const;

export const PRO_FEATURES = [
  { icon: 'infinite-outline', title: 'Unlimited habits', free: '5 habits', pro: 'No limit' },
  { icon: 'stats-chart-outline', title: 'Full stats history', free: '7 days', pro: 'Everything' },
  { icon: 'chatbubble-ellipses-outline', title: 'AI Coach messages', free: '3 per day', pro: 'Unlimited' },
  { icon: 'eye-off-outline', title: 'No ads', free: 'Ads on Stats', pro: 'Ad-free' },
] as const;
