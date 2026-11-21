import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, type DimensionValue } from 'react-native';

import { useTheme } from '@/theme/useTheme';

/** Pulsing placeholder. Holds still if the user prefers reduced motion. */
export function Skeleton({ height = 64, width = '100%' }: { height?: number; width?: DimensionValue }) {
  const { colors, radius } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, width, opacity, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg }}
    />
  );
}
