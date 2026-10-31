-- Migration 20261022225105_v15_02_roles_and_policies
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

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
  select exists(select 1 from public.members where building_id = b and user_id = auth.uid() and role in ('manager','comanager'))
$$;
revoke all on all functions in schema private from public;
grant execute on function private.my_role(uuid), private.is_member(uuid), private.is_manager(uuid) to authenticated, anon;

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.buildings, public.members, public.invites, public.units, public.cycles,
  public.charges, public.handovers, public.payments, public.expenses, public.tasks to authenticated;
grant select on public.events to authenticated;
revoke all on public.buildings, public.members, public.invites, public.units, public.cycles, public.charges,
  public.handovers, public.payments, public.expenses, public.tasks, public.events from anon;

create policy bny_buildings_read on public.buildings for select to authenticated using (private.is_member(id));
create policy bny_buildings_edit on public.buildings for update to authenticated using (private.is_manager(id)) with check (private.is_manager(id));
create policy bny_buildings_del on public.buildings for delete to authenticated using (private.my_role(id) = 'manager');
create policy bny_members_read on public.members for select to authenticated using (private.is_member(building_id));
create policy bny_members_edit on public.members for update to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_members_del on public.members for delete to authenticated using (private.is_manager(building_id) and role <> 'manager');
create policy bny_invites_all on public.invites for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_units_read on public.units for select to authenticated using (private.is_member(building_id));
create policy bny_units_write on public.units for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_cycles_read on public.cycles for select to authenticated using (private.is_member(building_id));
create policy bny_cycles_write on public.cycles for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_charges_read on public.charges for select to authenticated using (private.is_member(building_id));
create policy bny_charges_write on public.charges for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_pay_read on public.payments for select to authenticated using (private.is_member(building_id));
create policy bny_pay_mgr on public.payments for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_pay_col on public.payments for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and channel = 'collector' and received_by = auth.uid() and handover_id is null and voided_at is null);
create policy bny_exp_read on public.expenses for select to authenticated using (private.is_member(building_id));
create policy bny_exp_mgr on public.expenses for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_exp_col on public.expenses for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and paid_from = 'collector' and paid_by = auth.uid() and handover_id is null);
create policy bny_ho_read on public.handovers for select to authenticated using (private.is_member(building_id));
create policy bny_tasks_read on public.tasks for select to authenticated using (private.is_member(building_id));
create policy bny_tasks_mgr on public.tasks for all to authenticated using (private.is_manager(building_id)) with check (private.is_manager(building_id));
create policy bny_tasks_col on public.tasks for update to authenticated using (private.my_role(building_id) = 'collector') with check (private.my_role(building_id) = 'collector');
create policy bny_events_read on public.events for select to authenticated using (private.is_member(building_id));
