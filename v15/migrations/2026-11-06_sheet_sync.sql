-- Shadow sync: turns sheet snapshots into water rounds and ticks. One way, sheet to Natour.
alter table public.units add column if not exists ext_ref text;
create unique index if not exists units_building_ext_ref on public.units(building_id, ext_ref) where ext_ref is not null;
alter table public.cycles add column if not exists ext_key text;
create unique index if not exists cycles_building_ext_key on public.cycles(building_id, ext_key) where ext_key is not null;
alter table public.payments add column if not exists ext_key text;
create unique index if not exists payments_building_ext_key on public.payments(building_id, ext_key) where ext_key is not null;
alter table public.natour_sync_inbox add column if not exists result jsonb;

create or replace function private.natour_money(t text) returns numeric language sql immutable as $$
  select coalesce(nullif(regexp_replace(coalesce(t, ''), '[^0-9.]', '', 'g'), '')::numeric, 0)
$$;
create or replace function private.natour_when(t text) returns timestamptz language plpgsql immutable as $$
begin
  return to_timestamp(t, 'MM/DD/YYYY HH24:MI:SS');
exception when others then return now();
end $$;

create or replace function private.natour_apply_sync(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  comp uuid := (select id from compounds where name = 'Blocks A–D');
  sb uuid; cb uuid; r jsonb; hdr jsonb;
  unmatched text[] := '{}'; seen text[] := '{}'; seen_c text[] := '{}';
  uid uuid; cid uuid; chid uuid; key text; amt numeric; per text; d1 date; d2 date; code text;
  n_rows int := 0; n_c int := 0;
  nm_id jsonb := '{}';
  title_map jsonb := '{"maint":"Maintenance","anas":"Anas''s fee","svc_internet":"Internet","svc_dish":"Dish"}';
  mon text; k text; ch_title text; cyc uuid; chan text;
  me uuid := (select created_by from compounds where name = 'Blocks A–D');
begin
  select id into sb from buildings where compound_id = comp and kind = 'shared';
  select id into cb from buildings where compound_id = comp and kind = 'building' and name = 'Block C';

  -- Directory: names and language by permanent ID. Never phones.
  for r in select value from jsonb_array_elements(p->'water'->'directory') with ordinality t(value, i) where i > 1 loop
    if r->>2 <> 'Apartment' then continue; end if;
    nm_id := nm_id || jsonb_build_object(r->>3, r->>0);
    update units set name = r->>3, name_ar = nullif(r->>4, ''),
      lang = case lower(coalesce(r->>8, '')) when 'english' then 'en' when 'arabic' then 'ar' else 'both' end
      where ext_ref = r->>0 and building_id in (sb, cb);
    if not found then unmatched := unmatched || (r->>0); end if;
  end loop;

  -- Current bill: amounts per apartment. Stays a draft until the first tick for that period.
  d1 := to_date(p->'water'->'billing'->2->>2, 'MM/DD/YYYY');
  d2 := to_date(p->'water'->'billing'->3->>2, 'MM/DD/YYYY');
  per := to_char(d1, 'FMMM/FMDD/YYYY') || ' to ' || to_char(d2, 'FMMM/FMDD/YYYY');
  select r2->>1 into code from jsonb_array_elements(p->'water'->'payments') r2 where r2->>2 = per limit 1;
  insert into cycles(building_id, kind, title, title_ar, published, created_at, ext_key)
    values (sb, 'round', 'Water' || coalesce(' ' || code, '') || ' · ' || to_char(d1, 'FMDD Mon') || ' to ' || to_char(d2, 'FMDD Mon'),
            'المياه' || coalesce(' ' || code, '') || ' · ' || to_char(d1, 'FMMM/FMDD') || ' إلى ' || to_char(d2, 'FMMM/FMDD'), code is not null, d2, 'water:' || per)
    on conflict (building_id, ext_key) where ext_key is not null
    do update set published = excluded.published, title = excluded.title, title_ar = excluded.title_ar
    returning id into cyc;
  select id into chid from charges where cycle_id = cyc and title = 'Water';
  if chid is null then
    insert into charges(building_id, cycle_id, kind, title, title_ar, cur, amount, split, overrides, recurring)
      values (sb, cyc, 'due', 'Water', 'المياه', 'LBP', 0, 'custom', '{}', false) returning id into chid;
  end if;
  for r in select value from jsonb_array_elements(p->'water'->'billing') with ordinality t(value, i) where i > 10 loop
    if coalesce(r->>1, '') = '' or r->>1 like '%Total%' or r->>2 = 'EBML' or not nm_id ? (r->>1) then continue; end if;
    amt := private.natour_money(r->>8);
    select id into uid from units where building_id = sb and ext_ref = nm_id->>(r->>1);
    if uid is not null and amt > 0 then
      update charges set overrides = overrides || jsonb_build_object(uid::text, amt) where id = chid;
    end if;
  end loop;

  -- Water ticks.
  for r in select value from jsonb_array_elements(p->'water'->'payments') with ordinality t(value, i) where i > 1 loop
    n_rows := n_rows + 1;
    amt := private.natour_money(r->>5);
    if amt <= 0 then continue; end if;
    select id into uid from units where building_id = sb and ext_ref = r->>3;
    if uid is null then unmatched := unmatched || (r->>3); continue; end if;
    per := r->>2;
    d1 := to_date(split_part(per, ' to ', 1), 'MM/DD/YYYY');
    d2 := to_date(split_part(per, ' to ', 2), 'MM/DD/YYYY');
    insert into cycles(building_id, kind, title, title_ar, published, created_at, ext_key)
      values (sb, 'round', 'Water ' || (r->>1) || ' · ' || to_char(d1, 'FMDD Mon') || ' to ' || to_char(d2, 'FMDD Mon'),
              'المياه ' || (r->>1) || ' · ' || to_char(d1, 'FMMM/FMDD') || ' إلى ' || to_char(d2, 'FMMM/FMDD'), true, d2, 'water:' || per)
      on conflict (building_id, ext_key) where ext_key is not null do update set published = true
      returning id into cyc;
    select id into chid from charges where cycle_id = cyc and title = 'Water';
    if chid is null then
      insert into charges(building_id, cycle_id, kind, title, title_ar, cur, amount, split, overrides, recurring)
        values (sb, cyc, 'due', 'Water', 'المياه', 'LBP', 0, 'custom', '{}', false) returning id into chid;
    end if;
    update charges set overrides = overrides || jsonb_build_object(uid::text, amt)
      where id = chid and not overrides ? uid::text;
    key := 'w:' || per || ':' || (r->>3);
    if lower(r->>6) = 'paid' then
      seen := seen || key;
      insert into payments(building_id, charge_id, unit_id, amount, cur, channel, method, received_at, note, ext_key)
        values (sb, chid, uid, amt, 'LBP', 'collector', 'Cash', private.natour_when(r->>0), 'Copied from the water sheet', key)
        on conflict (building_id, ext_key) where ext_key is not null
        do update set amount = excluded.amount, voided_at = null;
    end if;
  end loop;
  update payments set voided_at = now() where building_id = sb and ext_key like 'w:%' and voided_at is null and not ext_key = any(seen);

  -- Block C ticks, for months that exist in Natour.
  for r in select value from jsonb_array_elements(p->'blockC'->'collectLog') with ordinality t(value, i) where i > 1 loop
    k := split_part(r->>3, ':', 2); mon := split_part(r->>3, ':', 3);
    ch_title := title_map->>k;
    if ch_title is null or coalesce(r->>7, '') = '' then continue; end if;
    select id into cyc from cycles where building_id = cb and kind = 'month' and title = mon;
    if cyc is null then continue; end if;
    select id into chid from charges where cycle_id = cyc and title = ch_title;
    select id into uid from units where building_id = cb and ext_ref = r->>7;
    if chid is null or uid is null then continue; end if;
    key := 'c:' || (r->>3) || ':' || (r->>7);
    if lower(r->>6) = 'paid' then
      n_c := n_c + 1; seen_c := seen_c || key;
      chan := case when k = 'maint' then 'manager' else 'collector' end;
      insert into payments(building_id, charge_id, unit_id, amount, cur, channel, method, received_by, received_at, note, ext_key)
        values (cb, chid, uid, private.natour_money(r->>5), 'USD', chan, 'Cash', case when chan = 'manager' then me end, private.natour_when(r->>0), 'Copied from the Block C sheet', key)
        on conflict (building_id, ext_key) where ext_key is not null
        do update set amount = excluded.amount, voided_at = null;
    end if;
  end loop;
  update payments set voided_at = now() where building_id = cb and ext_key like 'c:%' and voided_at is null and not ext_key = any(seen_c);

  return jsonb_build_object('water_rows', n_rows, 'water_paid', cardinality(seen), 'blockc_paid', n_c, 'unmatched', to_jsonb(unmatched));
end $$;

create or replace function private.natour_sync_apply() returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    new.result := private.natour_apply_sync(new.payload);
  exception when others then
    new.result := jsonb_build_object('error', sqlerrm);
  end;
  return new;
end $$;
drop trigger if exists natour_sync_apply on public.natour_sync_inbox;
create trigger natour_sync_apply before insert on public.natour_sync_inbox for each row execute function private.natour_sync_apply();

-- Looking at an old period in the Weekly Billing dropdown must not rewrite that round.
create or replace function private.natour_sync_fresh(p jsonb) returns jsonb language plpgsql immutable as $$
declare latest date; d2 date;
begin
  select max(to_date(split_part(r->>2, ' to ', 2), 'MM/DD/YYYY')) into latest
    from jsonb_array_elements(p->'water'->'payments') with ordinality t(r, i) where i > 1;
  d2 := to_date(p->'water'->'billing'->3->>2, 'MM/DD/YYYY');
  if latest is null or d2 >= latest then return p; end if;
  select to_date(split_part(r->>2, ' to ', 1), 'MM/DD/YYYY') into d2
    from jsonb_array_elements(p->'water'->'payments') with ordinality t(r, i)
    where i > 1 and to_date(split_part(r->>2, ' to ', 2), 'MM/DD/YYYY') = latest limit 1;
  return jsonb_set(p, '{water,billing}', jsonb_build_array('[]'::jsonb, '[]'::jsonb,
    jsonb_build_array('', '', to_char(d2, 'FMMM/FMDD/YYYY')), jsonb_build_array('', '', to_char(latest, 'FMMM/FMDD/YYYY'))));
end $$;
create or replace function private.natour_sync_apply() returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    new.result := private.natour_apply_sync(private.natour_sync_fresh(new.payload));
  exception when others then
    new.result := jsonb_build_object('error', sqlerrm);
  end;
  return new;
end $$;

-- natour_apply_db was then applied directly (migration natour_sync_water_database): it reads the Water Database
-- Lines, Invoices and EDL tabs into rounds, and natour_sync_apply calls it after natour_apply_sync.
