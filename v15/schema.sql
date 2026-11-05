-- ============================================================================
-- Binayati V15 · Supabase schema
-- Already applied to the BINAYATI project. To rebuild elsewhere: Supabase → SQL Editor → paste all → Run.
-- Safe to re-run: it drops and recreates the policies and functions it owns,
-- but it never drops tables, so your data stays.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.buildings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_ar     text,
  settings    jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  building_id  uuid not null references public.buildings(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('manager','comanager','collector')),
  display_name text not null default '',
  phone        text,
  created_at   timestamptz not null default now(),
  primary key (building_id, user_id)
);

create table if not exists public.invites (
  code         text primary key,
  building_id  uuid not null references public.buildings(id) on delete cascade,
  role         text not null check (role in ('comanager','collector')),
  display_name text not null default '',
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  used_by      uuid,
  used_at      timestamptz
);

create table if not exists public.units (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid not null references public.buildings(id) on delete cascade,
  code           text not null,
  name           text not null default '',
  name_ar        text,
  phone          text,
  lang           text not null default 'both' check (lang in ('ar','en','both')),
  weight         numeric not null default 1 check (weight >= 0),
  sort           int not null default 0,
  active         boolean not null default true,
  resident_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at     timestamptz not null default now()
);

create table if not exists public.cycles (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  kind        text not null default 'month' check (kind in ('month','project')),
  title       text not null,
  title_ar    text,
  period      text,               -- 'YYYY-MM' for months
  budget      numeric,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.charges (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  cycle_id    uuid not null references public.cycles(id) on delete cascade,
  kind        text not null default 'fixed' check (kind in ('fixed','due','service')),
  title       text not null,
  title_ar    text,
  cur         text not null default 'USD' check (cur in ('USD','LBP')),
  amount      numeric not null default 0,
  split       text not null default 'each' check (split in ('each','weight','total','custom')),
  overrides   jsonb not null default '{}'::jsonb,  -- { unit_id: amount }
  pass_through boolean not null default false,       -- collected for a supplier (moteur, internet)
  recurring   boolean not null default true,         -- copied into the next month
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.handovers (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(id) on delete cascade,
  collector_id uuid not null,
  usd          numeric not null default 0,
  lbp          numeric not null default 0,
  note         text,
  status       text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  created_at   timestamptz not null default now(),
  resolved_by  uuid,
  resolved_at  timestamptz
);

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  charge_id   uuid not null references public.charges(id) on delete cascade,
  unit_id     uuid not null references public.units(id) on delete cascade,
  amount      numeric not null check (amount > 0),
  cur         text not null check (cur in ('USD','LBP')),
  channel     text not null check (channel in ('collector','manager','transfer')),
  method      text,              -- Cash, Whish, OMT, Bank…
  received_by uuid default auth.uid(),
  received_at timestamptz not null default now(),
  handover_id uuid references public.handovers(id) on delete set null,
  note        text,
  voided_at   timestamptz,
  voided_by   uuid
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  cycle_id    uuid references public.cycles(id) on delete set null,
  charge_id   uuid references public.charges(id) on delete set null,  -- set when paying a supplier
  cat         text not null default 'other',
  title       text not null,
  amount      numeric not null check (amount > 0),
  cur         text not null check (cur in ('USD','LBP')),
  paid_from   text not null default 'safe' check (paid_from in ('safe','collector')),
  paid_by     uuid default auth.uid(),
  spent_on    date not null default current_date,
  ref         text,
  note        text,
  handover_id uuid references public.handovers(id) on delete set null,
  voided_at   timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  title       text not null,
  title_ar    text,
  due_on      date,
  repeat      text not null default 'none' check (repeat in ('none','daily','weekly','monthly','quarterly','halfyear','yearly')),
  assignee    text not null default 'manager' check (assignee in ('manager','collector')),
  done_at     timestamptz,
  done_by     uuid,
  created_at  timestamptz not null default now()
);

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  building_id uuid not null references public.buildings(id) on delete cascade,
  actor       uuid,
  actor_name  text,
  tbl         text not null,
  action      text not null,
  row_id      uuid,
  data        jsonb,
  at          timestamptz not null default now()
);

create index if not exists units_b on public.units(building_id);
create index if not exists cycles_b on public.cycles(building_id);
create index if not exists charges_b on public.charges(building_id);
create index if not exists payments_b on public.payments(building_id);
create index if not exists payments_cu on public.payments(charge_id, unit_id);
create index if not exists expenses_b on public.expenses(building_id);
create index if not exists tasks_b on public.tasks(building_id);
create index if not exists events_b on public.events(building_id, at desc);
create index if not exists handovers_b on public.handovers(building_id);

-- ---------------------------------------------------------------------------
-- 2. Role helpers (security definer so policies don't recurse into members).
--    They live in a private schema that the Data API does not expose.
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated, anon;
create or replace function private.my_role(b uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where building_id = b and user_id = auth.uid()
$$;

create or replace function private.is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.members where building_id = b and user_id = auth.uid())
$$;

create or replace function private.is_manager(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.members where building_id = b and user_id = auth.uid()
                and role in ('manager','comanager'))
$$;

-- ---------------------------------------------------------------------------
-- 3. Data API access. New Supabase projects no longer expose new tables
--    automatically, so signed-in users get explicit grants; RLS below decides
--    which rows they see. Signed-out visitors (residents) get no table access:
--    they only reach resident_view().
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.buildings, public.members, public.invites, public.units, public.cycles,
  public.charges, public.handovers, public.payments, public.expenses, public.tasks to authenticated;
grant select on public.events to authenticated;
revoke all on public.buildings, public.members, public.invites, public.units, public.cycles, public.charges,
  public.handovers, public.payments, public.expenses, public.tasks, public.events from anon;

-- ---------------------------------------------------------------------------
-- 3b. Row level security
-- ---------------------------------------------------------------------------
alter table public.buildings enable row level security;
alter table public.members   enable row level security;
alter table public.invites   enable row level security;
alter table public.units     enable row level security;
alter table public.cycles    enable row level security;
alter table public.charges   enable row level security;
alter table public.handovers enable row level security;
alter table public.payments  enable row level security;
alter table public.expenses  enable row level security;
alter table public.tasks     enable row level security;
alter table public.events    enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and policyname like 'bny_%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- buildings: members read, managers edit. Creation goes through create_building().
create policy bny_buildings_read on public.buildings for select to authenticated using (private.is_member(id));
create policy bny_buildings_edit on public.buildings for update to authenticated using (private.is_manager(id)) with check (private.is_manager(id));
create policy bny_buildings_del  on public.buildings for delete to authenticated using (private.my_role(id) = 'manager');

-- members: members read the team, managers change it. Joining goes through join_building().
create policy bny_members_read on public.members for select to authenticated using (private.is_member(building_id));
create policy bny_members_edit on public.members for update to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_members_del  on public.members for delete to authenticated using (private.is_manager(building_id) and role <> 'manager');

-- invites: managers only
create policy bny_invites_all on public.invites for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));

-- units, cycles, charges: members read, managers write
create policy bny_units_read   on public.units   for select to authenticated using (private.is_member(building_id));
create policy bny_units_write  on public.units   for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_cycles_read  on public.cycles  for select to authenticated using (private.is_member(building_id));
create policy bny_cycles_write on public.cycles  for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_charges_read on public.charges for select to authenticated using (private.is_member(building_id));
create policy bny_charges_write on public.charges for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));

-- payments: members read; managers write anything; a collector can only add cash he received himself.
create policy bny_pay_read on public.payments for select to authenticated using (private.is_member(building_id));
create policy bny_pay_mgr  on public.payments for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_pay_col  on public.payments for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and channel = 'collector'
  and received_by = auth.uid() and handover_id is null and voided_at is null);

