import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip, ListRow, Group, ProgressBar } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

const STARTERS = ['Drink water', 'Walk 10 minutes', 'Read 5 pages', 'Stretch', 'Write one line', 'Go to bed on time', 'Meditate', 'Tidy one thing'];
const TIMES = ['Morning', 'Midday', 'Evening', 'No reminders'];

// UI PREVIEW: choices are not saved yet. The finished flow creates the chosen habits and schedules reminders.
export default function OnboardingScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [time, setTime] = useState('Morning');

  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : p.length < 3 ? [...p, s] : p));
  const last = step === 2;

  return (
    <Screen
      footer={
        <>
          <Button
            title={last ? 'Get started' : 'Continue'}
            disabled={step === 1 && picked.length === 0}
            onPress={() => (last ? router.back() : setStep(step + 1))}
          />
          {step > 0 ? <Button title="Back" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
        </>
      }
    >
      <ProgressBar value={(step + 1) / 3} label={`Step ${step + 1} of 3`} />

      {step === 0 && (
        <View style={{ gap: spacing.md, paddingTop: spacing.lg }}>
          <Ionicons name="leaf" size={48} color={colors.accent} />
          <Text variant="largeTitle">Small steps, steady progress</Text>
          <Text secondary>
            HabitFlow is built to be calm. There are no guilt trips or broken-chain shaming. Missed a day? You simply pick up again.
          </Text>
          <Group>
            <ListRow icon="checkmark-circle-outline" title="One tap check-ins" last={false} />
            <ListRow icon="cloud-offline-outline" title="Works offline, syncs when it can" />
            <ListRow icon="lock-closed-outline" title="Your data stays yours" last />
          </Group>
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: spacing.md }}>
          <Text variant="title1">Pick up to 3 to start</Text>
          <Text secondary>Start small. You can add or change these any time.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {STARTERS.map((s) => (
              <Chip key={s} label={s} selected={picked.includes(s)} onPress={() => toggle(s)} />
            ))}
          </View>
          <Text variant="footnote" secondary>{picked.length} of 3 selected</Text>
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: spacing.md }}>
          <Text variant="title1">When should we nudge you?</Text>
          <Text secondary>One gentle reminder a day, at most. You can change this in Settings.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {TIMES.map((t) => (
              <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
            ))}
          </View>
          <Text variant="footnote" secondary>
            iOS will ask for notification permission only when you finish, not before.
          </Text>
        </View>
      )}
    </Screen>
  );
}
