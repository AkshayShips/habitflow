import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

interface Props extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}

export function Button({ title, variant = 'primary', loading, disabled, onPress, ...rest }: Props) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.surfaceAlt : 'transparent';
  const fg = variant === 'primary' ? colors.accentText : variant === 'danger' ? colors.dangerText : colors.text;

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
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
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
    minHeight: 52, // >= 44pt touch target
    alignItems: 'center',
    justifyContent: 'center',
  },
});
