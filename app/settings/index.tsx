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
        <ListRow icon="notifications" iconColor="#E07B5B" title="Reminders" onPress={() => router.push('/settings/reminders')} />
        <ListRow icon="phone-portrait" iconColor="#7A8696" title="Haptic feedback" toggle={{ value: haptics, onChange: setHaptics }} />
        <ListRow icon="calendar" iconColor="#5B8DEF" title="Week starts on Monday" toggle={{ value: mondayStart, onChange: setMondayStart }} last />
      </Group>

      <SectionLabel>Privacy</SectionLabel>
      <Group>
        <ListRow
          icon="analytics" iconColor="#8E7CE0"
          title="Share anonymous usage data"
          subtitle="Helps improve the app. No habit names or journal text."
          toggle={{ value: analytics, onChange: setAnalytics }}
          last
        />
      </Group>

      <SectionLabel>Your data</SectionLabel>
      <Group>
        <ListRow icon="download" iconColor="#4FB286" title="Export my data" onPress={() => router.push('/settings/export')} />
        <ListRow icon="trash" title="Delete account" destructive onPress={() => router.push('/settings/delete-account')} last />
      </Group>
      {isGuest ? <Text variant="footnote" secondary>You’re using a guest session. Create an account in Profile to back up your data.</Text> : null}

      <SectionLabel>About</SectionLabel>
      <Group>
        <ListRow icon="help-circle" iconColor="#4BB3C4" title="Help and support" onPress={() => undefined} />
        <ListRow icon="document-text" iconColor="#7A8696" title="Privacy Policy" onPress={() => undefined} />
        <ListRow icon="reader" iconColor="#7A8696" title="Terms of Use" onPress={() => undefined} />
        <ListRow icon="information-circle" iconColor="#7A8696" title="Version" value={Constants.expoConfig?.version ?? '1.0.0'} last />
      </Group>
    </Screen>
  );
}
