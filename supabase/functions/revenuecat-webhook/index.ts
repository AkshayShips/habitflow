// RevenueCat -> Supabase. Keeps subscriptions_cache in sync so the SERVER knows who is Pro
// (AI limit, optional habit limit). Authenticated with a shared secret, not a user JWT.
// Set in RevenueCat: Webhook URL = this function, Authorization header = "Bearer <REVENUECAT_WEBHOOK_SECRET>".
import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITLEMENT = 'pro';

function statusFor(type: string, e: Record<string, unknown>): string | null {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
    case 'NON_RENEWING_PURCHASE':
    case 'SUBSCRIPTION_EXTENDED':
      return 'active';
    case 'CANCELLATION': // user turned off auto-renew; access continues until expiry
      return 'active';
    case 'BILLING_ISSUE': {
      const grace = Number(e.grace_period_expiration_at_ms ?? 0);
      return grace > Date.now() ? 'in_grace_period' : 'billing_retry';
    }
    case 'EXPIRATION':
      return 'expired';
    default:
      return null; // TEST, TRANSFER, etc.
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) return new Response('webhook not configured', { status: 503 });
  if (req.headers.get('Authorization') !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 });

  let payload: { event?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return new Response('bad request', { status: 400 }); }
  const e = payload.event;
  if (!e) return new Response('bad request', { status: 400 });

  const type = String(e.type ?? '');
  const userId = String(e.app_user_id ?? '');
  const status = statusFor(type, e);
  // Anonymous RevenueCat ids ($RCAnonymousID...) or unknown events: acknowledge so RC doesn't retry forever.
  if (!status || !UUID.test(userId)) return new Response('ignored', { status: 200 });

  const expMs = Number(e.expiration_at_ms ?? 0);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.from('subscriptions_cache').upsert({
    user_id: userId,
    entitlement: ENTITLEMENT,
    product_id: String(e.product_id ?? 'unknown'),
    expires_at: expMs > 0 ? new Date(expMs).toISOString() : null,
    store: String(e.store ?? 'APP_STORE').toLowerCase(),
    status,
  }, { onConflict: 'user_id,entitlement' });

  // 5xx makes RevenueCat retry (e.g. the user row doesn't exist yet).
  if (error) return new Response('db error', { status: 500 });
  return new Response('ok', { status: 200 });
});
