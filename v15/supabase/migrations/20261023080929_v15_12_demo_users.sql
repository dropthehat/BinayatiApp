-- Migration 20261023080929_v15_12_demo_users
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.


do $$
declare u record;
begin
  for u in select * from (values
    ('d0000000-0000-4000-8000-00000000d001'::uuid, 'demo-manager@binayati.local', 'Rima', 'demo-manager'),
    ('d0000000-0000-4000-8000-00000000d002'::uuid, 'demo-collector@binayati.local', 'Anas', 'demo-collector')) v(id, email, nm, un)
  loop
    if not exists (select 1 from auth.users where id = u.id) then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
        extensions.crypt('<DEMO_PASSWORD>' /* placeholder: real value redacted from this export */, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('name', u.nm, 'username', u.un, 'demo', true),
        now(), now(), '', '', '', '');
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now());
    end if;
  end loop;
end $$;
