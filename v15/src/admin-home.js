/* ============================================================================
   Natour admin workspace: the laptop frame, Overview and Buildings.
   Internal tool, English only. Features, Lists and News live in admin.js and
   news.js. All data comes from admin-only server functions.
   ============================================================================ */
var ADM_PAGES = [
  ['overview', '📊', 'Overview'], ['support', '🏢', 'Buildings'], ['features', '🧩', 'Features'],
  ['lists', '🗂', 'Lists'], ['news', '📣', 'News']
];
var STALL_DAYS = 3, QUIET_DAYS = 14;

function renderAdmin() {
  if (!IS_ADMIN) return '<div class="shell"><div class="sec"><div class="card pad">Not allowed.</div></div></div>';
  var page = ADM_PAGES.filter(function(p) { return p[0] === ADM.tab; })[0] || ADM_PAGES[0];
  var h = '<div class="desk adm" dir="ltr"><aside class="desk-side">';
  h += '<div class="desk-brand"><span class="logo">ن</span><span><b>Natour admin</b><small>Only you can see this</small></span></div>';
  ADM_PAGES.forEach(function(p) {
    h += '<button class="desk-nav' + (page[0] === p[0] ? ' on' : '') + '"' + (page[0] === p[0] ? ' aria-current="page"' : '') + ' onclick="admGo(\'' + p[0] + '\')"><span>' + p[1] + '</span>' + p[2] + '</button>';
  });
  h += '<div class="grow"></div><button class="desk-nav" onclick="UI.screen=\'app\';render()"><span>‹</span>Back to the app</button></aside><main class="desk-main">';
  if (page[0] === 'overview') h += admOverview();
  else if (page[0] === 'support') h += admBuildings();
  else {
    h += deskHead(page[2]) + '<p class="adm-sub">Changes reach every app within seconds.</p>';
    if (page[0] === 'features') h += admFeatures();
    else h += '<div class="adm-narrowpage">' + (page[0] === 'lists' ? admLists() : admNews()) + '</div>';
  }
  return h + '</main></div>';
}
function admGo(tab) {
  ADM.tab = tab; UI.sheet = null;
  if (tab === 'overview' || tab === 'support' || tab === 'news') admLoadBuildings();
  if (tab === 'news') loadNews().then(admLoadNewsStats);
  render(); window.scrollTo(0, 0);
}

/* ---------- Data ---------- */
function admLoadBuildings() {
  if (ADM.loading) return ADM.loading;
  ADM.err = null;
  ADM.loading = Promise.all([rpc('admin_buildings_stats', {}), rpc('admin_activity_daily', { p_days: 30 })]).then(function(r) {
    ADM.buildings = r[0] || []; ADM.daily = r[1] || []; ADM.loading = null; render();
  }, function(e) {
    ADM.loading = null; ADM.err = (e && e.message) || String(e); render();
  });
  return ADM.loading;
}
function admWaiting() {
  if (ADM.err) return '<div class="desk-card"><p>Couldn\'t load this: ' + esc(ADM.err) + '</p><button class="btn sec sm" onclick="admLoadBuildings()">Try again</button></div>';
  if (!ADM.buildings) { admLoadBuildings(); return '<div class="desk-card muted">Loading…</div>'; }
  return '';
}
function admDaysAgo(iso) { return iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity; }
function admAgo(iso) {
  if (!iso) return 'Never';
  var d = new Date(iso), now = new Date();
  var days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 60 ? days + ' days ago' : dateLabel(iso);
}
function admStage(b) {
  if (!b.has_payments) return b.units_with_phone ? ['Adding residents', 'beta'] : ['Just set up', 'idea'];
  return b.months >= 2 ? ['Running', 'live'] : ['First month', 'live'];
}
function admReal() { return (ADM.buildings || []).filter(function(b) { return !b.is_test; }); }
function admById(id) { return (ADM.buildings || []).filter(function(b) { return b.id === id; })[0]; }
function admName(b) { return b.name + (b.name_ar && b.name_ar !== b.name ? ' · ' + b.name_ar : ''); }

