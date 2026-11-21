import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';
import { percent, type Bucket } from '../logic/stats';

const HEIGHT = 120;

/** Simple bar chart. Each bar is its own accessibility element ("Mon: 80%"), since a chart is otherwise invisible to VoiceOver. */
export function BarChart({ buckets, locked }: { buckets: Bucket[]; locked?: (b: Bucket) => boolean }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height: HEIGHT + 24 }}>
      {buckets.map((b) => {
        const isLocked = locked?.(b) ?? false;
        const h = b.rate === null ? 2 : Math.max(4, Math.round(b.rate * HEIGHT));
        return (
          <View
            key={`${b.from}-${b.label}`}
            accessible
            accessibilityLabel={isLocked ? `${b.label}: locked` : `${b.label}: ${b.rate === null ? 'nothing scheduled' : percent(b.rate)}`}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs }}
          >
            <View
              style={{
                width: '100%',
                height: h,
                borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
                backgroundColor: isLocked || b.rate === null ? colors.surfaceAlt : colors.accent,
              }}
            />
            <Text variant="caption" secondary numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {b.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
