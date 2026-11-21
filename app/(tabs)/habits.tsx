import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Group, ListRow, SectionLabel } from '@/components/ui/Card';
import { LargeHeader } from '@/components/ui/LargeHeader';
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
      <LargeHeader
        title="Habits"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add habit"
            onPress={() => router.push('/habit/new')}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="add" size={26} color={colors.accentText} />
          </Pressable>
        }
      />

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
            <Text variant="footnote" secondary style={{ marginLeft: spacing.xs }}>
              {active.length} of {FREE_HABIT_LIMIT} free habits in use
            </Text>
          )}
          <Group>
            {active.map((h, i) => (
              <Row key={h.id} habit={h} streak={streaks.get(h.id)} last={i === active.length - 1} onPress={() => router.push({ pathname: '/habit-detail', params: { id: h.id } })} />
            ))}
          </Group>

          {archived.length > 0 && (
            <>
              <SectionLabel>Archived</SectionLabel>
              <Group>
                {archived.map((h, i) => (
                  <Row key={h.id} habit={h} streak={streaks.get(h.id)} last={i === archived.length - 1} dim onPress={() => router.push({ pathname: '/habit-detail', params: { id: h.id } })} />
                ))}
              </Group>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Row({ habit, streak, onPress, dim, last }: { habit: Habit; streak?: StreakResult; onPress: () => void; dim?: boolean; last?: boolean }) {
  const best = streak?.longest ?? 0;
  return (
    <View style={{ opacity: dim ? 0.55 : 1 }}>
      <ListRow
        leading={
          <View style={{ width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: habit.color }}>
            <HabitIcon name={habit.icon} color="#FFFFFF" size={22} />
          </View>
        }
        title={habit.name}
        subtitle={describeCadence(habit.cadence)}
        value={best > 0 ? `Best ${best}` : undefined}
        onPress={onPress}
        last={last}
      />
    </View>
  );
}
