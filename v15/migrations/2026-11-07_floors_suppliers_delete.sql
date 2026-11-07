-- 2026-11-07: apartment floor and position, who pays a supplier bill,
-- supplier money counted as paid by the collector who collected it, deleting a building.

-- Apartment floor (0 = ground, -1 = SS1 …) and position on the floor (A, B …).
-- Empty means "read it from the code" as before.
alter table public.units add column if not exists floor smallint;
alter table public.units add column if not exists spot text;

-- Supplier charge (moteur, internet, the collector's fee): who hands the money to the supplier.
-- 'collector' (or empty) = whoever collected it; 'safe' = the manager, from the safe.
alter table public.charges add column if not exists payer text;

-- An expense written automatically for one supplier payment a collector collected.
alter table public.expenses add column if not exists payment_id uuid references public.payments(id) on delete cascade;
create unique index if not exists expenses_payment_id on public.expenses(payment_id) where payment_id is not null;

-- Keep the automatic "paid to supplier" expense in step with its payment.
create or replace function private.sup_apply(p public.payments)
returns void language plpgsql security definer set search_path = public as $$
declare ch public.charges; b public.buildings; want boolean;
begin
  select * into ch from public.charges where id = p.charge_id;
  select * into b from public.buildings where id = p.building_id;
  want := ch.id is not null and ch.pass_through and coalesce(ch.payer, 'collector') = 'collector'
          and p.channel = 'collector' and coalesce(b.settings->>'sup_confirm', 'false') <> 'true';
  -- Cash already handed over before this existed went to the safe: leave it to the manager.
  if want and p.handover_id is not null and not exists(select 1 from public.expenses where payment_id = p.id) then return; end if;
  if want then
    insert into public.expenses(building_id, cycle_id, charge_id, cat, title, title_ar, amount, cur, paid_from, paid_by,
                                spent_on, note, payment_id, handover_id, voided_at)
    values (p.building_id, ch.cycle_id, ch.id, 'supplier', 'Paid to supplier · ' || ch.title,
            'دفع للمورد · ' || coalesce(ch.title_ar, ch.title), p.amount, p.cur, 'collector', p.received_by,
            coalesce(p.received_at, now())::date, 'auto', p.id, p.handover_id, p.voided_at)
    on conflict (payment_id) where payment_id is not null do update
      set amount = excluded.amount, cur = excluded.cur, paid_by = excluded.paid_by, voided_at = excluded.voided_at,
          handover_id = excluded.handover_id
      where (expenses.amount, expenses.cur, expenses.paid_by, expenses.voided_at, expenses.handover_id)
            is distinct from (excluded.amount, excluded.cur, excluded.paid_by, excluded.voided_at, excluded.handover_id);
  else
    update public.expenses set voided_at = now() where payment_id = p.id and voided_at is null;
  end if;
end $$;
revoke all on function private.sup_apply(public.payments) from public, anon, authenticated;

create or replace function private.sup_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.sup_apply(new);
  return null;
end $$;
revoke all on function private.sup_trigger() from public, anon, authenticated;

drop trigger if exists bny_sup_auto on public.payments;
create trigger bny_sup_auto after insert or update of amount, cur, channel, received_by, charge_id, voided_at, handover_id
  on public.payments for each row execute function private.sup_trigger();

-- Re-apply after the manager changes the setting or who pays a charge.
create or replace function public.sup_resync(p_building uuid)
returns int language plpgsql security definer set search_path = public as $$
declare p public.payments; n int := 0;
begin
  if not private.is_manager(p_building) then raise exception 'managers only'; end if;
  for p in select x.* from public.payments x join public.charges c on c.id = x.charge_id
           where x.building_id = p_building and c.pass_through loop
    perform private.sup_apply(p); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.sup_resync(uuid) from public, anon;
grant execute on function public.sup_resync(uuid) to authenticated;

-- Delete a whole building. Only its manager, and only when the exact name is typed.
create or replace function public.delete_building(p_building uuid, p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.buildings;
begin
  select * into b from public.buildings where id = p_building;
  if not found then raise exception 'building not found'; end if;
  if private.my_role(p_building) is distinct from 'manager' then raise exception 'only the building''s manager can delete it'; end if;
  if btrim(coalesce(p_confirm, '')) is distinct from btrim(b.name) then raise exception 'the name does not match'; end if;
  delete from public.buildings where id = p_building;
end $$;
revoke all on function public.delete_building(uuid, text) from public, anon;
grant execute on function public.delete_building(uuid, text) to authenticated;

-- Backfill: supplier money already collected by a collector.
do $$ declare p public.payments; begin
  for p in select x.* from public.payments x join public.charges c on c.id = x.charge_id
           where c.pass_through and x.channel = 'collector' and x.handover_id is null loop
    perform private.sup_apply(p);
  end loop;
end $$;

-- More cleaning products in the shared expense list.
insert into public.app_lists(building_id, kind, en, ar, data, sort, hidden)
select null, 'expense_preset', x.en, x.ar, '{"cat":"clean"}'::jsonb, 18, false
from (values ('Glass & window cleaner', 'منظّف زجاج'), ('Floor cleaner & detergent', 'منظّف أرضيات ومسحوق'), ('Mops, brooms & cloths', 'ممسحات ومكانس وفوط')) x(en, ar)
where not exists (select 1 from public.app_lists l where l.kind = 'expense_preset' and l.building_id is null and l.en = x.en);
