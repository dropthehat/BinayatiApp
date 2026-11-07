-- Floors set in a building flow to the same apartment in the shared book (one way only;
-- apartments are linked both ways, so the shared side never writes back).
create or replace function private.units_follow_floor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.buildings b where b.id = new.building_id and b.kind = 'shared') then return null; end if;
  update public.units s set floor = new.floor, spot = new.spot
    from public.buildings sb
   where s.linked_unit_id = new.id and sb.id = s.building_id and sb.kind = 'shared'
     and (s.floor, s.spot) is distinct from (new.floor, new.spot);
  return null;
end $$;
revoke all on function private.units_follow_floor() from public, anon, authenticated;
drop trigger if exists bny_units_follow_floor on public.units;
create trigger bny_units_follow_floor after insert or update of floor, spot on public.units
  for each row execute function private.units_follow_floor();
create index if not exists units_linked_unit_id on public.units(linked_unit_id) where linked_unit_id is not null;
