/* ============================================================================
   Natour admin (Carl only): the feature map, feature switches, the app's
   live lists, and support for clients who turned support access on.
   Internal tool, English only. The server allows all of this only for
   accounts in app_admins; the app just hides the door for everyone else.
   ============================================================================ */
var ADM = { tab: 'features', kind: 'expense_cat', buildings: null, q: '' };
var LIST_KINDS = [
  ['expense_cat', 'Expense categories'], ['expense_preset', 'Common expenses'], ['charge_preset', 'Common charges'],
  ['task_preset', 'Common tasks'], ['pay_method', 'Transfer methods']
];
var FEATURE_STATUS = { live: 'Live', beta: 'Beta', idea: 'Idea', custom: 'Custom', off: 'Off' };

function openAdmin() {
  if (!IS_ADMIN) return;
  UI.sheet = null; UI.screen = 'admin'; render(); window.scrollTo(0, 0);
  loadConfig(S.building && S.building.id).then(render);
}
function admTabs() {
  var h = '<div class="seg" style="margin:4px 16px 0">';
  [['features', 'Features'], ['lists', 'Lists'], ['news', 'News'], ['support', 'Buildings']].forEach(function(x) {
    h += '<button class="' + (ADM.tab === x[0] ? 'on' : '') + '" onclick="ADM.tab=\'' + x[0] + '\';if(ADM.tab===\'support\'||ADM.tab===\'news\')admLoadBuildings();if(ADM.tab===\'news\'){loadNews().then(admLoadNewsStats);}render()">' + x[1] + '</button>';
  });
  return h + '</div>';
}
function renderAdmin() {
  if (!IS_ADMIN) return '<div class="shell"><div class="sec"><div class="card pad">Not allowed.</div></div></div>';
  var h = '<div class="shell"><header class="topbar"><button class="iconbtn" onclick="UI.screen=\'app\';render()" aria-label="Back">' + (LANG === 'ar' ? '›' : '‹') + '</button>';
  h += '<div class="grow"><b style="font-size:20px;font-weight:800">Natour app admin</b><small class="muted" style="display:block">Changes reach every app within seconds</small></div></header>';
  h += admTabs();
  if (ADM.tab === 'features') h += admFeatures();
  else if (ADM.tab === 'lists') h += admLists();
  else if (ADM.tab === 'news') h += admNews();
  else h += admBuildings();
  return h + '</div>';
}

