import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }, style]}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const { spacing } = useTheme();
  return (
    <Text variant="footnote" secondary accessibilityRole="header" style={{ marginTop: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.6 }}>
      {children}
    </Text>
  );
}

/** A grouped list: rows separated by hairlines inside one rounded surface. */
export function Group({ children }: { children: ReactNode }) {
  const { colors, radius } = useTheme();
  return <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>{children}</View>;
}

interface RowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  /** Renders a switch instead of a chevron. */
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  last?: boolean;
  badge?: string;
}

export function ListRow({ title, subtitle, icon, iconColor, value, onPress, destructive, toggle, last, badge }: RowProps) {
  const { colors, spacing } = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border,
      }}
    >
      {icon ? <Ionicons name={icon} size={22} color={destructive ? colors.danger : (iconColor ?? colors.accent)} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={destructive ? { color: colors.danger } : undefined}>{title}</Text>
        {subtitle ? <Text variant="footnote" secondary>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
          <Text variant="caption" style={{ color: colors.accentText }}>{badge}</Text>
        </View>
      ) : null}
      {value ? <Text secondary>{value}</Text> : null}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          accessibilityLabel={title}
          trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
        />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      ) : null}
    </View>
  );
  if (!onPress || toggle) return <View accessible={!toggle}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, value, subtitle].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export function ProgressBar({ value, color, label }: { value: number; color?: string; label: string }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
    >
      <View style={{ height: 10, width: `${pct * 100}%`, backgroundColor: color ?? colors.accent, borderRadius: 5 }} />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999,
        backgroundColor: selected ? colors.accent : colors.surface,
        borderWidth: 1, borderColor: selected ? colors.accent : colors.border,
      }}
    >
      <Text variant="callout" style={{ color: selected ? colors.accentText : colors.text }}>{label}</Text>
    </Pressable>
  );
}
