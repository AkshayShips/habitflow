import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useReduceMotion } from '@/theme/useReduceMotion';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

type Tone = 'neutral' | 'success' | 'error';
interface ToastState {
  id: number;
  message: string | null;
  tone: Tone;
  show: (message: string, tone?: Tone) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  id: 0,
  message: null,
  tone: 'neutral',
  show: (message, tone = 'neutral') => set((s) => ({ id: s.id + 1, message, tone })),
  hide: () => set({ message: null }),
}));

/** Imperative helper: showToast('Saved') from anywhere. */
export const showToast = (message: string, tone: Tone = 'neutral') => useToastStore.getState().show(message, tone);

/** Mount once near the root. Announced to screen readers via accessibilityLiveRegion / role alert. */
export function ToastHost() {
  const { id, message, tone, hide } = useToastStore();
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    opacity.setValue(reduce ? 1 : 0);
    if (!reduce) Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(hide, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!message) return null;
  const bg = tone === 'success' ? colors.successTint : tone === 'error' ? colors.dangerTint : colors.surface;
  const fg = tone === 'success' ? colors.successInk : tone === 'error' ? colors.dangerInk : colors.text;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: insets.bottom + 84 }}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          opacity,
          backgroundColor: bg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.sm2,
          paddingHorizontal: spacing.md,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Text variant="callout" style={{ color: fg }}>{message}</Text>
      </Animated.View>
    </View>
  );
}
