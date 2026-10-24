// Suggests the Arabic (or English) version of a name or short label.
// The AI key lives here as a Supabase secret, never in the app:
//   GEMINI_API_KEY (preferred, free tier) or ANTHROPIC_API_KEY.
// TRANSLATE_MODEL (optional secret) pins the exact model; otherwise the defaults below.
// Only signed-in users can translate: the caller's session is checked in code below.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const GEMINI = Deno.env.get('GEMINI_API_KEY');
const CLAUDE = Deno.env.get('ANTHROPIC_API_KEY');
const PROVIDER = GEMINI ? 'gemini' : CLAUDE ? 'claude' : null;
const MODEL = Deno.env.get('TRANSLATE_MODEL') || (PROVIDER === 'gemini' ? 'gemini-3.5-flash-lite' : 'claude-haiku-5-5');

function anonKey(): string {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}'); if (k.default) return k.default; } catch (_) { /* */ }
  return Deno.env.get('SUPABASE_ANON_KEY') || '';
}
const sb = createClient(Deno.env.get('SUPABASE_URL')!, anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });

function instructions(kind: string, to: string) {
  const task = kind === 'name'
    ? (to === 'ar'
        ? 'Write this person\'s name in Arabic script, spelled the way it is usually written in Lebanon (for example Khoury = خوري, Haddad = حداد, Ahmad = أحمد). Do not translate meanings.'
        : 'Write this Arabic name in Latin letters the way Lebanese people usually spell it (for example خوري = Khoury, حداد = Haddad).')
    : (to === 'ar'
        ? 'Translate this short label from a Lebanese building-management app (a task, fee, bill, expense or building name) into clear, short Arabic as used in Lebanon. Keep apartment codes, numbers and brand names as they are.'
        : 'Translate this short label from a Lebanese building-management app into clear, short English. Keep apartment codes, numbers and brand names as they are.');
  return task + ' Reply with only the result, nothing else. If the input is not something to convert, reply with it unchanged.';
}

async function viaGemini(sys: string, text: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: { 'x-goog-api-key': GEMINI!, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
  });
  if (!r.ok) throw new Error('gemini ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p: any) => !p.thought).map((p: any) => p.text || '').join('');
}

async function viaClaude(sys: string, text: string) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: { 'x-api-key': CLAUDE!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 120, system: sys, messages: [{ role: 'user', content: text }] }),
  });
  if (!r.ok) throw new Error('claude ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  return (data.content || []).map((c: any) => c.text || '').join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  // GET tells you which provider and model are in use (no key is ever returned).
  if (req.method === 'GET') return json({ provider: PROVIDER, model: PROVIDER ? MODEL : null });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt || jwt.startsWith('sb_')) return json({ error: 'sign_in' }, 401);
  const { data: who, error: authErr } = await sb.auth.getUser(jwt);
  if (authErr || !who?.user) return json({ error: 'sign_in' }, 401);
  if (!PROVIDER) return json({ error: 'no_key' }, 503);
  let body: any;
  try { body = await req.json(); } catch (_) { return json({ error: 'bad_request' }, 400); }
  const text = String(body.text || '').trim().slice(0, 200);
  const kind = body.kind === 'name' ? 'name' : 'phrase';
  const to = body.to === 'en' ? 'en' : 'ar';
  if (!text) return json({ error: 'empty' }, 400);
  const sys = instructions(kind, to);
  try {
    const raw = PROVIDER === 'gemini' ? await viaGemini(sys, text) : await viaClaude(sys, text);
    const out = String(raw).trim().split('\n')[0].replace(/^["'«]|["'»]$/g, '').slice(0, 200);
    return json({ text: out, model: MODEL });
  } catch (e) {
    console.error(String(e));
    return json({ error: 'upstream' }, 502);
  }
});
