-- Additive only. A shared book holds what several buildings in a compound share (water, EDL).
alter table public.buildings add column if not exists kind text not null default 'building';
alter table public.buildings drop constraint if exists buildings_kind_check;
alter table public.buildings add constraint buildings_kind_check check (kind in ('building', 'shared'));
-- The same apartment in a shared book and in its own building's book.
alter table public.units add column if not exists linked_unit_id uuid references public.units(id) on delete set null;
-- A published bill round (water runs 2-3 times a month, so it isn't a month).
alter table public.cycles drop constraint if exists cycles_kind_check;
alter table public.cycles add constraint cycles_kind_check check (kind in ('month', 'project', 'round'));
