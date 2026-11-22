import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export type CoachFailure = 'unavailable' | 'limit' | 'auth' | 'too_long' | 'empty' | 'network';

export type CoachResult =
  | { ok: true; reply: string; used: number; limit: number | null }
  | { ok: false; failure: CoachFailure; used?: number; limit?: number | null };

/** Maps the Edge Function's error responses to something the UI can act on. */
export function mapCoachFailure(status: number, body: { error?: string; used?: number; limit?: number | null } | null): CoachResult {
  const code = body?.error;
  if (status === 429 || code === 'limit_reached') return { ok: false, failure: 'limit', used: body?.used, limit: body?.limit };
  if (status === 401 || code === 'unauthorized') return { ok: false, failure: 'auth' };
  if (code === 'message_too_long') return { ok: false, failure: 'too_long' };
  if (code === 'empty_message') return { ok: false, failure: 'empty' };
  return { ok: false, failure: 'unavailable' }; // 503/502/500: not configured or upstream failure
}

export async function askCoach(message: string): Promise<CoachResult> {
  const { data, error } = await supabase.functions.invoke('coach', { body: { message } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      return mapCoachFailure((error.context as Response).status, body);
    }
    return { ok: false, failure: 'network' };
  }
  if (typeof data?.reply !== 'string') return { ok: false, failure: 'unavailable' };
  return { ok: true, reply: data.reply, used: data.used, limit: data.limit ?? null };
}

/** Saved conversation (RLS: only the signed-in user's own rows). Oldest first. */
export async function loadHistory(limit = 30): Promise<CoachMessage[]> {
  const { data, error } = await supabase
    .from('ai_coach_messages')
    .select('id, role, content')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.reverse().map((r) => ({ id: r.id as string, role: r.role as 'user' | 'assistant', text: r.content as string }));
}

export async function clearHistory(userId: string): Promise<boolean> {
  const { error } = await supabase.from('ai_coach_messages').delete().eq('user_id', userId);
  return !error;
}