/* ---------- Feature map ---------- */
function admFeatures() {
  var all = Object.keys(CFG.features).map(function(k) { return CFG.features[k]; }).sort(function(a, b) { return a.sort - b.sort; });
  var cats = []; all.forEach(function(f) { if (cats.indexOf(f.category) < 0) cats.push(f.category); });
  var h = '<div class="sec"><input class="input" placeholder="Search features" value="' + esc(ADM.q) + '" oninput="ADM.q=this.value;admFilter()"></div>';
  cats.forEach(function(c) {
    h += '<div class="sec adm-cat"><div class="sec-h"><h2>' + esc(c) + '</h2></div><div class="card list">';
    all.filter(function(f) { return f.category === c; }).forEach(function(f) {
      var on = f.status !== 'off' && f.default_on !== false;
      h += '<div class="li adm-row" data-s="' + esc((f.en + ' ' + (f.ar || '') + ' ' + (f.about_en || '') + ' ' + f.key).toLowerCase()) + '"><div class="grow" style="cursor:pointer" onclick="openSheet(\'admFeature\',{key:' + jsArg(f.key) + '})"><b>' + esc(f.en) + ' <span class="pill-st st-' + esc(f.status) + '">' + esc(FEATURE_STATUS[f.status] || f.status) + '</span></b><small>' + esc(f.about_en || '') + '</small></div>';
      h += f.switchable ? '<button class="sw' + (on ? ' on' : '') + '" onclick="admFeatureGlobal(' + jsArg(f.key) + ',' + !on + ')" aria-label="On for everyone"></button>' : '<span class="chev">›</span>';
      h += '</div>';
    });
    h += '</div></div>';
  });
  h += '<div class="sec"><button class="btn sec block" onclick="openSheet(\'admFeature\',{})">＋ Add a feature to the map</button><p class="hint">Switches turn a feature on or off for every building. Per-building switches are under Buildings.</p></div>';
  return h;
}
function admFilter() {
  var q = ADM.q.trim().toLowerCase();
  document.querySelectorAll('.adm-row').forEach(function(r) { r.style.display = !q || r.getAttribute('data-s').indexOf(q) >= 0 ? '' : 'none'; });
}
function admFeatureGlobal(key, on) {
  cloudCall(SB.from('app_features').update({ default_on: on, updated_at: nowIso() }).eq('key', key)).then(function() { CFG.features[key].default_on = on; render(); toast(on ? 'On for everyone' : 'Off for everyone'); }, fail);
}
SHEETS.admFeature = function(d) {
  var f = d.key ? CFG.features[d.key] : null;
  var v = f || { key: '', category: 'Collect', en: '', ar: '', about_en: '', about_ar: '', status: 'idea', switchable: false, default_on: true, sort: 999 };
  if (!d.st) d.st = v.status;
  var h = '<h3>' + esc(f ? f.en : 'New feature') + '</h3>';
  if (!f) h += '<label class="field"><span>Key (short, no spaces)</span><input class="input" id="af-key" placeholder="e.g. late_fees"></label>';
  h += '<div class="two"><label class="field"><span>Name</span><input class="input" id="af-en" value="' + esc(v.en) + '"></label><label class="field"><span>Arabic</span><input class="input" id="af-ar" dir="rtl" value="' + esc(v.ar || '') + '"></label></div>';
  h += '<label class="field"><span>Category</span><input class="input" id="af-cat" list="af-cats" value="' + esc(v.category) + '"><datalist id="af-cats">' + ['Collect', 'Charges', 'Books', 'Building', 'Onboarding', 'Residents', 'Support'].map(function(c) { return '<option value="' + c + '">'; }).join('') + '</datalist></label>';
  h += '<label class="field"><span>What it does</span><input class="input" id="af-about" value="' + esc(v.about_en || '') + '"></label>';
  h += '<label class="field"><span>In Arabic</span><input class="input" id="af-about-ar" dir="rtl" value="' + esc(v.about_ar || '') + '"></label>';
  h += '<label class="field"><span>Status</span><div class="seg">' + Object.keys(FEATURE_STATUS).map(function(s) { return '<button class="' + (d.st === s ? 'on' : '') + '" onclick="admKeepFeature();UI.sheet.data.st=\'' + s + '\';render()">' + FEATURE_STATUS[s] + '</button>'; }).join('') + '</div></label>';
  h += '<p class="hint">Off hides a switchable feature everywhere. Custom = built for some buildings; switch it on for them under Buildings. Idea = planned, shows on the map only.</p>';
  if (f && !f.switchable) h += '<p class="hint">This one is part of the app\'s core and has no switch.</p>';
  h += '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn sec" onclick="closeSheet()">Close</button><button class="btn pri" onclick="admSaveFeature(' + jsArg(d.key || '') + ')">Save</button></div>';
  return h;
};
function admKeepFeature() {
  var d = UI.sheet.data; ['en', 'ar', 'cat', 'about', 'about-ar', 'key'].forEach(function(k) { var el = document.getElementById('af-' + k); if (el) d['_' + k] = el.value; });
}
function admSaveFeature(key) {
  var d = UI.sheet.data;
  var row = { en: val('af-en').trim(), ar: val('af-ar').trim() || null, category: val('af-cat').trim() || 'Other', about_en: val('af-about').trim() || null, about_ar: val('af-about-ar').trim() || null, status: d.st, updated_at: nowIso() };
  if (!row.en) return sheetErr('Give it a name');
  var p;
  if (key) p = cloudCall(SB.from('app_features').update(row).eq('key', key));
  else {
    row.key = val('af-key').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!row.key) return sheetErr('Give it a key');
    row.switchable = d.st === 'custom' || d.st === 'beta'; row.default_on = d.st !== 'custom'; row.sort = 900;
    p = cloudCall(SB.from('app_features').insert(row));
  }
  p.then(function() { closeSheet(); loadConfig(S.building && S.building.id).then(render); toast('Saved'); }, function(e) { sheetErr(e.message); });
}

