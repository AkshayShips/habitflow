import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

/** iOS-style large title for tab roots, with an optional subtitle and a trailing control. */
export function LargeHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        {subtitle ? (
          <Text variant="footnote" secondary style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {subtitle}
          </Text>
        ) : null}
        <Text variant="largeTitle">{title}</Text>
      </View>
      {right}
    </View>
  );
}
