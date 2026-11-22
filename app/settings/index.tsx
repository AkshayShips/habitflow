import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { Group, ListRow, SectionLabel } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useIsGuest } from '@/features/auth/store/authStore';
import { tileColors } from '@/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const isGuest = useIsGuest();

  return (
    <Screen>
      <SectionLabel>Preferences</SectionLabel>
      <Group>
        <ListRow icon="notifications" iconColor={tileColors.orange} title="Reminders" onPress={() => router.push('/settings/reminders')} last />
      </Group>

      <SectionLabel>Your data</SectionLabel>
      <Group>
        <ListRow icon="download" iconColor={tileColors.green} title="Export my data" onPress={() => router.push('/settings/export')} />
        <ListRow icon="trash" title="Delete account" destructive onPress={() => router.push('/settings/delete-account')} last />
      </Group>
      {isGuest ? <Text variant="footnote" secondary>You’re using a guest session. Create an account in Profile to back up your data.</Text> : null}

      <SectionLabel>About</SectionLabel>
      <Group>
        <ListRow icon="information-circle" iconColor={tileColors.gray} title="Version" value={Constants.expoConfig?.version ?? '1.0.0'} last />
      </Group>
    </Screen>
  );
}
