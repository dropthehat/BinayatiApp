-- Binayati V15 · 2026-11-04
-- Per-block access: a collector or co-manager can be limited to some blocks of a compound.
-- members.blocks null or empty = every block (the default). The owner is never limited.
-- Writes are enforced here; the app also hides other blocks from a limited person.

alter table public.members add column if not exists blocks text[];
alter table public.invites add column if not exists blocks text[];

-- My blocks: null when I can act on every block.
create or replace function private.my_blocks(b uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select case when m.role = 'manager' or m.blocks is null or cardinality(m.blocks) = 0 then null else m.blocks end
  from public.members m where m.building_id = b and m.user_id = (select auth.uid())
$$;

-- May I act on this block? A null block means "the whole compound": only someone with every block.
create or replace function private.block_ok(b uuid, blk text) returns boolean
language sql stable security definer set search_path = public as $$
  select private.my_blocks(b) is null or (blk is not null and blk = any(private.my_blocks(b)))
$$;

-- May I act on this apartment? Same rule, using the apartment's block.
create or replace function private.unit_ok(b uuid, unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.my_blocks(b) is null
      or exists(select 1 from public.units u where u.id = unit and u.block = any(private.my_blocks(b)))
$$;

revoke execute on function private.my_blocks(uuid), private.block_ok(uuid, text), private.unit_ok(uuid, uuid) from public, anon;
grant execute on function private.my_blocks(uuid), private.block_ok(uuid, text), private.unit_ok(uuid, uuid) to authenticated;

-- Payments: only for apartments in my blocks.
drop policy if exists bny_pay_mgr on public.payments;
drop policy if exists bny_pay_col on public.payments;
create policy bny_pay_mgr on public.payments for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'pay') and private.unit_ok(building_id, unit_id))
  with check (private.is_manager(building_id) and private.can(building_id, 'pay') and private.unit_ok(building_id, unit_id));
create policy bny_pay_col on public.payments for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and private.can(building_id, 'pay') and private.unit_ok(building_id, unit_id)
  and channel = 'collector' and received_by = (select auth.uid()) and handover_id is null and voided_at is null);

-- Expenses: only for my blocks. An expense with no block (whole compound) needs every block,
-- except with one shared safe, where cash spent from anyone's pocket is the compound's.
drop policy if exists bny_exp_mgr on public.expenses;
drop policy if exists bny_exp_col on public.expenses;
create policy bny_exp_mgr on public.expenses for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'spend')
         and (private.block_ok(building_id, block) or (block is null and coalesce((select settings->>'safe_mode' from public.buildings where id = building_id), '') <> 'block')))
  with check (private.is_manager(building_id) and private.can(building_id, 'spend')
         and (private.block_ok(building_id, block) or (block is null and coalesce((select settings->>'safe_mode' from public.buildings where id = building_id), '') <> 'block')));
create policy bny_exp_col on public.expenses for insert to authenticated with check (
  private.my_role(building_id) = 'collector' and private.can(building_id, 'spend') and paid_from = 'collector'
  and paid_by = (select auth.uid()) and handover_id is null
  and (private.block_ok(building_id, block) or (block is null and coalesce((select settings->>'safe_mode' from public.buildings where id = building_id), '') <> 'block')));

-- Apartments and charges: a limited co-manager changes only their blocks; months and
-- compound-wide charges stay with people who have every block.
drop policy if exists bny_units_write   on public.units;
drop policy if exists bny_cycles_write  on public.cycles;
drop policy if exists bny_charges_write on public.charges;
create policy bny_units_write on public.units for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'charges') and private.block_ok(building_id, block))
  with check (private.is_manager(building_id) and private.can(building_id, 'charges') and private.block_ok(building_id, block));
create policy bny_cycles_write on public.cycles for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'charges') and private.my_blocks(building_id) is null)
  with check (private.is_manager(building_id) and private.can(building_id, 'charges') and private.my_blocks(building_id) is null);
create policy bny_charges_write on public.charges for all to authenticated
  using (private.is_manager(building_id) and private.can(building_id, 'charges') and private.block_ok(building_id, block))
  with check (private.is_manager(building_id) and private.can(building_id, 'charges') and private.block_ok(building_id, block));

-- Undo a payment: same block rule, and a co-manager needs the pay permission.
create or replace function public.void_payment(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payments;
begin
  select * into p from public.payments where id = p_payment for update;
  if p.id is null then raise exception 'not found'; end if;
  if not private.unit_ok(p.building_id, p.unit_id) then raise exception 'not allowed'; end if;
  if (private.is_manager(p.building_id) and private.can(p.building_id, 'pay'))
     or (private.my_role(p.building_id) = 'collector' and p.received_by = auth.uid() and p.handover_id is null) then
    update public.payments set voided_at = now(), voided_by = auth.uid() where id = p.id;
  else
    raise exception 'not allowed';
  end if;
end $$;

-- Invites carry blocks. A limited person can only invite into their own blocks; the owner picks.
drop function if exists public.create_invite(uuid, text, text, text[]);
create or replace function public.create_invite(p_building uuid, p_role text, p_display_name text, p_blocks text[] default null)
returns text language plpgsql security definer set search_path = public as $$
declare c text; mine text[] := private.my_blocks(p_building); want text[];
begin
  if not (private.is_manager(p_building) and private.can(p_building, 'team')) then raise exception 'not allowed'; end if;
  want := case when p_blocks is null or cardinality(p_blocks) = 0 then mine else p_blocks end;
  if mine is not null and not (want <@ mine) then raise exception 'not allowed'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites(code, building_id, role, display_name, blocks) values (c, p_building, p_role, coalesce(p_display_name, ''), want);
  return c;
end $$;
revoke all on function public.create_invite(uuid, text, text, text[]) from public, anon;
grant execute on function public.create_invite(uuid, text, text, text[]) to authenticated;
drop function if exists public.create_invite(uuid, text, text);

create or replace function public.join_building(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from public.invites where code = upper(p_code) for update;
  if inv.code is null then raise exception 'invite not found'; end if;
  if inv.used_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  insert into public.members(building_id, user_id, role, display_name, blocks)
  values (inv.building_id, auth.uid(), inv.role, coalesce(nullif(p_display_name, ''), inv.display_name), inv.blocks)
  on conflict (building_id, user_id) do update set role = excluded.role, blocks = excluded.blocks;
  update public.invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.building_id;
end $$;
