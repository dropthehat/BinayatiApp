/* ============================================================================
   Laptop dashboard for managers: wide tables, the year at a glance, and
   reports you can print to PDF or download for Excel. Opens by itself on a
   wide screen; "Phone view" switches back. Uses the same data and sheets.
   ============================================================================ */
var DESK = { page: 'overview', cyc: null, from: '', to: '', kind: 'all', q: '' };
function deskWanted() {
  var pref = null; try { pref = localStorage.getItem('binayati-desk'); } catch (e) {}
  if (pref === 'off') return false;
  if (pref === 'on') return true;
  return window.innerWidth >= 1000;
}
function setDesk(on) { try { localStorage.setItem('binayati-desk', on ? 'on' : 'off'); } catch (e) {} render(); window.scrollTo(0, 0); }
function deskActive() { return UI.screen === 'app' && isManager() && can('books') && feature('desk_dashboard') && deskWanted(); }
function deskGo(p) { DESK.page = p; UI.sheet = null; render(); window.scrollTo(0, 0); }

function renderDesk() {
  var pages = [['overview', '📊', t('Overview', 'نظرة عامة')], ['collect', '✓', t('Collections', 'التحصيل')], ['books', '📒', t('Money in & out', 'المقبوض والمدفوع')],
               ['arrears', '⏳', t('Arrears', 'المتأخرات')], ['reports', '🖨', t('Reports', 'التقارير')], ['contacts', '📇', t('Contacts', 'جهات الاتصال')]];
  var h = supportBanner() + '<div class="desk"><aside class="desk-side">';
  h += '<button class="desk-brand" onclick="openSheet(\'menu\')"><span class="logo">' + esc((bName() || 'B').charAt(0).toUpperCase()) + '</span><span><b>' + esc(bName()) + '</b><small>' + esc(roleLabel(S.role)) + '</small></span></button>';
  pages.forEach(function(p) { h += '<button class="desk-nav' + (DESK.page === p[0] ? ' on' : '') + '" onclick="deskGo(\'' + p[0] + '\')"><span>' + p[1] + '</span>' + esc(p[2]) + '</button>'; });
  if (blocks().length > 1) {
    h += '<div class="desk-sub">' + esc(t('Block', 'البلوك')) + '</div><select class="input" onchange="UI.block=this.value||null;render()"><option value="">' + esc(t('All blocks', 'كل البلوكات')) + '</option>' + blocks().map(function(b) { return '<option value="' + esc(b) + '"' + (UI.block === b ? ' selected' : '') + '>' + esc(blockLabel(b)) + '</option>'; }).join('') + '</select>';
  }
  h += '<div class="grow"></div>';
  if (IS_ADMIN && !S.support) h += '<button class="desk-nav" onclick="openAdmin()"><span>🛠</span>Natour admin</button>';
  h += '<button class="desk-nav" onclick="setLang()"><span>ع</span>' + (LANG === 'ar' ? 'English' : 'العربية') + '</button>';
  h += '<button class="desk-nav" onclick="setDesk(false)"><span>📱</span>' + esc(t('Phone view', 'عرض الهاتف')) + '</button>';
  h += '</aside><main class="desk-main">';
  if (DESK.page === 'collect') h += deskCollect();
  else if (DESK.page === 'books') h += deskBooks();
  else if (DESK.page === 'arrears') h += deskArrears();
  else if (DESK.page === 'reports') h += deskReports();
  else if (DESK.page === 'contacts') h += renderContactsSec();
  else h += deskOverview();
  return h + '</main></div>';
}
function deskUnits() { return activeUnits().filter(function(u) { return !UI.block || blockOf(u) === UI.block; }); }
function deskCycle() {
  var c = DESK.cyc && byId(S.cycles, DESK.cyc);
  return c || latestMonth() || visibleCycles()[0] || null;
}
function deskCyclePick(onchange) {
  var cur = deskCycle();
  return '<select class="input desk-pick" onchange="DESK.cyc=this.value;' + (onchange || '') + 'render()">' + visibleCycles().map(function(c) { return '<option value="' + esc(c.id) + '"' + (cur && c.id === cur.id ? ' selected' : '') + '>' + esc(cycleTitle(c)) + '</option>'; }).join('') + '</select>';
}
function deskHead(title, right) { return '<div class="desk-head"><h1>' + esc(title) + '</h1><div class="desk-acts">' + (right || '') + '</div></div>'; }
function eq(p) { return pairUsd(p); }
function money(v) { return fmt(Math.round(v * 100) / 100, 'USD'); }

