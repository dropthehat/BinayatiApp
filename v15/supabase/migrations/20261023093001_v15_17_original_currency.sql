-- Migration 20261023093001_v15_17_original_currency
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

-- When a building keeps its books in one currency, LBP entries are converted on save; the original is kept here.
alter table public.charges add column if not exists orig_amount numeric;
alter table public.charges add column if not exists orig_cur text;
alter table public.charges add column if not exists fx numeric;
alter table public.expenses add column if not exists orig_amount numeric;
alter table public.expenses add column if not exists orig_cur text;
alter table public.expenses add column if not exists fx numeric;
