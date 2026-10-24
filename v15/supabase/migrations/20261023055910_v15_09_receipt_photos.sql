-- Migration 20261023055910_v15_09_receipt_photos
-- Exported read-only from live Supabase project BINAYATI (ehatjqqmdmgptqbkgrzb) on 2026-10-24
-- from supabase_migrations.schema_migrations.statements. Do not re-apply to the live project.

alter table public.expenses add column if not exists photo_path text;
alter table public.payments add column if not exists photo_path text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy bny_receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy bny_receipts_add on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy bny_receipts_del on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and private.is_manager(((storage.foldername(name))[1])::uuid));
