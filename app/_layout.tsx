import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSyncProfileTimezone } from '@/features/auth/hooks/useSyncProfileTimezone';
import { useSyncLifecycle } from '@/features/sync/hooks/useSyncLifecycle';
import { useAuthStore } from '@/features/auth/store/authStore';
import { queryClient } from '@/lib/queryClient';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialized = useAuthStore((s) => s.initialized);
  const signedIn = useAuthStore((s) => s.session !== null);
  const init = useAuthStore((s) => s.init);

  useEffect(() => init(), [init]);
  useSyncProfileTimezone();
  useSyncLifecycle();

  useEffect(() => {
    if (initialized) void SplashScreen.hideAsync();
  }, [initialized]);

  // Keep the splash screen up until the Keychain session has been read,
  // otherwise signed-in users would see a flash of the sign-in screen.
  if (!initialized) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <PhoneFrame>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="habit/new" options={{ presentation: 'modal', headerShown: true, title: 'New habit' }} />
            <Stack.Screen name="habit/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Edit habit' }} />
            <Stack.Screen name="habit-detail" options={{ headerShown: true, title: 'Habit', headerBackTitle: 'Back' }} />
            <Stack.Screen name="journal" options={{ headerShown: true, title: 'Journal', headerBackTitle: 'Back' }} />
            <Stack.Screen name="achievements" options={{ headerShown: true, title: 'Achievements', headerBackTitle: 'Back' }} />
            <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: true, title: 'Pro' }} />
            <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', headerShown: false }} />
            <Stack.Screen name="settings/index" options={{ headerShown: true, title: 'Settings', headerBackTitle: 'Back' }} />
            <Stack.Screen name="settings/reminders" options={{ headerShown: true, title: 'Reminders' }} />
            <Stack.Screen name="settings/export" options={{ headerShown: true, title: 'Export data' }} />
            <Stack.Screen name="settings/delete-account" options={{ headerShown: true, title: 'Delete account' }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          {/* Magic-link / OAuth return. Must stay reachable in both states. */}
          <Stack.Screen name="auth/callback" />
        </Stack>
        </PhoneFrame>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/** On desktop browsers (preview build only) show the app at phone width instead of stretched. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#1b1e24' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 430 }}>{children}</View>
    </View>
  );
}
