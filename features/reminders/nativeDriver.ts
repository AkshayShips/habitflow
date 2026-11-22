import { Platform } from 'react-native';

import type { NotificationsDriver } from './reminderScheduler';

/** Real driver for iOS/Android. Returns null on web, where local notifications aren't supported. */
export async function getNativeDriver(): Promise<NotificationsDriver | null> {
  if (Platform.OS === 'web') return null;
  const N = await import('expo-notifications');
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  return {
    async getPermission() {
      const p = await N.getPermissionsAsync();
      return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
    },
    async requestPermission() {
      const p = await N.requestPermissionsAsync();
      return p.granted ? 'granted' : 'denied';
    },
    async cancelAll() {
      await N.cancelAllScheduledNotificationsAsync();
    },
    async scheduleDaily(hour, minute, title, body) {
      await N.scheduleNotificationAsync({
        content: { title, body },
        trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    },
  };
}
