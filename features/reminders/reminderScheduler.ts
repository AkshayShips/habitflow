import { REMINDER_CONTENT, type ReminderSettings } from './reminderSettings';

export type PermissionState = 'granted' | 'denied' | 'unavailable';

/** Thin boundary over expo-notifications so the logic is testable without a device. */
export interface NotificationsDriver {
  getPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  requestPermission(): Promise<'granted' | 'denied'>;
  cancelAll(): Promise<void>;
  scheduleDaily(hour: number, minute: number, title: string, body: string): Promise<void>;
}

export type ApplyResult =
  | { ok: true; scheduled: boolean }
  | { ok: false; reason: 'permission-denied' | 'unavailable' | 'error' };

/**
 * Makes the OS schedule match the settings. Always clears first so there is never
 * more than one daily reminder. Only asks for permission when turning it on.
 */
export async function applyReminder(driver: NotificationsDriver | null, s: ReminderSettings): Promise<ApplyResult> {
  if (!driver) return { ok: false, reason: 'unavailable' };
  try {
    await driver.cancelAll();
    if (!s.enabled) return { ok: true, scheduled: false };
    let perm = await driver.getPermission();
    if (perm === 'undetermined') perm = await driver.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'permission-denied' };
    await driver.scheduleDaily(s.hour, s.minute, REMINDER_CONTENT.title, REMINDER_CONTENT.body);
    return { ok: true, scheduled: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
