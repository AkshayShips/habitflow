import { addDays, weekStart, type DateStr } from '@/features/habits/logic/dates';
import { dayState, hasFixedSchedule } from './patterns';
import { describeTarget, minimumTarget } from './suggestions';
import type { MHabit, MLog } from './types';

export type RecoveryActionId = 'restart_smaller' | 'adjust_schedule' | 'move_day' | 'review';

export interface RecoveryAction {
  id: RecoveryActionId;
  label: string;
  detail: string;
}

export interface RecoveryPlan {
  habitId: string;
  headline: string;
  /** Plain counts so the user can see what the message is based on. */
  missed: number;
  scheduled: number;
  actions: RecoveryAction[];
}

/**
 * Supportive recovery options when a habit has slipped. History is never altered. These are offers.
 * Triggers: fixed-schedule habits with >= 3 misses in the last 7 days, or a flexible weekly habit that can no longer
 * reach its weekly target. "Pause" is not offered yet because pause state isn't stored.
 */
export function recoveryFor(habit: MHabit, logs: MLog[], today: DateStr): RecoveryPlan | null {
  if (habit.archivedAt !== null) return null;

  if (hasFixedSchedule(habit)) {
    let scheduled = 0;
    let missed = 0;
    for (let i = 1; i <= 7; i++) {
      const s = dayState(habit, logs, addDays(today, -i), today);
      if (s === 'not_scheduled') continue;
      scheduled++;
      if (s === 'missed') missed++;
    }
    if (missed < 3) return null;
    const actions: RecoveryAction[] = [];
    if (habit.targetValue > 1) {
      actions.push({
        id: 'restart_smaller',
        label: 'Restart with a smaller target',
        detail: `For example ${describeTarget(minimumTarget(habit.targetValue), habit.unit)} instead of ${describeTarget(habit.targetValue, habit.unit)}.`,
      });
    }
    actions.push({ id: 'adjust_schedule', label: 'Adjust the schedule', detail: 'Fewer days can be easier to keep. You pick which.' });
    actions.push({ id: 'review', label: 'Think about what got in the way', detail: 'Only you know the reason; a quick note can help you spot it later.' });
    return {
      habitId: habit.id,
      headline: `${habit.name} has been tricky this week. That happens. Here are some gentle options.`,
      missed,
      scheduled,
      actions,
    };
  }

  if (habit.cadence.type === 'x_per_week') {
    const target = habit.cadence.config.times ?? 1;
    const ws = weekStart(today);
    const done = logs.filter((l) => l.habitId === habit.id && l.status === 'done' && l.date >= ws && l.date <= addDays(ws, 6)).length;
    const daysLeft = 6 - (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // days after today in this Mon-start week
    const remaining = target - done;
    if (remaining > daysLeft + 1) {
      return {
        habitId: habit.id,
        headline: `${habit.name} may be hard to finish this week. A lighter week is fine.`,
        missed: remaining - (daysLeft + 1),
        scheduled: target,
        actions: [
          { id: 'adjust_schedule', label: 'Lower this week’s target', detail: 'Edit the habit to ask for fewer sessions.' },
          { id: 'review', label: 'Think about what got in the way', detail: 'Only you know the reason.' },
        ],
      };
    }
  }
  return null;
}

/** The single most useful plan to show on Today (the habit with the most misses), or null. */
export function topRecovery(habits: MHabit[], logs: MLog[], today: DateStr): RecoveryPlan | null {
  let best: RecoveryPlan | null = null;
  for (const h of habits) {
    const p = recoveryFor(h, logs, today);
    if (p && (best === null || p.missed > best.missed)) best = p;
  }
  return best;
}
