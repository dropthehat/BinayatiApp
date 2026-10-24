-- Migration 20261023082742_v15_16_charge_meter
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

-- Generator priced by kWh: { rate, fixed, kwh: { unit_id: number } }. Amounts still live in overrides.
alter table public.charges add column if not exists meter jsonb;
