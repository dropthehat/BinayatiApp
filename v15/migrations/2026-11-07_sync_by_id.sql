-- The sheet link found Carl's compound and Block C by name, so renaming them in the app would stop it.
-- Point it at their ids instead.
do $$
declare f record; src text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname in ('natour_apply_sync', 'natour_apply_db') loop
    src := pg_get_functiondef(f.oid);
    src := replace(src, 'where name = ''Blocks A–D''', 'where id = ''a827c1db-bdd9-416e-b018-2cc4f14fcbdb''');
    src := replace(src, 'c.name = ''Blocks A–D''', 'c.id = ''a827c1db-bdd9-416e-b018-2cc4f14fcbdb''');
    src := replace(src, 'and name = ''Block C''', 'and id = ''6deb35c7-c368-4e97-9554-46b985a78656''');
    execute src;
  end loop;
end $$;
