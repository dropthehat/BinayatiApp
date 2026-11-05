-- Natour V15 · 2026-11-05 · Admin workspace: Overview and Buildings data.
-- Additive. Counts of what people did are visible to the admin; anything that
-- reveals a building's activity detail needs support access (private.support_ok).

-- Admin's own labels on a building. is_test null = automatic (demo buildings count as test).
create table if not exists public.admin_building_meta (
  building_id uuid primary key references public.buildings(id) on delete cascade,
  is_test     boolean,
  note        text,
  updated_at  timestamptz not null default now()
);
alter table public.admin_building_meta enable row level security;
revoke all on public.admin_building_meta from public, anon;
grant select, insert, update, delete on public.admin_building_meta to authenticated;
drop policy if exists adm_meta_all on public.admin_building_meta;
create policy adm_meta_all on public.admin_building_meta for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- One row per building for the Buildings table and Overview.
-- last_activity ignores support looks and system-written rows, so opening a
-- building as support never makes it look active.
create or replace function public.admin_buildings_stats()
returns table(id uuid, name text, name_ar text, created_at timestamptz, owner text,
              units int, units_with_phone int, members int, months int, charges int,
              has_payments boolean, last_activity timestamptz, support_until timestamptz, custom int,
              is_test boolean, is_live_demo boolean, note text, access boolean,
              payments int, latest_period text, latest_units_paid int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return query
  select b.id, b.name, b.name_ar, b.created_at,
         (select m.display_name from public.members m where m.building_id = b.id and m.role = 'manager' order by m.created_at limit 1),
         (select count(*)::int from public.units u where u.building_id = b.id and u.active is not false),
         (select count(*)::int from public.units u where u.building_id = b.id and u.active is not false and coalesce(u.phone, '') <> ''),
         (select count(*)::int from public.members m where m.building_id = b.id),
         (select count(*)::int from public.cycles c where c.building_id = b.id and c.kind = 'month'),
         (select count(*)::int from public.charges c where c.building_id = b.id),
         exists(select 1 from public.payments p where p.building_id = b.id and p.voided_at is null),
         (select max(e.at) from public.events e where e.building_id = b.id and e.tbl <> 'support' and e.actor is not null),
         (select g.expires_at from public.support_grants g where g.building_id = b.id and g.expires_at > now()),
         (select count(*)::int from public.building_features f where f.building_id = b.id),
         coalesce(meta.is_test, b.settings ? 'demo'),
         (b.settings->>'demo') = 'true' and exists(select 1 from public.members m where m.building_id = b.id),
         meta.note,
         ok.access,
         case when ok.access then (select count(*)::int from public.payments p where p.building_id = b.id and p.voided_at is null) end,
         lm.period,
         case when ok.access then (select count(distinct p.unit_id)::int from public.payments p join public.charges c on c.id = p.charge_id
                                    where c.cycle_id = lm.id and p.voided_at is null) end
  from public.buildings b
  left join public.admin_building_meta meta on meta.building_id = b.id
  cross join lateral (select private.support_ok(b.id) as access) ok
  left join lateral (select c.id, c.period from public.cycles c where c.building_id = b.id and c.kind = 'month' order by c.period desc nulls last limit 1) lm on true
  order by b.created_at desc;
end $$;
revoke all on function public.admin_buildings_stats() from public, anon;
grant execute on function public.admin_buildings_stats() to authenticated;

-- Actions per Beirut day and building, for the Overview chart.
create or replace function public.admin_activity_daily(p_days int default 30)
returns table(day date, building_id uuid, actions int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return query
  select (e.at at time zone 'Asia/Beirut')::date, e.building_id, count(*)::int
  from public.events e
  where e.at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 366))
    and e.tbl <> 'support' and e.actor is not null
  group by 1, 2;
end $$;
revoke all on function public.admin_activity_daily(int) from public, anon;
grant execute on function public.admin_activity_daily(int) to authenticated;

-- A building's timeline. This is a look inside, so it needs support access and
-- is logged in the building's activity (at most once an hour per admin).
create or replace function public.admin_building_activity(p_building uuid, p_limit int default 200)
returns table(at timestamptz, actor_name text, tbl text, action text)
language plpgsql security definer set search_path = public as $$
declare md text;
begin
  if not private.support_ok(p_building) then raise exception 'support access is not on for this building'; end if;
  if not exists(select 1 from public.support_log l where l.admin_id = auth.uid() and l.building_id = p_building and l.at > now() - interval '1 hour') then
    md := case when private.support_full() then 'full' else 'read-only' end;
    insert into public.support_log(admin_id, building_id, action, detail) values (auth.uid(), p_building, 'view', md);
    insert into public.events(building_id, actor, actor_name, tbl, action, data)
    values (p_building, auth.uid(), 'Natour app support', 'support', 'view', jsonb_build_object('mode', md));
  end if;
  return query
  select e.at, e.actor_name, e.tbl, e.action from public.events e
  where e.building_id = p_building
  order by e.at desc limit least(greatest(coalesce(p_limit, 200), 1), 500);
end $$;
revoke all on function public.admin_building_activity(uuid, int) from public, anon;
grant execute on function public.admin_building_activity(uuid, int) to authenticated;

-- Remove a test building. Only one marked as test, never the live demo, and only
-- when the exact name is typed. Everything in it goes with it.
create or replace function public.admin_delete_test_building(p_building uuid, p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.buildings; t boolean; live boolean;
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  select * into b from public.buildings x where x.id = p_building;
  if not found then raise exception 'building not found'; end if;
  select coalesce(m.is_test, b.settings ? 'demo') into t from (select 1) one left join public.admin_building_meta m on m.building_id = p_building;
  live := (b.settings->>'demo') = 'true' and exists(select 1 from public.members m where m.building_id = p_building);
  if not t then raise exception 'mark it as a test building first'; end if;
  if live then raise exception 'this is the live demo building'; end if;
  if p_confirm is distinct from b.name then raise exception 'the name does not match'; end if;
  delete from public.buildings x where x.id = p_building;
end $$;
revoke all on function public.admin_delete_test_building(uuid, text) from public, anon;
grant execute on function public.admin_delete_test_building(uuid, text) to authenticated;
