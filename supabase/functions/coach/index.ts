// AI Coach. The Claude API key lives ONLY here (Edge Function secret ANTHROPIC_API_KEY), never in the app.
// Limits are enforced server-side: the client cannot raise its own daily quota.
import { createClient } from 'npm:@supabase/supabase-js@2';

const FREE_DAILY_LIMIT = 3;
const MODEL = 'claude-sonnet-5-5';
const MAX_INPUT_CHARS = 1000;
const HISTORY_TURNS = 8;

const SYSTEM = `You are the HabitFlow coach: calm, warm, practical and brief (under 120 words).
Help people build small, sustainable habits. Never shame or guilt, and never mention "breaking" a streak as a failure.
Prefer tiny next steps over big plans. You are not a doctor or therapist: don't diagnose or give medical advice.
If someone seems to be in crisis or mentions harming themselves, respond with care and encourage them to contact local emergency services or a crisis line.
Plain text only, no markdown headings.`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: authErr } = await asUser.auth.getUser();
  if (authErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let message = '';
  try {
    const body = await req.json();
    message = typeof body?.message === 'string' ? body.message.trim() : '';
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!message) return json({ error: 'empty_message' }, 400);
  if (message.length > MAX_INPUT_CHARS) return json({ error: 'message_too_long', max: MAX_INPUT_CHARS }, 400);

  // Check configuration BEFORE counting, so an unconfigured server never uses up a user's allowance.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'coach_unavailable' }, 503);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: isPro } = await admin.rpc('has_pro', { p_user: userId });
  const limit = isPro ? null : FREE_DAILY_LIMIT;

  const { data: usage, error: usageErr } = await admin.rpc('consume_ai_message', { p_user: userId, p_limit: limit });
  if (usageErr || !usage?.[0]) return json({ error: 'server_error' }, 500);
  if (!usage[0].allowed) return json({ error: 'limit_reached', used: usage[0].used, limit }, 429);

  // Conversation context comes from OUR database, never from the client, so history can't be forged.
  const { data: past } = await admin
    .from('ai_coach_messages')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS);
  const history = (past ?? []).reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

  let reply = '';
  let tokens: number | null = null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [...history, { role: 'user', content: message }],
      }),
    });
    if (!res.ok) {
      // Log WHY (status + Anthropic's error type/message; never the key) so outages are diagnosable.
      const errBody = await res.text().catch(() => '');
      console.error(`anthropic_error status=${res.status} body=${errBody.slice(0, 400)}`);
      throw new Error(`anthropic ${res.status}`);
    }
    const data = await res.json();
    reply = (data.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
    tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    if (!reply) throw new Error('empty reply');
  } catch (e) {
    console.error(`coach_failed ${e instanceof Error ? e.message : String(e)}`);
    await admin.rpc('refund_ai_message', { p_user: userId }); // a failed call must not cost the user a message
    return json({ error: 'coach_unavailable' }, 502);
  }

  await admin.from('ai_coach_messages').insert([
    { user_id: userId, role: 'user', content: message },
    { user_id: userId, role: 'assistant', content: reply, tokens },
  ]);

  return json({ reply, used: usage[0].used, limit });
});
