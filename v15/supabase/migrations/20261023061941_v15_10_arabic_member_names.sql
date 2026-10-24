-- Migration 20261023061941_v15_10_arabic_member_names
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

alter table public.members add column if not exists display_name_ar text;
alter table public.invites add column if not exists display_name_ar text;

create or replace function public.peek_invite(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('building', b.name, 'building_ar', b.name_ar, 'role', i.role,
                            'display_name', i.display_name, 'display_name_ar', i.display_name_ar,
                            'valid', i.used_at is null and i.expires_at > now())
  from public.invites i join public.buildings b on b.id = i.building_id
  where i.code = upper(p_code)
$$;

create or replace function public.set_my_name(p_building uuid, p_name text, p_name_ar text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.members set display_name = coalesce(nullif(trim(p_name), ''), display_name), display_name_ar = nullif(trim(coalesce(p_name_ar, '')), '')
  where building_id = p_building and user_id = auth.uid();
end $$;
revoke all on function public.set_my_name(uuid, text, text) from public, anon;
grant execute on function public.set_my_name(uuid, text, text) to authenticated;

create or replace function private.invite_name_ar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.used_by is not null and old.used_by is null and new.display_name_ar is not null then
    update public.members set display_name_ar = coalesce(display_name_ar, new.display_name_ar)
    where building_id = new.building_id and user_id = new.used_by;
  end if;
  return null;
end $$;
revoke all on function private.invite_name_ar() from public, anon, authenticated;
create or replace trigger bny_invite_name_ar after update on public.invites for each row execute function private.invite_name_ar();
