/* ============================================================================
   Binayati V15 — core helpers and the money model
   Everything here is pure: it reads the loaded building in S and computes.
   ============================================================================ */
var LANG = 'en';
try { LANG = localStorage.getItem('bny15_lang') || ((navigator.language || '').slice(0, 2) === 'ar' ? 'ar' : 'en'); } catch (e) {}

var MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var MONTHS_AR = ['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];

/* The loaded building and who is looking at it. */
var S = emptyState();
function emptyState() {
  return { building: null, members: [], units: [], cycles: [], charges: [], payments: [], handovers: [],
           expenses: [], tasks: [], events: [], invites: [], me: null, role: null, resident: null };
}

function t(en, ar) { return LANG === 'ar' ? ar : en; }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function dayKey(iso) { if (!iso) return ''; if (iso.length <= 10) return iso; var d = new Date(iso); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function nowIso() { return new Date().toISOString(); }
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function jsArg(s) { return esc(JSON.stringify(s == null ? '' : s)); }
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
}
function token() { return uuid().replace(/-/g, ''); }
function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function round(v, cur) { return cur === 'LBP' ? Math.round(v) : Math.round(v * 100) / 100; }
function tiny(v, cur) { return Math.abs(v) < (cur === 'LBP' ? 1 : 0.005); }

function fmt(amt, cur) { return '\u2066' + fmtRaw(amt, cur) + '\u2069'; }
function fmtRaw(amt, cur) {
  var n = num(amt), sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (cur === 'LBP') {
    if (n >= 1e6 && n % 1e5 === 0) return sign + (n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'M LBP';
    return sign + Math.round(n).toLocaleString('en-US') + ' LBP';
  }
  var r2 = Math.round(n * 100) / 100;
  return sign + '$' + r2.toLocaleString('en-US', { minimumFractionDigits: r2 % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
/* One reference currency: when on, LBP charges and expenses are converted to USD as they're saved,
   and every two-currency total is shown as a single dollar figure. */
function baseUsd() { return setting('base_cur') === 'USD'; }
function toBase(tbl, row) {
  if (!baseUsd() || (tbl !== 'charges' && tbl !== 'expenses') || row.cur !== 'LBP') return row;
  var r = num(row.fx) || rate(), cv = function(v) { return Math.round(num(v) / r * 100) / 100; };
  row.orig_amount = num(row.amount); row.orig_cur = 'LBP'; row.fx = r;
  row.amount = cv(row.amount); row.cur = 'USD';
  if (row.overrides) { var o = {}; Object.keys(row.overrides).forEach(function(k) { o[k] = cv(row.overrides[k]); }); row.overrides = o; }
  if (row.meter) row.meter = Object.assign({}, row.meter, { rate: Math.round(num(row.meter.rate) / r * 10000) / 10000, fixed: cv(row.meter.fixed) });
  return row;
}
function fxText(v) { return '@ ' + Math.round(num(v)).toLocaleString('en-US'); }
function origNote(x) {
  if (!x) return '';
  if (x.orig_cur === 'LBP' && x.orig_amount) return ' (' + fmt(x.orig_amount, 'LBP') + ' ' + fxText(x.fx || rate()) + ')';
  if (x.cur === 'LBP' && x.fx) return ' · ' + fxText(x.fx);
  return '';
}
/* Exchange-rate box shown under an LBP amount: suppliers often use their own rate. */
function fxField(id, cur, val0, amtId) {
  if (cur !== 'LBP') return '';
  var v = val0 || rate();
  setTimeout(function() { fxHint(id, amtId); var a = document.getElementById(amtId); if (a && !a._fx) { a._fx = 1; a.addEventListener('input', function() { fxHint(id, amtId); }); } }, 0);
  return '<label class="field"><span>' + esc(t('Exchange rate (LBP per $1)', 'سعر الصرف (ليرة لكل دولار)')) + '</span><input class="input" id="' + id + '" inputmode="numeric" value="' + esc(v) + '" oninput="fxHint(\'' + id + '\',\'' + amtId + '\')"><small class="hint" id="' + id + '-h"></small></label>';
}
function fxHint(id, amtId) {
  var el = document.getElementById(id + '-h'), a = document.getElementById(amtId), r = num(val(id));
  if (!el) return;
  el.textContent = a && num(a.value) > 0 && r > 0 ? '= ' + fmt(num(a.value) / r, 'USD') + (Math.round(r) !== Math.round(rate()) ? t(' · building rate is ', ' · سعر البناية ') + Math.round(rate()).toLocaleString('en-US') : '') : '';
}
/* A two-currency pair {USD, LBP} as text, skipping zero sides. */
function fmtPair(p, zeroCur) {
  if (baseUsd()) return fmt((p.USD || 0) + (p.LBP || 0) / rate(), 'USD');
  var parts = [];
  if (!tiny(p.USD || 0, 'USD')) parts.push(fmt(p.USD, 'USD'));
  if (!tiny(p.LBP || 0, 'LBP')) parts.push(fmt(p.LBP, 'LBP'));
  return parts.length ? '\u2066' + parts.join(' + ') + '\u2069' : fmt(0, zeroCur || 'USD');
}
function pair() { return { USD: 0, LBP: 0 }; }
function addTo(p, cur, v) { p[cur] = (p[cur] || 0) + v; return p; }
function rate() { return num(setting('rate')) || 89500; }
function toUsd(v, cur) { return cur === 'LBP' ? v / rate() : v; }
function pairUsd(p) { return (p.USD || 0) + (p.LBP || 0) / rate(); }

function setting(k) { return S.building && S.building.settings ? S.building.settings[k] : undefined; }
function bName() { if (!S.building) return ''; return LANG === 'ar' ? (S.building.name_ar || S.building.name) : S.building.name; }
function L(row, key) { key = key || 'title'; return LANG === 'ar' ? (row[key + '_ar'] || row[key]) : row[key]; }
function unitName(u) { return u ? (LANG === 'ar' ? (u.name_ar || u.name) : u.name) : ''; }

function dateLabel(iso, withTime) {
  if (!iso) return '';
  var d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
  var o = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  var s = d.toLocaleDateString(LANG === 'ar' ? 'ar-LB' : 'en-GB', o);
  if (withTime) s += ' · ' + d.toLocaleTimeString(LANG === 'ar' ? 'ar-LB' : 'en-US', { hour: 'numeric', minute: '2-digit' });
  return s;
}
function periodLabel(period, lang) {
  if (!period) return '';
  var p = period.split('-'), m = Number(p[1]) - 1;
  return ((lang || LANG) === 'ar' ? MONTHS_AR[m] : MONTHS_EN[m]) + ' ' + p[0];
}
function cycleTitle(c, lang) {
  if (!c) return '';
  lang = lang || LANG;
  if (c.kind === 'month' && c.period) return periodLabel(c.period, lang);
  return lang === 'ar' ? (c.title_ar || c.title) : c.title;
}
function nextPeriod(period) {
  var p = period.split('-'), y = Number(p[0]), m = Number(p[1]) + 1;
  if (m > 12) { m = 1; y++; }
  return y + '-' + pad2(m);
}
function currentPeriod() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }

/* ---------------------------------------------------------------------------
   Units and charges
   --------------------------------------------------------------------------- */
function activeUnits() {
  return S.units.filter(function(u) { return u.active !== false; }).sort(function(a, b) {
    return (a.sort || 0) - (b.sort || 0) || String(a.code).localeCompare(String(b.code), 'en', { numeric: true });
  });
}
/* An apartment added later isn't billed for months before it existed. */
function unitInCycle(u, cyc) {
  if (!u || u.active === false) return false;
  if (!cyc || !u.created_at) return true;
  var made = dayKey(u.created_at);
  if (cyc.kind === 'month' && cyc.period) return made.slice(0, 7) <= cyc.period;
  return !cyc.created_at || made <= dayKey(cyc.created_at);
}
/* A shared bill is split among the apartments that existed when it was added. */
function inSplit(u, ch) { return !ch || !ch.created_at || !u.created_at || u.created_at <= ch.created_at; }
/* Blocks: a compound run as one building can have blocks A, B, C… A charge can target one block. */
function blockOf(u) { return (u && u.block) || ''; }
function blocks() {
  var seen = {}, out = [];
  activeUnits().forEach(function(u) { var b = blockOf(u); if (b && !seen[b]) { seen[b] = 1; out.push(b); } });
  return out.sort(function(a, b) { return a.localeCompare(b, 'en', { numeric: true }); });
}
function inBlock(u, ch) { return !ch || !ch.block || blockOf(u) === ch.block; }
function blockLabel(b) { return b ? t('Block ', 'بلوك ') + b : t('Whole building', 'كل البناية'); }
function weightSum(cyc, ch) {
  return activeUnits().filter(function(u) { return unitInCycle(u, cyc) && inSplit(u, ch) && inBlock(u, ch); })
    .reduce(function(s, u) { return s + num(u.weight == null ? 1 : u.weight); }, 0) || 1;
}

/* What one apartment owes for one charge. */
function dueFor(ch, u) {
  if (!u || u.active === false) return 0;
  var ov = ch.overrides || {};
  if (ov[u.id] != null && ov[u.id] !== '') return num(ov[u.id]);
  var cyc = byId(S.cycles, ch.cycle_id);
  if (!unitInCycle(u, cyc) || !inBlock(u, ch)) return 0;
  if (ch.pass_through || ch.split === 'custom') return 0;
  var w = num(u.weight == null ? 1 : u.weight);
  if (ch.split === 'weight') return round(num(ch.amount) * w, ch.cur);
  if (ch.split === 'total') return inSplit(u, ch) ? round(num(ch.amount) * w / weightSum(cyc, ch), ch.cur) : 0;
  return num(ch.amount);
}
function chargesOf(cycleId) {
  return S.charges.filter(function(c) { return c.cycle_id === cycleId; }).sort(function(a, b) {
    var ko = { fixed: 0, due: 1, service: 2 };
    return (ko[a.kind] - ko[b.kind]) || ((a.sort || 0) - (b.sort || 0)) || String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
}
/* " (120 kWh)" after a kWh-priced charge for one apartment */
function kwhNote(ch, u) { var k = ch && ch.meter && u && ch.meter.kwh ? ch.meter.kwh[u.id] : null; return k != null ? ' (' + k + ' kWh)' : ''; }
function chargeTotal(ch) { return activeUnits().reduce(function(s, u) { return s + dueFor(ch, u); }, 0); }

function livePayments() { return S.payments.filter(function(p) { return !p.voided_at; }); }
function liveExpenses() { return S.expenses.filter(function(e) { return !e.voided_at; }); }

/* Index payments by charge+unit once per render pass. */
var _payIdx = null, _payIdxKey = '';
function payIndex() {
  var key = S.payments.length + ':' + (S.payments.length ? S.payments[S.payments.length - 1].id : '') + ':' + S._rev;
  if (_payIdx && _payIdxKey === key) return _payIdx;
  _payIdx = {};
  livePayments().forEach(function(p) {
    var k = p.charge_id + '|' + p.unit_id;
    (_payIdx[k] = _payIdx[k] || []).push(p);
  });
  _payIdxKey = key;
  return _payIdx;
}
function paymentsFor(chId, uId) { return payIndex()[chId + '|' + uId] || []; }
function paidFor(ch, u) { return paymentsFor(ch.id, u.id).reduce(function(s, p) { return s + num(p.amount); }, 0); }

/* One cell: what is due, what came in, and where the money is now. */
function cell(ch, u) {
  var due = dueFor(ch, u);
  var ps = paymentsFor(ch.id, u.id);
  var paid = ps.reduce(function(s, p) { return s + num(p.amount); }, 0);
  var left = round(Math.max(0, due - paid), ch.cur);
  var st = due <= 0 && paid <= 0 ? 'none' : (tiny(left, ch.cur) ? 'paid' : (paid > 0 ? 'part' : 'owes'));
  var pocket = ps.some(function(p) { return p.channel === 'collector' && !handoverConfirmed(p.handover_id); });
  return { due: due, paid: paid, left: tiny(left, ch.cur) ? 0 : left, state: st, pocket: pocket && st === 'paid', payments: ps };
}

function handoverConfirmed(hid) {
  if (!hid) return false;
  var h = byId(S.handovers, hid);
  return !!h && h.status === 'confirmed';
}

/* ---------------------------------------------------------------------------
   Cycles
   --------------------------------------------------------------------------- */
function visibleCycles() {
  // Draft months stay on the manager's phone until they are shown to residents.
  return S.cycles.filter(function(c) { return c.published !== false || isManager(); }).sort(function(a, b) {
    var ka = a.kind === 'month' ? (a.period || '') : String(a.created_at || '').slice(0, 7);
    var kb = b.kind === 'month' ? (b.period || '') : String(b.created_at || '').slice(0, 7);
    if (ka !== kb) return ka < kb ? 1 : -1;
    return a.kind === 'month' ? -1 : 1;
  });
}
function monthCycles() { return visibleCycles().filter(function(c) { return c.kind === 'month'; }); }
function latestMonth() {
  var cp = currentPeriod(), ms = monthCycles();
  for (var i = 0; i < ms.length; i++) if (ms[i].period <= cp) return ms[i];
  return ms[ms.length - 1] || null;
}
function cycleOrderKey(c) { return c.kind === 'month' ? (c.period || '') : String(c.created_at || '').slice(0, 7); }

/* Month summary: building money only (supplier pass-through is reported apart). */
function cycleSummary(cyc) {
  var s = { due: pair(), paid: pair(), pocket: pair(), dueEq: 0, paidEq: 0, pocketEq: 0, units: 0, settled: 0, owing: [],
            supDue: pair(), supPaid: pair(), pct: 0 };
  if (!cyc) return s;
  var chs = chargesOf(cyc.id);
  activeUnits().forEach(function(u) {
    var any = false, owes = false, owed = pair();
    chs.forEach(function(ch) {
      var c = cell(ch, u);
      if (c.due <= 0) return;
      if (ch.pass_through) { addTo(s.supDue, ch.cur, c.due); addTo(s.supPaid, ch.cur, Math.min(c.paid, c.due)); return; }
      any = true;
      addTo(s.due, ch.cur, c.due);
      var got = Math.min(c.paid, c.due);
      addTo(s.paid, ch.cur, got);
      if (c.pocket) addTo(s.pocket, ch.cur, got);
      if (c.left > 0) { owes = true; addTo(owed, ch.cur, c.left); }
    });
    if (any) { s.units++; if (!owes) s.settled++; else s.owing.push({ unit: u, owed: owed }); }
  });
  s.dueEq = pairUsd(s.due); s.paidEq = pairUsd(s.paid); s.pocketEq = pairUsd(s.pocket);
  s.pct = s.dueEq > 0 ? Math.round(s.paidEq / s.dueEq * 100) : 0;
  return s;
}

/* Per apartment, this cycle: status for the windows and the cards. */
function unitCycle(u, cyc) {
  var r = { due: pair(), paid: pair(), left: pair(), any: false, state: 'none', cells: [] };
  if (!cyc) return r;
  chargesOf(cyc.id).forEach(function(ch) {
    var c = cell(ch, u);
    if (c.due <= 0 && c.paid <= 0) return;
    r.cells.push({ ch: ch, c: c });
    if (ch.pass_through) return;
    r.any = true;
    addTo(r.due, ch.cur, c.due); addTo(r.paid, ch.cur, Math.min(c.paid, c.due)); addTo(r.left, ch.cur, c.left);
  });
  var allLeft = pair();
  r.cells.forEach(function(x) { addTo(allLeft, x.ch.cur, x.c.left); });
  r.allLeft = allLeft;
  var leftEq = pairUsd(r.left), paidEq = pairUsd(r.paid);
  r.state = !r.any ? (pairUsd(allLeft) > 0 ? 'owes' : 'none') : (leftEq < 0.005 ? 'paid' : (paidEq > 0 ? 'part' : 'owes'));
  return r;
}

/* Running balance across every published cycle; arrears = what's left from cycles before `cyc`. */
function unitBalance(u, cyc) {
  var r = { owed: pair(), arrears: pair(), credit: pair() };
  var curKey = cyc ? cycleOrderKey(cyc) : '9999';
  S.cycles.forEach(function(c) {
    if (c.published === false) return;
    var earlier = cyc && c.id !== cyc.id && cycleOrderKey(c) < curKey && c.kind === 'month';
    chargesOf(c.id).forEach(function(ch) {
      var x = cell(ch, u);
      if (x.left > 0) { addTo(r.owed, ch.cur, x.left); if (earlier) addTo(r.arrears, ch.cur, x.left); }
      if (x.paid > x.due) addTo(r.credit, ch.cur, x.paid - x.due);
    });
  });
  return r;
}
function totalArrears(cyc) {
  var tot = pair(), n = 0;
  activeUnits().forEach(function(u) {
    var b = unitBalance(u, cyc);
    if (pairUsd(b.arrears) > 0.005) { n++; addTo(tot, 'USD', b.arrears.USD); addTo(tot, 'LBP', b.arrears.LBP); }
  });
  return { total: tot, units: n };
}

/* ---------------------------------------------------------------------------
   Where the cash is: in the safe, with each collector, owed to suppliers
   --------------------------------------------------------------------------- */
function cashState() {
  var safe = { USD: num(setting('opening_usd')), LBP: num(setting('opening_lbp')) };
  var pockets = {}; // user_id -> {USD, LBP, pending: pair, pendingId}
  var supplier = pair();
  function pk(uid) { return pockets[uid] = pockets[uid] || { USD: 0, LBP: 0, pending: pair(), pendingId: null }; }
  var passIds = {};
  S.charges.forEach(function(c) { if (c.pass_through) passIds[c.id] = true; });

  livePayments().forEach(function(p) {
    var v = num(p.amount);
    if (passIds[p.charge_id]) addTo(supplier, p.cur, v);
    if (p.channel !== 'collector' || handoverConfirmed(p.handover_id)) { addTo(safe, p.cur, v); return; }
    var pocket = pk(p.received_by || 'unknown');
    addTo(pocket, p.cur, v);
    if (p.handover_id) { addTo(pocket.pending, p.cur, v); pocket.pendingId = p.handover_id; }
  });
  liveExpenses().forEach(function(e) {
    var v = num(e.amount);
    if (e.charge_id && passIds[e.charge_id]) addTo(supplier, e.cur, -v);
    if (e.paid_from !== 'collector' || handoverConfirmed(e.handover_id)) { addTo(safe, e.cur, -v); return; }
    var pocket = pk(e.paid_by || 'unknown');
    addTo(pocket, e.cur, -v);
    if (e.handover_id) { addTo(pocket.pending, e.cur, -v); pocket.pendingId = e.handover_id; }
  });
  var withCol = pair();
  Object.keys(pockets).forEach(function(k) { addTo(withCol, 'USD', pockets[k].USD); addTo(withCol, 'LBP', pockets[k].LBP); });
  var pending = S.handovers.filter(function(h) { return h.status === 'pending'; });
  return { safe: safe, pockets: pockets, withCollector: withCol, supplier: supplier, pending: pending,
           building: { USD: safe.USD + withCol.USD - Math.max(0, supplier.USD), LBP: safe.LBP + withCol.LBP - Math.max(0, supplier.LBP) } };
}

/* Money collected inside a cycle (all channels), for the "collected" tile. */
function collectedIn(cyc) {
  var p = pair();
  if (!cyc) return p;
  var ids = {};
  chargesOf(cyc.id).forEach(function(c) { if (!c.pass_through) ids[c.id] = true; });
  livePayments().forEach(function(x) { if (ids[x.charge_id]) addTo(p, x.cur, num(x.amount)); });
  return p;
}
function spentIn(cyc) {
  var p = pair();
  liveExpenses().forEach(function(e) { if (cyc && e.cycle_id === cyc.id && !e.charge_id) addTo(p, e.cur, num(e.amount)); });
  return p;
}

/* ---------------------------------------------------------------------------
   People
   --------------------------------------------------------------------------- */
function member(uid) { for (var i = 0; i < S.members.length; i++) if (S.members[i].user_id === uid) return S.members[i]; return null; }
function mName(m, lang) {
  if (!m) return '';
  return ((lang || LANG) === 'ar' ? (m.display_name_ar || m.display_name) : (m.display_name || m.display_name_ar)) || '';
}
function memberName(uid, lang) {
  var m = member(uid);
  if (m && mName(m, lang)) return mName(m, lang);
  return t('Someone', 'أحدهم');
}
function collectors() { return S.members.filter(function(m) { return m.role === 'collector'; }); }
function isManager() { return S.role === 'manager' || S.role === 'comanager'; }
function collectorLabel(lang) {
  var c = collectors()[0];
  if (c && mName(c, lang)) return mName(c, lang);
  if ((lang || LANG) === 'ar' && setting('collector_name_ar')) return setting('collector_name_ar');
  return setting('collector_name') || ((lang || LANG) === 'ar' ? 'الجابي' : 'the collector');
}
function roleLabel(r) {
  return { manager: t('Manager', 'المدير'), comanager: t('Co-manager', 'مدير مساعد'), collector: t('Collector', 'الجابي') }[r] || r;
}

/* ---------------------------------------------------------------------------
   Tasks: repeating tasks roll forward when ticked
   --------------------------------------------------------------------------- */
var REPEATS = {
  none: ['Once', 'مرة واحدة'], daily: ['Every day', 'كل يوم'], weekly: ['Every week', 'كل أسبوع'], monthly: ['Every month', 'كل شهر'],
  quarterly: ['Every 3 months', 'كل 3 أشهر'], halfyear: ['Every 6 months', 'كل 6 أشهر'], yearly: ['Every year', 'كل سنة']
};
function rollDate(iso, rep) {
  var d = new Date((iso || todayIso()) + 'T12:00:00');
  if (rep === 'daily') { var td = new Date(todayIso() + 'T12:00:00'); if (d < td) d = td; d.setDate(d.getDate() + 1); }
  else if (rep === 'weekly') d.setDate(d.getDate() + 7);
  else if (rep === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (rep === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (rep === 'halfyear') d.setMonth(d.getMonth() + 6);
  else if (rep === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function openTasks(forRole) {
  return S.tasks.filter(function(x) { return !x.done_at && (!forRole || x.assignee === forRole); })
    .sort(function(a, b) { return String(a.due_on || '9').localeCompare(String(b.due_on || '9')); });
}

/* ---------------------------------------------------------------------------
   Expense categories
   --------------------------------------------------------------------------- */
var CATS = {
  gen: ['⚡', 'Generator & fuel', 'المولد والمازوت'], elev: ['🛗', 'Elevator', 'المصعد'], water: ['💧', 'Water', 'المياه'],
  clean: ['🧹', 'Cleaning', 'التنظيف'], light: ['💡', 'Lighting', 'الإنارة'], repair: ['🔧', 'Repairs', 'تصليحات'],
  staff: ['🧑‍🔧', 'Staff pay', 'أجور'], supplier: ['↗', 'Supplier', 'مورّد'], other: ['🧾', 'Other', 'أخرى']
};
function catIcon(k) { return (CATS[k] || CATS.other)[0]; }
function catName(k) { var c = CATS[k] || CATS.other; return LANG === 'ar' ? c[2] : c[1]; }

/* ---------------------------------------------------------------------------
   Which floor an apartment is on, read from its code:
   SS1A / SS2 / -1 → underground, G / GF / 0 → ground, 2B / 12 / 201 → that floor.
   --------------------------------------------------------------------------- */
function unitLevel(code) {
  var c = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  var m;
  if ((m = c.match(/^SS(\d*)/))) return -(Number(m[1]) || 1);
  if ((m = c.match(/^-(\d+)/))) return -Number(m[1]);
  if (/^(G|RDC|0)/.test(c)) return 0;
  if ((m = c.match(/^(\d+)/))) { var v = Number(m[1]); return m[1].length >= 3 ? Math.floor(v / 100) : v; }
  return null;
}
/* Group scene windows into floors. items: [{code, win}]. Returns null when codes don't say. */
function levelsFor(items) {
  var known = items.filter(function(x) { return unitLevel(x.code) != null; });
  if (!items.length || known.length < items.length / 2) return null;
  var by = {};
  items.forEach(function(x) {
    var lv = unitLevel(x.code);
    if (lv == null) lv = 1;
    (by[lv] = by[lv] || []).push(x);
  });
  return Object.keys(by).map(function(k) {
    var row = by[k].sort(function(a, b) { return String(a.code).localeCompare(String(b.code), 'en', { numeric: true }); });
    // more than 6 on one floor: split into extra rows above so nothing is hidden
    return { lv: Number(k), wins: row.map(function(x) { return x.win; }) };
  }).reduce(function(out, r) {
    if (r.wins.length <= 6) { out.push(r); return out; }
    for (var i = 0; i < r.wins.length; i += 6) out.push({ lv: r.lv + i / 600, wins: r.wins.slice(i, i + 6) });
    return out;
  }, []);
}

