import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getNativeDriver } from './nativeDriver';
import { applyReminder, type ApplyResult } from './reminderScheduler';
import { DEFAULT_REMINDER, parseReminderSettings, type ReminderSettings } from './reminderSettings';

const KEY = 'habitflow.reminder.v1';

export function useReminder() {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => alive && setSettings(parseReminderSettings(raw)))
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  /** Applies to the OS first; only saves if that worked, so the UI never claims a reminder that isn't set. */
  const update = useCallback(async (next: ReminderSettings): Promise<ApplyResult> => {
    const result = await applyReminder(await getNativeDriver().catch(() => null), next);
    if (result.ok) {
      setSettings(next);
      await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
    }
    return result;
  }, []);

  return { settings, loaded, update };
}
