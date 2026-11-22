import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'habitflow.coach.consent.v1';

export async function hasCoachConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false; // when unsure, ask again
  }
}

export async function giveCoachConsent(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // best effort; the user will simply be asked again next time
  }
}
