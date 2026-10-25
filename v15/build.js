const fs = require('fs'), path = require('path');
const D = __dirname, src = f => fs.readFileSync(path.join(D, 'src', f), 'utf8');
const vendor = fs.readFileSync(path.join(D, 'vendor', 'supabase.js'), 'utf8'); // supabase-js 2.117.3 UMD
function page(config) {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F1F5F4">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Binayati">
<title>Binayati · بنايتي</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%235B4CF5'/%3E%3Crect x='20' y='14' width='24' height='38' rx='3' fill='%23fff'/%3E%3Crect x='25' y='20' width='5' height='5' fill='%23FFC35E'/%3E%3Crect x='34' y='20' width='5' height='5' fill='%23FFC35E'/%3E%3Crect x='25' y='30' width='5' height='5' fill='%23FFC35E'/%3E%3Crect x='34' y='30' width='5' height='5' fill='%235B4CF5' opacity='.3'/%3E%3Crect x='29' y='42' width='6' height='10' fill='%235B4CF5'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
${src('app.css')}
/* ---- living building scene ---- */
${src('scene.css')}
</style>
</head>
<body>
<div id="app"></div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>
/* ===== Server settings =====
   Fill these in once and every phone that opens this file connects to the same building data.
   Use the publishable key only (never the secret / service_role key).
   publicUrl: where you host this file, so WhatsApp links point there (optional). */
window.BINAYATI_CONFIG = ${JSON.stringify(config, null, 2)};
</script>
<script>
/* supabase-js 2.117.3 (MIT) bundled so the app needs no CDN */
${vendor}
</script>
<script>
${src('core.js')}
${src('presets.js')}
${src('translate.js')}
${src('scene.js')}
${src('store.js')}
${src('ui-app.js')}
${src('ui-books.js')}
${src('ui-building.js')}
${src('ui-ob.js')}
${src('ui-resident.js')}
${src('ui-multi.js')}
${src('ai-docs.js')}
${src('ai-remind.js')}
boot();
</script>
</body>
</html>
`;
}
fs.writeFileSync(path.join(D, 'index.html'), page({ url: 'https://ehatjqqmdmgptqbkgrzb.supabase.co', key: 'sb_publishable_rnuIP7E5qOBxf1JG5a0Jzw_iyDJ74Zi', publicUrl: 'https://dropthehat.github.io/BinayatiApp/v15/' }));
fs.writeFileSync(path.join(D, 'local.html'), page({ url: '', key: '', publicUrl: '' }));
console.log('built', fs.statSync(path.join(D, 'index.html')).size);
