import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ui/AdBanner';
import { Ionicons } from '@expo/vector-icons';
import { LargeHeader } from '@/components/ui/LargeHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/StateViews';
import { Text } from '@/components/ui/Text';
import { useHabits, useLogs, useStreaks, useTodayStr } from '@/features/habits/hooks/useHabits';
import { BarChart } from '@/features/stats/components/BarChart';
import { Heatmap } from '@/features/stats/components/Heatmap';
import { SegmentedControl } from '@/features/stats/components/SegmentedControl';
import {
  buildIndex, heatmap, historyLimit, monthSeries, percent, perfectDays, perHabit, rangeFor, scoreRange,
  weekSeries, yearSeries, type Period, type StatHabit,
} from '@/features/stats/logic/stats';
import { InsightsSection } from '@/features/momentum/components/InsightsSection';
import { useIsPro } from '@/lib/entitlements';
import { useTheme } from '@/theme/useTheme';
import { onColor, tileColors } from '@/theme/tokens';

const PERIODS = [
  { value: 'week' as const, label: 'Week' },
  { value: 'month' as const, label: 'Month' },
  { value: 'year' as const, label: 'Year' },
];
const TITLES: Record<Period, string> = { week: 'Last 7 days', month: 'Last 5 weeks', year: 'Last 12 months' };

export default function StatsScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const today = useTodayStr();
  const isPro = useIsPro();
  const [period, setPeriod] = useState<Period>('week');

  const habitsQ = useHabits();
  const logsQ = useLogs();
  const loading = habitsQ.isPending || logsQ.isPending;
  const error = habitsQ.error ?? logsQ.error;

  const active = useMemo(() => (habitsQ.data ?? []).filter((h) => !h.archivedAt), [habitsQ.data]);
  const streaks = useStreaks(active, logsQ.data, today);

  const stat = useMemo<StatHabit[]>(
    () => active.map((h) => ({ id: h.id, name: h.name, color: h.color, cadence: h.cadence, startDate: h.startDate })),
    [active],
  );
  const index = useMemo(() => buildIndex(logsQ.data ?? []), [logsQ.data]);

  const visibleFrom = historyLimit(today, isPro);
  const locked = !isPro && period !== 'week';
  const { from, to } = rangeFor(period, today);

  const summary = useMemo(() => scoreRange(stat, index, from, to), [stat, index, from, to]);
  const perfect = useMemo(() => perfectDays(stat, index, from, to), [stat, index, from, to]);
  const rows = useMemo(() => perHabit(stat, index, from, to), [stat, index, from, to]);
  const buckets = useMemo(
    () => (period === 'week' ? weekSeries(stat, index, today) : period === 'month' ? monthSeries(stat, index, today) : yearSeries(stat, index, today)),
    [period, stat, index, today],
  );
  const grid = useMemo(() => heatmap(stat, index, today), [stat, index, today]);

  const longest = useMemo(() => Math.max(0, ...[...streaks.values()].map((s) => s.longest)), [streaks]);
  const fullDays = useMemo(
    () => grid.flat().filter((c) => !c.future && c.level === 4 && (visibleFrom === null || c.date >= visibleFrom)).length,
    [grid, visibleFrom],
  );

  const card = { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.md }}
    >
      <LargeHeader title="Stats" subtitle="Your progress" />
      <OfflineBanner />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState message="We couldn’t load your stats." onRetry={() => void Promise.all([habitsQ.refetch(), logsQ.refetch()])} />
      ) : active.length === 0 ? (
        <EmptyState title="Nothing to show yet" body="Once you’ve created a habit and checked in a few times, your progress will appear here." />
      ) : (
        <>
          <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} accessibilityLabel="Time range" />

          {locked ? (
            <View style={card}>
              <Text variant="title2">Full history is a Pro feature</Text>
              <Text secondary>
                The free plan shows your last 7 days. Pro unlocks weekly, monthly and yearly trends and your complete history.
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Tile icon="trending-up" tone={tileColors.green} label="Completion" value={percent(summary.rate)} />
                <Tile icon="star" tone={tileColors.gold} label="Perfect days" value={String(perfect)} />
                <Tile icon="flame" tone={tileColors.orange} label="Best streak" value={String(longest)} />
              </View>

              <View style={card}>
                <Text variant="headline">{TITLES[period]}</Text>
                <BarChart buckets={buckets} />
              </View>
            </>
          )}

          <View style={card}>
            <Text variant="headline">Last 15 weeks</Text>
            <Heatmap
              columns={grid}
              visibleFrom={visibleFrom}
              summary={`Completion heatmap for the last 15 weeks. ${fullDays} ${fullDays === 1 ? 'day' : 'days'} with everything completed${visibleFrom ? ' in the last 7 days; older history is locked on the free plan' : ''}.`}
            />
            {!isPro && (
              <Text variant="footnote" secondary>
                Free plan shows the last 7 days. Pro unlocks your full history.
              </Text>
            )}
          </View>

          <InsightsSection habits={habitsQ.data ?? []} logs={logsQ.data ?? []} today={today} />

          {!locked && (
            <View style={card}>
              <Text variant="headline">By habit</Text>
              {rows.map(({ habit, rate }) => (
                <View key={habit.id} accessible accessibilityLabel={`${habit.name}: ${percent(rate)}`} style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text numberOfLines={1} style={{ flex: 1 }}>{habit.name}</Text>
                    <Text secondary>{percent(rate)}</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
                    <View style={{ height: 8, width: `${Math.round((rate ?? 0) * 100)}%`, backgroundColor: habit.color }} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
      <AdBanner />
    </ScrollView>
  );
}

function Tile({ label, value, icon, tone }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name']; tone: string }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}
    >
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: tone }}>
        <Ionicons name={icon} size={16} color={onColor} />
      </View>
      <View>
        <Text variant="title2">{value}</Text>
        <Text variant="caption" secondary>{label}</Text>
      </View>
    </View>
  );
}
