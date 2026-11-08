-- Compound collectors: invite a collector once for a whole compound. He joins the compound's
-- shared book and every building in it whose manager lets compound collectors work there
-- (buildings.settings.compound_collectors = true). A building turning it on later adds them;
-- turning it off removes them from that building only. Each building's books stay private:
-- the collector only gets the collector role there.

create table if not exists public.compound_collectors (
  compound_id uuid not null references public.compounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  display_name_ar text,
  created_at timestamptz not null default now(),
  primary key (compound_id, user_id)
);
alter table public.compound_collectors enable row level security;
drop policy if exists bny_cc_read on public.compound_collectors;
create policy bny_cc_read on public.compound_collectors for select to authenticated
  using (user_id = (select auth.uid()) or private.in_compound(compound_id)
         or exists (select 1 from public.compounds c where c.id = compound_id and c.created_by = (select auth.uid())));

alter table public.invites add column if not exists compound_id uuid references public.compounds(id) on delete cascade;
alter table public.compounds add column if not exists name_ar text;

-- Who may manage a compound's collectors: its creator, or a manager of its shared book.
create or replace function private.compound_admin(p_compound uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.compounds c where c.id = p_compound and c.created_by = auth.uid())
      or exists (select 1 from public.buildings b where b.compound_id = p_compound and b.kind = 'shared' and private.is_manager(b.id));
$$;
revoke all on function private.compound_admin(uuid) from public, anon;
grant execute on function private.compound_admin(uuid) to authenticated;

-- Put one compound collector into every building of the compound that accepts compound collectors.
create or replace function private.cc_spread(p_compound uuid, p_user uuid)
returns int language plpgsql security definer set search_path = public as $$
declare cc public.compound_collectors; n int := 0; b record;
begin
  select * into cc from public.compound_collectors where compound_id = p_compound and user_id = p_user;
  if not found then return 0; end if;
  for b in select id from public.buildings where compound_id = p_compound
            and (kind = 'shared' or coalesce(settings->>'compound_collectors', 'false') = 'true') loop
    insert into public.members(building_id, user_id, role, display_name, display_name_ar)
    values (b.id, p_user, 'collector', cc.display_name, cc.display_name_ar)
    on conflict (building_id, user_id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function private.cc_spread(uuid, uuid) from public, anon, authenticated;

create or replace function public.create_compound_invite(p_compound uuid, p_display_name text, p_display_name_ar text default null)
returns text language plpgsql security definer set search_path = public as $$
declare c text; sb uuid;
begin
  if not private.compound_admin(p_compound) then raise exception 'not allowed'; end if;
  select id into sb from public.buildings where compound_id = p_compound and kind = 'shared' limit 1;
  if sb is null then select id into sb from public.buildings where compound_id = p_compound order by created_at limit 1; end if;
  if sb is null then raise exception 'the compound has no buildings yet'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites(code, building_id, role, display_name, display_name_ar, compound_id)
  values (c, sb, 'collector', coalesce(p_display_name, ''), nullif(p_display_name_ar, ''), p_compound);
  return c;
end $$;
revoke all on function public.create_compound_invite(uuid, text, text) from public, anon;
grant execute on function public.create_compound_invite(uuid, text, text) to authenticated;

-- Joining: a compound invite makes the person a compound collector, then spreads him.
create or replace function public.join_building(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invites; nm text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from public.invites where code = upper(p_code) for update;
  if inv.code is null then raise exception 'invite not found'; end if;
  if inv.used_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  nm := coalesce(nullif(p_display_name, ''), inv.display_name);
  if inv.compound_id is not null then
    insert into public.compound_collectors(compound_id, user_id, display_name, display_name_ar)
    values (inv.compound_id, auth.uid(), nm, inv.display_name_ar)
    on conflict (compound_id, user_id) do update set display_name = excluded.display_name;
    perform private.cc_spread(inv.compound_id, auth.uid());
  else
    insert into public.members(building_id, user_id, role, display_name, blocks)
    values (inv.building_id, auth.uid(), inv.role, nm, inv.blocks)
    on conflict (building_id, user_id) do update set role = excluded.role, blocks = excluded.blocks;
  end if;
  update public.invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.building_id;
end $$;

-- The join screen shows the compound's name for a compound invite.
create or replace function public.peek_invite(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('building', coalesce(c.name, b.name), 'building_ar', coalesce(c.name_ar, c.name, b.name_ar),
                            'role', i.role, 'display_name', i.display_name, 'display_name_ar', i.display_name_ar,
                            'compound', i.compound_id is not null,
                            'valid', i.used_at is null and i.expires_at > now())
  from public.invites i join public.buildings b on b.id = i.building_id
  left join public.compounds c on c.id = i.compound_id
  where i.code = upper(p_code)
$$;

-- A building's manager lets the compound's collectors work there, or stops it.
create or replace function public.set_compound_collectors(p_building uuid, p_on boolean)
returns int language plpgsql security definer set search_path = public as $$
declare b public.buildings; cc record; n int := 0;
begin
  select * into b from public.buildings where id = p_building;
  if not found or b.compound_id is null then raise exception 'this building is not in a compound'; end if;
  if not private.is_manager(p_building) then raise exception 'managers only'; end if;
  update public.buildings set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('compound_collectors', p_on) where id = p_building;
  for cc in select * from public.compound_collectors where compound_id = b.compound_id loop
    if p_on then
      insert into public.members(building_id, user_id, role, display_name, display_name_ar)
      values (p_building, cc.user_id, 'collector', cc.display_name, cc.display_name_ar)
      on conflict (building_id, user_id) do nothing;
      if found then n := n + 1; end if;
    else
      delete from public.members where building_id = p_building and user_id = cc.user_id and role = 'collector';
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.set_compound_collectors(uuid, boolean) from public, anon;
grant execute on function public.set_compound_collectors(uuid, boolean) to authenticated;

-- Remove a compound collector from the whole compound.
create or replace function public.remove_compound_collector(p_compound uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.compound_admin(p_compound) then raise exception 'not allowed'; end if;
  delete from public.members m using public.buildings b
   where b.id = m.building_id and b.compound_id = p_compound and m.user_id = p_user and m.role = 'collector';
  delete from public.compound_collectors where compound_id = p_compound and user_id = p_user;
end $$;
revoke all on function public.remove_compound_collector(uuid, uuid) from public, anon;
grant execute on function public.remove_compound_collector(uuid, uuid) to authenticated;

-- Carl's C 388 accepts the compound's collectors.
update public.buildings set settings = coalesce(settings, '{}'::jsonb) || '{"compound_collectors": true}'::jsonb
 where id = '6deb35c7-c368-4e97-9554-46b985a78656';
