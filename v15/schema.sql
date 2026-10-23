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
