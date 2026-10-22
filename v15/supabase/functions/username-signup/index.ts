// Creates an account from a username + password, for people without an email address
// (many Natours). Behind the scenes the account gets a placeholder address on
// binayati.local, which never receives mail. Public on purpose, like any sign-up form.
// Deployed to the BINAYATI project with verify_jwt = false.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    if (keys.default) return keys.default;
  } catch (_) { /* fall through */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body: any;
  try { body = await req.json(); } catch (_) { return json({ error: 'bad_request' }, 400); }
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || '').trim().slice(0, 60);
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) return json({ error: 'bad_username' }, 400);
  if (password.length < 6 || password.length > 72) return json({ error: 'weak_password' }, 400);
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@binayati.local`,
    password,
    email_confirm: true,
    user_metadata: { name, username },
  });
  if (error) {
    const msg = error.message || '';
    if (/already|exists|registered/i.test(msg)) return json({ error: 'taken' }, 409);
    return json({ error: 'failed' }, 400);
  }
  return json({ ok: true, id: data.user?.id });
});
