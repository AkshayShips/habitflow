import Constants from 'expo-constants';
import { z } from 'zod';

// Validate environment once at startup so a missing key fails loudly in dev,
// not as a mysterious 401 later.
const schema = z.object({
  appEnv: z.enum(['dev', 'staging', 'prod']),
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(20),
});

const parsed = schema.safeParse({
  appEnv: (Constants.expoConfig?.extra as { appEnv?: string } | undefined)?.appEnv ?? 'dev',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration. Copy .env.example to .env.local and fill it in.\n${parsed.error.message}`,
  );
}

export const env = parsed.data;