/* ---------- Overview ---------- */
function admAttention() {
  var out = [], real = admReal(), full = CFG.supportMode === 'full';
  if (full) out.push({ st: 'custom', tag: 'Reminder', title: 'Support mode is on full access', sub: 'You can open any building without asking. Switch to Privacy before real clients join.', go: "admGo('support')" });
  real.filter(function(b) { return !b.has_payments && admDaysAgo(b.created_at) > STALL_DAYS; }).forEach(function(b) {
    out.push({ st: 'idea', tag: 'Stalled', title: b.name + ' hasn\'t collected yet', sub: 'Set up ' + admAgo(b.created_at).toLowerCase() + ' with no payment ticked.', go: 'openSheet(\'admBuilding\',{id:' + jsArg(b.id) + '})' });
  });
  real.filter(function(b) { return b.has_payments && admDaysAgo(b.last_activity) > QUIET_DAYS; }).forEach(function(b) {
    out.push({ st: 'off', tag: 'Gone quiet', title: b.name + ' has stopped', sub: 'Last activity ' + admAgo(b.last_activity).toLowerCase() + '.', go: 'openSheet(\'admBuilding\',{id:' + jsArg(b.id) + '})' });
  });
  if (!full) real.filter(function(b) { return b.support_until; }).forEach(function(b) {
    out.push({ st: 'live', tag: 'Support open', title: b.name + ' asked for help', sub: 'You can look until ' + dateLabel(b.support_until, true) + '.', go: 'openSheet(\'admBuilding\',{id:' + jsArg(b.id) + '})' });
  });
  var spare = (ADM.buildings || []).filter(function(b) { return b.is_test && !b.is_live_demo; });
  if (spare.length) out.push({ st: 'beta', tag: 'Tidy up', title: spare.length + ' old test building' + (spare.length > 1 ? 's' : '') + ' can be removed', sub: 'Old copies that nobody uses any more.', go: "ADM.showTest=true;admGo('support')" });
  return out;
}
function admOverview() {
  var wait = admWaiting(), h = deskHead('Overview');
  if (wait) return h + wait;
  var real = admReal(), tests = ADM.buildings.length - real.length;
  var apts = real.reduce(function(s, b) { return s + b.units; }, 0);
  var active = real.filter(function(b) { return admDaysAgo(b.last_activity) <= 7; }).length;
  var fresh = real.filter(function(b) { return admDaysAgo(b.created_at) <= 7; }).length;
  var collecting = real.filter(function(b) { return b.has_payments; }).length;
  h += '<div class="desk-tiles">';
  h += deskTile('Buildings', String(real.length), tests ? tests + ' test not counted' : 'No test buildings');
  h += deskTile('Apartments', String(apts), 'In those buildings');
  h += deskTile('Active this week', active + ' of ' + real.length, 'Someone did something in the app');
  h += deskTile('Collecting', collecting + ' of ' + real.length, 'Have ticked a payment');
  h += deskTile('New this week', String(fresh), fresh === 1 ? 'Building set up' : 'Buildings set up');
  h += '</div><div class="adm-two">' + admChart();
  var att = admAttention();
  h += '<section class="desk-card"><h2>Needs you' + (att.length ? ' · ' + att.length : '') + '</h2>';
  if (!att.length) h += '<p class="muted">Nothing right now.</p>';
  else h += '<div class="adm-att">' + att.map(function(a) {
    return '<button class="li" onclick="' + esc(a.go) + '"><div class="grow"><b>' + esc(a.title) + ' <span class="pill-st st-' + a.st + '">' + esc(a.tag) + '</span></b><small>' + esc(a.sub) + '</small></div><span class="chev">›</span></button>';
  }).join('') + '</div>';
  h += '</section></div>';
  var newest = real.slice().sort(function(a, b) { return a.created_at < b.created_at ? 1 : -1; }).slice(0, 5);
  h += '<section class="desk-card"><h2>Newest buildings</h2>' + (newest.length ? admTable(newest, false) : '<p class="muted">None yet.</p>') + '</section>';
  return h;
}
function admChart() {
  var real = {}, days = [], now = new Date(), byDay = {};
  admReal().forEach(function(b) { real[b.id] = 1; });
  (ADM.daily || []).forEach(function(r) {
    if (!real[r.building_id]) return;
    var x = byDay[r.day] || (byDay[r.day] = { n: 0, b: 0 }); x.n += r.actions; x.b++;
  });
  for (var i = 29; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var v = byDay[key] || { n: 0, b: 0 };
    days.push({ key: key, n: v.n, b: v.b });
  }
  var max = Math.max.apply(null, days.map(function(x) { return x.n; }).concat([1]));
  var total = days.reduce(function(s, x) { return s + x.n; }, 0);
  var peak = days.filter(function(x) { return x.n === max; })[0];
  var label = function(x) { return dateLabel(x.key) + ': ' + x.n + ' action' + (x.n === 1 ? '' : 's') + (x.b ? ' in ' + x.b + ' building' + (x.b > 1 ? 's' : '') : ''); };
  var h = '<section class="desk-card"><h2>Actions per day, last 30 days</h2>';
  if (!total) return h + '<p class="muted">Nothing yet in real buildings.</p></section>';
  h += '<p class="adm-sub">' + total + ' things people did in real buildings. Busiest: ' + esc(dateLabel(peak.key)) + ' with ' + peak.n + '.</p>';
  h += '<div class="adm-chart">' + days.map(function(x, i) {
    return '<div class="adm-col' + (i < 8 ? ' l' : i > 21 ? ' r' : '') + '" tabindex="0" data-tip="' + esc(label(x)) + '" aria-label="' + esc(label(x)) + '"><i style="height:' + (x.n ? Math.max(1.5, x.n / max * 100) : 0) + '%"></i></div>';
  }).join('') + '</div>';
  h += '<div class="adm-axis"><span>' + esc(dateLabel(days[0].key)) + '</span><span>' + esc(dateLabel(days[15].key)) + '</span><span>Today</span></div>';
  h += '<details class="adm-more"><summary>See as a table</summary>' + deskTable(['Day', 'Actions', 'Buildings'], days.filter(function(x) { return x.n; }).reverse().map(function(x) { return [dateLabel(x.key), String(x.n), String(x.b)]; }), [1, 2]) + '</details>';
  return h + '</section>';
}

