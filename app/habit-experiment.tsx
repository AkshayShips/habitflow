import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card, Chip } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, ListSkeleton } from '@/components/ui/StateViews';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { useHabit, useLogs, useTodayStr } from '@/features/habits/hooks/useHabits';
import { addDays } from '@/features/habits/logic/dates';
import { useDecideExperiment, useExperiments, useStartExperiment } from '@/features/momentum/hooks/useMomentum';
import { evaluateExperiment, type ExperimentResult } from '@/features/momentum/logic/experiments';
import { hasFixedSchedule } from '@/features/momentum/logic/patterns';
import { describeTarget } from '@/features/momentum/logic/suggestions';
import { useTheme } from '@/theme/useTheme';

const DURATIONS = [7, 14, 21] as const;
const pct = (r: number | null) => (r === null ? 'no data' : `${Math.round(r * 100)}%`);

function resultText(r: ExperimentResult): string {
  switch (r.verdict) {
    case 'better': return `Completion is higher than before (${r.deltaPoints! > 0 ? '+' : ''}${r.deltaPoints} points).`;
    case 'worse': return `Completion is lower than before (${r.deltaPoints} points).`;
    case 'similar': return 'Completion is about the same as before.';
    default: return 'Too early to compare. Keep going for a few more days.';
  }
}

export default function HabitExperimentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const today = useTodayStr();
  const habitQ = useHabit(id);
  const logsQ = useLogs();
  const expQ = useExperiments();
  const start = useStartExperiment();
  const decide = useDecideExperiment();
  const [days, setDays] = useState<number>(7);
  const [trial, setTrial] = useState('');

  const habit = habitQ.data;
  const mine = useMemo(() => (expQ.data ?? []).filter((e) => e.habitId === id), [expQ.data, id]);
  const running = mine.find((e) => e.status === 'running');
  const past = mine.filter((e) => e.status !== 'running');

  const result = useMemo(() => {
    if (!habit || !running) return null;
    return evaluateExperiment(
      { id: habit.id, name: habit.name, cadence: habit.cadence, startDate: habit.startDate, archivedAt: habit.archivedAt, targetValue: habit.targetValue, unit: habit.unit },
      (logsQ.data ?? []).map((l) => ({ habitId: l.habitId, date: l.date, status: l.status })),
      { habitId: habit.id, startDate: running.startDate, durationDays: running.durationDays },
      today,
    );
  }, [habit, running, logsQ.data, today]);

  if (habitQ.isPending || expQ.isPending || logsQ.isPending) return <Screen><ListSkeleton rows={3} /></Screen>;
  if (!habit) return <Screen><ErrorState message="We couldn’t find this habit." onRetry={() => void habitQ.refetch()} /></Screen>;

  const unit = habit.unit;
  const trialNum = Number(trial.trim().replace(',', '.'));
  const trialValid = trial.trim() !== '' && Number.isFinite(trialNum) && trialNum > 0 && trialNum !== habit.targetValue;
  const fixed = hasFixedSchedule({ cadence: habit.cadence });

  if (running && result) {
    const endDate = addDays(running.startDate, running.durationDays - 1);
    return (
      <Screen>
        <Text variant="title2">{habit.name}</Text>
        <Card>
          <Text variant="headline">Trial: {describeTarget(running.trialTargetValue, unit)} instead of {describeTarget(running.baselineTargetValue, unit)}</Text>
          <Text secondary>
            Day {Math.min(result.daysElapsed + 1, running.durationDays)} of {running.durationDays} · ends {endDate}. Your habit and history stay as they are until you decide.
          </Text>
        </Card>
        <Card>
          <Text variant="headline">How it’s going</Text>
          {fixed ? (
            <>
              <Text>Before: {result.before.done} of {result.before.scheduled - result.before.skipped} days ({pct(result.before.rate)})</Text>
              <Text>During: {result.during.done} of {result.during.scheduled - result.during.skipped} days ({pct(result.during.rate)})</Text>
              <Text accessibilityLiveRegion="polite" style={{ fontWeight: '600' }}>{resultText(result)}</Text>
              <Text variant="footnote" secondary>{result.caveat}</Text>
            </>
          ) : (
            <Text secondary>
              This habit doesn’t have fixed days, so we can’t compare automatically. Trust how it feels. Does the new target make showing up easier?
            </Text>
          )}
        </Card>
        <View style={{ gap: spacing.sm }}>
          <Button
            title={`Keep ${describeTarget(running.trialTargetValue, unit)} as my target`}
            loading={decide.isPending}
            onPress={() =>
              decide.mutate(
                { id: running.id, decision: 'kept' },
                {
                  onSuccess: () => { router.back(); showToast('New target saved', 'success'); },
                  onError: () => showToast('Couldn’t save. Please try again.', 'error'),
                },
              )
            }
          />
          <Button
            title={`Go back to ${describeTarget(running.baselineTargetValue, unit)}`}
            variant="secondary"
            onPress={() =>
              decide.mutate(
                { id: running.id, decision: 'discarded' },
                {
                  onSuccess: () => { router.back(); showToast('Experiment ended. Nothing changed.', 'success'); },
                  onError: () => showToast('Couldn’t save. Please try again.', 'error'),
                },
              )
            }
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          title="Start experiment"
          disabled={!trialValid}
          loading={start.isPending}
          onPress={() =>
            start.mutate(
              { habitId: habit.id, startDate: today, durationDays: days, baselineTargetValue: habit.targetValue, trialTargetValue: trialNum },
              {
                onSuccess: () => showToast('Experiment started', 'success'),
                onError: (e) => showToast(e instanceof Error ? e.message : 'Couldn’t start. Please try again.', 'error'),
              },
            )
          }
        />
      }
    >
      <Text variant="title2">{habit.name}</Text>
      <Text secondary>
        Try a different target for a short while and compare. Nothing about your habit or history changes unless you choose to keep the new target at the end.
      </Text>
      <Card>
        <Text variant="headline">Trial target{unit ? ` (${unit})` : ''}</Text>
        <Text variant="footnote" secondary>Current target: {describeTarget(habit.targetValue, unit)}</Text>
        <TextInput
          value={trial}
          onChangeText={setTrial}
          keyboardType="decimal-pad"
          placeholder="e.g. a smaller number"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Trial target"
          style={{
            minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, fontSize: 17,
          }}
        />
        <Text variant="headline">How long</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {DURATIONS.map((d) => (
            <Chip key={d} label={`${d} days`} selected={days === d} onPress={() => setDays(d)} />
          ))}
        </View>
        {!fixed ? (
          <Text variant="footnote" secondary>
            Heads up: this habit doesn’t have fixed days, so we can’t compare results automatically. You’ll decide based on how it feels.
          </Text>
        ) : null}
      </Card>
      {past.length > 0 ? (
        <Card>
          <Text variant="headline">Past experiments</Text>
          {past.map((e) => (
            <Text key={e.id} variant="footnote" secondary>
              {e.startDate}: {describeTarget(e.trialTargetValue, unit)} for {e.durationDays} days · {e.status === 'kept' ? 'kept' : 'not kept'}
            </Text>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
