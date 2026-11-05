-- Raw snapshots of the water and Block C sheets, sent by Carl's Apps Script. Server only: no app user can read it.
create table if not exists public.natour_sync_inbox (
  id bigint generated always as identity primary key,
  hash text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
alter table public.natour_sync_inbox enable row level security;
revoke all on public.natour_sync_inbox from anon, authenticated;
-- Keep only the latest few snapshots.
create or replace function private.natour_sync_prune() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.natour_sync_inbox where id not in (select id from public.natour_sync_inbox order by id desc limit 5);
  return null;
end $$;
drop trigger if exists natour_sync_prune on public.natour_sync_inbox;
create trigger natour_sync_prune after insert on public.natour_sync_inbox for each statement execute function private.natour_sync_prune();
