-- Migration 20261023004643_v15_08_blocks_and_compounds
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

alter table public.units add column if not exists block text;
alter table public.charges add column if not exists block text;

create table if not exists public.compounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.buildings add column if not exists compound_id uuid references public.compounds(id) on delete set null;
create index if not exists buildings_compound on public.buildings(compound_id);
alter table public.compounds enable row level security;
grant select, insert, update, delete on public.compounds to authenticated;
revoke all on public.compounds from anon;

create or replace function private.in_compound(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.buildings b join public.members m on m.building_id = b.id
                where b.compound_id = c and m.user_id = auth.uid())
$$;
revoke all on function private.in_compound(uuid) from public;
grant execute on function private.in_compound(uuid) to authenticated;

create policy bny_compounds_read on public.compounds for select to authenticated
  using (created_by = auth.uid() or private.in_compound(id));
create policy bny_compounds_insert on public.compounds for insert to authenticated with check (created_by = auth.uid());
create policy bny_compounds_edit on public.compounds for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy bny_compounds_del on public.compounds for delete to authenticated using (created_by = auth.uid());

-- Names of the other buildings in my compound, so a manager can see who shares it.
create or replace function public.compound_buildings(p_compound uuid)
returns table(id uuid, name text, name_ar text, units int, my_role text)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.name_ar,
         (select count(*)::int from public.units u where u.building_id = b.id and u.active),
         (select m.role from public.members m where m.building_id = b.id and m.user_id = auth.uid())
  from public.buildings b
  where b.compound_id = p_compound and private.in_compound(p_compound)
  order by b.name
$$;
revoke all on function public.compound_buildings(uuid) from public, anon;
grant execute on function public.compound_buildings(uuid) to authenticated;

create or replace function public.resident_view(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u public.units; b public.buildings; pub boolean; who boolean; res jsonb;
begin
  select * into u from public.units where resident_token = p_token and active;
  if u.id is null then return null; end if;
  select * into b from public.buildings where id = u.building_id;
  pub := coalesce((b.settings->>'books_public')::boolean, true);
  who := coalesce((b.settings->>'show_who_paid')::boolean, false);
  res := jsonb_build_object(
    'building', jsonb_build_object('id', b.id, 'name', b.name, 'name_ar', b.name_ar, 'settings', b.settings - 'notes'),
    'unit', to_jsonb(u) - 'resident_token' - 'phone',
    'units', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'code', x.code, 'block', x.block, 'weight', x.weight, 'active', x.active, 'sort', x.sort, 'created_at', x.created_at)), '[]')
                from public.units x where x.building_id = b.id),
    'cycles', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.cycles c where c.building_id = b.id and c.published),
    'charges', (select coalesce(jsonb_agg(to_jsonb(ch)), '[]') from public.charges ch
                 join public.cycles c on c.id = ch.cycle_id and c.published where ch.building_id = b.id),
    'my_payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'charge_id', p.charge_id, 'unit_id', p.unit_id,
                      'amount', p.amount, 'cur', p.cur, 'channel', p.channel, 'method', p.method, 'received_at', p.received_at,
                      'received_by', p.received_by, 'handover_id', p.handover_id, 'voided_at', p.voided_at,
                      'received_by_name', (select display_name from public.members m where m.building_id = b.id and m.user_id = p.received_by))), '[]')
                    from public.payments p where p.unit_id = u.id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role, 'display_name', m.display_name)), '[]')
                  from public.members m where m.building_id = b.id),
    'books_public', pub);
  if pub then
    res := res || jsonb_build_object(
      'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'charge_id', p.charge_id,
                    'unit_id', case when who or p.unit_id = u.id then p.unit_id end,
                    'amount', p.amount, 'cur', p.cur, 'channel', p.channel, 'received_at', p.received_at,
                    'received_by', p.received_by, 'handover_id', p.handover_id, 'voided_at', p.voided_at)), '[]')
                   from public.payments p where p.building_id = b.id),
      'expenses', (select coalesce(jsonb_agg(to_jsonb(e) - 'paid_by'), '[]') from public.expenses e where e.building_id = b.id),
      'handovers', (select coalesce(jsonb_agg(to_jsonb(h)), '[]') from public.handovers h where h.building_id = b.id));
  end if;
  return res;
end $$;
