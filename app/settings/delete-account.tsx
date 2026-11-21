import { useState } from 'react';
import { TextInput } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';

// UI PREVIEW: the button does nothing yet. The real version calls an Edge Function that deletes
// the auth user (all rows cascade), then wipes the local database and signs out.
export default function DeleteAccountScreen() {
  const { colors, spacing, radius } = useTheme();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const ok = text.trim().toUpperCase() === 'DELETE';

  return (
    <Screen
      footer={
        <Button
          title="Delete my account"
          disabled={!ok}
          variant="danger"
          onPress={() => setTried(true)}
        />
      }
    >
      <Card>
        <Text variant="title2">Delete your account</Text>
        <Text>This permanently removes your habits, check-ins, journal entries and progress from our servers and this device.</Text>
        <Text secondary>It can’t be undone. If you have an active subscription, cancel it in your Apple ID settings. Deleting your account doesn’t cancel it.</Text>
        <Text variant="footnote" secondary>Want a copy first? Use Export my data in Settings.</Text>
      </Card>
      <Text variant="headline">Type DELETE to confirm</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel="Type DELETE to confirm"
        placeholder="DELETE"
        placeholderTextColor={colors.textSecondary}
        style={{
          minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
          color: colors.text, paddingHorizontal: spacing.md, fontSize: 17,
        }}
      />
      {tried ? <Text accessibilityLiveRegion="polite" secondary>Preview only: nothing was deleted.</Text> : null}
    </Screen>
  );
}
