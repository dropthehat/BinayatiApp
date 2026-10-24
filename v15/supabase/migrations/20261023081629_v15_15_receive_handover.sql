-- Migration 20261023081629_v15_15_receive_handover
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.


-- Manager records cash received from a collector who didn't start a handover himself.
-- Confirms a waiting handover if there is one, and sweeps anything newer into a confirmed one.
create or replace function public.receive_handover(p_building uuid, p_collector uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; u numeric; l numeric; done boolean := false;
begin
  if not private.is_manager(p_building) then raise exception 'managers only'; end if;
  update public.handovers set status = 'confirmed', resolved_by = auth.uid(), resolved_at = now()
   where building_id = p_building and collector_id = p_collector and status = 'pending' returning id into hid;
  done := hid is not null;
  select coalesce(sum(case when cur = 'USD' then amount end), 0), coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.payments
   where building_id = p_building and channel = 'collector' and received_by = p_collector and handover_id is null and voided_at is null;
  select u - coalesce(sum(case when cur = 'USD' then amount end), 0), l - coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.expenses
   where building_id = p_building and paid_from = 'collector' and paid_by = p_collector and handover_id is null and voided_at is null;
  if u = 0 and l = 0 then
    if done then return hid; end if;
    raise exception 'nothing to receive';
  end if;
  insert into public.handovers(building_id, collector_id, usd, lbp, note, status, resolved_by, resolved_at)
  values (p_building, p_collector, u, l, coalesce(p_note, 'Received by the manager'), 'confirmed', auth.uid(), now()) returning id into hid;
  update public.payments set handover_id = hid
   where building_id = p_building and channel = 'collector' and received_by = p_collector and handover_id is null and voided_at is null;
  update public.expenses set handover_id = hid
   where building_id = p_building and paid_from = 'collector' and paid_by = p_collector and handover_id is null and voided_at is null;
  return hid;
end $$;
revoke all on function public.receive_handover(uuid, uuid, text) from public, anon;
grant execute on function public.receive_handover(uuid, uuid, text) to authenticated;