-- expenses: members read; managers write; a collector can log cash he spent himself.
create policy bny_exp_read on public.expenses for select to authenticated using (private.is_member(building_id));
create policy bny_exp_mgr  on public.expenses for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_exp_col  on public.expenses for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and paid_from = 'collector'
  and paid_by = auth.uid() and handover_id is null);

-- handovers: members read; changes go through request_handover() / resolve_handover().
create policy bny_ho_read on public.handovers for select to authenticated using (private.is_member(building_id));

-- tasks: members read; managers write; collectors may tick tasks off.
create policy bny_tasks_read on public.tasks for select to authenticated using (private.is_member(building_id));
create policy bny_tasks_mgr  on public.tasks for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_tasks_col  on public.tasks for update to authenticated using (private.my_role(building_id) = 'collector')
  with check (private.my_role(building_id) = 'collector');

-- events: read only; written by triggers
create policy bny_events_read on public.events for select to authenticated using (private.is_member(building_id));

-- ---------------------------------------------------------------------------
-- 4. Audit trail: every change to money and setup is logged with who did it
-- ---------------------------------------------------------------------------
create or replace function private.log_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  b uuid := (rec->>'building_id')::uuid;
  nm text;
begin
  if tg_table_name = 'buildings' then b := (rec->>'id')::uuid; end if;
  if tg_table_name = 'units' then rec := rec - 'resident_token'; end if;
  select display_name into nm from public.members where building_id = b and user_id = auth.uid();
  insert into public.events(building_id, actor, actor_name, tbl, action, row_id, data)
  values (b, auth.uid(), nm, tg_table_name, lower(tg_op), (rec->>'id')::uuid,
          case when tg_op = 'UPDATE' then jsonb_build_object('new', rec, 'old', to_jsonb(old) - 'resident_token') else rec end);
  return null;
exception when foreign_key_violation then
  return null;   -- the building itself is being deleted
end $$;

do $$
declare t text;
begin
  foreach t in array array['units','cycles','charges','payments','expenses','handovers','tasks','members'] loop
    execute format('drop trigger if exists bny_log on public.%I', t);
    execute format('create trigger bny_log after insert or update or delete on public.%I for each row execute function private.log_event()', t);
  end loop;
end $$;


-- Repeating tasks roll forward on the server when ticked, whoever ticks them.
create or replace function private.roll_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.done_at is not null and old.done_at is null and new.repeat <> 'none' then
    insert into public.tasks(building_id, title, title_ar, due_on, repeat, assignee)
    values (new.building_id, new.title, new.title_ar,
            case when new.repeat = 'daily' then greatest(coalesce(new.due_on, current_date), current_date) + 1
            else (coalesce(new.due_on, current_date) + case new.repeat
               when 'weekly' then interval '7 days' when 'monthly' then interval '1 month'
               when 'quarterly' then interval '3 months' when 'halfyear' then interval '6 months'
               else interval '1 year' end)::date end,
            new.repeat, new.assignee);
    new.repeat := 'none';
  end if;
  return new;
end $$;
drop trigger if exists bny_roll on public.tasks;
create trigger bny_roll before update on public.tasks for each row execute function private.roll_task();

-- ---------------------------------------------------------------------------
-- 5. Functions the app calls
-- ---------------------------------------------------------------------------

