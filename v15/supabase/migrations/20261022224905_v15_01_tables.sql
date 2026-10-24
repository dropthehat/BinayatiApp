-- Migration 20261022224905_v15_01_tables
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(), name text not null, name_ar text,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now());
create table if not exists public.members (
  building_id uuid not null references public.buildings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('manager','comanager','collector')),
  display_name text not null default '', phone text, created_at timestamptz not null default now(),
  primary key (building_id, user_id));
create table if not exists public.invites (
  code text primary key, building_id uuid not null references public.buildings(id) on delete cascade,
  role text not null check (role in ('comanager','collector')), display_name text not null default '',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days', used_by uuid, used_at timestamptz);
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade,
  code text not null, name text not null default '', name_ar text, phone text,
  lang text not null default 'both' check (lang in ('ar','en','both')),
  weight numeric not null default 1 check (weight >= 0), sort int not null default 0, active boolean not null default true,
  resident_token text not null unique default replace(gen_random_uuid()::text, '-', ''), created_at timestamptz not null default now());
create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade,
  kind text not null default 'month' check (kind in ('month','project')), title text not null, title_ar text,
  period text, budget numeric, published boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  kind text not null default 'fixed' check (kind in ('fixed','due','service')), title text not null, title_ar text,
  cur text not null default 'USD' check (cur in ('USD','LBP')), amount numeric not null default 0,
  split text not null default 'each' check (split in ('each','weight','total','custom')),
  overrides jsonb not null default '{}'::jsonb, pass_through boolean not null default false,
  recurring boolean not null default true, sort int not null default 0, created_at timestamptz not null default now());
create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade,
  collector_id uuid not null, usd numeric not null default 0, lbp numeric not null default 0, note text,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  created_at timestamptz not null default now(), resolved_by uuid, resolved_at timestamptz);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade,
  charge_id uuid not null references public.charges(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  amount numeric not null check (amount > 0), cur text not null check (cur in ('USD','LBP')),
  channel text not null check (channel in ('collector','manager','transfer')), method text,
  received_by uuid default auth.uid(), received_at timestamptz not null default now(),
  handover_id uuid references public.handovers(id) on delete set null, note text, voided_at timestamptz, voided_by uuid);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade,
  cycle_id uuid references public.cycles(id) on delete set null, charge_id uuid references public.charges(id) on delete set null,
  cat text not null default 'other', title text not null, amount numeric not null check (amount > 0),
  cur text not null check (cur in ('USD','LBP')),
  paid_from text not null default 'safe' check (paid_from in ('safe','collector')),
  paid_by uuid default auth.uid(), spent_on date not null default current_date, ref text, note text,
  handover_id uuid references public.handovers(id) on delete set null, voided_at timestamptz,
  created_at timestamptz not null default now());
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id) on delete cascade,
  title text not null, title_ar text, due_on date,
  repeat text not null default 'none' check (repeat in ('none','weekly','monthly','quarterly','halfyear','yearly')),
  assignee text not null default 'manager' check (assignee in ('manager','collector')),
  done_at timestamptz, done_by uuid, created_at timestamptz not null default now());
create table if not exists public.events (
  id bigint generated always as identity primary key,
  building_id uuid not null references public.buildings(id) on delete cascade,
  actor uuid, actor_name text, tbl text not null, action text not null, row_id uuid, data jsonb,
  at timestamptz not null default now());
create index if not exists units_b on public.units(building_id);
create index if not exists cycles_b on public.cycles(building_id);
create index if not exists charges_b on public.charges(building_id);
create index if not exists payments_b on public.payments(building_id);
create index if not exists payments_cu on public.payments(charge_id, unit_id);
create index if not exists expenses_b on public.expenses(building_id);
create index if not exists tasks_b on public.tasks(building_id);
create index if not exists events_b on public.events(building_id, at desc);
create index if not exists handovers_b on public.handovers(building_id);
alter table public.buildings enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.units enable row level security;
alter table public.cycles enable row level security;
alter table public.charges enable row level security;
alter table public.handovers enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;
