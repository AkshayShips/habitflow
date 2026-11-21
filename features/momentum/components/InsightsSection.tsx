import { useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { Habit, HabitLog } from '@/features/habits/api/habitRepository';
import { useTheme } from '@/theme/useTheme';
import { generateInsights } from '../logic/insights';
import { useMomentumStore } from '../store/momentumStore';

const CONF = { low: 'Based on limited data', medium: 'Moderate amount of data', high: 'Based on plenty of data' } as const;

/** Explainable insights: observation, the numbers behind it, how much data, an optional idea, and a dismiss button. */
export function InsightsSection({ habits, logs, today }: { habits: Habit[]; logs: HabitLog[]; today: string }) {
  const { colors, spacing, radius } = useTheme();
  const dismissed = useMomentumStore((s) => s.dismissed);
  const dismiss = useMomentumStore((s) => s.dismiss);
  const insights = useMemo(
    () => generateInsights(habits, logs, today).filter((i) => !dismissed.includes(i.id)),
    [habits, logs, today, dismissed],
  );

  const box = { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm } as const;

  if (insights.length === 0) {
    return (
      <View style={box}>
        <Text variant="headline">Insights</Text>
        <Text secondary>
          Patterns show up after a few weeks of check-ins. We only mention something when there’s enough data behind it.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="headline">Insights</Text>
      {insights.map((i) => (
        <View key={i.id} style={box} accessible={false}>
          <Text variant="headline">{i.observation}</Text>
          <Text secondary>{i.evidence}</Text>
          <Text variant="caption" secondary>{CONF[i.confidence]} · {i.sampleSize} scheduled days</Text>
          {i.suggestedAction ? <Text variant="footnote">{i.suggestedAction}</Text> : null}
          <Button title="Dismiss" variant="ghost" onPress={() => dismiss(i.id)} accessibilityLabel={`Dismiss insight: ${i.observation}`} />
        </View>
      ))}
    </View>
  );
}