-- Create a building and make the caller its manager.
create or replace function public.create_building(p_name text, p_name_ar text, p_settings jsonb, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.buildings(name, name_ar, settings, created_by)
  values (p_name, p_name_ar, coalesce(p_settings, '{}'::jsonb), auth.uid()) returning id into bid;
  insert into public.members(building_id, user_id, role, display_name)
  values (bid, auth.uid(), 'manager', coalesce(p_display_name, ''));
  return bid;
end $$;

-- Manager creates an invite code for a collector or co-manager.
create or replace function public.create_invite(p_building uuid, p_role text, p_display_name text)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not private.is_manager(p_building) then raise exception 'managers only'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites(code, building_id, role, display_name) values (c, p_building, p_role, coalesce(p_display_name, ''));
  return c;
end $$;

-- Look at an invite before accepting it (works signed out).
create or replace function public.peek_invite(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('building', b.name, 'building_ar', b.name_ar, 'role', i.role,
                            'display_name', i.display_name,
                            'valid', i.used_at is null and i.expires_at > now())
  from public.invites i join public.buildings b on b.id = i.building_id
  where i.code = upper(p_code)
$$;

-- Accept an invite: the signed-in user joins the building with the invite's role.
create or replace function public.join_building(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from public.invites where code = upper(p_code) for update;
  if inv.code is null then raise exception 'invite not found'; end if;
  if inv.used_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  insert into public.members(building_id, user_id, role, display_name)
  values (inv.building_id, auth.uid(), inv.role, coalesce(nullif(p_display_name, ''), inv.display_name))
  on conflict (building_id, user_id) do update set role = excluded.role;
  update public.invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.building_id;
end $$;

-- Collector hands his cash to the manager: everything he holds goes into one pending handover.
create or replace function public.request_handover(p_building uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; u numeric; l numeric;
begin
  if private.my_role(p_building) is null then raise exception 'not a member'; end if;
  if exists(select 1 from public.handovers where building_id = p_building and collector_id = auth.uid() and status = 'pending') then
    raise exception 'a handover is already waiting for confirmation';
  end if;
  select coalesce(sum(case when cur = 'USD' then amount end), 0), coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.payments
   where building_id = p_building and channel = 'collector' and received_by = auth.uid()
     and handover_id is null and voided_at is null;
  select u - coalesce(sum(case when cur = 'USD' then amount end), 0), l - coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.expenses
   where building_id = p_building and paid_from = 'collector' and paid_by = auth.uid()
     and handover_id is null and voided_at is null;
  if u = 0 and l = 0 then raise exception 'nothing to hand over'; end if;
  insert into public.handovers(building_id, collector_id, usd, lbp, note)
  values (p_building, auth.uid(), u, l, p_note) returning id into hid;
  update public.payments set handover_id = hid
   where building_id = p_building and channel = 'collector' and received_by = auth.uid()
     and handover_id is null and voided_at is null;
  update public.expenses set handover_id = hid
   where building_id = p_building and paid_from = 'collector' and paid_by = auth.uid()
     and handover_id is null and voided_at is null;
  return hid;
end $$;

-- Manager confirms (cash is now in the safe) or rejects (cash goes back to the collector's pocket).
create or replace function public.resolve_handover(p_handover uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare h public.handovers;
begin
  select * into h from public.handovers where id = p_handover for update;
  if h.id is null then raise exception 'not found'; end if;
  if not private.is_manager(h.building_id) then raise exception 'managers only'; end if;
  if h.status <> 'pending' then raise exception 'already resolved'; end if;
  update public.handovers set status = case when p_accept then 'confirmed' else 'rejected' end,
         resolved_by = auth.uid(), resolved_at = now() where id = h.id;
  if not p_accept then
    update public.payments set handover_id = null where handover_id = h.id;
    update public.expenses set handover_id = null where handover_id = h.id;
  end if;
end $$;

-- A collector may undo his own payment while the cash is still in his pocket.
create or replace function public.void_payment(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payments;
begin
  select * into p from public.payments where id = p_payment for update;
  if p.id is null then raise exception 'not found'; end if;
  if private.is_manager(p.building_id)
     or (private.my_role(p.building_id) = 'collector' and p.received_by = auth.uid() and p.handover_id is null) then
    update public.payments set voided_at = now(), voided_by = auth.uid() where id = p.id;
  else
    raise exception 'not allowed';
  end if;
end $$;

-- What a resident sees from their private link. Works without signing in.
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
    'books_public', pub
  );
  if pub then
    res := res || jsonb_build_object(
      'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'charge_id', p.charge_id,
                    'unit_id', case when who or p.unit_id = u.id then p.unit_id end,
                    'amount', p.amount, 'cur', p.cur, 'channel', p.channel, 'received_at', p.received_at,
                    'received_by', p.received_by, 'handover_id', p.handover_id, 'voided_at', p.voided_at)), '[]')
                   from public.payments p where p.building_id = b.id),
      'expenses', (select coalesce(jsonb_agg(to_jsonb(e) - 'paid_by'), '[]') from public.expenses e where e.building_id = b.id),
      'handovers', (select coalesce(jsonb_agg(to_jsonb(h)), '[]') from public.handovers h where h.building_id = b.id)
    );
  end if;
  return res;
end $$;

revoke all on all functions in schema private from public;
grant execute on function private.my_role(uuid), private.is_member(uuid), private.is_manager(uuid) to authenticated, anon;
revoke all on function public.resident_view(text), public.peek_invite(text), public.create_building(text, text, jsonb, text),
  public.create_invite(uuid, text, text), public.join_building(text, text), public.request_handover(uuid, text),
  public.resolve_handover(uuid, boolean), public.void_payment(uuid) from public, anon;
grant execute on function public.resident_view(text) to anon, authenticated;
grant execute on function public.peek_invite(text) to anon, authenticated;
grant execute on function public.create_building(text, text, jsonb, text) to authenticated;
grant execute on function public.create_invite(uuid, text, text) to authenticated;
grant execute on function public.join_building(text, text) to authenticated;
grant execute on function public.request_handover(uuid, text) to authenticated;
grant execute on function public.resolve_handover(uuid, boolean) to authenticated;
grant execute on function public.void_payment(uuid) to authenticated;
revoke all on function private.log_event(), private.roll_task() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Live updates between phones
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['buildings','members','units','cycles','charges','payments','expenses','handovers','tasks','events'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Blocks and compounds
--    Blocks: one building record, one safe, units and charges tagged A, B, C…
--    Compounds: separate buildings (own safe, own team) grouped to split shared bills.
-- ---------------------------------------------------------------------------
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
drop policy if exists bny_compounds_read on public.compounds;
drop policy if exists bny_compounds_insert on public.compounds;
drop policy if exists bny_compounds_edit on public.compounds;
drop policy if exists bny_compounds_del on public.compounds;
create policy bny_compounds_read on public.compounds for select to authenticated using (created_by = auth.uid() or private.in_compound(id));
create policy bny_compounds_insert on public.compounds for insert to authenticated with check (created_by = auth.uid());
create policy bny_compounds_edit on public.compounds for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy bny_compounds_del on public.compounds for delete to authenticated using (created_by = auth.uid());
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
-- resident_view in section 5 also returns each unit's block (applied as migration v15_08).

-- ---------------------------------------------------------------------------
-- 8. Photos of receipts and transfer screenshots (private bucket, per building folder)
-- ---------------------------------------------------------------------------
alter table public.expenses add column if not exists photo_path text;
alter table public.payments add column if not exists photo_path text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists bny_receipts_read on storage.objects;
drop policy if exists bny_receipts_add on storage.objects;
drop policy if exists bny_receipts_del on storage.objects;
create policy bny_receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy bny_receipts_add on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy bny_receipts_del on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and private.is_manager(((storage.foldername(name))[1])::uuid));

-- v15_10: Arabic names for people
alter table public.members add column if not exists display_name_ar text;
alter table public.invites add column if not exists display_name_ar text;
-- set_my_name(p_building, p_name, p_name_ar), invite_name_ar trigger, peek_invite and resident_view
-- return display_name_ar (applied live as migrations v15_10_arabic_member_names / v15_11).

-- v15_12–14: shared demo accounts demo-manager / demo-collector (password binayati-demo)
-- and public.demo_reset(), which builds a fresh "Demo Arz" building (12 apartments, Sep+Oct,
-- handovers, expenses, tasks) and moves the two demo members onto it. Applied live as migrations.

-- v15_15: public.receive_handover(p_building, p_collector, p_note): manager records cash received from a collector
-- (confirms a waiting handover and sweeps anything newer into a confirmed one). Applied live.

-- v15_16: charges.meter jsonb { rate, fixed, kwh:{unit_id:n} } for generators priced by kWh. Applied live.
alter table public.charges add column if not exists meter jsonb;

-- v15_17: charges/expenses orig_amount, orig_cur, fx (original LBP kept when the books are in dollars). Applied live.
-- Binayati V15 · 2026-11-03
-- 1) Per-member permissions the owner can switch on/off, enforced in RLS.
-- 2) Only the owner (role 'manager') changes or removes team members.
-- 3) Expenses: Arabic title and an optional block (for a safe per block).

alter table public.members  add column if not exists perms jsonb not null default '{}'::jsonb;
alter table public.expenses add column if not exists title_ar text;
alter table public.expenses add column if not exists block text;

-- Permission keys: pay, spend, charges, books, tasks, team.
-- The owner can do everything. Otherwise an explicit true/false in members.perms wins,
-- else the role default: co-manager everything; collector pay, spend, books, tasks.
create or replace function private.can(b uuid, p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when m.role = 'manager' then true
      when m.perms ? p then coalesce((m.perms ->> p)::boolean, false)
      when m.role = 'comanager' then true
      when m.role = 'collector' then p in ('pay', 'spend', 'books', 'tasks')
      else false end
    from public.members m
    where m.building_id = b and m.user_id = (select auth.uid())), false)
$$;
revoke execute on function private.can(uuid, text) from public, anon;
grant execute on function private.can(uuid, text) to authenticated;

-- team: only the owner edits roles/permissions or removes people (members rename themselves via set_my_name)
drop policy if exists bny_members_edit on public.members;
drop policy if exists bny_members_del  on public.members;
create policy bny_members_edit on public.members for update to authenticated
  using (private.my_role(building_id) = 'manager') with check (private.my_role(building_id) = 'manager');
create policy bny_members_del  on public.members for delete to authenticated
  using (private.my_role(building_id) = 'manager' and role <> 'manager');

drop policy if exists bny_invites_all on public.invites;
create policy bny_invites_all on public.invites for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'team'))
  with check (private.is_manager(building_id) and private.can(building_id, 'team'));

drop policy if exists bny_units_write   on public.units;
drop policy if exists bny_cycles_write  on public.cycles;
drop policy if exists bny_charges_write on public.charges;
create policy bny_units_write   on public.units   for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'charges')) with check (private.is_manager(building_id) and private.can(building_id, 'charges'));
create policy bny_cycles_write  on public.cycles  for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'charges')) with check (private.is_manager(building_id) and private.can(building_id, 'charges'));
create policy bny_charges_write on public.charges for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'charges')) with check (private.is_manager(building_id) and private.can(building_id, 'charges'));

drop policy if exists bny_pay_mgr on public.payments;
drop policy if exists bny_pay_col on public.payments;
create policy bny_pay_mgr on public.payments for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'pay')) with check (private.is_manager(building_id) and private.can(building_id, 'pay'));
create policy bny_pay_col on public.payments for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and private.can(building_id, 'pay') and channel = 'collector'
  and received_by = (select auth.uid()) and handover_id is null and voided_at is null);

drop policy if exists bny_exp_mgr on public.expenses;
drop policy if exists bny_exp_col on public.expenses;
create policy bny_exp_mgr on public.expenses for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'spend')) with check (private.is_manager(building_id) and private.can(building_id, 'spend'));
create policy bny_exp_col on public.expenses for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and private.can(building_id, 'spend') and paid_from = 'collector'
  and paid_by = (select auth.uid()) and handover_id is null);

