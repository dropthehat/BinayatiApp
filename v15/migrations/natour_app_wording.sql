-- Brand wording: "the Natour app", never just "Natour"; the cat is black now.
update app_features set about_en = 'Owner lets Natour app support view the building for a while', about_ar = 'المالك يسمح لدعم تطبيق ناطور برؤية البناية لفترة' where key = 'support_access';
update app_features set en = 'News from the Natour app', ar = 'أخبار تطبيق ناطور', about_en = 'Announcements from the Natour app team: new features, tips, offers', about_ar = 'إعلانات من فريق تطبيق ناطور: ميزات جديدة، نصائح، عروض' where key = 'announcements';
update app_features set about_en = 'Easter egg: a black cat naps on a balcony (a different one each day), walks the ledge to the neighbours, strolls the pavement, and talks when tapped', about_ar = 'مفاجأة: قطة سوداء تغفو على شرفة (كل يوم شرفة)، تمشي على الحافة إلى الجيران، تتمشى على الرصيف، وتحكي عند لمسها' where key = 'hero_cat';
do $$ declare src text; begin
  select pg_get_functiondef('public.support_open'::regproc) into src;
  execute replace(src, '''Natour support''', '''Natour app support''');
end $$;
