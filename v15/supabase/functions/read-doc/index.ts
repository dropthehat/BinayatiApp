// Reads a photo of a receipt/invoice or a screenshot of a money transfer and returns
// the fields as JSON, for the app to propose (a person always confirms).
// Key: GEMINI_API_KEY secret. Optional READ_MODEL to pin a model.
// Only signed-in users can call it; the caller's session is checked below.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const GEMINI = Deno.env.get('GEMINI_API_KEY');
const MODEL = Deno.env.get('READ_MODEL') || Deno.env.get('TRANSLATE_MODEL') || 'gemini-3.5-flash-lite';
function anonKey(): string {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}'); if (k.default) return k.default; } catch (_) { /* */ }
  return Deno.env.get('SUPABASE_ANON_KEY') || '';
}
const sb = createClient(Deno.env.get('SUPABASE_URL')!, anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });

const RECEIPT = `You read photos of receipts, invoices and bills paid for a residential building in Lebanon.
They can be printed or handwritten, in Arabic, English or French, in US dollars or Lebanese pounds (LBP, L.L., ل.ل).
Return only JSON with these keys:
{"title": short description in English of what was bought or paid (e.g. "Generator diesel 200L"),
 "title_ar": the same in Arabic,
 "amount": total paid as a number (no thousands separators), or null,
 "cur": "USD" or "LBP",
 "date": "YYYY-MM-DD" or null,
 "ref": invoice/receipt number or null,
 "supplier": shop or company name or null,
 "cat": one of CATS,
 "confidence": "high" | "medium" | "low"}
If a field is unreadable use null. Never invent numbers.`;

const TRANSFER = `You read screenshots of money transfers and payment confirmations used in Lebanon (Whish Money, OMT, BOB Finance, bank apps, WhatsApp messages saying a payment was sent).
Return only JSON with these keys:
{"amount": number or null, "cur": "USD" or "LBP",
 "method": "Whish" | "OMT" | "BOB" | "Bank" | "Other",
 "sender_name": name of the person who sent the money or null,
 "sender_phone": phone number of the sender or null,
 "ref": transaction or reference number or null,
 "date": "YYYY-MM-DD" or null,
 "unit_code": the apartment code from APARTMENTS that best matches the sender (by name or phone), or null if unsure,
 "confidence": "high" | "medium" | "low"}
Never invent numbers. Only pick a unit_code when the name or phone clearly matches.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method === 'GET') return json({ provider: GEMINI ? 'gemini' : null, model: GEMINI ? MODEL : null });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt || jwt.startsWith('sb_')) return json({ error: 'sign_in' }, 401);
  const { data: who, error: authErr } = await sb.auth.getUser(jwt);
  if (authErr || !who?.user) return json({ error: 'sign_in' }, 401);
  if (!GEMINI) return json({ error: 'no_key' }, 503);

  let body: any;
  try { body = await req.json(); } catch (_) { return json({ error: 'bad_request' }, 400); }
  const kind = body.kind === 'transfer' ? 'transfer' : 'receipt';
  const image = String(body.image || '');
  const mime = /^image\/(jpeg|png|webp|heic|heif)$/.test(body.mime) ? body.mime : 'image/jpeg';
  if (!image || image.length > 6_000_000) return json({ error: 'bad_image' }, 400);

  let sys = kind === 'transfer' ? TRANSFER : RECEIPT;
  if (kind === 'receipt') sys = sys.replace('CATS', JSON.stringify(Array.isArray(body.cats) ? body.cats.slice(0, 20) : ['gen', 'elev', 'water', 'clean', 'light', 'repair', 'staff', 'other']));
  if (kind === 'transfer') {
    const units = Array.isArray(body.units) ? body.units.slice(0, 200).map((u: any) => ({ code: String(u.code || ''), name: String(u.name || ''), name_ar: String(u.name_ar || ''), phone: String(u.phone || '') })) : [];
    sys = sys.replace('APARTMENTS', 'APARTMENTS (' + JSON.stringify(units) + ')');
  }

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
      headers: { 'x-goog-api-key': GEMINI, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: image } }, { text: 'Read this image and return the JSON.' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 2048, responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) throw new Error('gemini ' + r.status + ' ' + (await r.text()).slice(0, 300));
    const data = await r.json();
    const txt = (data?.candidates?.[0]?.content?.parts || []).filter((p: any) => !p.thought).map((p: any) => p.text || '').join('');
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: 'unreadable' }, 422);
    const out = JSON.parse(m[0]);
    if (out.amount != null) out.amount = Number(String(out.amount).replace(/[^0-9.]/g, '')) || null;
    if (out.cur !== 'LBP') out.cur = 'USD';
    return json({ ok: true, kind, fields: out, model: MODEL });
  } catch (e) {
    console.error(String(e));
    return json({ error: 'upstream' }, 502);
  }
});