drop policy if exists bny_tasks_mgr on public.tasks;
drop policy if exists bny_tasks_col on public.tasks;
create policy bny_tasks_mgr on public.tasks for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'tasks')) with check (private.is_manager(building_id) and private.can(building_id, 'tasks'));
create policy bny_tasks_col on public.tasks for update to authenticated
  using (private.my_role(building_id) = 'collector' and private.can(building_id, 'tasks'))
  with check (private.my_role(building_id) = 'collector' and private.can(building_id, 'tasks'));

-- Binayati V15 · 2026-11-04
-- Per-block access: a collector or co-manager can be limited to some blocks of a compound.
-- members.blocks null or empty = every block (the default). The owner is never limited.
-- Writes are enforced here; the app also hides other blocks from a limited person.

alter table public.members add column if not exists blocks text[];
alter table public.invites add column if not exists blocks text[];

-- My blocks: null when I can act on every block.
create or replace function private.my_blocks(b uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select case when m.role = 'manager' or m.blocks is null or cardinality(m.blocks) = 0 then null else m.blocks end
  from public.members m where m.building_id = b and m.user_id = (select auth.uid())
$$;

-- May I act on this block? A null block means "the whole compound": only someone with every block.
create or replace function private.block_ok(b uuid, blk text) returns boolean
language sql stable security definer set search_path = public as $$
  select private.my_blocks(b) is null or (blk is not null and blk = any(private.my_blocks(b)))
$$;

-- May I act on this apartment? Same rule, using the apartment's block.
create or replace function private.unit_ok(b uuid, unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.my_blocks(b) is null
      or exists(select 1 from public.units u where u.id = unit and u.block = any(private.my_blocks(b)))
$$;

revoke execute on function private.my_blocks(uuid), private.block_ok(uuid, text), private.unit_ok(uuid, uuid) from public, anon;
grant execute on function private.my_blocks(uuid), private.block_ok(uuid, text), private.unit_ok(uuid, uuid) to authenticated;

-- Payments: only for apartments in my blocks.
drop policy if exists bny_pay_mgr on public.payments;
drop policy if exists bny_pay_col on public.payments;
create policy bny_pay_mgr on public.payments for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'pay') and private.unit_ok(building_id, unit_id))
  with check (private.is_manager(building_id) and private.can(building_id, 'pay') and private.unit_ok(building_id, unit_id));
create policy bny_pay_col on public.payments for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and private.can(building_id, 'pay') and private.unit_ok(building_id, unit_id)
  and channel = 'collector' and received_by = (select auth.uid()) and handover_id is null and voided_at is null);

-- Expenses: only for my blocks. An expense with no block (whole compound) needs every block,
-- except with one shared safe, where cash spent from anyone's pocket is the compound's.
drop policy if exists bny_exp_mgr on public.expenses;
drop policy if exists bny_exp_col on public.expenses;
create policy bny_exp_mgr on public.expenses for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'spend')
         and (private.block_ok(building_id, block) or (block is null and coalesce((select settings->>'safe_mode' from public.buildings where id = building_id), '') <> 'block')))
  with check (private.is_manager(building_id) and private.can(building_id, 'spend')
         and (private.block_ok(building_id, block) or (block is null and coalesce((select settings->>'safe_mode' from public.buildings where id = building_id), '') <> 'block')));
create policy bny_exp_col on public.expenses for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and private.can(building_id, 'spend') and paid_from = 'collector'
  and paid_by = (select auth.uid()) and handover_id is null
  and (private.block_ok(building_id, block) or (block is null and coalesce((select settings->>'safe_mode' from public.buildings where id = building_id), '') <> 'block')));

-- Apartments and charges: a limited co-manager changes only their blocks; months and
-- compound-wide charges stay with people who have every block.
drop policy if exists bny_units_write   on public.units;
drop policy if exists bny_cycles_write  on public.cycles;
drop policy if exists bny_charges_write on public.charges;
create policy bny_units_write on public.units for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'charges') and private.block_ok(building_id, block))
  with check (private.is_manager(building_id) and private.can(building_id, 'charges') and private.block_ok(building_id, block));
create policy bny_cycles_write on public.cycles for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'charges') and private.my_blocks(building_id) is null)
  with check (private.is_manager(building_id) and private.can(building_id, 'charges') and private.my_blocks(building_id) is null);
create policy bny_charges_write on public.charges for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'charges') and private.block_ok(building_id, block))
  with check (private.is_manager(building_id) and private.can(building_id, 'charges') and private.block_ok(building_id, block));

-- Undo a payment: same block rule, and a co-manager needs the pay permission.
create or replace function public.void_payment(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payments;
begin
  select * into p from public.payments where id = p_payment for update;
  if p.id is null then raise exception 'not found'; end if;
  if not private.unit_ok(p.building_id, p.unit_id) then raise exception 'not allowed'; end if;
  if (private.is_manager(p.building_id) and private.can(p.building_id, 'pay'))
     or (private.my_role(p.building_id) = 'collector' and p.received_by = auth.uid() and p.handover_id is null) then
    update public.payments set voided_at = now(), voided_by = auth.uid() where id = p.id;
  else
    raise exception 'not allowed';
  end if;
end $$;

-- Invites carry blocks. A limited person can only invite into their own blocks; the owner picks.
drop function if exists public.create_invite(uuid, text, text, text[]);
create or replace function public.create_invite(p_building uuid, p_role text, p_display_name text, p_blocks text[] default null)
returns text language plpgsql security definer set search_path = public as $$
declare c text; mine text[] := private.my_blocks(p_building); want text[];
begin
  if not (private.is_manager(p_building) and private.can(p_building, 'team')) then raise exception 'not allowed'; end if;
  want := case when p_blocks is null or cardinality(p_blocks) = 0 then mine else p_blocks end;
  if mine is not null and not (want <@ mine) then raise exception 'not allowed'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites(code, building_id, role, display_name, blocks) values (c, p_building, p_role, coalesce(p_display_name, ''), want);
  return c;
end $$;
revoke all on function public.create_invite(uuid, text, text, text[]) from public, anon;
grant execute on function public.create_invite(uuid, text, text, text[]) to authenticated;
drop function if exists public.create_invite(uuid, text, text);

create or replace function public.join_building(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from public.invites where code = upper(p_code) for update;
  if inv.code is null then raise exception 'invite not found'; end if;
  if inv.used_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  insert into public.members(building_id, user_id, role, display_name, blocks)
  values (inv.building_id, auth.uid(), inv.role, coalesce(nullif(p_display_name, ''), inv.display_name), inv.blocks)
  on conflict (building_id, user_id) do update set role = excluded.role, blocks = excluded.blocks;
  update public.invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.building_id;
end $$;

-- Binayati V15 · 2026-11-04 · Admin workspace
-- 1) app_admins: who runs Binayati (Carl). 2) app_features: the feature map, with switches.
-- 3) building_features: a feature switched on/off for one building. 4) app_lists: categories and
-- presets the app reads live (global rows have building_id null; a building can add its own).
-- 5) Support: the building owner grants time-limited, read-only access; every look is logged
-- and shows in the building's activity.

create table if not exists public.app_admins (user_id uuid primary key references auth.users(id) on delete cascade, added_at timestamptz not null default now());
alter table public.app_admins enable row level security;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.app_admins where user_id = (select auth.uid()))
$$;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy if exists adm_self on public.app_admins;
create policy adm_self on public.app_admins for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.am_admin() returns boolean language sql stable security definer set search_path = public as $$ select private.is_admin() $$;
revoke all on function public.am_admin() from public, anon; grant execute on function public.am_admin() to authenticated;

-- Feature map
create table if not exists public.app_features (
  key text primary key, category text not null, en text not null, ar text, about_en text, about_ar text,
  status text not null default 'live' check (status in ('live','beta','idea','custom','off')),
  switchable boolean not null default false, default_on boolean not null default true, sort int not null default 0,
  updated_at timestamptz not null default now());
