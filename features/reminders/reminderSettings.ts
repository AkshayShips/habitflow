export interface ReminderSettings {
  enabled: boolean;
  hour: number; // 0-23, device local time
  minute: number; // 0-59
}

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 8, minute: 0 };

/** Preset times offered in the UI (24h). */
export const REMINDER_TIMES: { hour: number; minute: number }[] = [
  { hour: 7, minute: 0 },
  { hour: 8, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 18, minute: 0 },
  { hour: 21, minute: 0 },
];

export function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Parse untrusted stored JSON; anything invalid falls back to the defaults. */
export function parseReminderSettings(raw: string | null): ReminderSettings {
  if (!raw) return DEFAULT_REMINDER;
  try {
    const v = JSON.parse(raw) as Partial<ReminderSettings>;
    const okInt = (n: unknown, max: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max;
    if (typeof v.enabled !== 'boolean' || !okInt(v.hour, 23) || !okInt(v.minute, 59)) return DEFAULT_REMINDER;
    return { enabled: v.enabled, hour: v.hour, minute: v.minute };
  } catch {
    return DEFAULT_REMINDER;
  }
}

/** Gentle copy: never mentions streaks or loss. */
export const REMINDER_CONTENT = {
  title: 'HabitFlow',
  body: 'A good moment for your habits today. Even a small step counts.',
};