/* ---------- Buildings ---------- */
var ADM_COLS = [
  ['name', 'Building', function(b) { return b.name.toLowerCase(); }],
  ['owner', 'Owner', function(b) { return (b.owner || '').trim().toLowerCase(); }],
  ['stage', 'Stage', function(b) { return admStage(b)[0]; }],
  ['units', 'Apartments', function(b) { return b.units; }, 1],
  ['phones', 'Phones added', function(b) { return b.units ? b.units_with_phone / b.units : 0; }, 1],
  ['members', 'People', function(b) { return b.members; }, 1],
  ['months', 'Months', function(b) { return b.months; }, 1],
  ['paid', 'Paid, latest month', function(b) { return b.latest_units_paid == null || !b.units ? -1 : b.latest_units_paid / b.units; }, 1],
  ['last', 'Last activity', function(b) { return b.last_activity || ''; }],
  ['since', 'Since', function(b) { return b.created_at; }]
];
function admSort(k) {
  if (ADM.sort.k === k) ADM.sort.dir = -ADM.sort.dir; else ADM.sort = { k: k, dir: k === 'name' || k === 'owner' ? 1 : -1 };
  render();
}
function admSorted(rows) {
  var c = ADM_COLS.filter(function(x) { return x[0] === ADM.sort.k; })[0] || ADM_COLS[8], dir = ADM.sort.dir;
  return rows.slice().sort(function(a, b) { var x = c[2](a), y = c[2](b); return x === y ? 0 : (x < y ? -dir : dir); });
}
function admTags(b) {
  return (b.is_live_demo ? ' <span class="pill-st st-beta">Live demo</span>' : b.is_test ? ' <span class="pill-st st-idea">Test</span>' : '') + (b.custom ? ' <span class="pill-st st-custom">' + b.custom + ' custom</span>' : '') +
    (CFG.supportMode !== 'full' && b.support_until ? ' <span class="pill-st st-live">Support open</span>' : '');
}
function admPaid(b) {
  if (b.latest_units_paid == null) return '<span class="muted" title="Needs support access">Private</span>';
  return !b.latest_period ? '—' : '<span title="' + esc(b.latest_period) + '">' + b.latest_units_paid + ' of ' + b.units + '</span>';
}
function admTable(rows, sortable) {
  var h = '<div class="desk-tw"><table class="desk-t adm-t"><thead><tr>';
  ADM_COLS.forEach(function(c) {
    var on = ADM.sort.k === c[0];
    h += '<th' + (c[3] ? ' class="num"' : '') + (sortable && on ? ' aria-sort="' + (ADM.sort.dir > 0 ? 'ascending' : 'descending') + '"' : '') + '>' + (sortable ? '<button onclick="admSort(\'' + c[0] + '\')">' + c[1] + (on ? (ADM.sort.dir > 0 ? ' ↑' : ' ↓') : '') + '</button>' : c[1]) + '</th>';
  });
  h += '</tr></thead><tbody>';
  rows.forEach(function(b) {
    var st = admStage(b), open = 'openSheet(\'admBuilding\',{id:' + jsArg(b.id) + '})';
    h += '<tr class="click" onclick="' + open + '"><td><button class="adm-link" onclick="event.stopPropagation();' + open + '">' + esc(b.name) + '</button>' + admTags(b) + (b.note ? '<small class="adm-note">' + esc(b.note) + '</small>' : '') + '</td>';
    h += '<td>' + esc((b.owner || '').trim() || '—') + '</td><td><span class="pill-st st-' + st[1] + '">' + st[0] + '</span></td>';
    h += '<td class="num">' + b.units + '</td><td class="num">' + b.units_with_phone + '</td><td class="num">' + b.members + '</td><td class="num">' + b.months + '</td><td class="num">' + admPaid(b) + '</td>';
    h += '<td title="' + esc(b.last_activity ? dateLabel(b.last_activity, true) : '') + '">' + esc(admAgo(b.last_activity)) + '</td><td>' + esc(dateLabel(b.created_at)) + '</td></tr>';
  });
  return h + '</tbody></table></div>';
}
function admBuildings() {
  var wait = admWaiting(), full = CFG.supportMode === 'full';
  var h = deskHead('Buildings');
  if (wait) return h + wait;
  var all = ADM.buildings, tests = all.filter(function(b) { return b.is_test; }).length, q = ADM.bq.trim().toLowerCase();
  var rows = admSorted(all.filter(function(b) {
    return (ADM.showTest || !b.is_test) && (!q || ((b.name + ' ' + (b.name_ar || '') + ' ' + (b.owner || '') + ' ' + (b.note || '')).toLowerCase().indexOf(q) >= 0));
  }));
  h += '<section class="desk-card adm-mode"><div class="switch-row" style="border:0;padding:0"><div><b>Support mode: ' + (full ? 'Testing · full access' : 'Privacy') + '</b><small>' + (full
    ? 'You can open and change any building without asking. Every open is logged in its activity. Switch to Privacy before real clients join.'
    : 'You can only look (read-only) at buildings whose owner turned support access on, until it expires.') + '</small></div><button class="sw' + (full ? ' on' : '') + '" aria-label="Full access" onclick="admSupportMode(' + (full ? "'consent'" : "'full'") + ')"></button></div></section>';
  h += '<div class="desk-filters"><input class="input adm-q" id="adm-bq" placeholder="Search name, owner or note" value="' + esc(ADM.bq) + '" oninput="ADM.bq=this.value;admKeepSearch()">';
  if (tests) h += '<button class="chip' + (ADM.showTest ? ' on' : '') + '" onclick="ADM.showTest=!ADM.showTest;render()">' + (ADM.showTest ? 'Showing' : 'Show') + ' ' + tests + ' test</button>';
  h += '<span class="muted adm-count">' + rows.length + ' building' + (rows.length === 1 ? '' : 's') + '</span></div>';
  if (!rows.length) return h + '<div class="desk-card muted">No buildings match.</div>';
  h += '<section class="desk-card adm-wide">' + admTable(rows, true) + '</section>';
  h += '<div class="card list adm-narrow">' + rows.map(function(b) {
    var st = admStage(b);
    return '<button class="li" onclick="openSheet(\'admBuilding\',{id:' + jsArg(b.id) + '})"><div class="grow"><b>' + esc(b.name) + admTags(b) + '</b><small>' + esc([(b.owner || '').trim() || '—', b.units + ' apartments', st[0], admAgo(b.last_activity)].join(' · ')) + '</small></div><span class="chev">›</span></button>';
  }).join('') + '</div>';
  return h;
}
function admKeepSearch() {
  render();
  var el = document.getElementById('adm-bq');
  if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

/* Building detail: slides in from the side on a laptop. */
var ADM_EVENTS = {
  payments: ['Payment recorded', 'Payment edited', 'Payment removed'], units: ['Apartment added', 'Apartment edited', 'Apartment removed'],
  charges: ['Charge added', 'Charge edited', 'Charge removed'], cycles: ['Month started', 'Month edited', 'Month removed'],
  expenses: ['Expense added', 'Expense edited', 'Expense removed'], tasks: ['Task added', 'Task updated', 'Task removed'],
  handovers: ['Handover started', 'Handover updated', 'Handover removed'], members: ['Person joined', 'Person edited', 'Person removed'],
  invites: ['Invite created', 'Invite edited', 'Invite removed'], contacts: ['Contact added', 'Contact edited', 'Contact removed'],
  buildings: ['Building created', 'Building settings changed', 'Building removed']
};
function admEventLabel(e) {
  if (e.tbl === 'support') return { view: 'Support looked', grant: 'Owner allowed support', revoke: 'Owner stopped support' }[e.action] || 'Support';
  var m = ADM_EVENTS[e.tbl], i = { insert: 0, update: 1, delete: 2 }[e.action];
  return m && i != null ? m[i] : e.tbl + ' ' + e.action;
}
function admTimeline(rows) {
  var out = [];
  rows.forEach(function(e) {
    var who = (e.actor_name || '').trim(), label = admEventLabel(e), day = String(e.at).slice(0, 10), p = out[out.length - 1];
    if (p && p.label === label && p.who === who && p.day === day) p.n++; else out.push({ label: label, who: who, day: day, at: e.at, n: 1 });
  });
  return out;
}
SHEETS.admBuilding = function(d) {
  var b = admById(d.id);
  if (!b) return '<h3>Building removed</h3><div class="foot"><button class="btn sec" onclick="closeSheet()">Close</button></div>';
  if (!d.bf) { d.bf = {}; cloudCall(SB.from('building_features').select('*').eq('building_id', b.id)).then(function(rows) { (rows || []).forEach(function(r) { d.bf[r.key] = r; }); d.loaded = true; render(); }, function(e) { d.loaded = true; fail(e); }); }
  var full = CFG.supportMode === 'full', open = b.access;
  if (open && !d.act) { d.act = 'loading'; rpc('admin_building_activity', { p_building: b.id, p_limit: 200 }).then(function(r) { d.act = admTimeline(r || []); render(); }, function(e) { d.act = []; d.actErr = e.message; render(); }); }
  var st = admStage(b);
  var h = '<h3>' + esc(admName(b)) + admTags(b) + '</h3><p class="lead">' + esc(((b.owner || '').trim() || 'No owner') + ' · since ' + dateLabel(b.created_at)) + ' · <span class="pill-st st-' + st[1] + '">' + st[0] + '</span></p>';
  h += '<div class="adm-facts">' + [['Apartments', b.units], ['Phones added', b.units_with_phone], ['People', b.members], ['Months', b.months], ['Payments', b.payments == null ? 'Private' : b.payments], ['Last active', admAgo(b.last_activity)]].map(function(x) { return '<div><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div>';
  h += open ? '<button class="btn pri block" onclick="adminOpenBuilding(' + jsArg(b.id) + ')">' + (full ? 'Open their building (full access)' : 'Open their building (read-only)') + '</button><p class="hint">' + (full ? 'Testing mode: you can change things. It shows in their activity.' : 'Support access until ' + esc(dateLabel(b.support_until, true)) + '.') + '</p>'
            : '<div class="banner info"><div class="grow"><b>Support access is off</b>Ask the owner to turn it on: Building → Settings → Support access.</div></div>';

  h += '<div class="sec-h" style="margin-top:18px"><h2>Your labels</h2></div>';
  h += '<div class="switch-row"><div><b>Test building</b><small>Left out of Overview and hidden from this list by default</small></div><button class="sw' + (b.is_test ? ' on' : '') + '" aria-label="Test building" onclick="admSetTest(' + jsArg(b.id) + ',' + !b.is_test + ')"></button></div>';
  h += '<label class="field"><span>Note, only you see it</span><input class="input" id="adm-note" value="' + esc(d._note != null ? d._note : (b.note || '')) + '" placeholder="e.g. Starts in January, prefers WhatsApp" onchange="admSaveNote(' + jsArg(b.id) + ',this.value)"></label>';

  h += '<div class="sec-h" style="margin-top:18px"><h2>Recent activity</h2></div>';
  if (!open) h += '<p class="muted">Private until the owner turns support access on.</p>';
  else if (d.act === 'loading') h += '<p class="muted">Loading…</p>';
  else if (d.actErr) h += '<p class="muted">Couldn\'t load it: ' + esc(d.actErr) + '</p>';
  else if (!d.act.length) h += '<p class="muted">Nothing yet.</p>';
  else {
    var shown = d.actAll ? d.act : d.act.slice(0, 12);
    h += '<div class="adm-feed">' + shown.map(function(e) { return '<div><b>' + esc(e.label) + (e.n > 1 ? ' × ' + e.n : '') + '</b><small>' + esc([e.who, dateLabel(e.at, true)].filter(Boolean).join(' · ')) + '</small></div>'; }).join('') + '</div>';
    if (d.act.length > shown.length) h += '<button class="btn ghost sm" onclick="UI.sheet.data.actAll=true;render()">Show all ' + d.act.length + '</button>';
    if (open) h += '<p class="hint">Opening this counts as a support look and shows in their activity, at most once an hour.</p>';
  }

  h += '<div class="sec-h" style="margin-top:18px"><h2>Switches for this building</h2></div>';
  var feats = Object.keys(CFG.features).map(function(k) { return CFG.features[k]; }).filter(function(f) { return f.switchable; }).sort(function(a, b) { return a.sort - b.sort; });
  if (!d.loaded) h += '<p class="muted">Loading…</p>';
  else feats.forEach(function(f) {
    var o = d.bf[f.key], eff = o ? o.on : (f.status !== 'off' && f.default_on !== false);
    h += '<div class="switch-row"><div><b>' + esc(f.en) + (f.status === 'custom' ? ' <span class="pill-st st-custom">Custom</span>' : '') + '</b><small>' + esc(o ? (o.on ? 'On here' : 'Off here') + ' (everyone else: ' + (f.default_on !== false && f.status !== 'off' ? 'on' : 'off') + ')' + (o.note ? ' · ' + o.note : '') : 'Same as everyone') + '</small></div>';
    h += '<button class="sw' + (eff ? ' on' : '') + '" aria-label="' + esc(f.en) + '" onclick="admBuildingSwitch(' + jsArg(b.id) + ',' + jsArg(f.key) + ',' + !eff + ')"></button></div>';
    if (o) h += '<button class="btn ghost sm" style="margin:-6px 0 6px" onclick="admBuildingReset(' + jsArg(b.id) + ',' + jsArg(f.key) + ')">Back to same as everyone</button>';
  });

  if (b.is_test && !b.is_live_demo) {
    h += '<div class="sec-h" style="margin-top:18px"><h2>Remove this test building</h2></div><p class="hint" style="margin-top:0">Deletes the building and everything in it for good, including ' + b.units + ' apartments and their history. Type <b>' + esc(b.name) + '</b> to confirm.</p>';
    h += '<div class="row" style="gap:8px"><input class="input grow" id="adm-del" autocomplete="off" aria-label="Type the building name"><button class="btn danger" onclick="admDeleteTest(' + jsArg(b.id) + ')">Remove</button></div><div id="sheet-err" class="err"></div>';
  } else if (b.is_live_demo) h += '<p class="hint" style="margin-top:18px">This is the building behind “Try the demo”, so it can\'t be removed.</p>';
  return h + '<div class="foot"><button class="btn sec" onclick="closeSheet()">Close</button></div>';
};
SHEETS.admBuilding.cls = 'drawer';

function admMetaSave(id, patch) {
  var b = admById(id); if (!b) return Promise.resolve();
  var row = Object.assign({ building_id: id, is_test: b.is_test, note: b.note || null, updated_at: nowIso() }, patch);
  return cloudCall(SB.from('admin_building_meta').upsert(row)).then(function() { Object.assign(b, patch); }, function(e) { fail(e); throw e; });
}
function admSetTest(id, on) {
  admMetaSave(id, { is_test: on }).then(function() { render(); toast(on ? 'Marked as test' : 'Counts as a real building'); }, function() {});
}
function admSaveNote(id, v) {
  var note = v.trim() || null;
  admMetaSave(id, { note: note }).then(function() { var d = UI.sheet && UI.sheet.data; if (d) d._note = null; toast('Note saved'); render(); }, function() {});
}
function admDeleteTest(id) {
  var typed = val('adm-del').trim(), b = admById(id);
  if (!b) return;
  if (typed !== b.name) return sheetErr('Type the name exactly: ' + b.name);
  rpc('admin_delete_test_building', { p_building: id, p_confirm: typed }).then(function() {
    closeSheet(); toast(b.name + ' removed'); admLoadBuildings();
  }, function(e) { sheetErr(e.message); });
}