/* ---------- Lists ---------- */
function admLists() {
  var h = '<div class="sec"><div class="chips" style="flex-wrap:wrap">';
  LIST_KINDS.forEach(function(k) { h += '<button class="chip' + (ADM.kind === k[0] ? ' on' : '') + '" onclick="ADM.kind=\'' + k[0] + '\';render()">' + k[1] + '</button>'; });
  h += '</div></div>';
  var rows = CFG.lists.filter(function(r) { return r.kind === ADM.kind && !r.building_id; }).sort(function(a, b) { return a.sort - b.sort; });
  var own = CFG.lists.filter(function(r) { return r.kind === ADM.kind && r.building_id; });
  h += '<div class="sec"><div class="card list">';
  rows.forEach(function(r) { h += admListRow(r); });
  if (!rows.length) h += '<div class="li"><div class="grow muted">Nothing yet.</div></div>';
  h += '</div><button class="btn pri block" style="margin-top:10px" onclick="openSheet(\'admList\',{kind:ADM.kind})">＋ Add</button>';
  h += '<p class="hint">Hidden items disappear from every app but stay on old records. Nothing here is deleted.</p></div>';
  if (own.length) {
    h += '<div class="sec"><div class="sec-h"><h2>Added by buildings</h2></div><div class="card list">';
    own.forEach(function(r) { h += admListRow(r); });
    h += '</div></div>';
  }
  return h;
}
function admListRow(r) {
  var d = r.data || {}, sub = '';
  if (r.kind === 'expense_preset') sub = catIcon(d.cat) + ' ' + catName(d.cat);
  else if (r.kind === 'charge_preset') sub = [{ fixed: 'Monthly fee', due: 'Bill to split', service: 'Supplier service' }[d.kind] || d.kind, d.g ? d.g[0] : '', d.amt != null ? fmt(d.amt, d.cur || 'USD') : '', d.split || ''].filter(Boolean).join(' · ');
  else if (r.kind === 'task_preset') sub = [d.g ? d.g[0] : '', (REPEATS[d.rep] || [d.rep])[0], d.who].filter(Boolean).join(' · ');
  else if (r.kind === 'expense_cat') sub = r.key + (d.locked ? ' · built in' : '');
  return '<div class="li"' + (r.hidden ? ' style="opacity:.5"' : '') + '><div class="ic">' + esc(r.icon || (r.kind === 'expense_preset' ? catIcon(d.cat) : '•')) + '</div><div class="grow" style="cursor:pointer" onclick="openSheet(\'admList\',{id:' + jsArg(r.id) + '})"><b>' + esc(r.en) + (r.ar ? ' · ' + esc(r.ar) : '') + '</b><small>' + esc(sub + (r.hidden ? ' · hidden' : '')) + '</small></div>' +
    (d.locked ? '' : '<button class="btn ghost sm" onclick="admHide(' + jsArg(r.id) + ',' + !r.hidden + ')">' + (r.hidden ? 'Show' : 'Hide') + '</button>') + '</div>';
}
function admHide(id, hide) {
  cloudCall(SB.from('app_lists').update({ hidden: hide, updated_at: nowIso() }).eq('id', id)).then(function() { var r = byId(CFG.lists, id); if (r) r.hidden = hide; applyLists(); render(); }, fail);
}
SHEETS.admList = function(d) {
  var r = d.id ? byId(CFG.lists, d.id) : null, kind = r ? r.kind : d.kind, x = (r && r.data) || {};
  if (d.k === undefined) d.k = x.kind || 'fixed';
  if (d.split === undefined) d.split = x.split || 'total';
  if (d.cur === undefined) d.cur = x.cur || 'USD';
  var title = (LIST_KINDS.filter(function(k) { return k[0] === kind; })[0] || [0, ''])[1];
  var h = '<h3>' + esc(r ? r.en : 'Add · ' + title) + '</h3>';
  h += '<div class="two"><label class="field"><span>English</span><input class="input" id="al-en" value="' + esc(r ? r.en : '') + '" data-autofocus></label><label class="field"><span>Arabic</span><input class="input" id="al-ar" dir="rtl" value="' + esc(r ? (r.ar || '') : '') + '"></label></div>';
  if (kind === 'expense_cat') h += '<label class="field"><span>Icon (an emoji)</span><input class="input" id="al-icon" value="' + esc(r ? (r.icon || '') : '') + '" placeholder="🐜"></label>';
  if (kind === 'expense_preset') {
    h += '<label class="field"><span>Category</span><select class="input" id="al-cat">' + Object.keys(CATS).filter(function(k) { return k !== 'supplier'; }).map(function(k) { return '<option value="' + esc(k) + '"' + (x.cat === k ? ' selected' : '') + '>' + esc(catIcon(k) + ' ' + catName(k)) + '</option>'; }).join('') + '</select></label>';
  }
  if (kind === 'charge_preset') {
    h += '<label class="field"><span>Kind</span><div class="seg">' + [['fixed', 'Monthly fee'], ['due', 'Bill to split'], ['service', 'Supplier']].map(function(k) { return '<button class="' + (d.k === k[0] ? 'on' : '') + '" onclick="admKeepList();UI.sheet.data.k=\'' + k[0] + '\';render()">' + k[1] + '</button>'; }).join('') + '</div></label>';
    h += '<div class="two"><label class="field"><span>Group</span><input class="input" id="al-g" value="' + esc(x.g ? x.g[0] : (d._g || '')) + '" placeholder="Upkeep"></label><label class="field"><span>Group in Arabic</span><input class="input" id="al-gar" dir="rtl" value="' + esc(x.g ? x.g[1] : (d._gar || '')) + '"></label></div>';
    if (d.k !== 'service') {
      h += '<label class="field"><span>Suggested amount</span><div class="money-in"><input class="input" id="al-amt" inputmode="decimal" value="' + esc(x.amt != null ? x.amt : (d._amt || '')) + '"><div class="seg">' + ['USD', 'LBP'].map(function(c) { return '<button class="' + (d.cur === c ? 'on' : '') + '" onclick="admKeepList();UI.sheet.data.cur=\'' + c + '\';render()">' + c + '</button>'; }).join('') + '</div></div></label>';
      h += '<label class="field"><span>How to split it</span><div class="seg">' + [['each', 'Same for each'], ['total', 'Split a total'], ['weight', 'Each × share']].map(function(k) { return '<button class="' + (d.split === k[0] ? 'on' : '') + '" onclick="admKeepList();UI.sheet.data.split=\'' + k[0] + '\';render()">' + k[1] + '</button>'; }).join('') + '</div></label>';
    }
  }
  if (kind === 'task_preset') {
    h += '<div class="two"><label class="field"><span>Group</span><input class="input" id="al-g" value="' + esc(x.g ? x.g[0] : '') + '" placeholder="Water"></label><label class="field"><span>Group in Arabic</span><input class="input" id="al-gar" dir="rtl" value="' + esc(x.g ? x.g[1] : '') + '"></label></div>';
    h += '<div class="two"><label class="field"><span>Repeats</span><select class="input" id="al-rep">' + Object.keys(REPEATS).map(function(k) { return '<option value="' + k + '"' + ((x.rep || 'monthly') === k ? ' selected' : '') + '>' + REPEATS[k][0] + '</option>'; }).join('') + '</select></label>';
    h += '<label class="field"><span>Who</span><select class="input" id="al-who"><option value="collector"' + (x.who !== 'manager' ? ' selected' : '') + '>Collector</option><option value="manager"' + (x.who === 'manager' ? ' selected' : '') + '>Manager</option></select></label></div>';
  }
  h += '<label class="field"><span>Position (lower comes first)</span><input class="input" id="al-sort" inputmode="numeric" value="' + esc(r ? r.sort : 500) + '"></label>';
  if (r && r.building_id) h += '<p class="hint">Added by a building for itself only.</p>';
  h += '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn sec" onclick="closeSheet()">Close</button><button class="btn pri" onclick="admSaveList(' + jsArg(r ? r.id : '') + ',' + jsArg(kind) + ')">Save</button></div>';
  return h;
};
function admKeepList() {
  var d = UI.sheet.data; ['g', 'gar', 'amt'].forEach(function(k) { var el = document.getElementById('al-' + k); if (el) d['_' + k] = el.value; });
}
function admSaveList(id, kind) {
  var d = UI.sheet.data, r = id ? byId(CFG.lists, id) : null;
  var row = { kind: kind, en: val('al-en').trim(), ar: val('al-ar').trim() || null, sort: parseInt(val('al-sort'), 10) || 0, updated_at: nowIso() };
  if (!row.en) return sheetErr('Give it a name');
  var data = Object.assign({}, (r && r.data) || {});
  if (kind === 'expense_cat') { row.icon = val('al-icon').trim() || '🧾'; if (!r) row.key = row.en.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || ('cat_' + Date.now()); }
  if (kind === 'pay_method' && !r) row.key = row.en;
  if (kind === 'expense_preset') data.cat = val('al-cat');
  if (kind === 'charge_preset') {
    data.kind = d.k; data.g = [val('al-g').trim() || 'Other', val('al-gar').trim() || 'أخرى']; data.cur = d.cur;
    if (d.k !== 'service') { data.amt = num(val('al-amt')) || null; data.split = d.split; } else { delete data.amt; delete data.split; }
  }
  if (kind === 'task_preset') { data.g = [val('al-g').trim() || 'Other', val('al-gar').trim() || 'أخرى']; data.rep = val('al-rep'); data.who = val('al-who'); }
  row.data = data;
  if (kind === 'expense_cat' && !r && CFG.lists.some(function(x) { return x.kind === 'expense_cat' && x.key === row.key; })) return sheetErr('That category already exists');
  var p = r ? cloudCall(SB.from('app_lists').update(row).eq('id', r.id)) : cloudCall(SB.from('app_lists').insert(row));
  p.then(function() { closeSheet(); loadConfig(S.building && S.building.id).then(render); toast('Saved · live in every app'); }, function(e) { sheetErr(e.message); });
}

