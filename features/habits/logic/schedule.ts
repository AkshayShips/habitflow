import { dayOfWeek, type DateStr } from './dates';
import type { Cadence } from './types';

/**
 * Is `date` a day the user is expected to do this habit?
 * x_per_week and interval are flexible (any day works), so they're "available" every day.
 */
export function isScheduledOn(cadence: Cadence, date: DateStr, startDate: DateStr): boolean {
  if (date < startDate) return false;
  switch (cadence.type) {
    case 'daily':
    case 'x_per_week':
    case 'interval':
      return true;
    case 'weekly_days':
      return (cadence.config.days ?? []).includes(dayOfWeek(date));
  }
}

export function describeCadence(cadence: Cadence): string {
  switch (cadence.type) {
    case 'daily':
      return 'Every day';
    case 'weekly_days': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = [...(cadence.config.days ?? [])].sort((a, b) => a - b);
      return days.length === 0 ? 'No days selected' : days.map((d) => names[d]).join(', ');
    }
    case 'x_per_week': {
      const n = cadence.config.times ?? 1;
      return `${n}× per week`;
    }
    case 'interval': {
      const n = cadence.config.every_days ?? 1;
      return n === 1 ? 'Every day' : `Every ${n} days`;
    }
  }
}
