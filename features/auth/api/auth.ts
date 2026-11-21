import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';
import { authCallbackSchema, emailSchema } from '../schemas/auth';

// Required so the in-app browser session used for Apple account linking can close itself.
WebBrowser.maybeCompleteAuthSession();

export type AuthResult = { status: 'ok' } | { status: 'cancelled' } | { status: 'error'; message: string };

const ok: AuthResult = { status: 'ok' };
const fail = (message: string): AuthResult => ({ status: 'error', message });

/** Deep link Supabase redirects to after a magic link / OAuth. Must be in Supabase "Redirect URLs". */
export const redirectUrl = () => Linking.createURL('auth/callback');

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

async function currentUserIsAnonymous(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.is_anonymous === true;
}

// ---------------------------------------------------------------------------
// Guest
// ---------------------------------------------------------------------------
export async function signInAsGuest(): Promise<AuthResult> {
  const { error } = await supabase.auth.signInAnonymously({
    options: { data: { timezone: getDeviceTimezone() } },
  });
  return error ? fail(error.message) : ok;
}

// ---------------------------------------------------------------------------
// Email magic link
// ---------------------------------------------------------------------------
/**
 * New or returning user  -> signInWithOtp (creates the account if needed).
 * Guest upgrading        -> updateUser({ email }): after the user taps the emailed link the
 *                           SAME user id becomes a full account, so no data is lost.
 */
export async function sendMagicLink(rawEmail: string): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Enter a valid email address.');
  const email = parsed.data;

  if (await currentUserIsAnonymous()) {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectUrl() });
    return error ? fail(error.message) : ok;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl(),
      shouldCreateUser: true,
      data: { timezone: getDeviceTimezone() },
    },
  });
  return error ? fail(error.message) : ok;
}

// ---------------------------------------------------------------------------
// Sign in with Apple
// ---------------------------------------------------------------------------
export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Not signed in -> native Apple sheet + signInWithIdToken.
 * Guest          -> linkIdentity (web flow) so the guest's data stays on the same user id.
 *                   (Signing in natively would create a SECOND user and orphan the guest data.)
 */
export async function signInWithApple(): Promise<AuthResult> {
  if (await currentUserIsAnonymous()) return linkAppleToGuest();

  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) return fail('Apple did not return an identity token.');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return fail(error.message);

    // Apple only sends the name on the FIRST authorization, so persist it now.
    const given = credential.fullName?.givenName ?? '';
    const family = credential.fullName?.familyName ?? '';
    const fullName = `${given} ${family}`.trim();
    if (fullName && data.user) {
      await supabase.from('profiles').update({ display_name: fullName.slice(0, 80) }).eq('id', data.user.id);
    }
    return ok;
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
      return { status: 'cancelled' };
    }
    return fail(e instanceof Error ? e.message : 'Sign in with Apple failed.');
  }
}

async function linkAppleToGuest(): Promise<AuthResult> {
  const redirectTo = redirectUrl();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'apple',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return fail(error?.message ?? 'Could not start Apple linking.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { status: 'cancelled' };
  return handleAuthUrl(result.url);
}

// ---------------------------------------------------------------------------
// Deep link / OAuth return handling
// ---------------------------------------------------------------------------
/** Exchanges the PKCE `code` in a magic-link / OAuth return URL for a session. */
export async function handleAuthUrl(url: string): Promise<AuthResult> {
  let params: Record<string, string> = {};
  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    // Some providers return params in the fragment.
    new URLSearchParams(parsedUrl.hash.replace(/^#/, '')).forEach((value, key) => {
      params[key] ??= value;
    });
  } catch {
    params = {};
  }

  const parsed = authCallbackSchema.safeParse(params);
  if (!parsed.success) return fail('This sign-in link is invalid.');
  if (parsed.data.error_description) return fail(parsed.data.error_description);
  if (!parsed.data.code) return fail('This sign-in link is invalid or has expired.');

  const { error } = await supabase.auth.exchangeCodeForSession(parsed.data.code);
  return error ? fail(error.message) : ok;
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut();
  return error ? fail(error.message) : ok;
}