/* ---------- Buildings & support ---------- */
function admLoadBuildings() {
  rpc('admin_buildings', {}).then(function(rows) { ADM.buildings = rows || []; render(); }, fail);
}
function admBuildings() {
  if (!ADM.buildings) { admLoadBuildings(); return '<div class="sec"><div class="card pad muted">Loading…</div></div>'; }
  var full = CFG.supportMode === 'full';
  var h = '<div class="sec"><div class="card pad"><div class="switch-row" style="border:0;padding:0"><div><b>Support mode: ' + (full ? 'Testing · full access' : 'Privacy') + '</b><small>' + (full
      ? 'You can open and change any building without asking. Every open is still logged in its activity. Switch to Privacy before real clients join.'
      : 'You can only look (read-only) at buildings whose owner turned support access on, until it expires.') + '</small></div><button class="sw' + (full ? ' on' : '') + '" onclick="admSupportMode(' + (full ? "'consent'" : "'full'") + ')"></button></div>' +
      (full ? '<div class="banner warn" style="margin-top:10px"><div class="grow"><b>Full access is on</b>Fine for testing. Not OK once real buildings use the app.</div></div>' : '') + '</div></div>';
  h += '<div class="sec"><div class="card list">';
  ADM.buildings.forEach(function(b) {
    var open = full || (b.support_until && b.support_until > nowIso());
    h += '<button class="li" onclick="openSheet(\'admBuilding\',{id:' + jsArg(b.id) + '})"><div class="ic">' + (open ? '🟢' : '🏢') + '</div><div class="grow"><b>' + esc(b.name) + '</b><small>' + esc([b.owner || '—', b.units + ' apartments', b.members + ' people', !full && open ? 'support open until ' + dateLabel(b.support_until, true) : '', b.custom ? b.custom + ' custom switch' + (b.custom > 1 ? 'es' : '') : ''].filter(Boolean).join(' · ')) + '</small></div><span class="chev">›</span></button>';
  });
  h += '</div><p class="hint">You can look inside a building only while its owner has support access turned on (Building → Settings). Every look is logged and shows in their activity.</p></div>';
  return h;
}
SHEETS.admBuilding = function(d) {
  var b = (ADM.buildings || []).filter(function(x) { return x.id === d.id; })[0];
  if (!b) return '';
  if (!d.bf) { d.bf = {}; cloudCall(SB.from('building_features').select('*').eq('building_id', b.id)).then(function(rows) { (rows || []).forEach(function(r) { d.bf[r.key] = r; }); d.loaded = true; render(); }); }
  var full = CFG.supportMode === 'full', open = full || (b.support_until && b.support_until > nowIso());
  var h = '<h3>' + esc(b.name) + '</h3><p class="lead">' + esc((b.owner || '—') + ' · ' + b.units + ' apartments · since ' + dateLabel(b.created_at)) + '</p>';
  h += open ? '<button class="btn pri block" onclick="adminOpenBuilding(' + jsArg(b.id) + ')">' + (full ? 'Open their building (full access)' : 'Open their building (read-only)') + '</button><p class="hint">' + (full ? 'Testing mode: you can change things. It shows in their activity.' : 'Support access until ' + esc(dateLabel(b.support_until, true)) + '.') + '</p>'
            : '<div class="banner info"><div class="grow"><b>Support access is off</b>Ask the owner to turn it on: Building → Settings → Support access.</div></div>';
  h += '<div class="sec-h" style="margin-top:14px"><h2>Switches for this building</h2></div>';
  var feats = Object.keys(CFG.features).map(function(k) { return CFG.features[k]; }).filter(function(f) { return f.switchable; }).sort(function(a, b) { return a.sort - b.sort; });
  if (!d.loaded) h += '<p class="muted">Loading…</p>';
  else feats.forEach(function(f) {
    var o = d.bf[f.key], eff = o ? o.on : (f.status !== 'off' && f.default_on !== false);
    h += '<div class="switch-row"><div><b>' + esc(f.en) + (f.status === 'custom' ? ' <span class="pill-st st-custom">Custom</span>' : '') + '</b><small>' + esc(o ? (o.on ? 'On here' : 'Off here') + ' (everyone else: ' + (f.default_on !== false && f.status !== 'off' ? 'on' : 'off') + ')' + (o.note ? ' · ' + o.note : '') : 'Same as everyone') + '</small></div>';
    h += '<button class="sw' + (eff ? ' on' : '') + '" onclick="admBuildingSwitch(' + jsArg(b.id) + ',' + jsArg(f.key) + ',' + !eff + ')"></button></div>';
    if (o) h += '<button class="btn ghost sm" style="margin:-6px 0 6px" onclick="admBuildingReset(' + jsArg(b.id) + ',' + jsArg(f.key) + ')">Back to same as everyone</button>';
  });
  h += '<div class="foot"><button class="btn sec" onclick="closeSheet()">Close</button></div>';
  return h;
};
function admBuildingSwitch(bid, key, on) {
  var note = prompt('Why? (optional note, e.g. the problem it solves for them)', '') || null;
  cloudCall(SB.from('building_features').upsert({ building_id: bid, key: key, on: on, note: note, set_at: nowIso() })).then(function() {
    var d = UI.sheet && UI.sheet.data; if (d && d.bf) d.bf[key] = { key: key, on: on, note: note }; admLoadBuildings(); toast('Saved');
  }, fail);
}
function admBuildingReset(bid, key) {
  cloudCall(SB.from('building_features').delete().eq('building_id', bid).eq('key', key)).then(function() {
    var d = UI.sheet && UI.sheet.data; if (d && d.bf) delete d.bf[key]; admLoadBuildings(); render();
  }, fail);
}

