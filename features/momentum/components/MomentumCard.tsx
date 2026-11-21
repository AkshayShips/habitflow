import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { Card, Chip } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import type { Habit, HabitLog } from '@/features/habits/api/habitRepository';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useTheme } from '@/theme/useTheme';
import { suggestForToday } from '../logic/suggestions';
import { topRecovery } from '../logic/recovery';
import type { DayMode } from '../logic/types';
import { useMomentumStore } from '../store/momentumStore';

const MODES: { id: DayMode; label: string }[] = [
  { id: 'light', label: 'Light day' },
  { id: 'normal', label: 'Normal' },
  { id: 'full', label: 'Full day' },
];

/**
 * Adaptive Momentum on Today. Optional: pick how today feels (or ignore it), get one suggestion built from
 * what's actually on your list today, and, only if a habit has slipped, gentle recovery options.
 * Nothing here changes your habits or history.
 */
export function MomentumCard({ habits, logs, today }: { habits: Habit[]; logs: HabitLog[]; today: string }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { dayMode, setDayMode, load } = useMomentumStore();

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  const mode: DayMode | null = dayMode && dayMode.date === today ? dayMode.mode : null;
  const suggestion = useMemo(() => suggestForToday(habits, logs, today, mode), [habits, logs, today, mode]);
  const recovery = useMemo(() => topRecovery(habits, logs, today), [habits, logs, today]);
  const recoveryHabit = recovery ? habits.find((h) => h.id === recovery.habitId) : undefined;

  return (
    <Card>
      <Text variant="footnote" secondary style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>How does today feel?</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {MODES.map((m) => (
          <Chip key={m.id} label={m.label} selected={mode === m.id} onPress={() => setDayMode(today, mode === m.id ? null : m.id)} />
        ))}
      </View>
      <Text accessibilityLiveRegion="polite">{suggestion.text}</Text>

      {recovery && recoveryHabit ? (
        <View style={{ gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text variant="headline">{recovery.headline}</Text>
          {recovery.actions.map((a) => (
            <Text key={a.id} variant="footnote" secondary>
              <Text variant="footnote" style={{ fontWeight: '600' }}>{a.label}. </Text>
              {a.detail}
            </Text>
          ))}
          <Button
            title={`Edit ${recoveryHabit.name}`}
            variant="secondary"
            onPress={() => router.push(`/habit/${recoveryHabit.id}`)}
          />
        </View>
      ) : null}
    </Card>
  );
}
