import { mapCoachFailure } from './coachApi';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@supabase/supabase-js', () => ({ FunctionsHttpError: class {} }));

describe('mapCoachFailure', () => {
  it('maps the daily limit', () => {
    expect(mapCoachFailure(429, { error: 'limit_reached', used: 3, limit: 3 })).toEqual({ ok: false, failure: 'limit', used: 3, limit: 3 });
  });
  it('maps auth, validation and outage', () => {
    expect(mapCoachFailure(401, { error: 'unauthorized' })).toEqual({ ok: false, failure: 'auth' });
    expect(mapCoachFailure(400, { error: 'message_too_long' })).toEqual({ ok: false, failure: 'too_long' });
    expect(mapCoachFailure(503, { error: 'coach_unavailable' })).toEqual({ ok: false, failure: 'unavailable' });
    expect(mapCoachFailure(500, null)).toEqual({ ok: false, failure: 'unavailable' });
  });
});
