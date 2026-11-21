import { z } from 'zod';

import type { Cadence } from '../logic/types';

export const cadenceSchema = z
  .object({
    type: z.enum(['daily', 'weekly_days', 'x_per_week', 'interval']),
    config: z
      .object({
        days: z.array(z.number().int().min(0).max(6)).optional(),
        times: z.number().int().min(1).max(7).optional(),
        every_days: z.number().int().min(2).max(60).optional(),
      })
      .default({}),
  })
  .superRefine((c, ctx) => {
    if (c.type === 'weekly_days' && (c.config.days?.length ?? 0) === 0) {
      ctx.addIssue({ code: 'custom', message: 'Pick at least one day.', path: ['config', 'days'] });
    }
    if (c.type === 'x_per_week' && c.config.times === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Choose how many times per week.', path: ['config', 'times'] });
    }
    if (c.type === 'interval' && c.config.every_days === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Choose the interval in days.', path: ['config', 'every_days'] });
    }
  });

export const habitInputSchema = z.object({
  name: z.string().trim().min(1, 'Give your habit a name.').max(80, 'Keep the name under 80 characters.'),
  icon: z.string().min(1).max(40).default('checkmark-circle'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a color.'),
  category: z.string().trim().max(40).nullable().default(null),
  cadence: cadenceSchema,
  targetValue: z.number().positive().default(1),
  unit: z.string().trim().max(20).nullable().default(null),
});

export type HabitInput = Omit<z.input<typeof habitInputSchema>, 'cadence'> & { cadence: Cadence };
export type ParsedHabitInput = z.output<typeof habitInputSchema>;

const DAILY: Cadence = { type: 'daily', config: {} };

/** Parses cadence columns read back from SQLite; falls back to daily rather than crashing. */
export function parseStoredCadence(type: string, configJson: string): Cadence {
  try {
    const parsed = cadenceSchema.safeParse({ type, config: JSON.parse(configJson) });
    return parsed.success ? parsed.data : DAILY;
  } catch {
    return DAILY;
  }
}
