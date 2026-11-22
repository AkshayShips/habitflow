import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card, Group, ListRow } from '@/components/ui/Card';
import { HabitIcon } from '@/components/ui/HabitIcon';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, ListSkeleton } from '@/components/ui/StateViews';
import { Text } from '@/components/ui/Text';
import { useHabit, useLogs, useStreaks, useTodayStr } from '@/features/habits/hooks/useHabits';
import { useEffortLevels, useExperiments } from '@/features/momentum/hooks/useMomentum';
import { describeTarget } from '@/features/momentum/logic/suggestions';
import { addDays, weekStart } from '@/features/habits/logic/dates';
import { describeCadence, isScheduledOn } from '@/features/habits/logic/schedule';
import { useTheme } from '@/theme/useTheme';
import { readableOn } from '@/lib/color';

const WEEKS = 6;
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const today = useTodayStr();

  const habitQ = useHabit(id);
  const logsQ = useLogs();
  const habit = habitQ.data;
  const levelsQ = useEffortLevels();
  const expQ = useExperiments();
  const streaks = useStreaks(habit ? [habit] : undefined, logsQ.data, today);

  const done = useMemo(
    () => new Set((logsQ.data ?? []).filter((l) => l.habitId === id && l.status === 'done').map((l) => l.date)),
    [logsQ.data, id],
  );

  if (habitQ.isPending || logsQ.isPending) return <Screen><ListSkeleton rows={3} /></Screen>;
  if (habitQ.error || !habit) {
    return <Screen><ErrorState message="We couldn’t find this habit." onRetry={() => void habitQ.refetch()} /></Screen>;
  }

  const streak = streaks.get(habit.id);
  const start = addDays(weekStart(today), -7 * (WEEKS - 1));
  const columns = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const totalDone = done.size;

  return (
    <Screen
      footer={<Button title="Edit habit" variant="secondary" onPress={() => router.push(`/habit/${habit.id}`)} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
          <HabitIcon name={habit.icon} color={habit.color} size={28} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title1" numberOfLines={2}>{habit.name}</Text>
          <Text secondary>{describeCadence(habit.cadence)}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {[
          { label: 'Current streak', value: streak?.current ?? 0 },
          { label: 'Best streak', value: streak?.longest ?? 0 },
          { label: 'Total check-ins', value: totalDone },
        ].map((t) => (
          <View
            key={t.label}
            accessible
            accessibilityLabel={`${t.label}: ${t.value}`}
            style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs }}
          >
            <Text variant="title2">{t.value}</Text>
            <Text variant="caption" secondary>{t.label}</Text>
          </View>
        ))}
      </View>

      <Group>
        <ListRow
          title="Effort levels"
          icon="options-outline"
          subtitle="Minimum, standard and extended targets"
          value={(() => {
            const mine = (levelsQ.data ?? []).filter((l) => l.habitId === habit.id);
            const lo = mine.find((l) => l.level === 'minimum');
            const hi = mine.find((l) => l.level === 'extended');
            if (!lo && !hi) return 'Not set';
            return [lo && describeTarget(lo.targetValue, habit.unit), describeTarget(habit.targetValue, habit.unit), hi && describeTarget(hi.targetValue, habit.unit)].filter(Boolean).join(' · ');
          })()}
          onPress={() => router.push({ pathname: '/habit-effort', params: { id: habit.id } })}
        />
        <ListRow
          title="Try a different target"
          icon="flask-outline"
          subtitle="Short experiment, your choice at the end"
          value={(expQ.data ?? []).some((e) => e.habitId === habit.id && e.status === 'running') ? 'Running' : undefined}
          onPress={() => router.push({ pathname: '/habit-experiment', params: { id: habit.id } })}
          last
        />
      </Group>

      <Card>
        <Text variant="headline">Last {WEEKS} weeks</Text>
        <View
          accessible
          accessibilityLabel={`Calendar of the last ${WEEKS} weeks. ${columns.flat().filter((d) => done.has(d)).length} days completed.`}
          style={{ gap: spacing.xs }}
        >
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {DOW.map((d, i) => (
              <Text key={i} variant="caption" secondary style={{ flex: 1, textAlign: 'center' }}>{d}</Text>
            ))}
          </View>
          {columns.map((week) => (
            <View key={week[0]} style={{ flexDirection: 'row', gap: spacing.xs }}>
              {week.map((d) => {
                const future = d > today;
                const isDone = done.has(d);
                const scheduled = isScheduledOn(habit.cadence, d, habit.startDate);
                return (
                  <View
                    key={d}
                    style={{
                      flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isDone ? habit.color : colors.surfaceAlt,
                      opacity: future ? 0.35 : scheduled || isDone ? 1 : 0.6,
                      borderWidth: d === today ? 2 : 0, borderColor: colors.text,
                    }}
                  >
                    <Text variant="caption" style={{ color: isDone ? readableOn(habit.color) : colors.textSecondary }}>
                      {Number(d.slice(8))}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
