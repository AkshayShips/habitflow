import { deleteAccount, type DeleteDeps } from './deleteAccount';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/localDb', () => ({ deleteLocalDb: jest.fn() }));
jest.mock('@/lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/features/sync/syncManager', () => ({ cancelScheduledSync: jest.fn() }));

const deps = (over: Partial<DeleteDeps> = {}): DeleteDeps & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    demo: false,
    invokeDelete: async () => { calls.push('server'); return { deleted: true }; },
    deleteLocal: async () => { calls.push('local'); },
    signOutLocal: async () => { calls.push('signout'); },
    clearCache: () => { calls.push('cache'); },
    stopSync: () => { calls.push('stopsync'); },
    ...over,
  };
};

describe('deleteAccount', () => {
  it('deletes on the server first, then wipes local data and signs out', async () => {
    const d = deps();
    expect(await deleteAccount('u1', d)).toEqual({ ok: true });
    expect(d.calls).toEqual(['stopsync', 'server', 'local', 'cache', 'signout']);
  });

  it('if the server fails, nothing local is touched and the user can retry', async () => {
    const d = deps({ invokeDelete: async () => ({ deleted: false, error: 'boom' }) });
    const r = await deleteAccount('u1', d);
    expect(r.ok).toBe(false);
    expect(d.calls).toEqual(['stopsync']);
  });

  it('a thrown network error is a failure, not a crash', async () => {
    const d = deps({ invokeDelete: async () => { throw new Error('offline'); } });
    expect((await deleteAccount('u1', d)).ok).toBe(false);
    expect(d.calls).toEqual(['stopsync']);
  });

  it('local cleanup failure still ends in sign-out and success', async () => {
    const d = deps({ deleteLocal: async () => { throw new Error('disk'); } });
    expect(await deleteAccount('u1', d)).toEqual({ ok: true });
    expect(d.calls).toContain('signout');
  });

  it('refuses in the demo preview without calling anything', async () => {
    const d = deps({ demo: true });
    expect((await deleteAccount('demo', d)).ok).toBe(false);
    expect(d.calls).toEqual([]);
  });
});
