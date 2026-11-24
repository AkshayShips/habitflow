import { Redirect } from 'expo-router';

import { useAuthStore } from '@/features/auth/store/authStore';

/**
 * On the web, a URL that only matches a screen the current auth state hides (for example "/" while
 * signed out) lands here. Send people to the right place instead of an "Unmatched Route" page.
 */
export default function NotFound() {
  const signedIn = useAuthStore((s) => s.session !== null);
  return <Redirect href={signedIn ? '/' : '/sign-in'} />;
}
