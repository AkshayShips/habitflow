import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { HabitIcon } from '@/components/ui/HabitIcon';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/StateViews';
import { Text } from '@/components/ui/Text';
import type { Habit } from '@/features/habits/api/habitRepository';
import { useHabits, useLogs, useStreaks, useTodayStr } from '@/features/habits/hooks/useHabits';
import { describeCadence } from '@/features/habits/logic/schedule';
import type { StreakResult } from '@/features/habits/logic/types';
import { FREE_HABIT_LIMIT, useIsPro } from '@/lib/entitlements';
import { useTheme } from '@/theme/useTheme';

export default function HabitsScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = useTodayStr();
  const isPro = useIsPro();

  const habitsQ = useHabits();
  const logsQ = useLogs();
  const streaks = useStreaks(habitsQ.data, logsQ.data, today);

  const active = (habitsQ.data ?? []).filter((h) => !h.archivedAt);
  const archived = (habitsQ.data ?? []).filter((h) => h.archivedAt);
  const loading = habitsQ.isPending;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="largeTitle">Habits</Text>
        <View style={{ width: 120 }}>
          <Button title="Add" onPress={() => router.push('/habit/new')} />
        </View>
      </View>

      <OfflineBanner />

      {loading ? (
        <ListSkeleton />
      ) : habitsQ.error ? (
        <ErrorState message="We couldn’t load your habits." onRetry={() => void habitsQ.refetch()} />
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState
          title="No habits yet"
          body="Create your first habit. Small and specific works best."
          actionLabel="Create a habit"
          onAction={() => router.push('/habit/new')}
        />
      ) : (
        <>
          {!isPro && (
            <Text variant="footnote" secondary>
              {active.length} of {FREE_HABIT_LIMIT} free habits in use
            </Text>
          )}
          <View style={{ gap: spacing.sm }}>
            {active.map((h) => (
              <Row key={h.id} habit={h} streak={streaks.get(h.id)} onPress={() => router.push({ pathname: '/habit-detail', params: { id: h.id } })} />
            ))}
          </View>

          {archived.length > 0 && (
            <>
              <Text variant="headline" style={{ marginTop: spacing.md }}>Archived</Text>
              <View style={{ gap: spacing.sm }}>
                {archived.map((h) => (
                  <Row key={h.id} habit={h} streak={streaks.get(h.id)} onPress={() => router.push({ pathname: '/habit-detail', params: { id: h.id } })} dim />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Row({ habit, streak, onPress, dim }: { habit: Habit; streak?: StreakResult; onPress: () => void; dim?: boolean }) {
  const { colors, spacing, radius } = useTheme();
  const best = streak?.longest ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${habit.name}. ${describeCadence(habit.cadence)}. Best streak ${best}. Opens details.`}
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 64,
        backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        opacity: dim ? 0.6 : 1,
      }}
    >
      <HabitIcon name={habit.icon} color={habit.color} size={26} />
      <View style={{ flex: 1 }}>
        <Text variant="headline" numberOfLines={1}>{habit.name}</Text>
        <Text variant="footnote" secondary numberOfLines={1}>
          {describeCadence(habit.cadence)} · best {best}
        </Text>
      </View>
    </Pressable>
  );
}
