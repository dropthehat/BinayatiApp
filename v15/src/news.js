/* ============================================================================
   News from Binayati: announcements the admin sends (new features, tips,
   offers). Newest unread shows as a card on Home; all of them in the menu.
   Managers can turn partner offers off for their building.
   ============================================================================ */
var NEWS = { list: [], read: {}, stats: {} };
var NEWS_KINDS = { news: ['📣', 'News', 'خبر'], feature: ['✨', 'New feature', 'ميزة جديدة'], tip: ['💡', 'Tip', 'نصيحة'], offer: ['🏷', 'Offer', 'عرض'] };

function newsAudienceOk(a) {
  if (a.audience === 'all') return true;
  if (a.audience === 'managers') return S.role === 'manager' || S.role === 'comanager';
  if (a.audience === 'collectors') return S.role === 'collector';
  if (a.audience === 'residents') return S.role === 'resident';
  return false;
}
function loadNews() {
  if (!isCloud()) return Promise.resolve();
  if (S.role === 'resident') return Promise.resolve();
  return Promise.all([
    SB.from('announcements').select('*').order('starts_at', { ascending: false }).limit(50),
    SB.from('announcement_reads').select('announcement_id')
  ]).then(function(r) {
    if (r[0].error) return;
    NEWS.list = r[0].data || [];
    NEWS.read = {}; (r[1].data || []).forEach(function(x) { NEWS.read[x.announcement_id] = 1; });
  }, function() {});
}
function visibleNews() {
  if (typeof feature === 'function' && !feature('announcements')) return [];
  var now = nowIso(), offersOff = !!setting('offers_off');
  return NEWS.list.filter(function(a) {
    if (a.starts_at > now || (a.ends_at && a.ends_at <= now)) return false;
    if (a.building_id && (!S.building || a.building_id !== S.building.id)) return false;
    if (a.kind === 'offer' && offersOff) return false;
    return IS_ADMIN && UI.screen === 'admin' ? true : newsAudienceOk(a);
  });
}
function newsTitle(a) { return LANG === 'ar' ? (a.title_ar || a.title) : a.title; }
function newsBody(a) { return LANG === 'ar' ? (a.body_ar || a.body || '') : (a.body || ''); }
function newsItem(a, compact) {
  var k = NEWS_KINDS[a.kind] || NEWS_KINDS.news;
  var h = '<div class="news-item' + (a.kind === 'offer' ? ' offer' : '') + '"><div class="news-k">' + k[0] + ' ' + esc(LANG === 'ar' ? k[2] : k[1]) + (a.kind === 'offer' ? ' · ' + esc(t('from a partner', 'من شريك')) : '') + '</div>';
  h += '<b>' + esc(newsTitle(a)) + '</b>';
  var body = newsBody(a);
  if (body) h += '<p>' + esc(compact && body.length > 160 ? body.slice(0, 157) + '…' : body) + '</p>';
  if (a.link_url) h += '<a class="btn sec sm" target="_blank" rel="noopener" href="' + esc(a.link_url) + '">' + esc((LANG === 'ar' ? (a.link_label_ar || a.link_label) : a.link_label) || t('Open', 'افتح')) + ' ›</a>';
  return h + '</div>';
}
/* Home: the newest unread one, with a dismiss button. */
function renderNewsCard() {
  if (S.support) return '';
  var unread = visibleNews().filter(function(a) { return !NEWS.read[a.id]; });
  if (!unread.length) return '';
  var a = unread[0];
  var h = '<div class="sec"><div class="card pad news-card">' + newsItem(a, true);
  h += '<div class="row" style="gap:8px;margin-top:8px"><button class="btn ghost sm" onclick="newsDismiss(' + jsArg(a.id) + ')">' + esc(t('Got it', 'حسناً')) + '</button>';
  if (unread.length > 1) h += '<button class="btn ghost sm" onclick="openSheet(\'news\')">' + esc(t('All news (' + unread.length + ')', 'كل الأخبار (' + unread.length + ')')) + '</button>';
  return h + '</div></div></div>';
}
function newsDismiss(id) {
  NEWS.read[id] = 1; render();
  if (isCloud()) cloudCall(SB.from('announcement_reads').upsert({ announcement_id: id })).catch(function() {});
}
SHEETS.news = function() {
  var list = visibleNews();
  var h = '<h3>' + esc(t('News from Binayati', 'أخبار بنايتي')) + '</h3>';
  h += list.length ? list.map(function(a) { return '<div class="card pad" style="margin-bottom:8px">' + newsItem(a, false) + '<small class="muted">' + esc(dateLabel(a.starts_at)) + '</small></div>'; }).join('') : '<p class="muted">' + esc(t('Nothing new.', 'لا جديد.')) + '</p>';
  list.forEach(function(a) { if (!NEWS.read[a.id]) { NEWS.read[a.id] = 1; if (isCloud()) cloudCall(SB.from('announcement_reads').upsert({ announcement_id: a.id })).catch(function() {}); } });
  return h + '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
};
/* Resident page */
function loadResidentNews(tok) {
  return rpc('resident_announcements', { p_token: tok }).then(function(list) { if (S.resident) { S.resident.news = list || []; render(); } }, function() {});
}
function renderResidentNews() {
  var list = (S.resident && S.resident.news) || [];
  if (!list.length) return '';
  return '<div class="sec"><div class="card pad news-card">' + newsItem(list[0], true) + '</div></div>';
}

