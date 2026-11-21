import { View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';

import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  const { colors, spacing, radius } = useTheme();
  if (isConnected !== false) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
    >
      <Text variant="footnote">You’re offline. Everything you do is saved on this device and will sync when you’re back.</Text>
    </View>
  );
}
