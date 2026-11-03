-- Binayati V15 · 2026-11-04 · Admin workspace
-- 1) app_admins: who runs Binayati (Carl). 2) app_features: the feature map, with switches.
-- 3) building_features: a feature switched on/off for one building. 4) app_lists: categories and
-- presets the app reads live (global rows have building_id null; a building can add its own).
-- 5) Support: the building owner grants time-limited, read-only access; every look is logged
-- and shows in the building's activity.

create table if not exists public.app_admins (user_id uuid primary key references auth.users(id) on delete cascade, added_at timestamptz not null default now());
alter table public.app_admins enable row level security;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.app_admins where user_id = (select auth.uid()))
$$;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy if exists adm_self on public.app_admins;
create policy adm_self on public.app_admins for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.am_admin() returns boolean language sql stable security definer set search_path = public as $$ select private.is_admin() $$;
revoke all on function public.am_admin() from public, anon; grant execute on function public.am_admin() to authenticated;

-- Feature map
create table if not exists public.app_features (
  key text primary key, category text not null, en text not null, ar text, about_en text, about_ar text,
  status text not null default 'live' check (status in ('live','beta','idea','custom','off')),
  switchable boolean not null default false, default_on boolean not null default true, sort int not null default 0,
  updated_at timestamptz not null default now());
alter table public.app_features enable row level security;
drop policy if exists feat_read on public.app_features;
drop policy if exists feat_write on public.app_features;
create policy feat_read on public.app_features for select to authenticated using (true);
create policy feat_write on public.app_features for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table if not exists public.building_features (
  building_id uuid not null references public.buildings(id) on delete cascade,
  key text not null references public.app_features(key) on delete cascade,
  "on" boolean not null, note text, set_by uuid default auth.uid(), set_at timestamptz not null default now(),
  primary key (building_id, key));
alter table public.building_features enable row level security;
drop policy if exists bfeat_read on public.building_features;
drop policy if exists bfeat_write on public.building_features;
create policy bfeat_read on public.building_features for select to authenticated using (private.is_member(building_id) or private.is_admin());
create policy bfeat_write on public.building_features for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Lists the app reads live
create table if not exists public.app_lists (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references public.buildings(id) on delete cascade,
  kind text not null check (kind in ('expense_cat','expense_preset','charge_preset','task_preset','pay_method')),
  key text, en text not null, ar text, icon text, data jsonb not null default '{}'::jsonb,
  sort int not null default 0, hidden boolean not null default false,
  updated_by uuid default auth.uid(), updated_at timestamptz not null default now());
create index if not exists app_lists_kind on public.app_lists(kind, building_id);
alter table public.app_lists enable row level security;
drop policy if exists lists_read on public.app_lists;
drop policy if exists lists_admin on public.app_lists;
drop policy if exists lists_bld on public.app_lists;
create policy lists_read on public.app_lists for select to authenticated
  using (building_id is null or private.is_member(building_id) or private.is_admin());
create policy lists_admin on public.app_lists for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy lists_bld on public.app_lists for all to authenticated
  using (building_id is not null and private.is_manager(building_id) and private.can(building_id, 'charges'))
  with check (building_id is not null and private.is_manager(building_id) and private.can(building_id, 'charges'));

-- Support access
create table if not exists public.support_grants (
  building_id uuid primary key references public.buildings(id) on delete cascade,
  granted_by uuid default auth.uid(), granted_at timestamptz not null default now(), expires_at timestamptz not null, note text);
alter table public.support_grants enable row level security;
drop policy if exists sg_read on public.support_grants;
create policy sg_read on public.support_grants for select to authenticated using (private.is_member(building_id) or private.is_admin());

create table if not exists public.support_log (
  id bigserial primary key, admin_id uuid not null, building_id uuid not null references public.buildings(id) on delete cascade,
  action text not null, detail text, at timestamptz not null default now());
alter table public.support_log enable row level security;
drop policy if exists sl_read on public.support_log;
create policy sl_read on public.support_log for select to authenticated using (private.is_admin() or private.my_role(building_id) = 'manager');

