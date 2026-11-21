import type { DateStr } from './dates';

export type CadenceType = 'daily' | 'weekly_days' | 'x_per_week' | 'interval';
export type LogStatus = 'done' | 'skipped' | 'missed';

export interface CadenceConfig {
  /** weekly_days: 0 = Sunday ... 6 = Saturday */
  days?: number[];
  /** x_per_week */
  times?: number;
  /** interval */
  every_days?: number;
}

export interface Cadence {
  type: CadenceType;
  config: CadenceConfig;
}

export interface LogEntry {
  date: DateStr;
  status: LogStatus;
}

export interface StreakResult {
  current: number;
  longest: number;
  lastCompleted: DateStr | null;
}
