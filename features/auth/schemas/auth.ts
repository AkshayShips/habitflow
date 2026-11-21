import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }));

export const authCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  error_description: z.string().optional(),
});

export type AuthCallbackParams = z.infer<typeof authCallbackSchema>;
