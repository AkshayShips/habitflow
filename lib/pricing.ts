/** What Pro includes. Prices are never stored here; they come from the App Store via RevenueCat offerings. */
export const PRO_FEATURES = [
  { icon: 'infinite-outline', title: 'Unlimited habits', free: '5 habits', pro: 'No limit' },
  { icon: 'stats-chart-outline', title: 'Full stats history', free: '7 days', pro: 'Everything' },
  { icon: 'chatbubble-ellipses-outline', title: 'AI Coach messages', free: '3 per day', pro: 'Unlimited' },
  { icon: 'eye-off-outline', title: 'No ads', free: 'Ads on Stats', pro: 'Ad-free' },
] as const;
