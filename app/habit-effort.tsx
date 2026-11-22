import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, ListSkeleton } from '@/components/ui/StateViews';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { useHabit } from '@/features/habits/hooks/useHabits';
import { useEffortLevels, useSaveEffortLevels } from '@/features/momentum/hooks/useMomentum';
import { useTheme } from '@/theme/useTheme';

/** Parses "", "5", "5.5" (or "5,5"). Returns null for empty, NaN for invalid. */
function parseTarget(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

export default function HabitEffortScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const habitQ = useHabit(id);
  const levelsQ = useEffortLevels();
  const save = useSaveEffortLevels(id);
  // Edits live in `draft*`; until the user types, the saved values are shown.
  const [draftMin, setMin] = useState<string | null>(null);
  const [draftExt, setExt] = useState<string | null>(null);
  const saved = (levelsQ.data ?? []).filter((l) => l.habitId === id);
  const min = draftMin ?? String(saved.find((l) => l.level === 'minimum')?.targetValue ?? '');
  const ext = draftExt ?? String(saved.find((l) => l.level === 'extended')?.targetValue ?? '');

  const habit = habitQ.data;
  if (habitQ.isPending || levelsQ.isPending) return <Screen><ListSkeleton rows={3} /></Screen>;
  if (!habit) return <Screen><ErrorState message="We couldn’t find this habit." onRetry={() => void habitQ.refetch()} /></Screen>;

  const unit = habit.unit ? ` ${habit.unit}` : '';
  const minV = parseTarget(min);
  const extV = parseTarget(ext);
  let error: string | null = null;
  if (Number.isNaN(minV) || Number.isNaN(extV) || (minV !== null && minV <= 0) || (extV !== null && extV <= 0)) {
    error = 'Use numbers greater than zero, or leave a level empty.';
  } else if (minV !== null && minV > habit.targetValue) {
    error = `Minimum should be at most your standard target (${habit.targetValue}${unit}).`;
  } else if (extV !== null && extV < habit.targetValue) {
    error = `Extended should be at least your standard target (${habit.targetValue}${unit}).`;
  }

  const field = (label: string, hint: string, value: string, onChange: (v: string) => void) => (
    <View style={{ gap: spacing.xs }}>
      <Text variant="headline">{label}</Text>
      <Text variant="footnote" secondary>{hint}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="Not set"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={`${label} target${unit}`}
        style={{
          minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
          backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, fontSize: 17,
        }}
      />
    </View>
  );

  return (
    <Screen
      footer={
        <Button
          title="Save"
          loading={save.isPending}
          disabled={error !== null}
          onPress={() =>
            save.mutate(
              { minimum: minV, extended: extV },
              {
                onSuccess: () => {
                  router.back();
                  showToast('Effort levels saved', 'success');
                },
                onError: () => showToast('Couldn’t save. Please try again.', 'error'),
              },
            )
          }
        />
      }
    >
      <Text variant="title2">{habit.name}</Text>
      <Text secondary>
        Some days you have more energy than others. Set what a small day and a big day look like. Any level counts as
        done, and your streak doesn’t change.
      </Text>

      <Card>
        {field('Minimum', `The smallest version that still counts${unit ? ` (${unit.trim()})` : ''}.`, min, setMin)}
        <View style={{ gap: spacing.xs }}>
          <Text variant="headline">Standard</Text>
          <Text variant="footnote" secondary>
            Your habit’s own target: {habit.targetValue}{unit}. Change it by editing the habit.
          </Text>
        </View>
        {field('Extended', 'A stretch version for days you feel strong.', ext, setExt)}
      </Card>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.dangerInk }}>{error}</Text> : null}
    </Screen>
  );
}
