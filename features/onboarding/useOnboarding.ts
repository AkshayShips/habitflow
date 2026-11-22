import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'habitflow.onboarding.done.v1';

export async function isOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true; // if storage is unreadable, never trap the user in onboarding
  }
}

export async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // best effort
  }
}