/* ---------- Admin: write and manage announcements ---------- */
function admNews() {
  var h = '<div class="sec"><button class="btn pri block" onclick="openSheet(\'admNews\',{})">＋ New announcement</button><p class="hint">Shows as a card on Home for the people you choose, until they tap “Got it” or it ends.</p></div>';
  var all = NEWS.list.slice().sort(function(a, b) { return a.created_at < b.created_at ? 1 : -1; });
  h += '<div class="sec"><div class="card list">';
  if (!all.length) h += '<div class="li"><div class="grow muted">Nothing sent yet.</div></div>';
  var now = nowIso();
  all.forEach(function(a) {
    var k = NEWS_KINDS[a.kind] || NEWS_KINDS.news, live = a.starts_at <= now && (!a.ends_at || a.ends_at > now);
    var who = { all: 'Everyone', managers: 'Managers', collectors: 'Collectors', residents: 'Residents' }[a.audience];
    var bld = a.building_id ? ((ADM.buildings || []).filter(function(b) { return b.id === a.building_id; })[0] || {}).name || 'one building' : 'all buildings';
    h += '<button class="li" onclick="openSheet(\'admNews\',{id:' + jsArg(a.id) + '})"><div class="ic">' + k[0] + '</div><div class="grow"><b>' + esc(a.title) + '</b><small>' + esc([who + ' · ' + bld, live ? 'live' : (a.starts_at > now ? 'starts ' + dateLabel(a.starts_at) : 'ended'), (NEWS.stats[a.id] || 0) + ' read'].join(' · ')) + '</small></div><span class="chev">›</span></button>';
  });
  return h + '</div></div>';
}
function admLoadNewsStats() {
  rpc('admin_announcement_reads', {}).then(function(rows) { NEWS.stats = {}; (rows || []).forEach(function(r) { NEWS.stats[r.id] = r.reads; }); render(); }, function() {});
}
SHEETS.admNews = function(d) {
  var a = d.id ? byId(NEWS.list, d.id) : null;
  var v = a || { kind: 'feature', audience: 'all', building_id: null, title: '', title_ar: '', body: '', body_ar: '', link_url: '', link_label: '', ends_at: null };
  ['kind', 'audience'].forEach(function(k) { if (d[k] === undefined) d[k] = v[k]; });
  if (d.bld === undefined) d.bld = v.building_id || '';
  var h = '<h3>' + (a ? 'Announcement' : 'New announcement') + '</h3>';
  h += '<label class="field"><span>Type</span><div class="seg">' + Object.keys(NEWS_KINDS).map(function(k) { return '<button class="' + (d.kind === k ? 'on' : '') + '" onclick="admKeepNews();UI.sheet.data.kind=\'' + k + '\';render()">' + NEWS_KINDS[k][0] + ' ' + NEWS_KINDS[k][1] + '</button>'; }).join('') + '</div></label>';
  h += '<label class="field"><span>Who sees it</span><div class="seg">' + [['all', 'Everyone'], ['managers', 'Managers'], ['collectors', 'Collectors'], ['residents', 'Residents']].map(function(x) { return '<button class="' + (d.audience === x[0] ? 'on' : '') + '" onclick="admKeepNews();UI.sheet.data.audience=\'' + x[0] + '\';render()">' + x[1] + '</button>'; }).join('') + '</div></label>';
  h += '<label class="field"><span>Where</span><select class="input" id="an-bld"><option value="">All buildings</option>' + (ADM.buildings || []).map(function(b) { return '<option value="' + esc(b.id) + '"' + (d.bld === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select></label>';
  h += '<label class="field"><span>Title</span><input class="input" id="an-title" value="' + esc(d._title != null ? d._title : v.title) + '" placeholder="e.g. New: building contacts"></label>';
  h += '<label class="field"><span>Title in Arabic</span><input class="input" id="an-title-ar" dir="rtl" value="' + esc(d._title_ar != null ? d._title_ar : (v.title_ar || '')) + '"></label>';
  h += '<label class="field"><span>Message</span><textarea class="input" id="an-body" rows="3">' + esc(d._body != null ? d._body : (v.body || '')) + '</textarea></label>';
  h += '<label class="field"><span>Message in Arabic</span><textarea class="input" id="an-body-ar" dir="rtl" rows="3">' + esc(d._body_ar != null ? d._body_ar : (v.body_ar || '')) + '</textarea></label>';
  h += '<div class="two"><label class="field"><span>Link (optional)</span><input class="input" id="an-url" inputmode="url" value="' + esc(d._url != null ? d._url : (v.link_url || '')) + '" placeholder="https://"></label><label class="field"><span>Button text</span><input class="input" id="an-lbl" value="' + esc(d._lbl != null ? d._lbl : (v.link_label || '')) + '" placeholder="Learn more"></label></div>';
  h += '<label class="field"><span>Ends (optional)</span><input class="input" type="date" id="an-end" value="' + esc(d._end != null ? d._end : (v.ends_at ? String(v.ends_at).slice(0, 10) : '')) + '"></label>';
  if (d.kind === 'offer') h += '<p class="hint">Offers are marked “from a partner”. Managers can turn offers off for their building in Settings. Keep them rare.</p>';
  h += '<div id="sheet-err" class="err"></div><div class="foot">';
  if (a) h += '<button class="btn danger" onclick="admEndNews(' + jsArg(a.id) + ')">End now</button>';
  h += '<button class="btn sec" onclick="closeSheet()">Close</button><button class="btn pri" onclick="admSaveNews(' + jsArg(a ? a.id : '') + ')">' + (a ? 'Save' : 'Send') + '</button></div>';
  return h;
};
function admKeepNews() {
  var d = UI.sheet.data;
  [['an-title', '_title'], ['an-title-ar', '_title_ar'], ['an-body', '_body'], ['an-body-ar', '_body_ar'], ['an-url', '_url'], ['an-lbl', '_lbl'], ['an-end', '_end']].forEach(function(x) { var el = document.getElementById(x[0]); if (el) d[x[1]] = el.value; });
  var b = document.getElementById('an-bld'); if (b) d.bld = b.value;
}
function admSaveNews(id) {
  admKeepNews();
  var d = UI.sheet.data;
  var row = { kind: d.kind, audience: d.audience, building_id: d.bld || null, title: (d._title || '').trim(), title_ar: (d._title_ar || '').trim() || null,
              body: (d._body || '').trim() || null, body_ar: (d._body_ar || '').trim() || null, link_url: (d._url || '').trim() || null, link_label: (d._lbl || '').trim() || null,
              ends_at: d._end ? d._end + 'T23:59:59Z' : null };
  if (!row.title) return sheetErr('Give it a title');
  if (row.link_url && !/^https:\/\//.test(row.link_url)) return sheetErr('Links must start with https://');
  if (!id && !confirm('Send this to ' + ({ all: 'everyone', managers: 'all managers', collectors: 'all collectors', residents: 'all residents' }[row.audience]) + (row.building_id ? ' in that building' : '') + '?')) return;
  var p = id ? cloudCall(SB.from('announcements').update(row).eq('id', id)) : cloudCall(SB.from('announcements').insert(row));
  p.then(function() { closeSheet(); loadNews().then(function() { admLoadNewsStats(); render(); }); toast(id ? 'Saved' : 'Sent'); }, function(e) { sheetErr(e.message); });
}
function admEndNews(id) {
  cloudCall(SB.from('announcements').update({ ends_at: nowIso() }).eq('id', id)).then(function() { closeSheet(); loadNews().then(render); toast('Ended'); }, fail);
}