/* Read-only look inside a client's building. */
function adminOpenBuilding(bid) {
  rpc('support_open', { p_building: bid }).then(function() { return cloudBuildingState(bid); }).then(function(ns) {
    ns.role = 'manager'; ns.support = true; ns.supportFull = CFG.supportMode === 'full'; ns.myBlocks = null;
    S = ns; UI.sheet = null; UI.screen = 'app'; UI.tab = 'home'; UI.bsec = null; UI.block = null; UI.cycleId = null;
    return loadConfig(bid);
  }).then(function() { render(); window.scrollTo(0, 0); }, fail);
}
function exitSupport() {
  S.support = false; UI.screen = 'admin'; ADM.tab = 'support';
  var last = null; try { last = localStorage.getItem('bny15_last'); } catch (e) {}
  (last ? openBuilding(last) : Promise.resolve()).then(function() { UI.screen = 'admin'; render(); }, function() { render(); });
}
function supportBanner() {
  if (!S.support) return '';
  return '<div class="support-bar' + (S.supportFull ? ' full' : '') + '"><b>' + (S.supportFull ? 'Support · full access' : 'Support view · read-only') + '</b><span>' + esc(bName()) + '</span><button onclick="exitSupport()">Exit</button></div>';
}
/* Nothing is written while looking at a client's building. The server refuses it anyway. */
(function() {
  var ro = function() { return Promise.reject(new Error(t('Support view is read-only', 'عرض الدعم للقراءة فقط'))); };
  ['dbInsert', 'dbInsertMany', 'dbUpdate', 'dbDelete'].forEach(function(n) {
    var orig = window[n];
    window[n] = function() { return S.support && !S.supportFull ? ro() : orig.apply(this, arguments); };
  });
  var origRpc = window.rpc;
  window.rpc = function(name) { return S.support && !S.supportFull && ['support_open', 'admin_buildings', 'am_admin'].indexOf(name) < 0 ? ro() : origRpc.apply(this, arguments); };
})();

