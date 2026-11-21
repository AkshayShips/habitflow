import { useState } from 'react';
import { View } from 'react-native';

import { Chip, Group, ListRow, SectionLabel } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useHabits } from '@/features/habits/hooks/useHabits';
import { useTheme } from '@/theme/useTheme';
import { tileColors } from '@/theme/tokens';

const TIMES = ['7:00 AM', '8:00 AM', '12:30 PM', '6:00 PM', '9:00 PM'];

// UI PREVIEW: nothing is scheduled yet. The real version uses expo-notifications local notifications.
export default function RemindersScreen() {
  const { spacing } = useTheme();
  const habitsQ = useHabits();
  const habits = (habitsQ.data ?? []).filter((h) => !h.archivedAt);

  const [enabled, setEnabled] = useState(true);
  const [time, setTime] = useState('8:00 AM');
  const [quiet, setQuiet] = useState(true);
  const [off, setOff] = useState<string[]>([]);

  return (
    <Screen>
      <Group>
        <ListRow icon="notifications" iconColor={tileColors.orange} title="Daily reminder" toggle={{ value: enabled, onChange: setEnabled }} last />
      </Group>

      {enabled ? (
        <>
          <SectionLabel>Time</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {TIMES.map((t) => (
              <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
            ))}
          </View>

          <SectionLabel>Quiet hours</SectionLabel>
          <Group>
            <ListRow icon="moon" iconColor={tileColors.purple} title="Pause 10 PM to 7 AM" toggle={{ value: quiet, onChange: setQuiet }} last />
          </Group>

          <SectionLabel>Include these habits</SectionLabel>
          {habits.length === 0 ? (
            <Text secondary>Create a habit to choose which ones appear in your reminder.</Text>
          ) : (
            <Group>
              {habits.map((h, i) => (
                <ListRow
                  key={h.id}
                  title={h.name}
                  toggle={{ value: !off.includes(h.id), onChange: (v) => setOff((o) => (v ? o.filter((x) => x !== h.id) : [...o, h.id])) }}
                  last={i === habits.length - 1}
                />
              ))}
            </Group>
          )}
          <Text variant="footnote" secondary>
            Reminders are gentle and never mention streaks you might lose.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
