-- Resident page: apartments' floor and position, building kind, and for a shared-book
-- apartment the name of its own building (home_name). Applied by patching resident_view.
do $$
declare f record; src text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'resident_view' loop
    src := pg_get_functiondef(f.oid);
    src := replace(src, '''created_at'', x.created_at))', '''created_at'', x.created_at, ''floor'', x.floor, ''spot'', x.spot))');
    src := replace(src, '''name_ar'', b.name_ar, ''settings'', b.settings - ''notes'')',
      '''name_ar'', b.name_ar, ''settings'', b.settings - ''notes'', ''kind'', b.kind, ''home_name'', (select bb.name from public.units lu join public.buildings bb on bb.id = lu.building_id where lu.id = u.linked_unit_id))');
    execute src;
  end loop;
end $$;
