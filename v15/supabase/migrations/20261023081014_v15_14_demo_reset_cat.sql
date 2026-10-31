-- Migration 20261023081014_v15_14_demo_reset_cat
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

do $$ begin execute replace(pg_get_functiondef('public.demo_reset()'::regprocedure), '''cleaning''', '''clean'''); end $$;