/* ---------- Overview ---------- */
function deskOverview() {
  var cyc = deskCycle(), s = cycleSummary(cyc), cash = cashState(UI.block || null), arr = totalArrears(cyc);
  var spent = pair(); liveExpenses().forEach(function(e) { if (cyc && e.cycle_id === cyc.id) addTo(spent, e.cur, num(e.amount)); });
  var h = deskHead(t('Overview', 'نظرة عامة'), deskCyclePick());
  h += '<div class="desk-tiles">';
  h += deskTile(t('Collected', 'المحصّل'), fmtPair(s.paid), s.pct + '% ' + t('of ', 'من ') + fmtPair(s.due));
  h += deskTile(t('In the safe', 'في الصندوق'), fmtPair(cash.safe), t('Cash the building holds', 'نقد البناية'));
  h += deskTile(t('With collectors', 'مع الجباة'), fmtPair(cash.withCollector || pair()), t('Not handed over yet', 'لم يُسلّم بعد'));
  h += deskTile(t('Spent this month', 'المصروف هذا الشهر'), fmtPair(spent), '');
  h += deskTile(t('Arrears', 'المتأخرات'), fmtPair(arr.total || arr), (arr.units || 0) + t(' apartments', ' شقق'));
  h += '</div>';
  // the year: collected vs spent per month
  var months = monthCycles().slice(0, 12).reverse();
  if (months.length) {
    var rows = months.map(function(c) {
      var cs = cycleSummary(c), sp = pair();
      liveExpenses().forEach(function(e) { if (e.cycle_id === c.id) addTo(sp, e.cur, num(e.amount)); });
      return { c: c, due: cs.dueEq, got: cs.paidEq, spent: eq(sp) };
    });
    var max = Math.max.apply(null, rows.map(function(r) { return Math.max(r.due, r.got, r.spent); }).concat([1]));
    h += '<section class="desk-card"><h2>' + esc(t('Month by month (in $)', 'شهراً بشهر (بالدولار)')) + '</h2><div class="desk-chart">';
    rows.forEach(function(r) {
      h += '<div class="dc-col" title="' + esc(cycleTitle(r.c) + ': ' + t('collected ', 'محصّل ') + money(r.got) + ' / ' + money(r.due) + ' · ' + t('spent ', 'مصروف ') + money(r.spent)) + '"><div class="dc-bars"><i class="due" style="height:' + (r.due / max * 100) + '%"></i><i class="got" style="height:' + (r.got / max * 100) + '%"></i><i class="out" style="height:' + (r.spent / max * 100) + '%"></i></div><small>' + esc(cycleTitle(r.c).replace(/\s*\d{4}$/, '').slice(0, 3)) + '</small></div>';
    });
    h += '</div><div class="dc-legend"><span><i class="due"></i>' + esc(t('Due', 'المستحق')) + '</span><span><i class="got"></i>' + esc(t('Collected', 'المحصّل')) + '</span><span><i class="out"></i>' + esc(t('Spent', 'المصروف')) + '</span></div></section>';
  }
  // who still owes
  var owe = deskUnits().map(function(u) { var r = unitCycle(u, cyc), b = unitBalance(u, cyc); return { u: u, now: r.left, arr: b.arrears, tot: eq(r.left) + eq(b.arrears) }; }).filter(function(x) { return x.tot > 0.005; }).sort(function(a, b) { return b.tot - a.tot; });
  h += '<section class="desk-card"><h2>' + esc(t('Still owe', 'لم يسددوا')) + ' · ' + owe.length + '</h2>';
  h += owe.length ? deskTable([t('Apartment', 'الشقة'), t('Name', 'الاسم'), t('This month', 'هذا الشهر'), t('Earlier months', 'أشهر سابقة'), ''], owe.slice(0, 15).map(function(x) {
    return [unitTag(x.u), unitName(x.u) || '—', fmtPair(x.now), fmtPair(x.arr), '<button class="btn ghost sm" onclick="openSheet(\'unit\',{id:' + jsArg(x.u.id) + '})">' + esc(t('Open', 'افتح')) + '</button>'];
  }), [2, 3]) : '<p class="muted">' + esc(t('Everyone has paid.', 'الجميع سدّد.')) + '</p>';
  return h + '</section>';
}
function deskTile(k, v, sub) { return '<div class="desk-tile"><small>' + esc(k) + '</small><b>' + esc(v) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>'; }
/* html table; cells are trusted html when they start with '<', otherwise escaped */
function deskTable(head, rows, numCols, foot) {
  numCols = numCols || [];
  var cell = function(v, i, tag) { var s = v == null ? '' : String(v); return '<' + tag + (numCols.indexOf(i) >= 0 ? ' class="num"' : '') + '>' + (s.charAt(0) === '<' ? s : esc(s)) + '</' + tag + '>'; };
  var h = '<div class="desk-tw"><table class="desk-t"><thead><tr>' + head.map(function(x, i) { return cell(x, i, 'th'); }).join('') + '</tr></thead><tbody>';
  rows.forEach(function(r) { h += '<tr>' + r.map(function(x, i) { return cell(x, i, 'td'); }).join('') + '</tr>'; });
  h += '</tbody>';
  if (foot) h += '<tfoot><tr>' + foot.map(function(x, i) { return cell(x, i, 'td'); }).join('') + '</tr></tfoot>';
  return h + '</table></div>';
}

/* ---------- Collections: apartments × charges ---------- */
function deskCollectData() {
  var cyc = deskCycle(), chs = cyc ? chargesOf(cyc.id) : [], units = deskUnits();
  var head = [t('Apartment', 'الشقة'), t('Name', 'الاسم')].concat(chs.map(function(c) { return L(c) + ' (' + c.cur + ')'; })).concat([t('Left', 'المتبقي')]);
  var tot = chs.map(function() { return { due: 0, paid: 0 }; });
  var rows = units.map(function(u) {
    var r = unitCycle(u, cyc);
    return { u: u, cells: chs.map(function(ch, i) { var c = cell(ch, u); tot[i].due += c.due; tot[i].paid += Math.min(c.paid, c.due); return { ch: ch, c: c }; }), left: r.allLeft || r.left };
  });
  return { cyc: cyc, chs: chs, head: head, rows: rows, tot: tot };
}
function deskCollect() {
  var D = deskCollectData();
  var h = deskHead(t('Collections', 'التحصيل'), deskCyclePick() + '<button class="btn sec sm" onclick="csvCollect()">⬇ Excel (CSV)</button><button class="btn sec sm" onclick="window.print()">🖨 ' + esc(t('Print / PDF', 'طباعة / PDF')) + '</button>');
  if (!D.chs.length) return h + '<div class="desk-card muted">' + esc(t('No charges this month.', 'لا رسوم هذا الشهر.')) + '</div>';
  var rows = D.rows.map(function(r) {
    return [unitTag(r.u), unitName(r.u) || '—'].concat(r.cells.map(function(x) {
      if (x.c.due <= 0 && x.c.paid <= 0) return '<span class="muted">—</span>';
      var st = x.c.state === 'paid' ? 'ok' : x.c.paid > 0 ? 'part' : 'due';
      return '<button class="dcell ' + st + '" onclick="openSheet(\'cell\',{ch:' + jsArg(x.ch.id) + ',u:' + jsArg(r.u.id) + '})">' + esc(fmt(x.c.paid, x.ch.cur)) + (st !== 'ok' ? '<small>/ ' + esc(fmt(x.c.due, x.ch.cur)) + '</small>' : ' ✓') + '</button>';
    })).concat([fmtPair(r.left)]);
  });
  var foot = [t('Total', 'المجموع'), ''].concat(D.tot.map(function(x, i) { return fmt(x.paid, D.chs[i].cur) + ' / ' + fmt(x.due, D.chs[i].cur); })).concat(['']);
  h += '<section class="desk-card">' + deskTable(D.head, rows, D.chs.map(function(_, i) { return i + 2; }).concat([D.chs.length + 2]), foot) + '<p class="hint">' + esc(t('Click a cell to record or undo a payment.', 'اضغط خانة لتسجيل دفعة أو إلغائها.')) + '</p></section>';
  return h;
}

/* ---------- Money in & out (ledger) ---------- */
function deskLedger() {
  var from = DESK.from || '', to = DESK.to || '', q = (DESK.q || '').toLowerCase(), rows = [];
  var inBlock = function(uid) { if (!UI.block) return true; var u = byId(S.units, uid); return u && blockOf(u) === UI.block; };
  if (DESK.kind !== 'out') livePayments().forEach(function(p) {
    var u = byId(S.units, p.unit_id), ch = byId(S.charges, p.charge_id), d = dayKey(p.received_at);
    if (!inBlock(p.unit_id)) return;
    rows.push({ d: d, type: 'in', what: (ch ? L(ch) : '') , who: u ? unitTag(u) + (unitName(u) ? ' · ' + unitName(u) : '') : '', how: p.channel === 'transfer' ? payMethodLabel(p.method || 'Whish') : p.channel === 'collector' ? t('Cash · ', 'نقداً · ') + memberName(p.received_by) : t('Cash', 'نقداً'), amt: num(p.amount), cur: p.cur });
  });
  if (DESK.kind !== 'in') liveExpenses().forEach(function(e) {
    if (UI.block && e.block && e.block !== UI.block) return;
    rows.push({ d: e.spent_on, type: 'out', what: L(e) || e.title, who: catName(e.cat), how: e.paid_from === 'collector' ? memberName(e.paid_by) : t('The safe', 'الصندوق'), amt: num(e.amount), cur: e.cur, ref: e.ref });
  });
  return rows.filter(function(r) { return (!from || r.d >= from) && (!to || r.d <= to) && (!q || (r.what + ' ' + r.who + ' ' + r.how + ' ' + (r.ref || '')).toLowerCase().indexOf(q) >= 0); })
    .sort(function(a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
}
function deskBooks() {
  var rows = deskLedger(), tin = pair(), tout = pair();
  rows.forEach(function(r) { addTo(r.type === 'in' ? tin : tout, r.cur, r.amt); });
  var h = deskHead(t('Money in & out', 'المقبوض والمدفوع'), '<button class="btn sec sm" onclick="csvLedger()">⬇ Excel (CSV)</button><button class="btn sec sm" onclick="window.print()">🖨 ' + esc(t('Print / PDF', 'طباعة / PDF')) + '</button>');
  h += '<div class="desk-filters"><input class="input" type="date" value="' + esc(DESK.from) + '" onchange="DESK.from=this.value;render()"><span>→</span><input class="input" type="date" value="' + esc(DESK.to) + '" onchange="DESK.to=this.value;render()">';
  h += '<div class="seg">' + [['all', t('All', 'الكل')], ['in', t('In', 'مقبوض')], ['out', t('Out', 'مدفوع')]].map(function(x) { return '<button class="' + (DESK.kind === x[0] ? 'on' : '') + '" onclick="DESK.kind=\'' + x[0] + '\';render()">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
  h += '<input class="input" placeholder="' + esc(t('Search', 'بحث')) + '" value="' + esc(DESK.q) + '" onchange="DESK.q=this.value;render()"></div>';
  h += '<div class="desk-tiles"><div class="desk-tile"><small>' + esc(t('In', 'مقبوض')) + '</small><b class="in">' + esc(fmtPair(tin)) + '</b></div><div class="desk-tile"><small>' + esc(t('Out', 'مدفوع')) + '</small><b class="out">' + esc(fmtPair(tout)) + '</b></div><div class="desk-tile"><small>' + esc(t('Net', 'الصافي')) + '</small><b>' + esc(fmtPair({ USD: tin.USD - tout.USD, LBP: tin.LBP - tout.LBP })) + '</b></div><div class="desk-tile"><small>' + esc(t('Lines', 'القيود')) + '</small><b>' + rows.length + '</b></div></div>';
  h += '<section class="desk-card">' + deskTable([t('Date', 'التاريخ'), t('What', 'البيان'), t('Who / category', 'من / الفئة'), t('How', 'الطريقة'), t('In', 'مقبوض'), t('Out', 'مدفوع')],
    rows.slice(0, 500).map(function(r) { return [dateLabel(r.d), r.what, r.who, r.how, r.type === 'in' ? fmt(r.amt, r.cur) : '', r.type === 'out' ? fmt(r.amt, r.cur) : '']; }), [4, 5]);
  if (rows.length > 500) h += '<p class="hint">' + esc(t('Showing the latest 500. The download has all of them.', 'تُعرض آخر 500. التنزيل يحوي الكل.')) + '</p>';
  return h + '</section>';
}

/* ---------- Arrears ---------- */
function deskArrearsData() {
  return deskUnits().map(function(u) {
    var per = [];
    S.cycles.filter(function(c) { return c.published !== false; }).sort(function(a, b) { return cycleOrderKey(a) < cycleOrderKey(b) ? -1 : 1; }).forEach(function(c) {
      var left = pair(); chargesOf(c.id).forEach(function(ch) { var x = cell(ch, u); if (x.left > 0 && !ch.pass_through) addTo(left, ch.cur, x.left); });
      if (eq(left) > 0.005) per.push({ c: c, left: left });
    });
    var tot = pair(); per.forEach(function(x) { addTo(tot, 'USD', x.left.USD); addTo(tot, 'LBP', x.left.LBP); });
    return { u: u, per: per, tot: tot };
  }).filter(function(x) { return x.per.length; }).sort(function(a, b) { return eq(b.tot) - eq(a.tot); });
}
function deskArrears() {
  var rows = deskArrearsData(), all = pair(); rows.forEach(function(r) { addTo(all, 'USD', r.tot.USD); addTo(all, 'LBP', r.tot.LBP); });
  var h = deskHead(t('Arrears', 'المتأخرات'), '<button class="btn sec sm" onclick="csvArrears()">⬇ Excel (CSV)</button><button class="btn sec sm" onclick="window.print()">🖨 ' + esc(t('Print / PDF', 'طباعة / PDF')) + '</button>');
  h += '<div class="desk-tiles"><div class="desk-tile"><small>' + esc(t('Total owed', 'مجموع المستحق')) + '</small><b class="out">' + esc(fmtPair(all)) + '</b></div><div class="desk-tile"><small>' + esc(t('Apartments', 'الشقق')) + '</small><b>' + rows.length + '</b></div></div>';
  h += '<section class="desk-card">' + (rows.length ? deskTable([t('Apartment', 'الشقة'), t('Name', 'الاسم'), t('Months', 'الأشهر'), t('Owes', 'عليه'), ''], rows.map(function(r) {
    return [unitTag(r.u), unitName(r.u) || '—', r.per.map(function(x) { return cycleTitle(x.c) + ': ' + fmtPair(x.left); }).join(' · '), fmtPair(r.tot),
            '<button class="btn wa sm" onclick="openSheet(\'remind\',{u:' + jsArg(r.u.id) + ',cyc:' + jsArg((deskCycle() || {}).id) + '})">WhatsApp</button>'];
  }), [3]) : '<p class="muted">' + esc(t('Nobody owes anything. 🎉', 'لا أحد عليه شيء. 🎉')) + '</p>');
  return h + '</section>';
}

/* ---------- Reports ---------- */
function deskReports() {
  var cyc = deskCycle();
  var h = deskHead(t('Reports', 'التقارير'), deskCyclePick() + '<button class="btn pri sm" onclick="window.print()">🖨 ' + esc(t('Print / Save as PDF', 'طباعة / حفظ PDF')) + '</button>');
  h += '<div class="desk-filters no-print"><button class="btn sec sm" onclick="csvStatement()">⬇ ' + esc(t('Statement (CSV)', 'الكشف (CSV)')) + '</button><button class="btn sec sm" onclick="csvYear()">⬇ ' + esc(t('Year (CSV)', 'السنة (CSV)')) + '</button><button class="btn sec sm" onclick="csvCollect()">⬇ ' + esc(t('Collections (CSV)', 'التحصيل (CSV)')) + '</button><button class="btn sec sm" onclick="csvLedger()">⬇ ' + esc(t('All money in & out (CSV)', 'كل المقبوض والمدفوع (CSV)')) + '</button><button class="btn sec sm" onclick="csvArrears()">⬇ ' + esc(t('Arrears (CSV)', 'المتأخرات (CSV)')) + '</button></div>';
  h += '<section class="desk-card report">' + statementHtml(cyc) + '</section>';
  h += '<section class="desk-card report">' + yearHtml() + '</section>';
  return h;
}
/* The month's statement: what was due, what came in, what went out, where the cash is. */
function statementData(cyc) {
  var s = cycleSummary(cyc), byCharge = [], byCat = {}, spent = pair();
  if (cyc) chargesOf(cyc.id).filter(function(ch) { return !ch.pass_through; }).forEach(function(ch) {
    var due = 0, got = 0; deskUnits().forEach(function(u) { var c = cell(ch, u); due += c.due; got += Math.min(c.paid, c.due); });
    byCharge.push({ ch: ch, due: due, got: got });
  });
  liveExpenses().forEach(function(e) {
    if (!cyc || e.cycle_id !== cyc.id) return;
    if (UI.block && e.block && e.block !== UI.block) return;
    var k = e.cat || 'other'; byCat[k] = byCat[k] || pair(); addTo(byCat[k], e.cur, num(e.amount)); addTo(spent, e.cur, num(e.amount));
  });
  return { s: s, byCharge: byCharge, byCat: byCat, spent: spent, cash: cashState(UI.block || null), arr: totalArrears(cyc) };
}
function statementHtml(cyc) {
  if (!cyc) return '<p class="muted">' + esc(t('No month yet.', 'لا شهر بعد.')) + '</p>';
  var D = statementData(cyc);
  var h = '<div class="rep-h"><div><h2>' + esc(t('Monthly statement', 'الكشف الشهري')) + ' · ' + esc(cycleTitle(cyc)) + '</h2><small>' + esc(bName() + (UI.block ? ' · ' + blockLabel(UI.block) : '') + ' · ' + t('printed ', 'طُبع ') + dateLabel(todayIso())) + '</small></div></div>';
  h += '<h3>' + esc(t('Money in', 'المقبوض')) + '</h3>' + deskTable([t('Charge', 'الرسم'), t('Due', 'المستحق'), t('Collected', 'المحصّل'), t('Left', 'المتبقي')],
    D.byCharge.map(function(x) { return [L(x.ch), fmt(x.due, x.ch.cur), fmt(x.got, x.ch.cur), fmt(Math.max(0, x.due - x.got), x.ch.cur)]; }), [1, 2, 3],
    [t('Total', 'المجموع'), fmtPair(D.s.due), fmtPair(D.s.paid), fmtPair({ USD: D.s.due.USD - D.s.paid.USD, LBP: D.s.due.LBP - D.s.paid.LBP })]);
  h += '<h3>' + esc(t('Money out', 'المدفوع')) + '</h3>' + (Object.keys(D.byCat).length ? deskTable([t('Category', 'الفئة'), t('Amount', 'المبلغ')],
    Object.keys(D.byCat).map(function(k) { return [catIcon(k) + ' ' + catName(k), fmtPair(D.byCat[k])]; }), [1], [t('Total', 'المجموع'), fmtPair(D.spent)]) : '<p class="muted">' + esc(t('Nothing spent this month.', 'لا مصاريف هذا الشهر.')) + '</p>');
  h += '<h3>' + esc(t('Where the money is now', 'أين المال الآن')) + '</h3>' + deskTable([t('', ''), t('Amount', 'المبلغ')], [
    [t('In the safe', 'في الصندوق'), fmtPair(D.cash.safe)], [t('With collectors (not handed over)', 'مع الجباة (لم يُسلّم)'), fmtPair(D.cash.withCollector || pair())],
    [t('Owed from earlier months', 'مستحق من أشهر سابقة'), fmtPair(D.arr.total || D.arr)]], [1]);
  return h;
}
function yearRows() {
  return monthCycles().slice(0, 12).reverse().map(function(c) {
    var cs = cycleSummary(c), sp = pair();
    liveExpenses().forEach(function(e) { if (e.cycle_id === c.id && (!UI.block || !e.block || e.block === UI.block)) addTo(sp, e.cur, num(e.amount)); });
    return { c: c, due: cs.due, got: cs.paid, spent: sp, pct: cs.pct };
  });
}
function yearHtml() {
  var rows = yearRows(), tg = pair(), ts = pair();
  rows.forEach(function(r) { addTo(tg, 'USD', r.got.USD); addTo(tg, 'LBP', r.got.LBP); addTo(ts, 'USD', r.spent.USD); addTo(ts, 'LBP', r.spent.LBP); });
  var h = '<div class="rep-h"><div><h2>' + esc(t('The year', 'السنة')) + '</h2><small>' + esc(t('Last 12 months', 'آخر 12 شهراً')) + '</small></div></div>';
  return h + deskTable([t('Month', 'الشهر'), t('Due', 'المستحق'), t('Collected', 'المحصّل'), '%', t('Spent', 'المصروف'), t('Net', 'الصافي')],
    rows.map(function(r) { return [cycleTitle(r.c), fmtPair(r.due), fmtPair(r.got), r.pct + '%', fmtPair(r.spent), fmtPair({ USD: r.got.USD - r.spent.USD, LBP: r.got.LBP - r.spent.LBP })]; }), [1, 2, 3, 4, 5],
    [t('Total', 'المجموع'), '', fmtPair(tg), '', fmtPair(ts), fmtPair({ USD: tg.USD - ts.USD, LBP: tg.LBP - ts.LBP })]);
}

/* ---------- CSV downloads (open in Excel, Numbers, Google Sheets) ---------- */
function csvDownload(name, rows) {
  var body = rows.map(function(r) { return r.map(function(v) { var s = v == null ? '' : String(v).replace(/[⁦-⁩]/g, ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','); }).join('\r\n');
  var blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (bName() + ' ' + name).replace(/[\\/:*?"<>|]+/g, '-') + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function csvCollect() {
  var D = deskCollectData();
  var rows = [[t('Apartment', 'الشقة'), t('Name', 'الاسم')].concat(D.chs.map(function(c) { return L(c) + ' due (' + c.cur + ')'; })).concat(D.chs.map(function(c) { return L(c) + ' paid (' + c.cur + ')'; }))];
  D.rows.forEach(function(r) { rows.push([unitTag(r.u), unitName(r.u) || ''].concat(r.cells.map(function(x) { return x.c.due; })).concat(r.cells.map(function(x) { return x.c.paid; }))); });
  csvDownload(t('collections ', 'التحصيل ') + (D.cyc ? cycleTitle(D.cyc) : ''), rows);
}
function csvLedger() {
  var rows = [['Date', 'Type', 'What', 'Who / category', 'How', 'Amount', 'Currency', 'Ref']];
  deskLedger().forEach(function(r) { rows.push([r.d, r.type === 'in' ? 'in' : 'out', r.what, r.who, r.how, r.type === 'in' ? r.amt : -r.amt, r.cur, r.ref || '']); });
  csvDownload(t('money in and out', 'المقبوض والمدفوع'), rows);
}
function csvArrears() {
  var rows = [['Apartment', 'Name', 'Month', 'USD', 'LBP']];
  deskArrearsData().forEach(function(r) { r.per.forEach(function(x) { rows.push([unitTag(r.u), unitName(r.u) || '', cycleTitle(x.c), x.left.USD, x.left.LBP]); }); });
  csvDownload(t('arrears', 'المتأخرات'), rows);
}
function csvStatement() {
  var cyc = deskCycle(); if (!cyc) return;
  var D = statementData(cyc), rows = [['Section', 'Item', 'Due', 'Collected / amount', 'Currency']];
  D.byCharge.forEach(function(x) { rows.push(['Money in', L(x.ch), x.due, x.got, x.ch.cur]); });
  Object.keys(D.byCat).forEach(function(k) { ['USD', 'LBP'].forEach(function(c) { if (D.byCat[k][c]) rows.push(['Money out', catName(k), '', D.byCat[k][c], c]); }); });
  ['USD', 'LBP'].forEach(function(c) { rows.push(['Now', 'In the safe', '', D.cash.safe[c] || 0, c]); rows.push(['Now', 'With collectors', '', (D.cash.withCollector || {})[c] || 0, c]); });
  csvDownload(t('statement ', 'كشف ') + cycleTitle(cyc), rows);
}
function csvYear() {
  var rows = [['Month', 'Due USD', 'Due LBP', 'Collected USD', 'Collected LBP', 'Spent USD', 'Spent LBP']];
  yearRows().forEach(function(r) { rows.push([cycleTitle(r.c), r.due.USD, r.due.LBP, r.got.USD, r.got.LBP, r.spent.USD, r.spent.LBP]); });
  csvDownload(t('year', 'السنة'), rows);
}
