-- Migration 20261022225221_v15_03_audit_and_tasks
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

create or replace function private.log_event() returns trigger
language plpgsql security definer set search_path = public as $$
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
end $$;

create or replace trigger bny_log after insert or update or delete on public.units for each row execute function private.log_event();
create or replace trigger bny_log after insert or update or delete on public.cycles for each row execute function private.log_event();
create or replace trigger bny_log after insert or update or delete on public.charges for each row execute function private.log_event();
create or replace trigger bny_log after insert or update or delete on public.payments for each row execute function private.log_event();
create or replace trigger bny_log after insert or update or delete on public.expenses for each row execute function private.log_event();
create or replace trigger bny_log after insert or update or delete on public.handovers for each row execute function private.log_event();
create or replace trigger bny_log after insert or update or delete on public.tasks for each row execute function private.log_event();
create or replace trigger bny_log after insert or update or delete on public.members for each row execute function private.log_event();

create or replace function private.roll_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.done_at is not null and old.done_at is null and new.repeat <> 'none' then
    insert into public.tasks(building_id, title, title_ar, due_on, repeat, assignee)
    values (new.building_id, new.title, new.title_ar,
            (coalesce(new.due_on, current_date) + case new.repeat
               when 'weekly' then interval '7 days' when 'monthly' then interval '1 month'
               when 'quarterly' then interval '3 months' when 'halfyear' then interval '6 months'
               else interval '1 year' end)::date,
            new.repeat, new.assignee);
    new.repeat := 'none';
  end if;
  return new;
end $$;
create or replace trigger bny_roll before update on public.tasks for each row execute function private.roll_task();
