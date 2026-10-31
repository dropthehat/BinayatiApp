-- Migration 20261022225253_v15_04_app_functions
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

create or replace function public.create_building(p_name text, p_name_ar text, p_settings jsonb, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.buildings(name, name_ar, settings, created_by)
  values (p_name, p_name_ar, coalesce(p_settings, '{}'::jsonb), auth.uid()) returning id into bid;
  insert into public.members(building_id, user_id, role, display_name)
  values (bid, auth.uid(), 'manager', coalesce(p_display_name, ''));
  return bid;
end $$;

create or replace function public.create_invite(p_building uuid, p_role text, p_display_name text)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not private.is_manager(p_building) then raise exception 'managers only'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites(code, building_id, role, display_name) values (c, p_building, p_role, coalesce(p_display_name, ''));
  return c;
end $$;

create or replace function public.peek_invite(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('building', b.name, 'building_ar', b.name_ar, 'role', i.role,
                            'display_name', i.display_name, 'valid', i.used_at is null and i.expires_at > now())
  from public.invites i join public.buildings b on b.id = i.building_id
  where i.code = upper(p_code)
$$;

create or replace function public.join_building(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from public.invites where code = upper(p_code) for update;
  if inv.code is null then raise exception 'invite not found'; end if;
  if inv.used_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  insert into public.members(building_id, user_id, role, display_name)
  values (inv.building_id, auth.uid(), inv.role, coalesce(nullif(p_display_name, ''), inv.display_name))
  on conflict (building_id, user_id) do update set role = excluded.role;
  update public.invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.building_id;
end $$;

create or replace function public.request_handover(p_building uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; u numeric; l numeric;
begin
  if private.my_role(p_building) is null then raise exception 'not a member'; end if;
  if exists(select 1 from public.handovers where building_id = p_building and collector_id = auth.uid() and status = 'pending') then
    raise exception 'a handover is already waiting for confirmation';
  end if;
  select coalesce(sum(case when cur = 'USD' then amount end), 0), coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.payments
   where building_id = p_building and channel = 'collector' and received_by = auth.uid() and handover_id is null and voided_at is null;
  select u - coalesce(sum(case when cur = 'USD' then amount end), 0), l - coalesce(sum(case when cur = 'LBP' then amount end), 0)
    into u, l from public.expenses
   where building_id = p_building and paid_from = 'collector' and paid_by = auth.uid() and handover_id is null and voided_at is null;
  if u = 0 and l = 0 then raise exception 'nothing to hand over'; end if;
  insert into public.handovers(building_id, collector_id, usd, lbp, note)
  values (p_building, auth.uid(), u, l, p_note) returning id into hid;
  update public.payments set handover_id = hid
   where building_id = p_building and channel = 'collector' and received_by = auth.uid() and handover_id is null and voided_at is null;
  update public.expenses set handover_id = hid
   where building_id = p_building and paid_from = 'collector' and paid_by = auth.uid() and handover_id is null and voided_at is null;
  return hid;
end $$;

create or replace function public.resolve_handover(p_handover uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare h public.handovers;
begin
  select * into h from public.handovers where id = p_handover for update;
  if h.id is null then raise exception 'not found'; end if;
  if not private.is_manager(h.building_id) then raise exception 'managers only'; end if;
  if h.status <> 'pending' then raise exception 'already resolved'; end if;
  update public.handovers set status = case when p_accept then 'confirmed' else 'rejected' end,
         resolved_by = auth.uid(), resolved_at = now() where id = h.id;
  if not p_accept then
    update public.payments set handover_id = null where handover_id = h.id;
    update public.expenses set handover_id = null where handover_id = h.id;
  end if;
end $$;

create or replace function public.void_payment(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payments;
begin
  select * into p from public.payments where id = p_payment for update;
  if p.id is null then raise exception 'not found'; end if;
  if private.is_manager(p.building_id)
     or (private.my_role(p.building_id) = 'collector' and p.received_by = auth.uid() and p.handover_id is null) then
    update public.payments set voided_at = now(), voided_by = auth.uid() where id = p.id;
  else
    raise exception 'not allowed';
  end if;
end $$;

create or replace function public.resident_view(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u public.units; b public.buildings; pub boolean; who boolean; res jsonb;
begin
  select * into u from public.units where resident_token = p_token and active;
  if u.id is null then return null; end if;
  select * into b from public.buildings where id = u.building_id;
  pub := coalesce((b.settings->>'books_public')::boolean, true);
  who := coalesce((b.settings->>'show_who_paid')::boolean, false);
  res := jsonb_build_object(
    'building', jsonb_build_object('id', b.id, 'name', b.name, 'name_ar', b.name_ar, 'settings', b.settings - 'notes'),
    'unit', to_jsonb(u) - 'resident_token' - 'phone',
    'units', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'code', x.code, 'weight', x.weight, 'active', x.active, 'sort', x.sort)), '[]')
                from public.units x where x.building_id = b.id),
    'cycles', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.cycles c where c.building_id = b.id and c.published),
    'charges', (select coalesce(jsonb_agg(to_jsonb(ch)), '[]') from public.charges ch
                 join public.cycles c on c.id = ch.cycle_id and c.published where ch.building_id = b.id),
    'my_payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'charge_id', p.charge_id, 'unit_id', p.unit_id,
                      'amount', p.amount, 'cur', p.cur, 'channel', p.channel, 'method', p.method, 'received_at', p.received_at,
                      'received_by', p.received_by, 'handover_id', p.handover_id, 'voided_at', p.voided_at,
                      'received_by_name', (select display_name from public.members m where m.building_id = b.id and m.user_id = p.received_by))), '[]')
                    from public.payments p where p.unit_id = u.id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role, 'display_name', m.display_name)), '[]')
                  from public.members m where m.building_id = b.id),
    'books_public', pub);
  if pub then
    res := res || jsonb_build_object(
      'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'charge_id', p.charge_id,
                    'unit_id', case when who or p.unit_id = u.id then p.unit_id end,
                    'amount', p.amount, 'cur', p.cur, 'channel', p.channel, 'received_at', p.received_at,
                    'received_by', p.received_by, 'handover_id', p.handover_id, 'voided_at', p.voided_at)), '[]')
                   from public.payments p where p.building_id = b.id),
      'expenses', (select coalesce(jsonb_agg(to_jsonb(e) - 'paid_by'), '[]') from public.expenses e where e.building_id = b.id),
      'handovers', (select coalesce(jsonb_agg(to_jsonb(h)), '[]') from public.handovers h where h.building_id = b.id));
  end if;
  return res;
end $$;

revoke all on function public.resident_view(text), public.peek_invite(text), public.create_building(text, text, jsonb, text),
  public.create_invite(uuid, text, text), public.join_building(text, text), public.request_handover(uuid, text),
  public.resolve_handover(uuid, boolean), public.void_payment(uuid) from public, anon;
grant execute on function public.resident_view(text), public.peek_invite(text) to anon, authenticated;
grant execute on function public.create_building(text, text, jsonb, text), public.create_invite(uuid, text, text),
  public.join_building(text, text), public.request_handover(uuid, text), public.resolve_handover(uuid, boolean),
  public.void_payment(uuid) to authenticated;
revoke all on function private.log_event(), private.roll_task() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['buildings','members','units','cycles','charges','payments','expenses','handovers','tasks','events'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
