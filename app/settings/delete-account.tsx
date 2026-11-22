import { useState } from 'react';
import { TextInput } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { deleteAccount } from '@/features/account/deleteAccount';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useTheme } from '@/theme/useTheme';

export default function DeleteAccountScreen() {
  const { colors, spacing, radius } = useTheme();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = text.trim().toUpperCase() === 'DELETE';

  async function run() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const r = await deleteAccount(userId);
    setBusy(false);
    if (!r.ok) setError(r.message);
    // On success the session is gone and the app routes back to sign-in on its own.
  }

  return (
    <Screen
      footer={
        <Button
          title="Delete my account"
          disabled={!ok}
          loading={busy}
          variant="danger"
          onPress={() => void run()}
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
      {error ? <Text accessibilityRole="alert" style={{ color: colors.dangerInk }}>{error}</Text> : null}
    </Screen>
  );
}
