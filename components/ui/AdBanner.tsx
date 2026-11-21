import { View } from 'react-native';

import { useIsPro } from '@/lib/entitlements';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

/**
 * PLACEHOLDER for the AdMob banner. Shown to free users on the Stats tab only.
 * Always labelled "Ad" and never placed next to a tappable control.
 * The real banner is requested only after the ATT prompt has been answered.
 */
export function AdBanner() {
  const isPro = useIsPro();
  const { colors, spacing, radius } = useTheme();
  if (isPro) return null;
  return (
    <View
      accessible
      accessibilityLabel="Advertisement placeholder"
      style={{
        minHeight: 60, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md,
        borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, padding: spacing.sm, marginTop: spacing.sm,
      }}
    >
      <Text variant="caption" secondary>Ad · banner placeholder</Text>
    </View>
  );
}
