import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Group, ListRow } from '@/components/ui/Card';
import { LargeHeader } from '@/components/ui/LargeHeader';
import { Text } from '@/components/ui/Text';
import { PAYMENTS_ENABLED, useIsPro } from '@/lib/entitlements';
import { sendMagicLink, signInWithApple, signOut } from '@/features/auth/api/auth';
import { useIsGuest, useUser } from '@/features/auth/store/authStore';
import { useSyncStore } from '@/features/sync/store/syncStore';
import { syncNow } from '@/features/sync/syncManager';
import { deleteLocalDb } from '@/lib/localDb';
import { useTheme } from '@/theme/useTheme';
import { tileColors } from '@/theme/tokens';

export default function ProfileScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useUser();
  const isGuest = useIsGuest();
  const sync = useSyncStore();
  const router = useRouter();
  const isPro = useIsPro();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upgradeWithEmail() {
    setBusy(true);
    setError(null);
    const result = await sendMagicLink(email);
    setBusy(false);
    if (result.status === 'error') setError(result.message);
    else setMessage(`Confirmation link sent to ${email.trim()}. Open it on this device to finish.`);
  }

  async function upgradeWithApple() {
    setBusy(true);
    setError(null);
    const result = await signInWithApple();
    setBusy(false);
    if (result.status === 'error') setError(result.message);
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.lg }}
    >
      <LargeHeader title="Profile" />

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
          <Text variant="title2" style={{ color: colors.accentText }}>
            {(isGuest ? 'G' : (user?.email?.[0] ?? 'U')).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={1}>{isGuest ? 'Guest' : (user?.email ?? 'Signed in')}</Text>
          <Text secondary variant="footnote">
            {isGuest ? 'Not backed up to an account yet' : 'Your progress is saved to your account'}
          </Text>
        </View>
        {PAYMENTS_ENABLED ? (
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 }}>
            <Text variant="caption" secondary>{isPro ? 'Pro' : 'Free'}</Text>
          </View>
        ) : null}
      </View>

      {PAYMENTS_ENABLED && !isPro && (
        <Group>
          <ListRow icon="sparkles" iconColor={tileColors.purple} title="Upgrade to Pro" subtitle="Unlimited habits, full history, more coach messages" onPress={() => router.push('/paywall')} last />
        </Group>
      )}

      <Group>
        <ListRow icon="trophy" iconColor={tileColors.gold} title="Achievements" onPress={() => router.push('/achievements')} />
        <ListRow icon="book" iconColor={tileColors.green} title="Journal" onPress={() => router.push('/journal')} />
        <ListRow icon="settings" iconColor={tileColors.gray} title="Settings" onPress={() => router.push('/settings')} />
        <ListRow icon="play" iconColor={tileColors.blue} title="Replay welcome tour" onPress={() => router.push('/onboarding')} last />
      </Group>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
        <Text variant="headline">Sync</Text>
        <Text secondary variant="footnote" accessibilityLiveRegion="polite">
          {sync.status === 'syncing'
            ? 'Syncing…'
            : sync.status === 'error'
              ? `Couldn’t sync: ${sync.error ?? 'unknown error'}`
              : sync.lastSyncedAt
                ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'Not synced yet'}
          {sync.lastResult && sync.lastResult.rejected > 0
            ? ` · ${sync.lastResult.rejected} item${sync.lastResult.rejected === 1 ? '' : 's'} couldn’t be saved to the cloud`
            : ''}
        </Text>
        <Button
          title="Sync now"
          variant="secondary"
          disabled={sync.status === 'syncing' || !user}
          onPress={() => user && void syncNow(user.id)}
        />
      </View>

      {isGuest && (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
          <Text variant="title2">Save your progress</Text>
          <Text secondary>Create an account to keep your habits if you switch phones. Nothing you’ve logged is lost.</Text>

          <Button title="Continue with Apple" loading={busy} onPress={() => void upgradeWithApple()} />

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            accessibilityLabel="Email address"
            style={{
              minHeight: 52,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bg,
              color: colors.text,
              paddingHorizontal: spacing.md,
              fontSize: 17,
            }}
          />
          <Button
            title="Email me a confirmation link"
            variant="secondary"
            disabled={busy || email.trim().length === 0}
            onPress={() => void upgradeWithEmail()}
          />

          {message && <Text accessibilityLiveRegion="polite">{message}</Text>}
          {error && (
            <Text accessibilityRole="alert" style={{ color: colors.dangerInk }}>
              {error}
            </Text>
          )}
        </View>
      )}

      <Button
        title={isGuest ? 'Discard guest session' : 'Sign out'}
        variant="ghost"
        onPress={() =>
          void (async () => {
            // A discarded guest session can never be reopened, so don't leave its data on disk.
            if (isGuest && user) await deleteLocalDb(user.id);
            await signOut();
          })()
        }
      />
      {isGuest && (
        <Text variant="footnote" secondary>
          Signing out of a guest session permanently removes access to its data. Create an account first to keep it.
        </Text>
      )}
    </ScrollView>
  );
}
