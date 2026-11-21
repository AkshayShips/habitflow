import type { DateStr } from '@/features/habits/logic/dates';
import type { Cadence, LogStatus } from '@/features/habits/logic/types';

/** The minimum a rule needs to know about a habit. The app's Habit satisfies this structurally. */
export interface MHabit {
  id: string;
  name: string;
  cadence: Cadence;
  startDate: DateStr;
  archivedAt: string | null;
  targetValue: number;
  unit: string | null;
}

export interface MLog {
  habitId: string;
  date: DateStr;
  status: LogStatus;
}

/** Optional daily self-report. Never required, never inferred. */
export type DayMode = 'light' | 'normal' | 'full';

/** What happened (or didn't) on a date for one habit. "paused" is not representable yet (no pause data). */
export type DayState = 'done' | 'skipped' | 'missed' | 'upcoming' | 'not_scheduled';

export type Confidence = 'low' | 'medium' | 'high';

export interface Insight {
  /** Stable per habit + rule so a dismissal sticks. */
  id: string;
  observation: string;
  /** The actual numbers behind the observation. */
  evidence: string;
  /** Number of scheduled days the claim rests on. */
  sampleSize: number;
  confidence: Confidence;
  /** Optional, phrased as an option the user can ignore. */
  suggestedAction?: string;
  habitId?: string;
}
