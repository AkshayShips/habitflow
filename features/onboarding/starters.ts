import type { HabitInput } from '@/features/habits/schemas/habit';
import { habitPalette } from '@/theme/tokens';

export const MAX_STARTERS = 3;

interface Starter { name: string; icon: string }

export const STARTERS: Starter[] = [
  { name: 'Drink water', icon: 'water' },
  { name: 'Walk 10 minutes', icon: 'walk' },
  { name: 'Read 5 pages', icon: 'book' },
  { name: 'Stretch', icon: 'happy' },
  { name: 'Write one line', icon: 'pencil' },
  { name: 'Go to bed on time', icon: 'moon' },
  { name: 'Meditate', icon: 'leaf' },
  { name: 'Tidy one thing', icon: 'checkmark-circle' },
];

export type ReminderChoice = 'Morning' | 'Midday' | 'Evening' | 'No reminders';
export const REMINDER_CHOICES: ReminderChoice[] = ['Morning', 'Midday', 'Evening', 'No reminders'];

export function reminderFor(c: ReminderChoice): { enabled: boolean; hour: number; minute: number } {
  switch (c) {
    case 'Morning': return { enabled: true, hour: 8, minute: 0 };
    case 'Midday': return { enabled: true, hour: 12, minute: 30 };
    case 'Evening': return { enabled: true, hour: 18, minute: 0 };
    default: return { enabled: false, hour: 8, minute: 0 };
  }
}

/**
 * Habits to create from the picked starters: daily, small, deduped against what
 * already exists (case-insensitive) and capped by the free-plan room left.
 */
export function planStarters(picked: string[], existingNames: string[], room: number): HabitInput[] {
  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const out: HabitInput[] = [];
  for (const name of picked.slice(0, MAX_STARTERS)) {
    const s = STARTERS.find((x) => x.name === name);
    if (!s || have.has(s.name.toLowerCase()) || out.length >= Math.max(0, room)) continue;
    out.push({
      name: s.name,
      icon: s.icon,
      color: habitPalette[out.length % habitPalette.length]!,
      category: null,
      cadence: { type: 'daily', config: {} },
      targetValue: 1,
      unit: null,
    });
  }
  return out;
}
