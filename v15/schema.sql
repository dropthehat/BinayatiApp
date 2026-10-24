-- Binayati V15 — database schema
-- REGENERATED FROM LIVE on 2026-10-24 from Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb)
-- via a read-only catalog dump (pg_catalog / pg_get_*def / pg_policies / ACLs), cross-checked
-- against the 17 recorded migrations in v15/supabase/migrations/ (v15_01 .. v15_17).
-- This file describes the current live state; to rebuild a fresh project, either run the
-- migrations in order or run this file on an empty project. Not intended to be re-run on live.
-- Demo accounts (demo-manager / demo-collector) are created by migration v15_12; their
-- password is NOT stored here (placeholder <DEMO_PASSWORD> in the migration file).

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ============ 1. Tables ============
create table if not exists public.buildings (
  id uuid not null default gen_random_uuid(),
  name text not null,
  name_ar text,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now(),
  compound_id uuid
);

create table if not exists public.charges (
  id uuid not null default gen_random_uuid(),
  building_id uuid not null,
  cycle_id uuid not null,
  kind text not null default 'fixed'::text,
  title text not null,
  title_ar text,
  cur text not null default 'USD'::text,
  amount numeric not null default 0,
  split text not null default 'each'::text,
  overrides jsonb not null default '{}'::jsonb,
  pass_through boolean not null default false,
  recurring boolean not null default true,
  sort integer not null default 0,
  created_at timestamp with time zone not null default now(),
  block text,
  meter jsonb,
  orig_amount numeric,
  orig_cur text,
  fx numeric
);

