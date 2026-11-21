import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import {
  isAppleSignInAvailable,
  sendMagicLink,
  signInAsGuest,
  signInWithApple,
} from '@/features/auth/api/auth';
import { useTheme } from '@/theme/useTheme';

export default function SignInScreen() {
  const { colors, spacing, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<null | 'apple' | 'email' | 'guest'>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function run(kind: 'apple' | 'email' | 'guest', fn: () => ReturnType<typeof signInAsGuest>) {
    setBusy(kind);
    setError(null);
    const result = await fn();
    setBusy(null);
    if (result.status === 'error') setError(result.message);
    return result;
  }

  async function onMagicLink() {
    const result = await run('email', () => sendMagicLink(email));
    if (result.status === 'ok') setSent(true);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: spacing.lg,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.lg,
          gap: spacing.lg,
        }}
      >
        <View style={{ gap: spacing.sm }}>
          <Text variant="largeTitle">HabitFlow</Text>
          <Text secondary>Build routines that stick, at a calm pace.</Text>
        </View>

        {sent ? (
          <View
            accessibilityLiveRegion="polite"
            style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}
          >
            <Text variant="title2">Check your email</Text>
            <Text secondary>
              We sent a sign-in link to {email.trim()}. Open it on this device to continue.
            </Text>
            <Button title="Use a different email" variant="ghost" onPress={() => setSent(false)} />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={
                  isDark
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={radius.md}
                style={{ height: 52 }}
                onPress={() => void run('apple', signInWithApple)}
              />
            )}

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={() => void onMagicLink()}
              accessibilityLabel="Email address"
              style={{
                minHeight: 52,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.text,
                paddingHorizontal: spacing.md,
                fontSize: 17,
              }}
            />
            <Button
              title="Email me a sign-in link"
              variant="secondary"
              loading={busy === 'email'}
              disabled={email.trim().length === 0 || busy !== null}
              onPress={() => void onMagicLink()}
            />
          </View>
        )}

        {error && (
          <Text accessibilityRole="alert" style={{ color: colors.dangerInk }}>
            {error}
          </Text>
        )}

        <View style={{ gap: spacing.xs, alignItems: 'center' }}>
          <Button
            title="Continue as guest"
            variant="ghost"
            loading={busy === 'guest'}
            disabled={busy !== null}
            onPress={() => void run('guest', signInAsGuest)}
          />
          <Text variant="footnote" secondary style={{ textAlign: 'center' }}>
            Guest progress is tied to this device. Create an account any time to keep it safe and nothing is lost.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
