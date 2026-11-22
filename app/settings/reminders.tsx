import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Chip, Group, ListRow, SectionLabel } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { formatTime, REMINDER_TIMES } from '@/features/reminders/reminderSettings';
import { useReminder } from '@/features/reminders/useReminder';
import { useTheme } from '@/theme/useTheme';
import { tileColors } from '@/theme/tokens';

export default function RemindersScreen() {
  const { spacing, colors } = useTheme();
  const { settings, loaded, update } = useReminder();
  const [denied, setDenied] = useState(false);
  const isWeb = Platform.OS === 'web';

  async function change(next: typeof settings) {
    const r = await update(next);
    if (r.ok) return setDenied(false);
    if (r.reason === 'permission-denied') setDenied(true);
    else showToast(r.reason === 'unavailable' ? 'Reminders need the iPhone app.' : 'Couldn’t update the reminder. Try again.', 'error');
  }

  return (
    <Screen>
      <Group>
        <ListRow
          icon="notifications"
          iconColor={tileColors.orange}
          title="Daily reminder"
          toggle={{ value: settings.enabled, onChange: (v) => void change({ ...settings, enabled: v }) }}
          last
        />
      </Group>

      {isWeb ? <Text secondary>Reminders are delivered by the iPhone app. This web preview can’t schedule them.</Text> : null}

      {denied ? (
        <View accessibilityRole="alert" style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.dangerInk }}>Notifications are turned off for HabitFlow.</Text>
          <Text secondary onPress={() => void Linking.openSettings()} accessibilityRole="link">
            Open Settings to allow them
          </Text>
        </View>
      ) : null}

      {loaded && settings.enabled ? (
        <>
          <SectionLabel>Time</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {REMINDER_TIMES.map((t) => (
              <Chip
                key={`${t.hour}:${t.minute}`}
                label={formatTime(t.hour, t.minute)}
                selected={settings.hour === t.hour && settings.minute === t.minute}
                onPress={() => void change({ ...settings, hour: t.hour, minute: t.minute })}
              />
            ))}
          </View>
          <Text variant="footnote" secondary>
            One gentle reminder a day, at the time you choose. It never mentions streaks you might lose.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
