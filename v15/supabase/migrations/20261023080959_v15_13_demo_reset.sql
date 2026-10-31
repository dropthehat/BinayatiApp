-- Migration 20261023080959_v15_13_demo_reset
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.


create or replace function public.demo_reset() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  mgr uuid := 'd0000000-0000-4000-8000-00000000d001';
  col uuid := 'd0000000-0000-4000-8000-00000000d002';
  b uuid; old uuid; sep uuid; oct uuid; c record; un record; h uuid; i int := 0;
  names text[] := array['Hadi Mansour','Lina Khoury','Omar Haddad','Maya Saab','Karim Aoun','Rania Nassar','Fadi Jaber','Nour Hamdan','Sami Rizk','Hiba Tannous','Joe Karam','Dana Fares'];
  names_ar text[] := array['هادي منصور','لينا خوري','عمر حداد','مايا صعب','كريم عون','رانيا نصار','فادي جابر','نور حمدان','سامي رزق','هبة طنوس','جو كرم','دانا فارس'];
  codes text[] := array['SS1A','SS1B','1A','1B','2A','2B','3A','3B','4A','4B','5A','5B'];
begin
  if auth.uid() is not null and auth.uid() not in (mgr, col) then raise exception 'not a demo account'; end if;
  select building_id into old from members m join buildings x on x.id = m.building_id
   where m.user_id = mgr and (x.settings->>'demo') = 'true' limit 1;
  insert into buildings (name, name_ar, settings, created_by)
  values ('Demo Arz', 'أرز (تجربة)', jsonb_build_object('demo', true, 'rate', 89500, 'elevator', true, 'opening_usd', 450, 'opening_lbp', 0,
          'books_public', true, 'show_who_paid', false, 'collector_name', 'Anas', 'collector_name_ar', 'أنس'), mgr)
  returning id into b;
  if old is not null then
    -- the previous demo building is retired: its two members move to the fresh one
    update members set building_id = b, display_name = case when user_id = mgr then 'Rima' else 'Anas' end,
                       display_name_ar = case when user_id = mgr then 'ريما' else 'أنس' end
     where building_id = old and user_id in (mgr, col);
    update buildings set settings = settings || '{"demo":"retired"}' where id = old;
  end if;
  insert into members (building_id, user_id, role, display_name, display_name_ar) values
    (b, mgr, 'manager', 'Rima', 'ريما'), (b, col, 'collector', 'Anas', 'أنس')
  on conflict (building_id, user_id) do nothing;
  for i in 1..12 loop
    insert into units (building_id, code, name, name_ar, phone, lang, sort)
    values (b, codes[i], names[i], names_ar[i], '+9617' || lpad((1000000 + i * 37311)::text, 7, '0'),
            case when i % 3 = 0 then 'en' when i % 3 = 1 then 'ar' else 'both' end, i);
  end loop;
  insert into cycles (building_id, kind, title, title_ar, period) values (b, 'month', 'September 2026', 'أيلول 2026', '2026-09') returning id into sep;
  insert into cycles (building_id, kind, title, title_ar, period) values (b, 'month', 'October 2026', 'تشرين الأول 2026', '2026-10') returning id into oct;
  for c in select * from (values (sep), (oct)) v(cy) loop
    insert into charges (building_id, cycle_id, kind, title, title_ar, cur, amount, split, sort) values
      (b, c.cy, 'fixed', 'Building fee', 'رسم البناية', 'USD', 25, 'each', 1),
      (b, c.cy, 'fixed', 'Elevator maintenance', 'صيانة المصعد', 'USD', 60, 'total', 2),
      (b, c.cy, 'service', 'Generator subscription', 'اشتراك المولد', 'LBP', 1500000, 'each', 3);
  end loop;
  insert into handovers (building_id, collector_id, usd, lbp, note, status, created_at, resolved_by, resolved_at)
  values (b, col, 0, 0, 'September cash', 'confirmed', '2026-09-28', mgr, '2026-09-28') returning id into h;
  for un in select * from units where building_id = b and code <> '5B' loop
    for c in select ch.*, case when ch.split = 'total' then round(ch.amount / 12, 2) else ch.amount end due from charges ch where ch.cycle_id = sep loop
      insert into payments (building_id, charge_id, unit_id, amount, cur, channel, method, received_by, received_at, handover_id)
      values (b, c.id, un.id, c.due, c.cur, case when un.sort % 2 = 0 then 'collector' else 'manager' end,
              case when un.sort % 4 = 1 then 'Whish' else 'Cash' end, case when un.sort % 2 = 0 then col else mgr end,
              ('2026-09-0' || (1 + un.sort % 9))::timestamptz, case when un.sort % 2 = 0 then h else null end);
    end loop;
  end loop;
  update handovers set usd = (select coalesce(sum(amount),0) from payments where handover_id = h and cur = 'USD'),
                       lbp = (select coalesce(sum(amount),0) from payments where handover_id = h and cur = 'LBP') where id = h;
  insert into handovers (building_id, collector_id, usd, lbp, note, status, created_at)
  values (b, col, 0, 0, 'First week of October', 'pending', now() - interval '1 day') returning id into h;
  for un in select * from units where building_id = b and sort in (1, 2, 3, 4, 6, 8, 9) loop
    for c in select ch.*, case when ch.split = 'total' then round(ch.amount / 12, 2) else ch.amount end due from charges ch
             where ch.cycle_id = oct and (ch.cur = 'USD' or un.sort < 6) loop
      insert into payments (building_id, charge_id, unit_id, amount, cur, channel, method, received_by, received_at, handover_id)
      values (b, c.id, un.id, c.due, c.cur, case when un.sort in (2, 4, 6, 8) then 'collector' else 'manager' end,
              case when un.sort = 3 then 'Whish' else 'Cash' end, case when un.sort in (2, 4, 6, 8) then col else mgr end,
              now() - ((10 - un.sort) || ' days')::interval, case when un.sort in (2, 4) then h else null end);
    end loop;
  end loop;
  update handovers set usd = (select coalesce(sum(amount),0) from payments where handover_id = h and cur = 'USD'),
                       lbp = (select coalesce(sum(amount),0) from payments where handover_id = h and cur = 'LBP') where id = h;
  insert into expenses (building_id, cycle_id, cat, title, amount, cur, paid_from, paid_by, spent_on) values
    (b, sep, 'elev', 'Elevator monthly service', 60, 'USD', 'safe', mgr, '2026-09-15'),
    (b, sep, 'cleaning', 'Stairs cleaning', 40, 'USD', 'safe', mgr, '2026-09-20'),
    (b, oct, 'gen', 'Diesel for the generator', 180, 'USD', 'safe', mgr, current_date - 6),
    (b, oct, 'water', 'Water tanker', 1800000, 'LBP', 'collector', col, current_date - 3);
  insert into tasks (building_id, title, title_ar, due_on, repeat, assignee) values
    (b, 'Elevator service visit', 'زيارة صيانة المصعد', current_date, 'monthly', 'manager'),
    (b, 'Trash collection', 'جمع النفايات', current_date + 1, 'daily', 'collector'),
    (b, 'Clean the water tanks', 'تنظيف خزانات المياه', current_date + 12, 'halfyear', 'manager'),
    (b, 'Check the generator oil', 'فحص زيت المولد', current_date - 2, 'weekly', 'collector');
  return b;
end $$;
revoke all on function public.demo_reset() from public, anon;
grant execute on function public.demo_reset() to authenticated;
select public.demo_reset();