create table if not exists public.compounds (
  id uuid not null default gen_random_uuid(),
  name text not null,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.cycles (
  id uuid not null default gen_random_uuid(),
  building_id uuid not null,
  kind text not null default 'month'::text,
  title text not null,
  title_ar text,
  period text,
  budget numeric,
  published boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.events (
  id bigint not null,
  building_id uuid not null,
  actor uuid,
  actor_name text,
  tbl text not null,
  action text not null,
  row_id uuid,
  data jsonb,
  at timestamp with time zone not null default now()
);

create table if not exists public.expenses (
  id uuid not null default gen_random_uuid(),
  building_id uuid not null,
  cycle_id uuid,
  charge_id uuid,
  cat text not null default 'other'::text,
  title text not null,
  amount numeric not null,
  cur text not null,
  paid_from text not null default 'safe'::text,
  paid_by uuid default auth.uid(),
  spent_on date not null default CURRENT_DATE,
  ref text,
  note text,
  handover_id uuid,
  voided_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  photo_path text,
  orig_amount numeric,
  orig_cur text,
  fx numeric
);

create table if not exists public.handovers (
  id uuid not null default gen_random_uuid(),
  building_id uuid not null,
  collector_id uuid not null,
  usd numeric not null default 0,
  lbp numeric not null default 0,
  note text,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  resolved_by uuid,
  resolved_at timestamp with time zone
);

create table if not exists public.invites (
  code text not null,
  building_id uuid not null,
  role text not null,
  display_name text not null default ''::text,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null default (now() + '14 days'::interval),
  used_by uuid,
  used_at timestamp with time zone,
  display_name_ar text
);

create table if not exists public.members (
  building_id uuid not null,
  user_id uuid not null,
  role text not null,
  display_name text not null default ''::text,
  phone text,
  created_at timestamp with time zone not null default now(),
  display_name_ar text
);

create table if not exists public.payments (
  id uuid not null default gen_random_uuid(),
  building_id uuid not null,
  charge_id uuid not null,
  unit_id uuid not null,
  amount numeric not null,
  cur text not null,
  channel text not null,
  method text,
  received_by uuid default auth.uid(),
  received_at timestamp with time zone not null default now(),
  handover_id uuid,
  note text,
  voided_at timestamp with time zone,
  voided_by uuid,
  photo_path text
);

create table if not exists public.tasks (
  id uuid not null default gen_random_uuid(),
  building_id uuid not null,
  title text not null,
  title_ar text,
  due_on date,
  repeat text not null default 'none'::text,
  assignee text not null default 'manager'::text,
  done_at timestamp with time zone,
  done_by uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.units (
  id uuid not null default gen_random_uuid(),
  building_id uuid not null,
  code text not null,
  name text not null default ''::text,
  name_ar text,
  phone text,
  lang text not null default 'both'::text,
  weight numeric not null default 1,
  sort integer not null default 0,
  active boolean not null default true,
  resident_token text not null default replace((gen_random_uuid())::text, '-'::text, ''::text),
  created_at timestamp with time zone not null default now(),
  block text
);

-- ============ 2. Constraints (primary keys, unique, checks, foreign keys) ============
alter table public.buildings add constraint buildings_pkey PRIMARY KEY (id);
alter table public.buildings add constraint buildings_compound_id_fkey FOREIGN KEY (compound_id) REFERENCES compounds(id) ON DELETE SET NULL;
alter table public.buildings add constraint buildings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.charges add constraint charges_pkey PRIMARY KEY (id);
alter table public.charges add constraint charges_cur_check CHECK ((cur = ANY (ARRAY['USD'::text, 'LBP'::text])));
alter table public.charges add constraint charges_kind_check CHECK ((kind = ANY (ARRAY['fixed'::text, 'due'::text, 'service'::text])));
alter table public.charges add constraint charges_split_check CHECK ((split = ANY (ARRAY['each'::text, 'weight'::text, 'total'::text, 'custom'::text])));
alter table public.charges add constraint charges_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
alter table public.charges add constraint charges_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE;
alter table public.compounds add constraint compounds_pkey PRIMARY KEY (id);
alter table public.cycles add constraint cycles_pkey PRIMARY KEY (id);
alter table public.cycles add constraint cycles_kind_check CHECK ((kind = ANY (ARRAY['month'::text, 'project'::text])));
alter table public.cycles add constraint cycles_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
alter table public.events add constraint events_pkey PRIMARY KEY (id);
alter table public.events add constraint events_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
alter table public.expenses add constraint expenses_pkey PRIMARY KEY (id);
alter table public.expenses add constraint expenses_amount_check CHECK ((amount > (0)::numeric));
alter table public.expenses add constraint expenses_cur_check CHECK ((cur = ANY (ARRAY['USD'::text, 'LBP'::text])));
alter table public.expenses add constraint expenses_paid_from_check CHECK ((paid_from = ANY (ARRAY['safe'::text, 'collector'::text])));
alter table public.expenses add constraint expenses_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
alter table public.expenses add constraint expenses_charge_id_fkey FOREIGN KEY (charge_id) REFERENCES charges(id) ON DELETE SET NULL;
alter table public.expenses add constraint expenses_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE SET NULL;
alter table public.expenses add constraint expenses_handover_id_fkey FOREIGN KEY (handover_id) REFERENCES handovers(id) ON DELETE SET NULL;
alter table public.handovers add constraint handovers_pkey PRIMARY KEY (id);
alter table public.handovers add constraint handovers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
alter table public.handovers add constraint handovers_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
alter table public.invites add constraint invites_pkey PRIMARY KEY (code);
alter table public.invites add constraint invites_role_check CHECK ((role = ANY (ARRAY['comanager'::text, 'collector'::text])));
alter table public.invites add constraint invites_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
alter table public.members add constraint members_pkey PRIMARY KEY (building_id, user_id);
alter table public.members add constraint members_role_check CHECK ((role = ANY (ARRAY['manager'::text, 'comanager'::text, 'collector'::text])));
alter table public.members add constraint members_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
alter table public.members add constraint members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_pkey PRIMARY KEY (id);
alter table public.payments add constraint payments_amount_check CHECK ((amount > (0)::numeric));
alter table public.payments add constraint payments_channel_check CHECK ((channel = ANY (ARRAY['collector'::text, 'manager'::text, 'transfer'::text])));
alter table public.payments add constraint payments_cur_check CHECK ((cur = ANY (ARRAY['USD'::text, 'LBP'::text])));
alter table public.payments add constraint payments_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_charge_id_fkey FOREIGN KEY (charge_id) REFERENCES charges(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_handover_id_fkey FOREIGN KEY (handover_id) REFERENCES handovers(id) ON DELETE SET NULL;
alter table public.payments add constraint payments_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE;
alter table public.tasks add constraint tasks_pkey PRIMARY KEY (id);
alter table public.tasks add constraint tasks_assignee_check CHECK ((assignee = ANY (ARRAY['manager'::text, 'collector'::text])));
alter table public.tasks add constraint tasks_repeat_check CHECK ((repeat = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text, 'halfyear'::text, 'yearly'::text])));
alter table public.tasks add constraint tasks_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
alter table public.units add constraint units_pkey PRIMARY KEY (id);
alter table public.units add constraint units_resident_token_key UNIQUE (resident_token);
alter table public.units add constraint units_lang_check CHECK ((lang = ANY (ARRAY['ar'::text, 'en'::text, 'both'::text])));
alter table public.units add constraint units_weight_check CHECK ((weight >= (0)::numeric));
alter table public.units add constraint units_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- ============ 3. Indexes ============
CREATE INDEX IF NOT EXISTS buildings_compound ON public.buildings USING btree (compound_id);
CREATE INDEX IF NOT EXISTS charges_b ON public.charges USING btree (building_id);
CREATE INDEX IF NOT EXISTS cycles_b ON public.cycles USING btree (building_id);
CREATE INDEX IF NOT EXISTS events_b ON public.events USING btree (building_id, at DESC);
CREATE INDEX IF NOT EXISTS expenses_b ON public.expenses USING btree (building_id);
CREATE INDEX IF NOT EXISTS handovers_b ON public.handovers USING btree (building_id);
CREATE INDEX IF NOT EXISTS payments_b ON public.payments USING btree (building_id);
CREATE INDEX IF NOT EXISTS payments_cu ON public.payments USING btree (charge_id, unit_id);
CREATE INDEX IF NOT EXISTS tasks_b ON public.tasks USING btree (building_id);
CREATE INDEX IF NOT EXISTS units_b ON public.units USING btree (building_id);

-- ============ 4. Row level security (enabled on every public table) ============
alter table public.buildings enable row level security;
alter table public.charges enable row level security;
alter table public.compounds enable row level security;
alter table public.cycles enable row level security;
alter table public.events enable row level security;
alter table public.expenses enable row level security;
alter table public.handovers enable row level security;
alter table public.invites enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.tasks enable row level security;
alter table public.units enable row level security;

-- ============ 5. Functions (public + private) ============
CREATE OR REPLACE FUNCTION private.in_compound(c uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.buildings b join public.members m on m.building_id = b.id
                where b.compound_id = c and m.user_id = auth.uid())
$function$
;

CREATE OR REPLACE FUNCTION private.invite_name_ar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.used_by is not null and old.used_by is null and new.display_name_ar is not null then
    update public.members set display_name_ar = coalesce(display_name_ar, new.display_name_ar)
    where building_id = new.building_id and user_id = new.used_by;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.is_manager(b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.members where building_id = b and user_id = auth.uid() and role in ('manager','comanager'))
$function$
;

CREATE OR REPLACE FUNCTION private.is_member(b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.members where building_id = b and user_id = auth.uid())
$function$
;

CREATE OR REPLACE FUNCTION private.log_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  b uuid := (rec->>'building_id')::uuid;
  nm text;
begin
  if tg_table_name = 'units' then rec := rec - 'resident_token'; end if;
  select display_name into nm from public.members where building_id = b and user_id = auth.uid();
  insert into public.events(building_id, actor, actor_name, tbl, action, row_id, data)
  values (b, auth.uid(), nm, tg_table_name, lower(tg_op), (rec->>'id')::uuid,
          case when tg_op = 'UPDATE' then jsonb_build_object('new', rec, 'old', to_jsonb(old) - 'resident_token') else rec end);
  return null;
exception when foreign_key_violation then
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION private.my_role(b uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.members where building_id = b and user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION private.roll_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.compound_buildings(p_compound uuid)
 RETURNS TABLE(id uuid, name text, name_ar text, units integer, my_role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, b.name, b.name_ar,
         (select count(*)::int from public.units u where u.building_id = b.id and u.active),
         (select m.role from public.members m where m.building_id = b.id and m.user_id = auth.uid())
  from public.buildings b
  where b.compound_id = p_compound and private.in_compound(p_compound)
  order by b.name
$function$
;

CREATE OR REPLACE FUNCTION public.create_building(p_name text, p_name_ar text, p_settings jsonb, p_display_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.buildings(name, name_ar, settings, created_by)
  values (p_name, p_name_ar, coalesce(p_settings, '{}'::jsonb), auth.uid()) returning id into bid;
  insert into public.members(building_id, user_id, role, display_name)
  values (bid, auth.uid(), 'manager', coalesce(p_display_name, ''));
  return bid;
end $function$
;

CREATE OR REPLACE FUNCTION public.create_invite(p_building uuid, p_role text, p_display_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text;
begin
  if not private.is_manager(p_building) then raise exception 'managers only'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites(code, building_id, role, display_name) values (c, p_building, p_role, coalesce(p_display_name, ''));
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.demo_reset()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  mgr uuid := 'd0000000-0000-4000-8000-00000000d001';
  col uuid := 'd0000000-0000-4000-8000-00000000d002';
  b uuid; old uuid; sep uuid; oct uuid; c record; un record; h uuid; i int := 0;
  names text[] := array['Hadi Mansour','Lina Khoury','Omar Haddad','Maya Saab','Karim Aoun','Rania Nassar','Fadi Jaber','Nour Hamdan','Sami Rizk','Hiba Tannous','Joe Karam','Dana Fares'];
  names_ar text[] := array['هادي منصور','لينا خوري','عمر حداد','مايا صعب','كريم عون','رانيا نصار','فادي جابر','نور حمدان','سامي رزق','هبة طنوس','جو كرم','دانا فارس'];
  codes text[] := array['SS1A','SS1B','1A','1B','2A','2B','3A','3B','4A','4B','5A','5B'];
begin
  if auth.uid() is not null and auth.uid() not in (mgr, col) then raise exception 'not a demo account'; end if;
  select building_id into old from members m join buildings x on x.id = m.building_id
   where m.user_id = mgr and (x.settings->>'demo') = 'true' limit 1;
  insert into buildings (name, name_ar, settings, created_by)
  values ('Demo Arz', 'أرز (تجربة)', jsonb_build_object('demo', true, 'rate', 89500, 'elevator', true, 'opening_usd', 450, 'opening_lbp', 0,
          'books_public', true, 'show_who_paid', false, 'collector_name', 'Anas', 'collector_name_ar', 'أنس'), mgr)
  returning id into b;
  if old is not null then
    -- the previous demo building is retired: its two members move to the fresh one
    update members set building_id = b, display_name = case when user_id = mgr then 'Rima' else 'Anas' end,
                       display_name_ar = case when user_id = mgr then 'ريما' else 'أنس' end
     where building_id = old and user_id in (mgr, col);
    update buildings set settings = settings || '{"demo":"retired"}' where id = old;
  end if;
  insert into members (building_id, user_id, role, display_name, display_name_ar) values
    (b, mgr, 'manager', 'Rima', 'ريما'), (b, col, 'collector', 'Anas', 'أنس')
  on conflict (building_id, user_id) do nothing;
  for i in 1..12 loop
    insert into units (building_id, code, name, name_ar, phone, lang, sort)
    values (b, codes[i], names[i], names_ar[i], '+9617' || lpad((1000000 + i * 37311)::text, 7, '0'),
            case when i % 3 = 0 then 'en' when i % 3 = 1 then 'ar' else 'both' end, i);
  end loop;
  insert into cycles (building_id, kind, title, title_ar, period) values (b, 'month', 'September 2026', 'أيلول 2026', '2026-09') returning id into sep;
  insert into cycles (building_id, kind, title, title_ar, period) values (b, 'month', 'October 2026', 'تشرين الأول 2026', '2026-10') returning id into oct;
  for c in select * from (values (sep), (oct)) v(cy) loop
    insert into charges (building_id, cycle_id, kind, title, title_ar, cur, amount, split, sort) values
      (b, c.cy, 'fixed', 'Building fee', 'رسم البناية', 'USD', 25, 'each', 1),
      (b, c.cy, 'fixed', 'Elevator maintenance', 'صيانة المصعد', 'USD', 60, 'total', 2),
      (b, c.cy, 'service', 'Generator subscription', 'اشتراك المولد', 'LBP', 1500000, 'each', 3);
  end loop;
  insert into handovers (building_id, collector_id, usd, lbp, note, status, created_at, resolved_by, resolved_at)
  values (b, col, 0, 0, 'September cash', 'confirmed', '2026-09-28', mgr, '2026-09-28') returning id into h;
  for un in select * from units where building_id = b and code <> '5B' loop
    for c in select ch.*, case when ch.split = 'total' then round(ch.amount / 12, 2) else ch.amount end due from charges ch where ch.cycle_id = sep loop
      insert into payments (building_id, charge_id, unit_id, amount, cur, channel, method, received_by, received_at, handover_id)
      values (b, c.id, un.id, c.due, c.cur, case when un.sort % 2 = 0 then 'collector' else 'manager' end,
              case when un.sort % 4 = 1 then 'Whish' else 'Cash' end, case when un.sort % 2 = 0 then col else mgr end,
              ('2026-09-0' || (1 + un.sort % 9))::timestamptz, case when un.sort % 2 = 0 then h else null end);
    end loop;
  end loop;
  update handovers set usd = (select coalesce(sum(amount),0) from payments where handover_id = h and cur = 'USD'),
                       lbp = (select coalesce(sum(amount),0) from payments where handover_id = h and cur = 'LBP') where id = h;
  insert into handovers (building_id, collector_id, usd, lbp, note, status, created_at)
  values (b, col, 0, 0, 'First week of October', 'pending', now() - interval '1 day') returning id into h;
  for un in select * from units where building_id = b and sort in (1, 2, 3, 4, 6, 8, 9) loop
    for c in select ch.*, case when ch.split = 'total' then round(ch.amount / 12, 2) else ch.amount end due from charges ch
             where ch.cycle_id = oct and (ch.cur = 'USD' or un.sort < 6) loop
      insert into payments (building_id, charge_id, unit_id, amount, cur, channel, method, received_by, received_at, handover_id)
      values (b, c.id, un.id, c.due, c.cur, case when un.sort in (2, 4, 6, 8) then 'collector' else 'manager' end,
              case when un.sort = 3 then 'Whish' else 'Cash' end, case when un.sort in (2, 4, 6, 8) then col else mgr end,
              now() - ((10 - un.sort) || ' days')::interval, case when un.sort in (2, 4) then h else null end);
    end loop;
  end loop;
  update handovers set usd = (select coalesce(sum(amount),0) from payments where handover_id = h and cur = 'USD'),
                       lbp = (select coalesce(sum(amount),0) from payments where handover_id = h and cur = 'LBP') where id = h;
  insert into expenses (building_id, cycle_id, cat, title, amount, cur, paid_from, paid_by, spent_on) values
    (b, sep, 'elev', 'Elevator monthly service', 60, 'USD', 'safe', mgr, '2026-09-15'),
    (b, sep, 'clean', 'Stairs cleaning', 40, 'USD', 'safe', mgr, '2026-09-20'),
    (b, oct, 'gen', 'Diesel for the generator', 180, 'USD', 'safe', mgr, current_date - 6),
    (b, oct, 'water', 'Water tanker', 1800000, 'LBP', 'collector', col, current_date - 3);
  insert into tasks (building_id, title, title_ar, due_on, repeat, assignee) values
    (b, 'Elevator service visit', 'زيارة صيانة المصعد', current_date, 'monthly', 'manager'),
    (b, 'Trash collection', 'جمع النفايات', current_date + 1, 'daily', 'collector'),
    (b, 'Clean the water tanks', 'تنظيف خزانات المياه', current_date + 12, 'halfyear', 'manager'),
    (b, 'Check the generator oil', 'فحص زيت المولد', current_date - 2, 'weekly', 'collector');
  return b;
end $function$
;

CREATE OR REPLACE FUNCTION public.join_building(p_code text, p_display_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.peek_invite(p_code text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('building', b.name, 'building_ar', b.name_ar, 'role', i.role,
                            'display_name', i.display_name, 'display_name_ar', i.display_name_ar,
                            'valid', i.used_at is null and i.expires_at > now())
  from public.invites i join public.buildings b on b.id = i.building_id
  where i.code = upper(p_code)
$function$
;

CREATE OR REPLACE FUNCTION public.receive_handover(p_building uuid, p_collector uuid, p_note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare hid uuid; u numeric; l numeric; done boolean := false;
begin
  if not private.is_manager(p_building) then raise exception 'managers only'; end if;
  update public.handovers set status = 'confirmed', resolved_by = auth.uid(), resolved_at = now()
   where building_id = p_building and collector_id = p_collector and status = 'pending' returning id into hid;
  done := hid is not null;
  select coalesce(sum(case when cur = 'USD' then amount end), 0), coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.payments
   where building_id = p_building and channel = 'collector' and received_by = p_collector and handover_id is null and voided_at is null;
  select u - coalesce(sum(case when cur = 'USD' then amount end), 0), l - coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.expenses
   where building_id = p_building and paid_from = 'collector' and paid_by = p_collector and handover_id is null and voided_at is null;
  if u = 0 and l = 0 then
    if done then return hid; end if;
    raise exception 'nothing to receive';
  end if;
  insert into public.handovers(building_id, collector_id, usd, lbp, note, status, resolved_by, resolved_at)
  values (p_building, p_collector, u, l, coalesce(p_note, 'Received by the manager'), 'confirmed', auth.uid(), now()) returning id into hid;
  update public.payments set handover_id = hid
   where building_id = p_building and channel = 'collector' and received_by = p_collector and handover_id is null and voided_at is null;
  update public.expenses set handover_id = hid
   where building_id = p_building and paid_from = 'collector' and paid_by = p_collector and handover_id is null and voided_at is null;
  return hid;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_handover(p_building uuid, p_note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare hid uuid; u numeric; l numeric;
begin
  if private.my_role(p_building) is null then raise exception 'not a member'; end if;
  if exists(select 1 from public.handovers where building_id = p_building and collector_id = auth.uid() and status = 'pending') then
    raise exception 'a handover is already waiting for confirmation';
  end if;
  select coalesce(sum(case when cur = 'USD' then amount end), 0), coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.payments
   where building_id = p_building and channel = 'collector' and received_by = auth.uid() and handover_id is null and voided_at is null;
  select u - coalesce(sum(case when cur = 'USD' then amount end), 0), l - coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.expenses
   where building_id = p_building and paid_from = 'collector' and paid_by = auth.uid() and handover_id is null and voided_at is null;
  if u = 0 and l = 0 then raise exception 'nothing to hand over'; end if;
  insert into public.handovers(building_id, collector_id, usd, lbp, note)
  values (p_building, auth.uid(), u, l, p_note) returning id into hid;
  update public.payments set handover_id = hid
   where building_id = p_building and channel = 'collector' and received_by = auth.uid() and handover_id is null and voided_at is null;
  update public.expenses set handover_id = hid
   where building_id = p_building and paid_from = 'collector' and paid_by = auth.uid() and handover_id is null and voided_at is null;
  return hid;
end $function$
;

CREATE OR REPLACE FUNCTION public.resident_view(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role, 'display_name', m.display_name, 'display_name_ar', m.display_name_ar)), '[]')
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
end $function$
;

CREATE OR REPLACE FUNCTION public.resolve_handover(p_handover uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.set_my_name(p_building uuid, p_name text, p_name_ar text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.members set display_name = coalesce(nullif(trim(p_name), ''), display_name), display_name_ar = nullif(trim(coalesce(p_name_ar, '')), '')
  where building_id = p_building and user_id = auth.uid();
end $function$
;

CREATE OR REPLACE FUNCTION public.void_payment(p_payment uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

-- ============ 6. Triggers ============
CREATE TRIGGER bny_log AFTER INSERT OR DELETE OR UPDATE ON public.charges FOR EACH ROW EXECUTE FUNCTION private.log_event();
CREATE TRIGGER bny_log AFTER INSERT OR DELETE OR UPDATE ON public.cycles FOR EACH ROW EXECUTE FUNCTION private.log_event();
CREATE TRIGGER bny_log AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION private.log_event();
CREATE TRIGGER bny_log AFTER INSERT OR DELETE OR UPDATE ON public.handovers FOR EACH ROW EXECUTE FUNCTION private.log_event();
CREATE TRIGGER bny_invite_name_ar AFTER UPDATE ON public.invites FOR EACH ROW EXECUTE FUNCTION private.invite_name_ar();
CREATE TRIGGER bny_log AFTER INSERT OR DELETE OR UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION private.log_event();
CREATE TRIGGER bny_log AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION private.log_event();
CREATE TRIGGER bny_log AFTER INSERT OR DELETE OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION private.log_event();
CREATE TRIGGER bny_roll BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION private.roll_task();
CREATE TRIGGER bny_log AFTER INSERT OR DELETE OR UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION private.log_event();

-- ============ 7. Policies (public tables + storage 'receipts' bucket) ============
create policy bny_buildings_del on public.buildings as PERMISSIVE for DELETE to authenticated
  using ((private.my_role(id) = 'manager'::text));
create policy bny_buildings_edit on public.buildings as PERMISSIVE for UPDATE to authenticated
  using (private.is_manager(id))
  with check (private.is_manager(id));
create policy bny_buildings_read on public.buildings as PERMISSIVE for SELECT to authenticated
  using (private.is_member(id));
create policy bny_charges_read on public.charges as PERMISSIVE for SELECT to authenticated
  using (private.is_member(building_id));
create policy bny_charges_write on public.charges as PERMISSIVE for ALL to authenticated
  using (private.is_manager(building_id))
  with check (private.is_manager(building_id));
create policy bny_compounds_del on public.compounds as PERMISSIVE for DELETE to authenticated
  using ((created_by = auth.uid()));
create policy bny_compounds_edit on public.compounds as PERMISSIVE for UPDATE to authenticated
  using ((created_by = auth.uid()))
  with check ((created_by = auth.uid()));
create policy bny_compounds_insert on public.compounds as PERMISSIVE for INSERT to authenticated
  with check ((created_by = auth.uid()));
create policy bny_compounds_read on public.compounds as PERMISSIVE for SELECT to authenticated
  using (((created_by = auth.uid()) OR private.in_compound(id)));
create policy bny_cycles_read on public.cycles as PERMISSIVE for SELECT to authenticated
  using (private.is_member(building_id));
create policy bny_cycles_write on public.cycles as PERMISSIVE for ALL to authenticated
  using (private.is_manager(building_id))
  with check (private.is_manager(building_id));
create policy bny_events_read on public.events as PERMISSIVE for SELECT to authenticated
  using (private.is_member(building_id));
create policy bny_exp_col on public.expenses as PERMISSIVE for INSERT to authenticated
  with check (((private.my_role(building_id) = 'collector'::text) AND (paid_from = 'collector'::text) AND (paid_by = auth.uid()) AND (handover_id IS NULL)));
create policy bny_exp_mgr on public.expenses as PERMISSIVE for ALL to authenticated
  using (private.is_manager(building_id))
  with check (private.is_manager(building_id));
create policy bny_exp_read on public.expenses as PERMISSIVE for SELECT to authenticated
  using (private.is_member(building_id));
create policy bny_ho_read on public.handovers as PERMISSIVE for SELECT to authenticated
  using (private.is_member(building_id));
create policy bny_invites_all on public.invites as PERMISSIVE for ALL to authenticated
  using (private.is_manager(building_id))
  with check (private.is_manager(building_id));
create policy bny_members_del on public.members as PERMISSIVE for DELETE to authenticated
  using ((private.is_manager(building_id) AND (role <> 'manager'::text)));
create policy bny_members_edit on public.members as PERMISSIVE for UPDATE to authenticated
  using (private.is_manager(building_id))
  with check (private.is_manager(building_id));
create policy bny_members_read on public.members as PERMISSIVE for SELECT to authenticated
  using (private.is_member(building_id));
create policy bny_pay_col on public.payments as PERMISSIVE for INSERT to authenticated
  with check (((private.my_role(building_id) = 'collector'::text) AND (channel = 'collector'::text) AND (received_by = auth.uid()) AND (handover_id IS NULL) AND (voided_at IS NULL)));
create policy bny_pay_mgr on public.payments as PERMISSIVE for ALL to authenticated
  using (private.is_manager(building_id))
  with check (private.is_manager(building_id));
create policy bny_pay_read on public.payments as PERMISSIVE for SELECT to authenticated
  using (private.is_member(building_id));
create policy bny_tasks_col on public.tasks as PERMISSIVE for UPDATE to authenticated
  using ((private.my_role(building_id) = 'collector'::text))
  with check ((private.my_role(building_id) = 'collector'::text));
create policy bny_tasks_mgr on public.tasks as PERMISSIVE for ALL to authenticated
  using (private.is_manager(building_id))
  with check (private.is_manager(building_id));
create policy bny_tasks_read on public.tasks as PERMISSIVE for SELECT to authenticated
  using (private.is_member(building_id));
create policy bny_units_read on public.units as PERMISSIVE for SELECT to authenticated
  using (private.is_member(building_id));
create policy bny_units_write on public.units as PERMISSIVE for ALL to authenticated
  using (private.is_manager(building_id))
  with check (private.is_manager(building_id));
create policy bny_receipts_add on storage.objects as PERMISSIVE for INSERT to authenticated
  with check (((bucket_id = 'receipts'::text) AND private.is_member(((storage.foldername(name))[1])::uuid)));
create policy bny_receipts_del on storage.objects as PERMISSIVE for DELETE to authenticated
  using (((bucket_id = 'receipts'::text) AND private.is_manager(((storage.foldername(name))[1])::uuid)));
create policy bny_receipts_read on storage.objects as PERMISSIVE for SELECT to authenticated
  using (((bucket_id = 'receipts'::text) AND private.is_member(((storage.foldername(name))[1])::uuid)));

-- ============ 8. Table grants (anon has no table access; app roles go through RLS) ============
revoke all on public.buildings, public.charges, public.compounds, public.cycles, public.events, public.expenses, public.handovers, public.invites, public.members, public.payments, public.tasks, public.units from anon, authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.buildings to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.charges to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.compounds to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.cycles to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.events to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.expenses to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.handovers to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.invites to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.members to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.payments to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.tasks to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.units to authenticated;

-- ============ 9. Function execute grants (from live ACLs) ============
revoke all on function private.in_compound(c uuid) from public, anon, authenticated;
grant execute on function private.in_compound(c uuid) to authenticated;
revoke all on function private.invite_name_ar() from public, anon, authenticated;
revoke all on function private.is_manager(b uuid) from public, anon, authenticated;
grant execute on function private.is_manager(b uuid) to authenticated, anon;
revoke all on function private.is_member(b uuid) from public, anon, authenticated;
grant execute on function private.is_member(b uuid) to authenticated, anon;
revoke all on function private.log_event() from public, anon, authenticated;
revoke all on function private.my_role(b uuid) from public, anon, authenticated;
grant execute on function private.my_role(b uuid) to authenticated, anon;
revoke all on function private.roll_task() from public, anon, authenticated;
revoke all on function public.compound_buildings(p_compound uuid) from public, anon, authenticated;
grant execute on function public.compound_buildings(p_compound uuid) to authenticated, service_role;
revoke all on function public.create_building(p_name text, p_name_ar text, p_settings jsonb, p_display_name text) from public, anon, authenticated;
grant execute on function public.create_building(p_name text, p_name_ar text, p_settings jsonb, p_display_name text) to authenticated, service_role;
revoke all on function public.create_invite(p_building uuid, p_role text, p_display_name text) from public, anon, authenticated;
grant execute on function public.create_invite(p_building uuid, p_role text, p_display_name text) to authenticated, service_role;
revoke all on function public.demo_reset() from public, anon, authenticated;
grant execute on function public.demo_reset() to authenticated, service_role;
revoke all on function public.join_building(p_code text, p_display_name text) from public, anon, authenticated;
grant execute on function public.join_building(p_code text, p_display_name text) to authenticated, service_role;
revoke all on function public.peek_invite(p_code text) from public, anon, authenticated;
grant execute on function public.peek_invite(p_code text) to authenticated, service_role, anon;
revoke all on function public.receive_handover(p_building uuid, p_collector uuid, p_note text) from public, anon, authenticated;
grant execute on function public.receive_handover(p_building uuid, p_collector uuid, p_note text) to authenticated, service_role;
revoke all on function public.request_handover(p_building uuid, p_note text) from public, anon, authenticated;
grant execute on function public.request_handover(p_building uuid, p_note text) to authenticated, service_role;
revoke all on function public.resident_view(p_token text) from public, anon, authenticated;
grant execute on function public.resident_view(p_token text) to authenticated, service_role, anon;
revoke all on function public.resolve_handover(p_handover uuid, p_accept boolean) from public, anon, authenticated;
grant execute on function public.resolve_handover(p_handover uuid, p_accept boolean) to authenticated, service_role;
revoke all on function public.set_my_name(p_building uuid, p_name text, p_name_ar text) from public, anon, authenticated;
grant execute on function public.set_my_name(p_building uuid, p_name text, p_name_ar text) to authenticated, service_role;
revoke all on function public.void_payment(p_payment uuid) from public, anon, authenticated;
grant execute on function public.void_payment(p_payment uuid) to authenticated, service_role;

-- ============ 10. Storage bucket ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('receipts', 'receipts', false, 5242880, '{image/jpeg,image/png,image/webp}') on conflict (id) do nothing;

-- ============ 11. Realtime publication ============
alter publication supabase_realtime add table public.buildings;
alter publication supabase_realtime add table public.charges;
alter publication supabase_realtime add table public.cycles;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.handovers;
alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.units;
