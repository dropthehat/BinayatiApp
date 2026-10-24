// Writes a WhatsApp payment reminder (or thank-you receipt) for one apartment,
// in the resident's language and in the tone the manager picked. Detailed by default:
// a clear bill notice (every item, the total, who to pay), not flowery prose.
// The app passes the exact figures; the model must not change them, and the app
// checks the amount is still there before offering the text.
// Key: GEMINI_API_KEY. Optional WRITE_MODEL. Signed-in users only.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const GEMINI = Deno.env.get('GEMINI_API_KEY');
const MODEL = Deno.env.get('WRITE_MODEL') || Deno.env.get('TRANSLATE_MODEL') || 'gemini-3.5-flash-lite';
function anonKey(): string {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}'); if (k.default) return k.default; } catch (_) { /* */ }
  return Deno.env.get('SUPABASE_ANON_KEY') || '';
}
const sb = createClient(Deno.env.get('SUPABASE_URL')!, anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });

const TONES: Record<string, string> = {
  gentle: 'Friendly nudge. Assume they forgot. No pressure.',
  firm: 'Polite but firm: several months are unpaid. No threats, no shaming.',
  warm: 'Warm: thank them for always paying, then mention this month is open.',
  thanks: 'Thank them: payment received in full. No request.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method === 'GET') return json({ provider: GEMINI ? 'gemini' : null, model: GEMINI ? MODEL : null });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt || jwt.startsWith('sb_')) return json({ error: 'sign_in' }, 401);
  const { data: who, error: authErr } = await sb.auth.getUser(jwt);
  if (authErr || !who?.user) return json({ error: 'sign_in' }, 401);
  if (!GEMINI) return json({ error: 'no_key' }, 503);
  let f: any;
  try { f = await req.json(); } catch (_) { return json({ error: 'bad_request' }, 400); }
  const tone = TONES[f.tone] ? f.tone : 'gentle';
  const long = f.length !== 'short';
  const lang = f.lang === 'ar' ? 'ar' : f.lang === 'en' ? 'en' : 'both';
  const facts = {
    apartment: String(f.unit || '').slice(0, 20), resident_first_name: String(f.name || '').split(/\s+/)[0].slice(0, 30),
    month: String(f.month || '').slice(0, 40), left_to_pay: String(f.left || '').slice(0, 60),
    earlier_months_unpaid: String(f.arrears || '').slice(0, 60), months_behind: Number(f.monthsBehind) || 0,
    pay_to: String(f.payTo || '').slice(0, 60),
    ...(long ? { building: String(f.building || '').slice(0, 60), items: Array.isArray(f.items) ? f.items.slice(0, 12).map((x: any) => String(x).slice(0, 80)) : [] } : {}),
  };
  const size = long
    ? 'A clear bill notice, like a statement. One short opening line in the tone above (greeting with first name, building and month). Then every item on its own line starting with "• ", with its amount exactly as given. Then the total left to pay in bold on its own line, earlier unpaid months on their own line if any, and one line saying who to pay. No flattery, no long sentences, no explanations of what the items are.'
    : 'Very short: one or two sentences, at most 25 words per language. No greeting fluff, no list of items, no sign-off. Like a quick WhatsApp from a neighbour.';
  const langRule = lang === 'ar' ? 'Write in Arabic as people write in Lebanon.'
    : lang === 'en' ? 'Write in English.'
    : 'Write it in Arabic (as people write in Lebanon), then a blank line, then the same in English.';
  const sys = `You write WhatsApp messages from a building's management in Lebanon to one resident.\nTone: ${TONES[tone]}\nFormat: ${size}\n${langRule}\nCopy every amount exactly as given (e.g. "$20 + 1,250,000 LBP"). Never invent amounts, dates, penalties or deadlines. Put the total in WhatsApp *bold*. At most one emoji. No link, no signature. Reply with the message only.`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'x-goog-api-key': GEMINI, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: 'Facts: ' + JSON.stringify(facts) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
    });
    if (!r.ok) throw new Error('gemini ' + r.status + ' ' + (await r.text()).slice(0, 300));
    const data = await r.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).filter((p: any) => !p.thought).map((p: any) => p.text || '').join('').trim();
    if (!text) return json({ error: 'empty' }, 502);
    return json({ ok: true, text, model: MODEL });
  } catch (e) {
    console.error(String(e));
    return json({ error: 'upstream' }, 502);
  }
});
