import { cancelScheduledSync } from '@/features/sync/syncManager';
import { IS_DEMO } from '@/lib/demo';
import { deleteLocalDb } from '@/lib/localDb';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

export interface DeleteDeps {
  invokeDelete: () => Promise<{ deleted: boolean; error?: string }>;
  deleteLocal: (userId: string) => Promise<void>;
  signOutLocal: () => Promise<void>;
  clearCache: () => void;
  stopSync: (userId: string) => void;
  demo: boolean;
}

const defaults: DeleteDeps = {
  demo: IS_DEMO,
  invokeDelete: async () => {
    const { data, error } = await supabase.functions.invoke<{ deleted?: boolean }>('delete-account', { method: 'POST' });
    return error || !data?.deleted ? { deleted: false, error: error?.message ?? 'Deletion was not confirmed.' } : { deleted: true };
  },
  deleteLocal: deleteLocalDb,
  signOutLocal: async () => {
    await supabase.auth.signOut({ scope: 'local' });
  },
  clearCache: () => queryClient.clear(),
  stopSync: cancelScheduledSync,
};

export type DeleteResult = { ok: true } | { ok: false; message: string };

/**
 * Permanently deletes the account. The server goes first: if it fails, nothing local is touched, so the user keeps
 * their data and can retry. Once the server confirms, local cleanup is best-effort but always ends in a sign-out.
 */
export async function deleteAccount(userId: string, deps: DeleteDeps = defaults): Promise<DeleteResult> {
  if (deps.demo) return { ok: false, message: 'Account deletion isn’t available in the preview.' };

  deps.stopSync(userId);
  let server: { deleted: boolean; error?: string };
  try {
    server = await deps.invokeDelete();
  } catch (e) {
    server = { deleted: false, error: e instanceof Error ? e.message : 'Network error' };
  }
  if (!server.deleted) {
    return { ok: false, message: 'We couldn’t delete your account. Check your connection and try again. Nothing was removed.' };
  }

  try {
    await deps.deleteLocal(userId);
  } catch {
    /* the account is already gone server-side; leftovers on this device are unreachable without the account */
  }
  try {
    deps.clearCache();
    await deps.signOutLocal();
  } catch {
    /* session is already invalid; the auth listener will route to sign-in */
  }
  return { ok: true };
}
