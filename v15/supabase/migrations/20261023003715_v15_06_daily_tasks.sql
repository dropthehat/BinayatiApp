-- Migration 20261023003715_v15_06_daily_tasks
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

alter table public.tasks drop constraint if exists tasks_repeat_check;
alter table public.tasks add constraint tasks_repeat_check check (repeat in ('none','daily','weekly','monthly','quarterly','halfyear','yearly'));
create or replace function private.roll_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.done_at is not null and old.done_at is null and new.repeat <> 'none' then
    insert into public.tasks(building_id, title, title_ar, due_on, repeat, assignee)
    values (new.building_id, new.title, new.title_ar,
            (coalesce(new.due_on, current_date) + case new.repeat
               when 'daily' then interval '1 day' when 'weekly' then interval '7 days' when 'monthly' then interval '1 month'
               when 'quarterly' then interval '3 months' when 'halfyear' then interval '6 months'
               else interval '1 year' end)::date,
            new.repeat, new.assignee);
    new.repeat := 'none';
  end if;
  return new;
end $$;
