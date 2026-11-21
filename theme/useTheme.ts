import { useColorScheme } from 'react-native';

import { darkColors, lightColors, radius, spacing, typography } from './tokens';

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    spacing,
    radius,
    typography,
  };
}
