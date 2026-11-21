import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';

interface Props {
  children: ReactNode;
  /** Tab roots have no navigation header, so they need the top safe-area inset. */
  tab?: boolean;
  /** Footer pinned below the scroll area (e.g. a primary action). */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, tab, footer, contentStyle }: Props) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          { padding: spacing.lg, paddingTop: tab ? insets.top + spacing.md : spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            padding: spacing.lg,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            gap: spacing.sm,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
