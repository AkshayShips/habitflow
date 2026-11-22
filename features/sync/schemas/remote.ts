import { z } from 'zod';

/** Validates rows coming back from Supabase before they touch the local database. */
const ts = z.string().min(10);
const nullableTs = z.string().min(10).nullable();

export const remoteHabitSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(40),
  color: z.string().min(4).max(9),
  category: z.string().nullable(),
  cadence_type: z.enum(['daily', 'weekly_days', 'x_per_week', 'interval']),
  cadence_config: z.record(z.string(), z.unknown()),
  target_value: z.coerce.number().positive(),
  unit: z.string().nullable(),
  start_date: z.string().length(10),
  archived_at: nullableTs,
  sort_order: z.number().int(),
  reminder_times: z.array(z.unknown()),
  created_at: ts,
  updated_at: ts,
  deleted_at: nullableTs,
});

export const remoteLogSchema = z.object({
  id: z.uuid(),
  habit_id: z.uuid(),
  user_id: z.uuid(),
  log_date: z.string().length(10),
  value: z.coerce.number().min(0),
  status: z.enum(['done', 'skipped', 'missed']),
  note: z.string().nullable(),
  mood: z.number().int().min(1).max(5).nullable(),
  logged_at: ts,
  updated_at: ts,
  deleted_at: nullableTs,
});

export const remoteEffortLevelSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  habit_id: z.uuid(),
  level: z.enum(['minimum', 'standard', 'extended']),
  target_value: z.coerce.number().positive(),
  created_at: ts,
  updated_at: ts,
  deleted_at: nullableTs,
});

export const remoteExperimentSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  habit_id: z.uuid(),
  start_date: z.string().length(10),
  duration_days: z.number().int().min(3).max(60),
  baseline_target_value: z.coerce.number().positive(),
  trial_target_value: z.coerce.number().positive(),
  status: z.enum(['running', 'kept', 'discarded']),
  decided_at: nullableTs,
  created_at: ts,
  updated_at: ts,
  deleted_at: nullableTs,
});

export const remoteJournalSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  entry_date: z.string().length(10),
  body: z.string().max(20000),
  mood: z.number().int().min(1).max(5).nullable(),
  created_at: ts,
  updated_at: ts,
  deleted_at: nullableTs,
});
