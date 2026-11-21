import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { env } from './env';
import { secureStorage } from './secureStorage';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // we handle deep links ourselves (see features/auth/api/auth.ts)
    flowType: 'pkce', // magic links return ?code=... which we exchange for a session
  },
});

// Only refresh tokens while the app is in the foreground (recommended for React Native).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