/* ---------- Owner side: support access in Settings ---------- */
var SUPPORT = { until: null };
function loadSupport() {
  if (!isCloud() || !S.building) return Promise.resolve();
  return cloudCall(SB.from('support_grants').select('expires_at').eq('building_id', S.building.id)).then(function(rows) {
    SUPPORT.until = rows && rows[0] && rows[0].expires_at > nowIso() ? rows[0].expires_at : null;
  }, function() {});
}
function renderSupportCard() {
  if (S.role !== 'manager' || S.support || !isCloud()) return '';
  var on = SUPPORT.until && SUPPORT.until > nowIso();
  var h = '<div class="sec"><div class="sec-h"><h2>' + esc(t('Support access', 'وصول الدعم')) + '</h2></div><div class="card pad">';
  h += '<p class="muted" style="margin-top:0">' + esc(on ? t('Natour app support can look at your building (read-only) until ' + dateLabel(SUPPORT.until, true) + '. Every look shows in your activity.', 'يمكن لدعم تطبيق ناطور رؤية بنايتك (قراءة فقط) حتى ' + dateLabel(SUPPORT.until, true) + '. كل اطّلاع يظهر في نشاطك.')
                                         : t('If you need help, let Natour app support see your building for a while. They can look, not change anything. You can turn it off any time.', 'إذا احتجت مساعدة، اسمح لدعم تطبيق ناطور برؤية بنايتك لفترة. يرون فقط ولا يغيّرون شيئاً. يمكنك إيقافه متى شئت.')) + '</p>';
  h += '<div class="row" style="gap:8px;flex-wrap:wrap">';
  if (on) h += '<button class="btn danger sm grow" onclick="setSupport(0)">' + esc(t('Turn off now', 'أوقفه الآن')) + '</button>';
  h += '<button class="btn sec sm grow" onclick="setSupport(24)">' + esc(t('Allow for 24 hours', 'اسمح لمدة 24 ساعة')) + '</button><button class="btn sec sm grow" onclick="setSupport(72)">' + esc(t('3 days', '3 أيام')) + '</button>';
  return h + '</div></div></div>';
}
function setSupport(hours) {
  rpc('set_support', { p_building: S.building.id, p_hours: hours }).then(function(until) {
    SUPPORT.until = until || null; render();
    toast(hours ? t('Support can look until ' + dateLabel(until, true), 'يمكن للدعم الاطّلاع حتى ' + dateLabel(until, true)) : t('Support access is off', 'وصول الدعم متوقف'));
  }, fail);
}

function admSupportMode(mode) {
  if (mode === 'full' && !confirm('Turn on full access? You will be able to open and change any building without the owner allowing it.')) return;
  cloudCall(SB.from('app_settings').upsert({ key: 'support_mode', value: mode, updated_at: nowIso() })).then(function() {
    CFG.supportMode = mode; admLoadBuildings(); toast(mode === 'full' ? 'Full access on (testing)' : 'Privacy mode on');
  }, fail);
}