alter table public.app_features enable row level security;
drop policy if exists feat_read on public.app_features;
drop policy if exists feat_write on public.app_features;
create policy feat_read on public.app_features for select to authenticated using (true);
create policy feat_write on public.app_features for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table if not exists public.building_features (
  building_id uuid not null references public.buildings(id) on delete cascade,
  key text not null references public.app_features(key) on delete cascade,
  "on" boolean not null, note text, set_by uuid default auth.uid(), set_at timestamptz not null default now(),
  primary key (building_id, key));
alter table public.building_features enable row level security;
drop policy if exists bfeat_read on public.building_features;
drop policy if exists bfeat_write on public.building_features;
create policy bfeat_read on public.building_features for select to authenticated using (private.is_member(building_id) or private.is_admin());
create policy bfeat_write on public.building_features for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Lists the app reads live
create table if not exists public.app_lists (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references public.buildings(id) on delete cascade,
  kind text not null check (kind in ('expense_cat','expense_preset','charge_preset','task_preset','pay_method')),
  key text, en text not null, ar text, icon text, data jsonb not null default '{}'::jsonb,
  sort int not null default 0, hidden boolean not null default false,
  updated_by uuid default auth.uid(), updated_at timestamptz not null default now());
create index if not exists app_lists_kind on public.app_lists(kind, building_id);
alter table public.app_lists enable row level security;
drop policy if exists lists_read on public.app_lists;
drop policy if exists lists_admin on public.app_lists;
drop policy if exists lists_bld on public.app_lists;
create policy lists_read on public.app_lists for select to authenticated
  using (building_id is null or private.is_member(building_id) or private.is_admin());
create policy lists_admin on public.app_lists for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy lists_bld on public.app_lists for all to authenticated
  using (building_id is not null and private.is_manager(building_id) and private.can(building_id, 'charges'))
  with check (building_id is not null and private.is_manager(building_id) and private.can(building_id, 'charges'));

-- Support access
create table if not exists public.support_grants (
  building_id uuid primary key references public.buildings(id) on delete cascade,
  granted_by uuid default auth.uid(), granted_at timestamptz not null default now(), expires_at timestamptz not null, note text);
alter table public.support_grants enable row level security;
drop policy if exists sg_read on public.support_grants;
create policy sg_read on public.support_grants for select to authenticated using (private.is_member(building_id) or private.is_admin());

create table if not exists public.support_log (
  id bigserial primary key, admin_id uuid not null, building_id uuid not null references public.buildings(id) on delete cascade,
  action text not null, detail text, at timestamptz not null default now());
alter table public.support_log enable row level security;
drop policy if exists sl_read on public.support_log;
create policy sl_read on public.support_log for select to authenticated using (private.is_admin() or private.my_role(building_id) = 'manager');

