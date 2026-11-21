import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Group, ListRow, SectionLabel } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useIsGuest } from '@/features/auth/store/authStore';

// UI PREVIEW: toggles are local state. Persisting preferences comes with the settings store.
export default function SettingsScreen() {
  const router = useRouter();
  const isGuest = useIsGuest();
  const [haptics, setHaptics] = useState(true);
  const [mondayStart, setMondayStart] = useState(true);
  const [analytics, setAnalytics] = useState(true);

  return (
    <Screen>
      <SectionLabel>Preferences</SectionLabel>
      <Group>
        <ListRow icon="notifications-outline" title="Reminders" onPress={() => router.push('/settings/reminders')} />
        <ListRow icon="phone-portrait-outline" title="Haptic feedback" toggle={{ value: haptics, onChange: setHaptics }} />
        <ListRow icon="calendar-outline" title="Week starts on Monday" toggle={{ value: mondayStart, onChange: setMondayStart }} last />
      </Group>

      <SectionLabel>Privacy</SectionLabel>
      <Group>
        <ListRow
          icon="analytics-outline"
          title="Share anonymous usage data"
          subtitle="Helps improve the app. No habit names or journal text."
          toggle={{ value: analytics, onChange: setAnalytics }}
          last
        />
      </Group>

      <SectionLabel>Your data</SectionLabel>
      <Group>
        <ListRow icon="download-outline" title="Export my data" onPress={() => router.push('/settings/export')} />
        <ListRow icon="trash-outline" title="Delete account" destructive onPress={() => router.push('/settings/delete-account')} last />
      </Group>
      {isGuest ? <Text variant="footnote" secondary>You’re using a guest session. Create an account in Profile to back up your data.</Text> : null}

      <SectionLabel>About</SectionLabel>
      <Group>
        <ListRow icon="help-circle-outline" title="Help and support" onPress={() => undefined} />
        <ListRow icon="document-text-outline" title="Privacy Policy" onPress={() => undefined} />
        <ListRow icon="reader-outline" title="Terms of Use" onPress={() => undefined} />
        <ListRow icon="information-circle-outline" title="Version" value={Constants.expoConfig?.version ?? '1.0.0'} last />
      </Group>
    </Screen>
  );
}
