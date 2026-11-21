import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import type { TypographyVariant } from '@/theme/tokens';

interface Props extends TextProps {
  variant?: TypographyVariant;
  secondary?: boolean;
}

// allowFontScaling stays on (default) so Dynamic Type works; cap runaway sizes.
export function Text({ variant = 'body', secondary, style, ...rest }: Props) {
  const { colors, typography } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      accessibilityRole={variant === 'largeTitle' || variant === 'title1' ? 'header' : undefined}
      style={[typography[variant], { color: secondary ? colors.textSecondary : colors.text }, style]}
      {...rest}
    />
  );
}
