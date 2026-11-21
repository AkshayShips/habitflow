import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useReduceMotion } from '@/theme/useReduceMotion';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

interface Props extends Omit<PressableProps, 'children'> {
  title: string;
  /** primary: solid; secondary: tinted (iOS "tinted" button); ghost: text only; danger: destructive solid. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}

export function Button({ title, variant = 'primary', loading, disabled, onPress, ...rest }: Props) {
  const { colors, radius, spacing } = useTheme();
  const reduceMotion = useReduceMotion();
  const isDisabled = disabled || loading;

  const tint = colors.accentTint;
  const bg =
    variant === 'primary' ? colors.accent : variant === 'danger' ? colors.dangerInk : variant === 'secondary' ? tint : 'transparent';
  const fg =
    variant === 'primary' ? colors.accentText : variant === 'danger' ? colors.dangerText : colors.accentInk;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.lg,
          opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !reduceMotion ? 0.98 : 1 }],
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text variant="headline" style={{ color: fg }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50, // >= 44pt touch target
    alignItems: 'center',
    justifyContent: 'center',
  },
});
