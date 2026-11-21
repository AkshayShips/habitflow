import { Pressable, View } from 'react-native';
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
  onToggle: () => void;
  onOpen?: () => void;
}

export function HabitRow({ name, icon, color, subtitle, done, streak, onToggle, onOpen }: Props) {
  const { colors, spacing, radius } = useTheme();
  const streakLabel = streak > 0 ? `${streak} ${streak === 1 ? 'day' : 'in a row'}` : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 72,
        paddingRight: spacing.xs,
      }}
    >
      {/* Whole left area is the check-in target: one tap. */}
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
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: done ? color : 'transparent',
            borderWidth: 2,
            borderColor: color,
          }}
        >
          {done ? (
            <Ionicons name="checkmark" size={24} color="#FFFFFF" />
          ) : (
            <HabitIcon name={icon} color={color} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            variant="headline"
            style={done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
            numberOfLines={2}
          >
            {name}
          </Text>
          <Text variant="footnote" secondary numberOfLines={1}>
            {streakLabel ? `${streakLabel} · ${subtitle}` : subtitle}
          </Text>
        </View>
      </Pressable>

      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${name}`}
          onPress={onOpen}
          hitSlop={8}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}
