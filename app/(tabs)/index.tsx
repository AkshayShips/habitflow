import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/StateViews';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card, Group, SectionLabel } from '@/components/ui/Card';
import { LargeHeader } from '@/components/ui/LargeHeader';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { HabitRow } from '@/features/habits/components/HabitRow';
import { useHabits, useLogs, useStreaks, useToggleDone, useTodayStr } from '@/features/habits/hooks/useHabits';
import { addDays, weekStart } from '@/features/habits/logic/dates';
import { describeCadence, isScheduledOn } from '@/features/habits/logic/schedule';
import { useTheme } from '@/theme/useTheme';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const longDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

export default function TodayScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = useTodayStr();

  const habitsQ = useHabits();
  const logsQ = useLogs();
  const toggle = useToggleDone();
  const streaks = useStreaks(habitsQ.data, logsQ.data, today);

  const rows = useMemo(() => {
    const habits = (habitsQ.data ?? []).filter((h) => h.archivedAt === null);
    const logs = logsQ.data ?? [];
    const wk = weekStart(today);
    return habits
      .filter((h) => isScheduledOn(h.cadence, today, h.startDate))
      .map((h) => {
        const mine = logs.filter((l) => l.habitId === h.id && l.status === 'done');
        const done = mine.some((l) => l.date === today);
        let subtitle = describeCadence(h.cadence);
        if (h.cadence.type === 'x_per_week') {
          const n = mine.filter((l) => l.date >= wk && l.date <= addDays(wk, 6)).length;
          subtitle = `${n}/${h.cadence.config.times ?? 1} this week`;
        }
        return { habit: h, done, subtitle };
      });
  }, [habitsQ.data, logsQ.data, today]);

  const doneCount = rows.filter((r) => r.done).length;
  const bestStreak = rows.reduce((m, r) => Math.max(m, streaks.get(r.habit.id)?.current ?? 0), 0);
  const loading = habitsQ.isPending || logsQ.isPending;
  const error = habitsQ.error ?? logsQ.error;
  const noHabitsAtAll = !loading && !error && (habitsQ.data ?? []).filter((h) => !h.archivedAt).length === 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => void Promise.all([habitsQ.refetch(), logsQ.refetch()])}
        />
      }
    >
      <LargeHeader title={greeting()} subtitle={longDate(today)} />

      <OfflineBanner />

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState
          message="We couldn’t load your habits from this device."
          onRetry={() => void Promise.all([habitsQ.refetch(), logsQ.refetch()])}
        />
      ) : noHabitsAtAll ? (
        <EmptyState
          title="Start with one small habit"
          body="Pick something you can do in under two minutes. You can always build from there."
          actionLabel="Create a habit"
          onAction={() => router.push('/habit/new')}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing scheduled today" body="Enjoy the day off. Your habits will be back on their next scheduled day." />
      ) : (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <ProgressRing
              progress={rows.length ? doneCount / rows.length : 0}
              label={`${doneCount} of ${rows.length} habits done today`}
              color={doneCount === rows.length ? colors.success : colors.accent}
            >
              <Text variant="title2">{doneCount}/{rows.length}</Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text accessibilityLiveRegion="polite" variant="title2">
                {doneCount === rows.length ? 'All done' : doneCount === 0 ? 'Let’s begin' : 'Keep going'}
              </Text>
              <Text secondary>
                {doneCount === rows.length ? 'Nice and steady today.' : `${rows.length - doneCount} left for today`}
              </Text>
              {bestStreak > 0 ? (
                <Text variant="footnote" style={{ color: colors.warningInk, fontWeight: '600' }}>
                  Longest active streak: {bestStreak} {bestStreak === 1 ? 'day' : 'days'}
                </Text>
              ) : null}
            </View>
          </Card>

          <SectionLabel>Habits</SectionLabel>
          <Group>
            {rows.map(({ habit, done, subtitle }, i) => (
              <HabitRow
                key={habit.id}
                name={habit.name}
                icon={habit.icon}
                color={habit.color}
                subtitle={subtitle}
                done={done}
                last={i === rows.length - 1}
                streak={streaks.get(habit.id)?.current ?? 0}
                onOpen={() => router.push({ pathname: '/habit-detail', params: { id: habit.id } })}
                onToggle={() =>
                  toggle.mutate(
                    { habitId: habit.id, date: today, done: !done },
                    { onError: () => showToast('Couldn’t save that check-in. Please try again.', 'error') },
                  )
                }
              />
            ))}
          </Group>
        </>
      )}
    </ScrollView>
  );
}
