import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

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
  leading?: React.ReactNode;
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

export function ListRow({ leading, title, subtitle, icon, iconColor, value, onPress, destructive, toggle, last, badge }: RowProps) {
  const { colors, spacing } = useTheme();
  const tile = destructive ? colors.danger : (iconColor ?? colors.accent);
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, minHeight: 56 }}>
      {leading ? (
        <View style={{ marginRight: spacing.md }}>{leading}</View>
      ) : icon ? (
        <View
          style={{
            width: 30, height: 30, borderRadius: 8, marginRight: spacing.md,
            alignItems: 'center', justifyContent: 'center', backgroundColor: tile,
          }}
        >
          <Ionicons name={icon} size={18} color="#FFFFFF" />
        </View>
      ) : null}
      <View
        style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56,
          paddingVertical: spacing.sm, paddingRight: spacing.lg,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border,
        }}
      >
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
            trackColor={{ true: colors.success, false: colors.surfaceAlt }}
          />
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        ) : null}
      </View>
    </View>
  );
  if (!onPress || toggle) return <View accessible={!toggle}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, value, subtitle].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}
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
      style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
    >
      <View style={{ height: 8, width: `${pct * 100}%`, backgroundColor: color ?? colors.accent, borderRadius: 4 }} />
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
