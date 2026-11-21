import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { HabitIcon } from '@/components/ui/HabitIcon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';
import { readableOn } from '@/lib/color';

interface Props {
  name: string;
  icon: string;
  color: string;
  subtitle: string;
  done: boolean;
  streak: number;
  last?: boolean;
  onToggle: () => void;
  /** Opens the habit's detail screen. */
  onOpen?: () => void;
}

/**
 * One row of the Today list. The circle on the right is the check-in control (44pt target);
 * the rest of the row opens the habit's detail screen.
 */
export function HabitRow({ name, icon, color, subtitle, done, streak, last, onToggle, onOpen }: Props) {
  const { colors, spacing } = useTheme();
  const streakLabel = streak > 0 ? `${streak} ${streak === 1 ? 'day' : 'in a row'}` : null;
  const glyph = readableOn(color);

  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, minHeight: 68,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${subtitle}${streakLabel ? `. ${streakLabel}` : ''}`}
        accessibilityHint="Opens habit details"
        onPress={onOpen}
        disabled={!onOpen}
        style={({ pressed }) => ({
          flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 68,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            width: 40, height: 40, borderRadius: 11, marginRight: spacing.md,
            alignItems: 'center', justifyContent: 'center', backgroundColor: color, opacity: done ? 0.55 : 1,
          }}
        >
          <HabitIcon name={icon} color={glyph} size={22} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={2} style={done ? { opacity: 0.5 } : undefined}>
            {name}
          </Text>
          <Text variant="footnote" secondary numberOfLines={1}>{subtitle}</Text>
        </View>
        {streakLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: spacing.sm }}>
            <Ionicons name="flame" size={15} color={colors.warning} />
            <Text variant="footnote" style={{ color: colors.warningInk, fontWeight: '600' }}>{streak}</Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Mark ${name} as done`}
        accessibilityHint={done ? 'Double tap to mark as not done' : 'Double tap to mark as done'}
        hitSlop={4}
        onPress={() => {
          void (done
            ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
          onToggle();
        }}
        style={{
          width: 64, minHeight: 68, alignItems: 'center', justifyContent: 'center',
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
            backgroundColor: done ? color : 'transparent', borderWidth: 2, borderColor: done ? color : colors.border,
          }}
        >
          {done ? <Ionicons name="checkmark" size={18} color={glyph} /> : null}
        </View>
      </Pressable>
    </View>
  );
}