create or replace function private.support_ok(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin() and exists(select 1 from public.support_grants g where g.building_id = b and g.expires_at > now())
$$;
revoke execute on function private.support_ok(uuid) from public, anon;
grant execute on function private.support_ok(uuid) to authenticated;

-- Read-only support view: select policies on every building table, nothing else.
do $$
declare tb text;
begin
  foreach tb in array array['members','units','cycles','charges','payments','handovers','expenses','tasks','events','invites'] loop
    execute format('drop policy if exists bny_support_read on public.%I', tb);
    execute format('create policy bny_support_read on public.%I for select to authenticated using (private.support_ok(building_id))', tb);
  end loop;
end $$;
drop policy if exists bny_support_read on public.buildings;
create policy bny_support_read on public.buildings for select to authenticated using (private.support_ok(id));

-- The owner turns support access on (for some hours) or off.
create or replace function public.set_support(p_building uuid, p_hours int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare until timestamptz;
begin
  if private.my_role(p_building) <> 'manager' then raise exception 'only the building owner can do this'; end if;
  if coalesce(p_hours, 0) <= 0 then
    delete from public.support_grants where building_id = p_building;
    insert into public.events(building_id, actor, actor_name, tbl, action, data) values (p_building, auth.uid(), '', 'support', 'revoke', '{}'::jsonb);
    return null;
  end if;
  until := now() + make_interval(hours => least(p_hours, 168));
  insert into public.support_grants(building_id, granted_by, expires_at) values (p_building, auth.uid(), until)
  on conflict (building_id) do update set granted_by = excluded.granted_by, granted_at = now(), expires_at = excluded.expires_at;
  insert into public.events(building_id, actor, actor_name, tbl, action, data) values (p_building, auth.uid(), '', 'support', 'grant', jsonb_build_object('until', until));
  return until;
end $$;
revoke all on function public.set_support(uuid, int) from public, anon; grant execute on function public.set_support(uuid, int) to authenticated;

-- Admin opens a building: allowed only while access is granted; logged and shown to the building.
create or replace function public.support_open(p_building uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.support_ok(p_building) then raise exception 'support access is not on for this building'; end if;
  insert into public.support_log(admin_id, building_id, action) values (auth.uid(), p_building, 'view');
  insert into public.events(building_id, actor, actor_name, tbl, action, data) values (p_building, auth.uid(), 'Binayati support', 'support', 'view', '{}'::jsonb);
end $$;
revoke all on function public.support_open(uuid) from public, anon; grant execute on function public.support_open(uuid) to authenticated;

-- Admin: every building with its size and whether support access is on.
create or replace function public.admin_buildings()
returns table(id uuid, name text, name_ar text, created_at timestamptz, units int, members int, owner text, support_until timestamptz, custom int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  return query
  select b.id, b.name, b.name_ar, b.created_at,
         (select count(*)::int from public.units u where u.building_id = b.id and u.active is not false),
         (select count(*)::int from public.members m where m.building_id = b.id),
         (select m.display_name from public.members m where m.building_id = b.id and m.role = 'manager' limit 1),
         (select g.expires_at from public.support_grants g where g.building_id = b.id and g.expires_at > now()),
         (select count(*)::int from public.building_features f where f.building_id = b.id)
  from public.buildings b order by b.created_at desc;
end $$;
revoke all on function public.admin_buildings() from public, anon; grant execute on function public.admin_buildings() to authenticated;

-- Live updates
do $$ begin
  begin alter publication supabase_realtime add table public.app_lists; exception when others then null; end;
  begin alter publication supabase_realtime add table public.app_features; exception when others then null; end;
  begin alter publication supabase_realtime add table public.building_features; exception when others then null; end;
  begin alter publication supabase_realtime add table public.support_grants; exception when others then null; end;
end $$;

-- Carl is the admin
insert into public.app_admins(user_id) select id from auth.users where email = 'halalcarl@gmail.com' on conflict do nothing;

-- Feature map (switchable ones can be turned on/off for everyone or one building)
insert into public.app_features(key, category, en, ar, about_en, about_ar, status, switchable, default_on, sort) values
('collect_ticks','Collect','Tick payments','تأشير الدفعات','Mark what each apartment paid, as cash or transfer','تأشير ما دفعته كل شقة، نقداً أو تحويلاً','live',false,true,10),
('receipts_whatsapp','Collect','WhatsApp bills & receipts','فواتير وإيصالات واتساب','Send each apartment its bill or receipt','إرسال الفاتورة أو الإيصال لكل شقة','live',false,true,11),
('transfer_scan','Collect','Read transfer screenshots','قراءة لقطات التحويل','Whish/OMT/bank screenshot fills the payment','لقطة Whish/OMT/المصرف تملأ الدفعة','live',true,true,12),
('ai_reminders','Collect','Reminder messages','رسائل تذكير','Write a polite reminder for an apartment that owes','كتابة تذكير لطيف لشقة عليها مستحقات','live',true,true,13),
('split_total','Charges','Split a total','تقسيم مبلغ كلي','One bill divided by share; typed amounts stay, the rest re-divide','فاتورة تُقسّم بالحصص؛ المبالغ المكتوبة تبقى','live',false,true,20),
('meter_kwh','Charges','Priced by kWh','حسب الكيلوواط','Generator charges priced per kWh','رسوم المولد حسب الكيلوواط','live',true,true,21),
('meter_m3','Charges','Priced by m³','حسب المتر المكعب','Water charges priced per m³','رسوم المياه حسب المتر المكعب','live',true,true,22),
('supplier_services','Charges','Supplier services','خدمات المورّدين','Moteur, internet… collected for a supplier','موتور، إنترنت… تُجمع لمورّد','live',false,true,23),
('projects','Charges','Projects','المشاريع','One-time collections like painting or a new pump','جمع لمرة واحدة مثل الدهان أو مضخة','live',false,true,24),
('expense_scan','Books','Scan receipts','مسح الإيصالات','Photo of a receipt fills the expense','صورة الإيصال تملأ المصروف','live',true,true,30),
('handovers','Books','Cash handovers','تسليم النقد','Collector hands cash to the manager, confirmed','الجابي يسلّم النقد للمدير بتأكيد','live',false,true,31),
('safe_per_block','Books','A safe per block','صندوق لكل بلوك','Each block keeps its own cash','كل بلوك له نقده','live',false,true,32),
('blocks','Building','Blocks & compounds','البلوكات والمجمّعات','Several blocks in one compound','عدة بلوكات في مجمّع واحد','live',false,true,40),
('permissions','Building','Permissions','الصلاحيات','Per-person access switches and remove access','صلاحيات لكل شخص وإزالة الوصول','live',false,true,41),
('block_access','Building','Access per block','الوصول حسب البلوك','Limit a person to some blocks','حصر شخص ببعض البلوكات','live',false,true,42),
('invite_qr','Building','Invite QR code','رمز QR للدعوة','Saveable QR under every invite link','رمز QR قابل للحفظ تحت كل رابط دعوة','live',true,true,43),
('contacts_pick','Building','Pick from contacts','الاختيار من جهات الاتصال','Fill a resident''s number from the phone''s contacts (Android)','ملء رقم الساكن من جهات الاتصال (أندرويد)','live',true,true,44),
('tasks','Building','Tasks & reminders','المهام والتذكيرات','Repeating building chores','أعمال البناية المتكررة','live',false,true,45),
('setup_checklist','Onboarding','Setup checklist','قائمة البدء','Get-started steps on Home after setup','خطوات البدء في الرئيسية بعد الإعداد','live',true,true,50),
('multi_block_scene','Onboarding','Buildings per block','بناية لكل بلوك','One building drawn per block','رسم بناية لكل بلوك','live',false,true,51),
('resident_page','Residents','Resident page','صفحة الساكن','Private link with bill, receipts and balance','رابط خاص بالفاتورة والإيصالات والرصيد','live',false,true,60),
('support_access','Support','Support access','وصول الدعم','Owner lets Binayati support view the building for a while','المالك يسمح للدعم برؤية البناية لفترة','live',false,true,70)
on conflict (key) do update set category = excluded.category, en = excluded.en, ar = excluded.ar, about_en = excluded.about_en, about_ar = excluded.about_ar, switchable = excluded.switchable, sort = excluded.sort;

-- Lists: seeded from the app's built-in lists (only once)
do $$ begin if not exists (select 1 from public.app_lists where building_id is null) then
insert into public.app_lists(kind, key, en, ar, icon, data, sort) values
('expense_cat', 'gen', 'Generator & fuel', 'المولد والمازوت', '⚡', '{"locked":false}'::jsonb, 0),
('expense_cat', 'elev', 'Elevator', 'المصعد', '🛗', '{"locked":false}'::jsonb, 1),
('expense_cat', 'water', 'Water', 'المياه', '💧', '{"locked":false}'::jsonb, 2),
('expense_cat', 'clean', 'Cleaning', 'التنظيف', '🧹', '{"locked":false}'::jsonb, 3),
('expense_cat', 'light', 'Lighting', 'الإنارة', '💡', '{"locked":false}'::jsonb, 4),
('expense_cat', 'repair', 'Repairs', 'تصليحات', '🔧', '{"locked":false}'::jsonb, 5),
('expense_cat', 'staff', 'Staff pay', 'أجور', '🧑‍🔧', '{"locked":false}'::jsonb, 6),
('expense_cat', 'supplier', 'Supplier', 'مورّد', '↗', '{"locked":true}'::jsonb, 7),
('expense_cat', 'other', 'Other', 'أخرى', '🧾', '{"locked":true}'::jsonb, 8),
('expense_preset', null, 'Generator diesel', 'مازوت المولّد', null, '{"cat":"gen"}'::jsonb, 9),
('expense_preset', null, 'Generator oil & filters', 'زيت وفلاتر المولّد', null, '{"cat":"gen"}'::jsonb, 10),
('expense_preset', null, 'Generator repair', 'تصليح المولّد', null, '{"cat":"gen"}'::jsonb, 11),
('expense_preset', null, 'Elevator monthly service', 'صيانة المصعد الشهرية', null, '{"cat":"elev"}'::jsonb, 12),
('expense_preset', null, 'Elevator repair', 'تصليح المصعد', null, '{"cat":"elev"}'::jsonb, 13),
('expense_preset', null, 'Water bill', 'فاتورة المياه', null, '{"cat":"water"}'::jsonb, 14),
('expense_preset', null, 'Water tanker', 'صهريج مياه', null, '{"cat":"water"}'::jsonb, 15),
('expense_preset', null, 'Water tank cleaning', 'تنظيف خزانات المياه', null, '{"cat":"water"}'::jsonb, 16),
('expense_preset', null, 'Water pump repair', 'تصليح مضخة المياه', null, '{"cat":"water"}'::jsonb, 17),
('expense_preset', null, 'Cleaning supplies', 'مواد تنظيف', null, '{"cat":"clean"}'::jsonb, 18),
('expense_preset', null, 'Trash bags', 'أكياس نفايات', null, '{"cat":"clean"}'::jsonb, 19),
('expense_preset', null, 'Trash collection fee', 'رسم جمع النفايات', null, '{"cat":"clean"}'::jsonb, 20),
('expense_preset', null, 'Trash bins', 'مستوعبات نفايات', null, '{"cat":"clean"}'::jsonb, 21),
('expense_preset', null, 'Bulky waste removal', 'رفع ردميات وأغراض كبيرة', null, '{"cat":"clean"}'::jsonb, 22),
('expense_preset', null, 'Pest control', 'رش مبيدات', null, '{"cat":"clean"}'::jsonb, 23),
('expense_preset', null, 'Light bulbs', 'لمبات إنارة', null, '{"cat":"light"}'::jsonb, 24),
('expense_preset', null, 'EDL bill (common meter)', 'فاتورة كهرباء الدولة (العداد المشترك)', null, '{"cat":"light"}'::jsonb, 25),
('expense_preset', null, 'Electrician', 'كهربائي', null, '{"cat":"light"}'::jsonb, 26),
('expense_preset', null, 'Plumber', 'سنكري', null, '{"cat":"repair"}'::jsonb, 27),
('expense_preset', null, 'Locksmith / door repair', 'تصليح أقفال وأبواب', null, '{"cat":"repair"}'::jsonb, 28),
('expense_preset', null, 'Intercom repair', 'تصليح الإنترفون', null, '{"cat":"repair"}'::jsonb, 29),
('expense_preset', null, 'Painting', 'دهان', null, '{"cat":"repair"}'::jsonb, 30),
('expense_preset', null, 'Roof waterproofing', 'عزل السطح', null, '{"cat":"repair"}'::jsonb, 31),
('expense_preset', null, 'Fire extinguishers refill', 'تعبئة طفايات الحريق', null, '{"cat":"repair"}'::jsonb, 32),
('expense_preset', null, 'Natour salary', 'راتب الناطور', null, '{"cat":"staff"}'::jsonb, 33),
('expense_preset', null, 'Cleaner pay', 'أجر عامل التنظيف', null, '{"cat":"staff"}'::jsonb, 34),
('expense_preset', null, 'Gardener', 'جنيناتي', null, '{"cat":"staff"}'::jsonb, 35),
('expense_preset', null, 'Building insurance', 'تأمين البناية', null, '{"cat":"other"}'::jsonb, 36),
('expense_preset', null, 'Municipality fees', 'رسوم البلدية', null, '{"cat":"other"}'::jsonb, 37),
('expense_preset', null, 'Transport / delivery', 'نقل وتوصيل', null, '{"cat":"other"}'::jsonb, 38),
('charge_preset', null, 'Building maintenance', 'صيانة البناية', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":20,"cur":"USD","split":"each"}'::jsonb, 39),
('charge_preset', null, 'Staircase & common areas cleaning', 'تنظيف الدرج والأقسام المشتركة', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":10,"cur":"USD","split":"each"}'::jsonb, 40),
('charge_preset', null, 'Elevator maintenance contract', 'عقد صيانة المصعد', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 41),
('charge_preset', null, 'Water pump maintenance', 'صيانة مضخة المياه', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":20,"cur":"USD","split":"total"}'::jsonb, 42),
('charge_preset', null, 'Garden care', 'العناية بالحديقة', null, '{"kind":"fixed","g":["Upkeep","الصيانة والتشغيل"],"amt":40,"cur":"USD","split":"total"}'::jsonb, 43),
('charge_preset', null, 'Trash collection (door to door)', 'جمع النفايات من الأبواب', null, '{"kind":"fixed","g":["Trash","النفايات"],"amt":5,"cur":"USD","split":"each"}'::jsonb, 44),
('charge_preset', null, 'Trash collection company', 'شركة جمع النفايات', null, '{"kind":"fixed","g":["Trash","النفايات"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 45),
('charge_preset', null, 'Trash bags & bin cleaning', 'أكياس النفايات وتنظيف المستوعبات', null, '{"kind":"fixed","g":["Trash","النفايات"],"amt":2,"cur":"USD","split":"each"}'::jsonb, 46),
('charge_preset', null, 'Natour (concierge) salary', 'راتب الناطور', null, '{"kind":"fixed","g":["Staff","الموظفون"],"amt":300,"cur":"USD","split":"total"}'::jsonb, 47),
('charge_preset', null, 'Security guard', 'أجر الحارس', null, '{"kind":"fixed","g":["Staff","الموظفون"],"amt":400,"cur":"USD","split":"total"}'::jsonb, 48),
('charge_preset', null, 'Cleaner', 'أجر عامل التنظيف', null, '{"kind":"fixed","g":["Staff","الموظفون"],"amt":100,"cur":"USD","split":"total"}'::jsonb, 49),
('charge_preset', null, 'Common areas electricity (EDL meter)', 'كهرباء الأقسام المشتركة (عداد الدولة)', null, '{"kind":"fixed","g":["Power & water","الكهرباء والمياه"],"amt":2000000,"cur":"LBP","split":"total"}'::jsonb, 50),
('charge_preset', null, 'Common areas generator subscription', 'اشتراك المولد للأقسام المشتركة', null, '{"kind":"fixed","g":["Power & water","الكهرباء والمياه"],"amt":40,"cur":"USD","split":"total"}'::jsonb, 51),
('charge_preset', null, 'Building generator diesel', 'مازوت مولّد البناية', null, '{"kind":"fixed","g":["Power & water","الكهرباء والمياه"],"amt":150,"cur":"USD","split":"total"}'::jsonb, 52),
('charge_preset', null, 'Water subscription (monthly share)', 'اشتراك المياه (الحصة الشهرية)', null, '{"kind":"fixed","g":["Power & water","الكهرباء والمياه"],"amt":1000000,"cur":"LBP","split":"total"}'::jsonb, 53),
('charge_preset', null, 'Reserve fund', 'صندوق الاحتياط', null, '{"kind":"fixed","g":["Savings","الادخار"],"amt":5,"cur":"USD","split":"each"}'::jsonb, 54),
('charge_preset', null, 'Solar system installment', 'قسط نظام الطاقة الشمسية', null, '{"kind":"fixed","g":["Savings","الادخار"],"amt":25,"cur":"USD","split":"each"}'::jsonb, 55),
('charge_preset', null, 'Water bill (Water Establishment)', 'فاتورة مؤسسة المياه', null, '{"kind":"due","g":["Water","المياه"],"amt":10000000,"cur":"LBP","split":"total"}'::jsonb, 56),
('charge_preset', null, 'Water tanker fill', 'نقلة صهريج مياه', null, '{"kind":"due","g":["Water","المياه"],"amt":40,"cur":"USD","split":"total"}'::jsonb, 57),
('charge_preset', null, 'Water tank cleaning', 'تنظيف خزانات المياه', null, '{"kind":"due","g":["Water","المياه"],"amt":80,"cur":"USD","split":"total"}'::jsonb, 58),
('charge_preset', null, 'Water pump repair', 'تصليح مضخة المياه', null, '{"kind":"due","g":["Water","المياه"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 59),
('charge_preset', null, 'EDL bill (common meter)', 'فاتورة كهرباء الدولة (العداد المشترك)', null, '{"kind":"due","g":["Power","الكهرباء"],"amt":3000000,"cur":"LBP","split":"total"}'::jsonb, 60),
('charge_preset', null, 'Generator diesel top-up', 'تعبئة مازوت للمولّد', null, '{"kind":"due","g":["Power","الكهرباء"],"amt":200,"cur":"USD","split":"total"}'::jsonb, 61),
('charge_preset', null, 'Generator repair', 'تصليح المولّد', null, '{"kind":"due","g":["Power","الكهرباء"],"amt":100,"cur":"USD","split":"total"}'::jsonb, 62),
('charge_preset', null, 'Solar batteries replacement', 'تبديل بطاريات الطاقة الشمسية', null, '{"kind":"due","g":["Power","الكهرباء"],"amt":600,"cur":"USD","split":"total"}'::jsonb, 63),
('charge_preset', null, 'Elevator repair', 'تصليح المصعد', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":150,"cur":"USD","split":"total"}'::jsonb, 64),
('charge_preset', null, 'Plumbing repair', 'تصليحات صحية', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 65),
('charge_preset', null, 'Electrical repair', 'تصليحات كهربائية', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 66),
('charge_preset', null, 'Intercom or entrance door repair', 'تصليح الإنترفون أو باب المدخل', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 67),
('charge_preset', null, 'Garage gate repair', 'تصليح باب الموقف', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":80,"cur":"USD","split":"total"}'::jsonb, 68),
('charge_preset', null, 'Roof waterproofing', 'عزل السطح', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":1500,"cur":"USD","split":"total"}'::jsonb, 69),
('charge_preset', null, 'Painting common areas', 'دهان الأقسام المشتركة', null, '{"kind":"due","g":["Repairs","التصليحات"],"amt":800,"cur":"USD","split":"total"}'::jsonb, 70),
('charge_preset', null, 'Fire extinguishers refill', 'تعبئة طفايات الحريق', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":60,"cur":"USD","split":"total"}'::jsonb, 71),
('charge_preset', null, 'Pest control', 'رش مبيدات', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 72),
('charge_preset', null, 'Building insurance', 'تأمين البناية', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":300,"cur":"USD","split":"total"}'::jsonb, 73),
('charge_preset', null, 'Municipality fees (common parts)', 'رسوم البلدية (الأقسام المشتركة)', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":5000000,"cur":"LBP","split":"total"}'::jsonb, 74),
('charge_preset', null, 'Lawyer or syndicate fees', 'أتعاب المحامي أو النقابة', null, '{"kind":"due","g":["Safety & admin","السلامة والإدارة"],"amt":100,"cur":"USD","split":"total"}'::jsonb, 75),
('charge_preset', null, 'New trash bins', 'مستوعبات نفايات جديدة', null, '{"kind":"due","g":["Trash","النفايات"],"amt":80,"cur":"USD","split":"total"}'::jsonb, 76),
('charge_preset', null, 'Bulky waste removal (renovation debris)', 'رفع ردميات وأغراض كبيرة', null, '{"kind":"due","g":["Trash","النفايات"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 77),
('charge_preset', null, 'Municipality trash fee', 'رسم النفايات للبلدية', null, '{"kind":"due","g":["Trash","النفايات"],"amt":2000000,"cur":"LBP","split":"total"}'::jsonb, 78),
('charge_preset', null, 'Common light bulbs', 'لمبات الأقسام المشتركة', null, '{"kind":"due","g":["Other","أخرى"],"amt":20,"cur":"USD","split":"total"}'::jsonb, 79),
('charge_preset', null, 'Holiday decoration', 'زينة الأعياد', null, '{"kind":"due","g":["Other","أخرى"],"amt":50,"cur":"USD","split":"total"}'::jsonb, 80),
('charge_preset', null, 'Private generator (moteur)', 'اشتراك الموتور', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 81),
('charge_preset', null, 'Internet', 'اشتراك الإنترنت', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 82),
('charge_preset', null, 'Satellite dish', 'اشتراك الدش', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 83),
('charge_preset', null, 'Cable TV', 'اشتراك الكابل', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 84),
('charge_preset', null, 'Drinking water delivery', 'توصيل مياه الشرب', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 85),
('charge_preset', null, 'Cooking gas', 'غاز الطبخ', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 86),
('charge_preset', null, 'Solar power share', 'حصة الطاقة الشمسية', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 87),
('charge_preset', null, 'Private trash pickup', 'جمع النفايات الخاص', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 88),
('charge_preset', null, 'Parking space rent', 'إيجار موقف السيارة', null, '{"kind":"service","g":["Collected for a supplier","تُجمع لمورّد"],"cur":"USD"}'::jsonb, 89),
('task_preset', null, 'Clean water tanks', 'تنظيف خزانات المياه', null, '{"g":["Water","المياه"],"rep":"halfyear","who":"collector"}'::jsonb, 90),
('task_preset', null, 'Check the water pump', 'فحص مضخة المياه', null, '{"g":["Water","المياه"],"rep":"monthly","who":"collector"}'::jsonb, 91),
('task_preset', null, 'Read the water meters', 'قراءة عدادات المياه', null, '{"g":["Water","المياه"],"rep":"monthly","who":"collector"}'::jsonb, 92),
('task_preset', null, 'Order a water tanker', 'طلب صهريج مياه', null, '{"g":["Water","المياه"],"rep":"none","who":"manager"}'::jsonb, 93),
('task_preset', null, 'Generator oil change', 'تغيير زيت المولّد', null, '{"g":["Power","الكهرباء"],"rep":"monthly","who":"collector"}'::jsonb, 94),
('task_preset', null, 'Top up generator diesel', 'تعبئة مازوت المولّد', null, '{"g":["Power","الكهرباء"],"rep":"weekly","who":"collector"}'::jsonb, 95),
('task_preset', null, 'Dust the solar panels', 'تنظيف ألواح الطاقة الشمسية', null, '{"g":["Power","الكهرباء"],"rep":"monthly","who":"collector"}'::jsonb, 96),
('task_preset', null, 'Replace burnt common lights', 'تبديل اللمبات المحروقة', null, '{"g":["Power","الكهرباء"],"rep":"monthly","who":"collector"}'::jsonb, 97),
('task_preset', null, 'Collect trash from the floors', 'جمع النفايات من الطوابق', null, '{"g":["Trash","النفايات"],"rep":"daily","who":"collector"}'::jsonb, 98),
('task_preset', null, 'Put the bins out for pickup', 'إخراج المستوعبات للجمع', null, '{"g":["Trash","النفايات"],"rep":"daily","who":"collector"}'::jsonb, 99),
('task_preset', null, 'Sort recycling (plastic, cardboard)', 'فرز إعادة التدوير (بلاستيك، كرتون)', null, '{"g":["Trash","النفايات"],"rep":"weekly","who":"collector"}'::jsonb, 100),
('task_preset', null, 'Pay the trash collection company', 'الدفع لشركة جمع النفايات', null, '{"g":["Trash","النفايات"],"rep":"monthly","who":"manager"}'::jsonb, 101),
('task_preset', null, 'Wash the trash bins', 'غسل مستوعبات النفايات', null, '{"g":["Trash","النفايات"],"rep":"weekly","who":"collector"}'::jsonb, 102),
('task_preset', null, 'Clean the staircase', 'تنظيف الدرج', null, '{"g":["Cleaning","التنظيف"],"rep":"weekly","who":"collector"}'::jsonb, 103),
('task_preset', null, 'Clean the entrance glass', 'تنظيف زجاج المدخل', null, '{"g":["Cleaning","التنظيف"],"rep":"weekly","who":"collector"}'::jsonb, 104),
('task_preset', null, 'Clear roof drains before winter', 'تنظيف مجاري السطح قبل الشتاء', null, '{"g":["Cleaning","التنظيف"],"rep":"yearly","who":"collector"}'::jsonb, 105),
('task_preset', null, 'Clean basement drains & light wells', 'تنظيف مجاري الطابق السفلي والمناور', null, '{"g":["Cleaning","التنظيف"],"rep":"quarterly","who":"collector"}'::jsonb, 106),
('task_preset', null, 'Water the garden', 'سقاية الحديقة', null, '{"g":["Cleaning","التنظيف"],"rep":"weekly","who":"collector"}'::jsonb, 107),
('task_preset', null, 'Elevator service visit', 'زيارة صيانة المصعد', null, '{"g":["Safety","السلامة"],"rep":"monthly","who":"manager"}'::jsonb, 108),
('task_preset', null, 'Elevator safety certificate', 'شهادة سلامة المصعد', null, '{"g":["Safety","السلامة"],"rep":"yearly","who":"manager"}'::jsonb, 109),
('task_preset', null, 'Check fire extinguishers', 'فحص طفايات الحريق', null, '{"g":["Safety","السلامة"],"rep":"yearly","who":"manager"}'::jsonb, 110),
('task_preset', null, 'Pest control', 'رش مبيدات', null, '{"g":["Safety","السلامة"],"rep":"halfyear","who":"manager"}'::jsonb, 111),
('task_preset', null, 'Test the intercom & door lock', 'فحص الإنترفون وقفل الباب', null, '{"g":["Safety","السلامة"],"rep":"quarterly","who":"collector"}'::jsonb, 112),
('task_preset', null, 'Collect the monthly dues', 'جمع المستحقات الشهرية', null, '{"g":["Admin","الإدارة"],"rep":"monthly","who":"collector"}'::jsonb, 113),
('task_preset', null, 'Share the monthly report', 'مشاركة التقرير الشهري', null, '{"g":["Admin","الإدارة"],"rep":"monthly","who":"manager"}'::jsonb, 114),
('task_preset', null, 'Renew building insurance', 'تجديد تأمين البناية', null, '{"g":["Admin","الإدارة"],"rep":"yearly","who":"manager"}'::jsonb, 115),
('task_preset', null, 'Pay the generator owner', 'الدفع لصاحب المولّد', null, '{"g":["Admin","الإدارة"],"rep":"monthly","who":"manager"}'::jsonb, 116),
('task_preset', null, 'Residents'' meeting', 'اجتماع السكان', null, '{"g":["Admin","الإدارة"],"rep":"halfyear","who":"manager"}'::jsonb, 117),
('pay_method', 'Whish', 'Whish', 'ويش', null, '{}'::jsonb, 900), ('pay_method', 'OMT', 'OMT', 'OMT', null, '{}'::jsonb, 901), ('pay_method', 'Bank', 'Bank transfer', 'تحويل مصرفي', null, '{}'::jsonb, 902);
end if; end $$;
