import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { handleAuthUrl } from '@/features/auth/api/auth';
import { useTheme } from '@/theme/useTheme';

/** Landing route for habitflow://auth/callback?code=... (magic links). */
export default function AuthCallback() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const url = Linking.useLinkingURL();
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || handled.current) return;
    handled.current = true; // PKCE codes are single-use; never exchange twice.

    void handleAuthUrl(url).then((result) => {
      if (result.status === 'error') {
        setError(result.message);
      } else {
        router.replace('/');
      }
    });
  }, [url, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        gap: spacing.md,
        backgroundColor: colors.bg,
      }}
    >
      {error ? (
        <>
          <Text variant="title2">Couldn’t sign you in</Text>
          <Text secondary style={{ textAlign: 'center' }}>
            {error}
          </Text>
          <Button title="Back" onPress={() => router.replace('/')} />
        </>
      ) : (
        <ActivityIndicator accessibilityLabel="Signing you in" />
      )}
    </View>
  );
}
