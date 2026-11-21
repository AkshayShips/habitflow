import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { HabitIcon } from '@/components/ui/HabitIcon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

interface Props {
  name: string;
  icon: string;
  color: string;
  subtitle: string;
  done: boolean;
  streak: number;
  last?: boolean;
  onToggle: () => void;
}

/** One row of the Today list: colored icon tile, title, streak, and a large circular check. Whole row is the tap target. */
export function HabitRow({ name, icon, color, subtitle, done, streak, last, onToggle }: Props) {
  const { colors, spacing, isDark } = useTheme();
  const streakLabel = streak > 0 ? `${streak} ${streak === 1 ? 'day' : 'in a row'}` : null;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${name}. ${subtitle}${streakLabel ? `. ${streakLabel}` : ''}`}
      accessibilityHint={done ? 'Double tap to mark as not done' : 'Double tap to mark as done'}
      onPress={() => {
        void (done
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        onToggle();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, minHeight: 68,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
      })}
    >
      <View
        style={{
          width: 40, height: 40, borderRadius: 11, marginRight: spacing.md,
          alignItems: 'center', justifyContent: 'center', backgroundColor: color, opacity: done ? 0.55 : 1,
        }}
      >
        <HabitIcon name={icon} color="#FFFFFF" size={22} />
      </View>

      <View
        style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 68, paddingRight: spacing.lg,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={2} style={done ? { opacity: 0.5 } : undefined}>
            {name}
          </Text>
          <Text variant="footnote" secondary numberOfLines={1}>{subtitle}</Text>
        </View>

        {streakLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Ionicons name="flame" size={15} color={isDark ? '#FFB340' : '#D9730D'} />
            <Text variant="footnote" style={{ color: isDark ? '#FFB340' : '#B45F06', fontWeight: '600' }}>{streak}</Text>
          </View>
        ) : null}

        <View
          style={{
            width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
            backgroundColor: done ? color : 'transparent', borderWidth: 2, borderColor: done ? color : colors.border,
          }}
        >
          {done ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
        </View>
      </View>
    </Pressable>
  );
}