create or replace function private.support_ok(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin() and exists(select 1 from public.support_grants g where g.building_id = b and g.expires_at > now())
$$;
revoke execute on function private.support_ok(uuid) from public, anon;
grant execute on function private.support_ok(uuid) to authenticated;

-- Read-only support view: select policies on every building table, nothing else.
do $$
declare tb text;
begin
  foreach tb in array array['members','units','cycles','charges','payments','handovers','expenses','tasks','events','invites'] loop
    execute format('drop policy if exists bny_support_read on public.%I', tb);
    execute format('create policy bny_support_read on public.%I for select to authenticated using (private.support_ok(building_id))', tb);
  end loop;
end $$;
drop policy if exists bny_support_read on public.buildings;
create policy bny_support_read on public.buildings for select to authenticated using (private.support_ok(id));

-- The owner turns support access on (for some hours) or off.
create or replace function public.set_support(p_building uuid, p_hours int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare until timestamptz;
begin
  if private.my_role(p_building) <> 'manager' then raise exception 'only the building owner can do this'; end if;
  if coalesce(p_hours, 0) <= 0 then
    delete from public.support_grants where building_id = p_building;
    insert into public.events(building_id, actor, actor_name, tbl, action, data) values (p_building, auth.uid(), '', 'support', 'revoke', '{}'::jsonb);
    return null;
  end if;
  until := now() + make_interval(hours => least(p_hours, 168));
  insert into public.support_grants(building_id, granted_by, expires_at) values (p_building, auth.uid(), until)
  on conflict (building_id) do update set granted_by = excluded.granted_by, granted_at = now(), expires_at = excluded.expires_at;
  insert into public.events(building_id, actor, actor_name, tbl, action, data) values (p_building, auth.uid(), '', 'support', 'grant', jsonb_build_object('until', until));
  return until;
end $$;
revoke all on function public.set_support(uuid, int) from public, anon; grant execute on function public.set_support(uuid, int) to authenticated;

-- Admin opens a building: allowed only while access is granted; logged and shown to the building.
create or replace function public.support_open(p_building uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.support_ok(p_building) then raise exception 'support access is not on for this building'; end if;
  insert into public.support_log(admin_id, building_id, action) values (auth.uid(), p_building, 'view');
  insert into public.events(building_id, actor, actor_name, tbl, action, data) values (p_building, auth.uid(), 'Binayati support', 'support', 'view', '{}'::jsonb);
end $$;
revoke all on function public.support_open(uuid) from public, anon; grant execute on function public.support_open(uuid) to authenticated;

-- Admin: every building with its size and whether support access is on.
create or replace function public.admin_buildings()
returns table(id uuid, name text, name_ar text, created_at timestamptz, units int, members int, owner text, support_until timestamptz, custom int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return query
  select b.id, b.name, b.name_ar, b.created_at,
         (select count(*)::int from public.units u where u.building_id = b.id and u.active is not false),
         (select count(*)::int from public.members m where m.building_id = b.id),
         (select m.display_name from public.members m where m.building_id = b.id and m.role = 'manager' limit 1),
         (select g.expires_at from public.support_grants g where g.building_id = b.id and g.expires_at > now()),
         (select count(*)::int from public.building_features f where f.building_id = b.id)
  from public.buildings b order by b.created_at desc;
end $$;
revoke all on function public.admin_buildings() from public, anon; grant execute on function public.admin_buildings() to authenticated;

-- Live updates
do $$ begin
  begin alter publication supabase_realtime add table public.app_lists; exception when others then null; end;
  begin alter publication supabase_realtime add table public.app_features; exception when others then null; end;
  begin alter publication supabase_realtime add table public.building_features; exception when others then null; end;
  begin alter publication supabase_realtime add table public.support_grants; exception when others then null; end;
end $$;

-- Carl is the admin
insert into public.app_admins(user_id) select id from auth.users where email = 'halalcarl@gmail.com' on conflict do nothing;

-- Feature map (switchable ones can be turned on/off for everyone or one building)
insert into public.app_features(key, category, en, ar, about_en, about_ar, status, switchable, default_on, sort) values
('collect_ticks','Collect','Tick payments','تأشير الدفعات','Mark what each apartment paid, as cash or transfer','تأشير ما دفعته كل شقة، نقداً أو تحويلاً','live',false,true,10),
('receipts_whatsapp','Collect','WhatsApp bills & receipts','فواتير وإيصالات واتساب','Send each apartment its bill or receipt','إرسال الفاتورة أو الإيصال لكل شقة','live',false,true,11),
('transfer_scan','Collect','Read transfer screenshots','قراءة لقطات التحويل','Whish/OMT/bank screenshot fills the payment','لقطة Whish/OMT/المصرف تملأ الدفعة','live',true,true,12),
('ai_reminders','Collect','Reminder messages','رسائل تذكير','Write a polite reminder for an apartment that owes','كتابة تذكير لطيف لشقة عليها مستحقات','live',true,true,13),
('split_total','Charges','Split a total','تقسيم مبلغ كلي','One bill divided by share; typed amounts stay, the rest re-divide','فاتورة تُقسّم بالحصص؛ المبالغ المكتوبة تبقى','live',false,true,20),
('meter_kwh','Charges','Priced by kWh','حسب الكيلوواط','Generator charges priced per kWh','رسوم المولد حسب الكيلوواط','live',true,true,21),
('meter_m3','Charges','Priced by m³','حسب المتر المكعب','Water charges priced per m³','رسوم المياه حسب المتر المكعب','live',true,true,22),
('supplier_services','Charges','Supplier services','خدمات المورّدين','Moteur, internet… collected for a supplier','موتور، إنترنت… تُجمع لمورّد','live',false,true,23),
('projects','Charges','Projects','المشاريع','One-time collections like painting or a new pump','جمع لمرة واحدة مثل الدهان أو مضخة','live',false,true,24),
('expense_scan','Books','Scan receipts','مسح الإيصالات','Photo of a receipt fills the expense','صورة الإيصال تملأ المصروف','live',true,true,30),
('handovers','Books','Cash handovers','تسليم النقد','Collector hands cash to the manager, confirmed','الجابي يسلّم النقد للمدير بتأكيد','live',false,true,31),
('safe_per_block','Books','A safe per block','صندوق لكل بلوك','Each block keeps its own cash','كل بلوك له نقده','live',false,true,32),
('blocks','Building','Blocks & compounds','البلوكات والمجمّعات','Several blocks in one compound','عدة بلوكات في مجمّع واحد','live',false,true,40),
('permissions','Building','Permissions','الصلاحيات','Per-person access switches and remove access','صلاحيات لكل شخص وإزالة الوصول','live',false,true,41),
('block_access','Building','Access per block','الوصول حسب البلوك','Limit a person to some blocks','حصر شخص ببعض البلوكات','live',false,true,42),
('invite_qr','Building','Invite QR code','رمز QR للدعوة','Saveable QR under every invite link','رمز QR قابل للحفظ تحت كل رابط دعوة','live',true,true,43),
('contacts_pick','Building','Pick from contacts','الاختيار من جهات الاتصال','Fill a resident''s number from the phone''s contacts (Android)','ملء رقم الساكن من جهات الاتصال (أندرويد)','live',true,true,44),
('tasks','Building','Tasks & reminders','المهام والتذكيرات','Repeating building chores','أعمال البناية المتكررة','live',false,true,45),
('setup_checklist','Onboarding','Setup checklist','قائمة البدء','Get-started steps on Home after setup','خطوات البدء في الرئيسية بعد الإعداد','live',true,true,50),
('multi_block_scene','Onboarding','Buildings per block','بناية لكل بلوك','One building drawn per block','رسم بناية لكل بلوك','live',false,true,51),
('resident_page','Residents','Resident page','صفحة الساكن','Private link with bill, receipts and balance','رابط خاص بالفاتورة والإيصالات والرصيد','live',false,true,60),
('support_access','Support','Support access','وصول الدعم','Owner lets Binayati support view the building for a while','المالك يسمح للدعم برؤية البناية لفترة','live',false,true,70)
on conflict (key) do update set category = excluded.category, en = excluded.en, ar = excluded.ar, about_en = excluded.about_en, about_ar = excluded.about_ar, switchable = excluded.switchable, sort = excluded.sort;

-- Lists: seeded from the app's built-in lists (only once)
do $$ begin if not exists (select 1 from public.app_lists where building_id is null) then
insert into public.app_lists(kind, key, en, ar, icon, data, sort) values
('expense_cat', 'gen', 'Generator & fuel', 'المولد والمازوت', '⚡', '{"locked":false}'::jsonb, 0),
('expense_cat', 'elev', 'Elevator', 'المصعد', '🛗', '{"locked":false}'::jsonb, 1),
('expense_cat', 'water', 'Water', 'المياه', '💧', '{"locked":false}'::jsonb, 2),
('expense_cat', 'clean', 'Cleaning', 'التنظيف', '🧹', '{"locked":false}'::jsonb, 3),
('expense_cat', 'light', 'Lighting', 'الإنارة', '💡', '{"locked":false}'::jsonb, 4),
('expense_cat', 'repair', 'Repairs', 'تصليحات', '🔧', '{"locked":false}'::jsonb, 5),
('expense_cat', 'staff', 'Staff pay', 'أجور', '🧑‍🔧', '{"locked":false}'::jsonb, 6),
('expense_cat', 'supplier', 'Supplier', 'مورّد', '↗', '{"locked":true}'::jsonb, 7),
('expense_cat', 'other', 'Other', 'أخرى', '🧾', '{"locked":true}'::jsonb, 8),
('expense_preset', null, 'Generator diesel', 'مازوت المولّد', null, '{"cat":"gen"}'::jsonb, 9),
('expense_preset', null, 'Generator oil & filters', 'زيت وفلاتر المولّد', null, '{"cat":"gen"}'::jsonb, 10),
('expense_preset', null, 'Generator repair', 'تصليح المولّد', null, '{"cat":"gen"}'::jsonb, 11),
('expense_preset', null, 'Elevator monthly service', 'صيانة المصعد الشهرية', null, '{"cat":"elev"}'::jsonb, 12),
('expense_preset', null, 'Elevator repair', 'تصليح المصعد', null, '{"cat":"elev"}'::jsonb, 13),
('expense_preset', null, 'Water bill', 'فاتورة المياه', null, '{"cat":"water"}'::jsonb, 14),
('expense_preset', null, 'Water tanker', 'صهريج مياه', null, '{"cat":"water"}'::jsonb, 15),
('expense_preset', null, 'Water tank cleaning', 'تنظيف خزانات المياه', null, '{"cat":"water"}'::jsonb, 16),
('expense_preset', null, 'Water pump repair', 'تصليح مضخة المياه', null, '{"cat":"water"}'::jsonb, 17),
('expense_preset', null, 'Cleaning supplies', 'مواد تنظيف', null, '{"cat":"clean"}'::jsonb, 18),
('expense_preset', null, 'Trash bags', 'أكياس نفايات', null, '{"cat":"clean"}'::jsonb, 19),
('expense_preset', null, 'Trash collection fee', 'رسم جمع النفايات', null, '{"cat":"clean"}'::jsonb, 20),
('expense_preset', null, 'Trash bins', 'مستوعبات نفايات', null, '{"cat":"clean"}'::jsonb, 21),
('expense_preset', null, 'Bulky waste removal', 'رفع ردميات وأغراض كبيرة', null, '{"cat":"clean"}'::jsonb, 22),
('expense_preset', null, 'Pest control', 'رش مبيدات', null, '{"cat":"clean"}'::jsonb, 23),
('expense_preset', null, 'Light bulbs', 'لمبات إنارة', null, '{"cat":"light"}'::jsonb, 24),
('expense_preset', null, 'EDL bill (common meter)', 'فاتورة كهرباء الدولة (العداد المشترك)', null, '{"cat":"light"}'::jsonb, 25),
('expense_preset', null, 'Electrician', 'كهربائي', null, '{"cat":"light"}'::jsonb, 26),
('expense_preset', null, 'Plumber', 'سنكري', null, '{"cat":"repair"}'::jsonb, 27),
('expense_preset', null, 'Locksmith / door repair', 'تصليح أقفال وأبواب', null, '{"cat":"repair"}'::jsonb, 28),
('expense_preset', null, 'Intercom repair', 'تصليح الإنترفون', null, '{"cat":"repair"}'::jsonb, 29),
('expense_preset', null, 'Painting', 'دهان', null, '{"cat":"repair"}'::jsonb, 30),
('expense_preset', null, 'Roof waterproofing', 'عزل السطح', null, '{"cat":"repair"}'::jsonb, 31),
('expense_preset', null, 'Fire extinguishers refill', 'تعبئة طفايات الحريق', null, '{"cat":"repair"}'::jsonb, 32),
('expense_preset', null, 'Natour salary', 'راتب الناطور', null, '{"cat":"staff"}'::jsonb, 33),
('expense_preset', null, 'Cleaner pay', 'أجر عامل التنظيف', null, '{"cat":"staff"}'::jsonb, 34),
('expense_preset', null, 'Gardener', 'جنيناتي', null, '{"cat":"staff"}'::jsonb, 35),
('expense_preset', null, 'Building insurance', 'تأمين البناية', null, '{"cat":"other"}'::jsonb, 36),
('expense_preset', null, 'Municipality fees', 'رسوم البلدية', null, '{"cat":"other"}'::jsonb, 37),
('expense_preset', null, 'Transport / delivery', 'نقل وتوصيل', null, '{"cat":"other"}'::jsonb, 38),
('charge_preset', null, 'Building maintenance', 'صيانة البناية', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":20,"cur":"USD","split":"each"}'::jsonb, 39),
('charge_preset', null, 'Staircase & common areas cleaning', 'تنظيف الدرج والأقسام المشتركة', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":10,"cur":"USD","split":"each"}'::jsonb, 40),
('charge_preset', null, 'Elevator maintenance contract', 'عقد صيانة المصعد', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 41),
('charge_preset', null, 'Water pump maintenance', 'صيانة مضخة المياه', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":20,"cur":"USD","split":"total"}'::jsonb, 42),
('charge_preset', null, 'Garden care', 'العناية بالحديقة', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":40,"cur":"USD","split":"total"}'::jsonb, 43),
('charge_preset', null, 'Trash collection (door to door)', 'جمع النفايات من الأبواب', null, '{"kind":"fixed","g":["Trash","النفايات"],"amt":5,"cur":"USD","split":"each"}'::jsonb, 44),
('charge_preset', null, 'Trash collection company', 'شركة جمع النفايات', null, '{"kind":"fixed","g":["Trash","النفايات"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 45),
('charge_preset', null, 'Trash bags & bin cleaning', 'أكياس النفايات وتنظيف المستوعبات', null, '{"kind":"fixed","g":["Trash","النفايات"],"amt":2,"cur":"USD","split":"each"}'::jsonb, 46),
('charge_preset', null, 'Natour (concierge) salary', 'راتب الناطور', null, '{"kind":"fixed","g":["Staff","الموظفون"],"amt":300,"cur":"USD","split":"total"}'::jsonb, 47),
('charge_preset', null, 'Security guard', 'أجر الحارس', null, '{"kind":"fixed","g":["Staff","الموظفون"],"amt":400,"cur":"USD","split":"total"}'::jsonb, 48),
('charge_preset', null, 'Cleaner', 'أجر عامل التنظيف', null, '{"kind":"fixed","g":["Staff","الموظفون"],"amt":100,"cur":"USD","split":"total"}'::jsonb, 49),
('charge_preset', null, 'Common areas electricity (EDL meter)', 'كهرباء الأقسام المشتركة (عداد الدولة)', null, '{"kind":"fixed","g":["Power & water","الكهرباء والمياه"],"amt":2000000,"cur":"LBP","split":"total"}'::jsonb, 50),
('charge_preset', null, 'Common areas generator subscription', 'اشتراك المولد للأقسام المشتركة', null, '{"kind":"fixed","g":["Power & water","الكهرباء والمياه"],"amt":40,"cur":"USD","split":"total"}'::jsonb, 51),
('charge_preset', null, 'Building generator diesel', 'مازوت مولّد البناية', null, '{"kind":"fixed","g":["Power & water","الكهرباء والمياه"],"amt":150,"cur":"USD","split":"total"}'::jsonb, 52),
('charge_preset', null, 'Water subscription (monthly share)', 'اشتراك المياه (الحصة الشهرية)', null, '{"kind":"fixed","g":["Power & water","الكهرباء والمياه"],"amt":1000000,"cur":"LBP","split":"total"}'::jsonb, 53),
('charge_preset', null, 'Reserve fund', 'صندوق الاحتياط', null, '{"kind":"fixed","g":["Savings","الادخار"],"amt":5,"cur":"USD","split":"each"}'::jsonb, 54),
('charge_preset', null, 'Solar system installment', 'قسط نظام الطاقة الشمسية', null, '{"kind":"fixed","g":["Savings","الادخار"],"amt":25,"cur":"USD","split":"each"}'::jsonb, 55),
('charge_preset', null, 'Water bill (Water Establishment)', 'فاتورة مؤسسة المياه', null, '{"kind":"due","g":["Water","المياه"],"amt":10000000,"cur":"LBP","split":"total"}'::jsonb, 56),
('charge_preset', null, 'Water tanker fill', 'نقلة صهريج مياه', null, '{"kind":"due","g":["Water","المياه"],"amt":40,"cur":"USD","split":"total"}'::jsonb, 57),
('charge_preset', null, 'Water tank cleaning', 'تنظيف خزانات المياه', null, '{"kind":"due","g":["Water","المياه"],"amt":80,"cur":"USD","split":"total"}'::jsonb, 58),
('charge_preset', null, 'Water pump repair', 'تصليح مضخة المياه', null, '{"kind":"due","g":["Water","المياه"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 59),
('charge_preset', null, 'EDL bill (common meter)', 'فاتورة كهرباء الدولة (العداد المشترك)', null, '{"kind":"due","g":["Power","الكهرباء"],"amt":3000000,"cur":"LBP","split":"total"}'::jsonb, 60),
('charge_preset', null, 'Generator diesel top-up', 'تعبئة مازوت للمولّد', null, '{"kind":"due","g":["Power","الكهرباء"],"amt":200,"cur":"USD","split":"total"}'::jsonb, 61),
('charge_preset', null, 'Generator repair', 'تصليح المولّد', null, '{"kind":"due","g":["Power","الكهرباء"],"amt":100,"cur":"USD","split":"total"}'::jsonb, 62),
('charge_preset', null, 'Solar batteries replacement', 'تبديل بطاريات الطاقة الشمسية', null, '{"kind":"due","g":["Power","الكهرباء"],"amt":600,"cur":"USD","split":"total"}'::jsonb, 63),
('charge_preset', null, 'Elevator repair', 'تصليح المصعد', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":150,"cur":"USD","split":"total"}'::jsonb, 64),
('charge_preset', null, 'Plumbing repair', 'تصليحات صحية', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 65),
('charge_preset', null, 'Electrical repair', 'تصليحات كهربائية', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 66),
('charge_preset', null, 'Intercom or entrance door repair', 'تصليح الإنترفون أو باب المدخل', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 67),
('charge_preset', null, 'Garage gate repair', 'تصليح باب الموقف', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":80,"cur":"USD","split":"total"}'::jsonb, 68),
('charge_preset', null, 'Roof waterproofing', 'عزل السطح', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":1500,"cur":"USD","split":"total"}'::jsonb, 69),
('charge_preset', null, 'Painting common areas', 'دهان الأقسام المشتركة', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":800,"cur":"USD","split":"total"}'::jsonb, 70),
('charge_preset', null, 'Fire extinguishers refill', 'تعبئة طفايات الحريق', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 71),
('charge_preset', null, 'Pest control', 'رش مبيدات', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 72),
('charge_preset', null, 'Building insurance', 'تأمين البناية', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":300,"cur":"USD","split":"total"}'::jsonb, 73),
('charge_preset', null, 'Municipality fees (common parts)', 'رسوم البلدية (الأقسام المشتركة)', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":5000000,"cur":"LBP","split":"total"}'::jsonb, 74),
('charge_preset', null, 'Lawyer or syndicate fees', 'أتعاب المحامي أو النقابة', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":100,"cur":"USD","split":"total"}'::jsonb, 75),
('charge_preset', null, 'New trash bins', 'مستوعبات نفايات جديدة', null, '{"kind":"due","g":["Trash","النفايات"],"amt":80,"cur":"USD","split":"total"}'::jsonb, 76),
('charge_preset', null, 'Bulky waste removal (renovation debris)', 'رفع ردميات وأغراض كبيرة', null, '{"kind":"due","g":["Trash","النفايات"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 77),
('charge_preset', null, 'Municipality trash fee', 'رسم النفايات للبلدية', null, '{"kind":"due","g":["Trash","النفايات"],"amt":2000000,"cur":"LBP","split":"total"}'::jsonb, 78),
('charge_preset', null, 'Common light bulbs', 'لمبات الأقسام المشتركة', null, '{"kind":"due","g":["Other","أخرى"],"amt":20,"cur":"USD","split":"total"}'::jsonb, 79),
('charge_preset', null, 'Holiday decoration', 'زينة الأعياد', null, '{"kind":"due","g":["Other","أخرى"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 80),
('charge_preset', null, 'Private generator (moteur)', 'اشتراك الموتور', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 81),
('charge_preset', null, 'Internet', 'اشتراك الإنترنت', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 82),
('charge_preset', null, 'Satellite dish', 'اشتراك الدش', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 83),
('charge_preset', null, 'Cable TV', 'اشتراك الكابل', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 84),
('charge_preset', null, 'Drinking water delivery', 'توصيل مياه الشرب', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 85),
('charge_preset', null, 'Cooking gas', 'غاز الطبخ', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 86),
('charge_preset', null, 'Solar power share', 'حصة الطاقة الشمسية', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 87),
('charge_preset', null, 'Private trash pickup', 'جمع النفايات الخاص', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 88),
('charge_preset', null, 'Parking space rent', 'إيجار موقف السيارة', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 89),
('task_preset', null, 'Clean water tanks', 'تنظيف خزانات المياه', null, '{"g":["Water","المياه"],"rep":"halfyear","who":"collector"}'::jsonb, 90),
('task_preset', null, 'Check the water pump', 'فحص مضخة المياه', null, '{"g":["Water","المياه"],"rep":"monthly","who":"collector"}'::jsonb, 91),
('task_preset', null, 'Read the water meters', 'قراءة عدادات المياه', null, '{"g":["Water","المياه"],"rep":"monthly","who":"collector"}'::jsonb, 92),
('task_preset', null, 'Order a water tanker', 'طلب صهريج مياه', null, '{"g":["Water","المياه"],"rep":"none","who":"manager"}'::jsonb, 93),
('task_preset', null, 'Generator oil change', 'تغيير زيت المولّد', null, '{"g":["Power","الكهرباء"],"rep":"monthly","who":"collector"}'::jsonb, 94),
('task_preset', null, 'Top up generator diesel', 'تعبئة مازوت المولّد', null, '{"g":["Power","الكهرباء"],"rep":"weekly","who":"collector"}'::jsonb, 95),
('task_preset', null, 'Dust the solar panels', 'تنظيف ألواح الطاقة الشمسية', null, '{"g":["Power","الكهرباء"],"rep":"monthly","who":"collector"}'::jsonb, 96),
('task_preset', null, 'Replace burnt common lights', 'تبديل اللمبات المحروقة', null, '{"g":["Power","الكهرباء"],"rep":"monthly","who":"collector"}'::jsonb, 97),
('task_preset', null, 'Collect trash from the floors', 'جمع النفايات من الطوابق', null, '{"g":["Trash","النفايات"],"rep":"daily","who":"collector"}'::jsonb, 98),
('task_preset', null, 'Put the bins out for pickup', 'إخراج المستوعبات للجمع', null, '{"g":["Trash","النفايات"],"rep":"daily","who":"collector"}'::jsonb, 99),
('task_preset', null, 'Sort recycling (plastic, cardboard)', 'فرز إعادة التدوير (بلاستيك، كرتون)', null, '{"g":["Trash","النفايات"],"rep":"weekly","who":"collector"}'::jsonb, 100),
('task_preset', null, 'Pay the trash collection company', 'الدفع لشركة جمع النفايات', null, '{"g":["Trash","النفايات"],"rep":"monthly","who":"manager"}'::jsonb, 101),
('task_preset', null, 'Wash the trash bins', 'غسل مستوعبات النفايات', null, '{"g":["Trash","النفايات"],"rep":"weekly","who":"collector"}'::jsonb, 102),
('task_preset', null, 'Clean the staircase', 'تنظيف الدرج', null, '{"g":["Cleaning","التنظيف"],"rep":"weekly","who":"collector"}'::jsonb, 103),
('task_preset', null, 'Clean the entrance glass', 'تنظيف زجاج المدخل', null, '{"g":["Cleaning","التنظيف"],"rep":"weekly","who":"collector"}'::jsonb, 104),
('task_preset', null, 'Clear roof drains before winter', 'تنظيف مجاري السطح قبل الشتاء', null, '{"g":["Cleaning","التنظيف"],"rep":"yearly","who":"collector"}'::jsonb, 105),
('task_preset', null, 'Clean basement drains & light wells', 'تنظيف مجاري الطابق السفلي والمناور', null, '{"g":["Cleaning","التنظيف"],"rep":"quarterly","who":"collector"}'::jsonb, 106),
('task_preset', null, 'Water the garden', 'سقاية الحديقة', null, '{"g":["Cleaning","التنظيف"],"rep":"weekly","who":"collector"}'::jsonb, 107),
('task_preset', null, 'Elevator service visit', 'زيارة صيانة المصعد', null, '{"g":["Safety","السلامة"],"rep":"monthly","who":"manager"}'::jsonb, 108),
('task_preset', null, 'Elevator safety certificate', 'شهادة سلامة المصعد', null, '{"g":["Safety","السلامة"],"rep":"yearly","who":"manager"}'::jsonb, 109),
('task_preset', null, 'Check fire extinguishers', 'فحص طفايات الحريق', null, '{"g":["Safety","السلامة"],"rep":"yearly","who":"manager"}'::jsonb, 110),
('task_preset', null, 'Pest control', 'رش مبيدات', null, '{"g":["Safety","السلامة"],"rep":"halfyear","who":"manager"}'::jsonb, 111),
('task_preset', null, 'Test the intercom & door lock', 'فحص الإنترفون وقفل الباب', null, '{"g":["Safety","السلامة"],"rep":"quarterly","who":"collector"}'::jsonb, 112),
('task_preset', null, 'Collect the monthly dues', 'جمع المستحقات الشهرية', null, '{"g":["Admin","الإدارة"],"rep":"monthly","who":"collector"}'::jsonb, 113),
('task_preset', null, 'Share the monthly report', 'مشاركة التقرير الشهري', null, '{"g":["Admin","الإدارة"],"rep":"monthly","who":"manager"}'::jsonb, 114),
('task_preset', null, 'Renew building insurance', 'تجديد تأمين البناية', null, '{"g":["Admin","الإدارة"],"rep":"yearly","who":"manager"}'::jsonb, 115),
('task_preset', null, 'Pay the generator owner', 'الدفع لصاحب المولّد', null, '{"g":["Admin","الإدارة"],"rep":"monthly","who":"manager"}'::jsonb, 116),
('task_preset', null, 'Residents'' meeting', 'اجتماع السكان', null, '{"g":["Admin","الإدارة"],"rep":"halfyear","who":"manager"}'::jsonb, 117),
('pay_method', 'Whish', 'Whish', 'ويش', null, '{}'::jsonb, 900), ('pay_method', 'OMT', 'OMT', 'OMT', null, '{}'::jsonb, 901), ('pay_method', 'Bank', 'Bank transfer', 'تحويل مصرفي', null, '{}'::jsonb, 902);
end if; end $$;

-- ===== Admin workspace: Overview and Buildings (2026-11-05) =====
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
