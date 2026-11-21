import type { DateStr } from '@/features/habits/logic/dates';
import { isScheduledOn } from '@/features/habits/logic/schedule';
import type { DayMode, MHabit, MLog } from './types';

export interface Suggestion {
  kind: 'generic' | 'light_day' | 'full_day' | 'all_done';
  text: string;
  habitId?: string;
}

/**
 * A "smaller version" of a target, offered as a suggestion only; nothing is changed for the user.
 * Quarter of the target, at least 1, never above the target.
 */
export function minimumTarget(target: number): number {
  const t = Math.max(1, Math.floor(target));
  return Math.min(t, Math.max(1, Math.ceil(t / 4)));
}

export function describeTarget(value: number, unit: string | null): string {
  return unit ? `${value} ${unit}` : `${value}`;
}

/**
 * One contextual line for the Today card. Uses only what we actually know: today's open habits and the
 * (optional) day mode. With nothing to go on it returns a generic tip instead of a made-up personal claim.
 */
export function suggestForToday(
  habits: MHabit[],
  logs: MLog[],
  today: DateStr,
  mode: DayMode | null,
): Suggestion {
  const due = habits.filter((h) => h.archivedAt === null && isScheduledOn(h.cadence, today, h.startDate));
  const doneToday = new Set(logs.filter((l) => l.date === today && l.status === 'done').map((l) => l.habitId));
  const open = due.filter((h) => !doneToday.has(h.id));

  if (due.length > 0 && open.length === 0) {
    return { kind: 'all_done', text: 'All done for today. Rest counts too.' };
  }

  if (mode === 'light' && open.length > 0) {
    const withTarget = open.find((h) => h.targetValue > 1);
    if (withTarget) {
      const min = minimumTarget(withTarget.targetValue);
      return {
        kind: 'light_day',
        habitId: withTarget.id,
        text: `Light day: a small version of ${withTarget.name} (${describeTarget(min, withTarget.unit)}) still counts as showing up.`,
      };
    }
    return { kind: 'light_day', text: 'Light day: pick the one habit that feels easiest and let the rest wait.' };
  }

  if (mode === 'full' && open.length > 0) {
    return { kind: 'full_day', text: `Full day: ${open.length} ${open.length === 1 ? 'habit' : 'habits'} left. Take them one at a time.` };
  }

  return { kind: 'generic', text: 'Short on time? Do the smallest version of one habit. It still counts.' };
}
