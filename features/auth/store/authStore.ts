import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { DEMO_USER_ID, IS_DEMO } from '@/lib/demo';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  /** false until the persisted session has been read from the Keychain. */
  initialized: boolean;
  /** Call once at app start. Returns an unsubscribe function. */
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  init: () => {
    if (IS_DEMO) {
      const user = { id: DEMO_USER_ID, email: 'demo@habitflow.app', is_anonymous: false };
      set({ session: { user } as unknown as Session, initialized: true });
      return () => undefined;
    }
    void supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, initialized: true });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, initialized: true });
    });
    return () => data.subscription.unsubscribe();
  },
}));

export const useIsGuest = () => useAuthStore((s) => s.session?.user.is_anonymous === true);
export const useUser = () => useAuthStore((s) => s.session?.user ?? null);
