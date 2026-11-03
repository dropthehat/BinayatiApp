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
