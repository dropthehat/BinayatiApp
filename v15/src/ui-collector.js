/* ============================================================================
   Collector page (test build): two tabs. Dashboard has the quick numbers across
   every book; Collect is only names, amounts and ticks. A manager can preview it
   with writes switched off.
   ============================================================================ */
function colUI() { return testBuild() && !!S.building && !isManager(); }
function pvBlocked() { return new Error(t('Preview only: nothing is saved', 'معاينة فقط: لا يُحفظ شيء')); }
function startColPreview() { UI.pvCol = true; UI.sheet = null; UI.tab = 'home'; UI.cycleId = null; UI.cb = null; render(); window.scrollTo(0, 0); }
function stopColPreview() { UI.pvCol = false; UI.tab = 'home'; UI.cycleId = null; UI.cb = null; render(); window.scrollTo(0, 0); }
function colPreviewBar() {
  if (!UI.pvCol) return '';
  return '<div class="pvbar"><span>' + esc(t('Preview of the collector page. Ticks are off.', 'معاينة صفحة الجابي. التأشير معطّل.')) + '</span><button onclick="stopColPreview()">' + esc(t('Exit', 'خروج')) + '</button></div>';
}

/* What is still to collect in a book, across all its open bills. */
function bookLeft() {
  var left = pair(), bills = 0;
  visibleCycles().forEach(function(c) {
    var any = false;
    activeUnits().forEach(function(u) {
      chargesOf(c.id).forEach(function(ch) { var x = cell(ch, u); if (x.left > 0) { addTo(left, ch.cur, x.left); any = true; } });
    });
    if (any) bills++;
  });
  return { left: left, bills: bills };
}
function billLeft(c) {
  var n = 0;
  activeUnits().forEach(function(u) { if (chargesOf(c.id).some(function(ch) { return cell(ch, u).left > 0; })) n++; });
  return n;
}
function loadColBooks() {
  if (UI.cbLoading) return;
  UI.cbLoading = true;
  myBuildingList().then(function(list) {
    return Promise.all(list.map(function(b) {
      return buildingState(b.id).then(function(ns) {
        scopeToMyBlocks(ns);
        return withState(ns, function() {
          var cash = cashState(), mine = cash.pockets[ns.me.id] || pair();
          var pocket = UI.pvCol ? cash.withCollector : { USD: mine.USD || 0, LBP: mine.LBP || 0 };
          var due = openTasks('collector').filter(function(x) { return x.due_on && x.due_on <= todayIso(); });
          var pend = ns.handovers.filter(function(h) { return h.status === 'pending' && (UI.pvCol || h.collector_id === ns.me.id); }).length;
          return { b: b, pocket: pocket, left: bookLeft(), tasks: due, pending: pend };
        });
      });
    }));
  }).then(function(rows) { UI.cb = rows; UI.cbLoading = false; render(); }, function(e) { UI.cbLoading = false; UI.cb = []; fail(e); });
}
function colOpen(bid, then) {
  var go = function() { UI.cycleId = null; UI.screen = 'app'; then(); };
  if (S.building && S.building.id === bid) return go();
  openBuilding(bid).then(go, fail);
}
function colHand(bid) { colOpen(bid, function() { render(); openSheet('handreq'); }); }
function colCollect(bid) { colOpen(bid, function() { UI.tab = 'collect'; render(); window.scrollTo(0, 0); }); }

function renderColDash() {
  var h = colPreviewBar() + renderTopbar(t('Dashboard', 'لوحة المعلومات'));
  if (!UI.cb) { loadColBooks(); return h + '<div class="sec"><div class="card empty">' + esc(t('Loading…', 'جارٍ التحميل…')) + '</div></div>'; }
  var pocket = pair(), left = pair();
  UI.cb.forEach(function(r) { addTo(pocket, 'USD', r.pocket.USD); addTo(pocket, 'LBP', r.pocket.LBP); addTo(left, 'USD', r.left.left.USD); addTo(left, 'LBP', r.left.left.LBP); });
  h += '<div class="sec"><div class="tiles">';
  h += tile(t('In your pocket', 'معك الآن'), fmtPairBig(pocket), t('Across all books', 'من كل الحسابات'), '', 'var(--warn)');
  h += tile(t('Still to collect', 'باقي للتحصيل'), fmtPairBig(left), t('All open bills', 'كل الفواتير المفتوحة'), "go('collect')", 'var(--acc)');
  h += '</div></div>';
  h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Your books', 'حساباتك')) + '</h2></div><div class="stack">';
  UI.cb.forEach(function(r) {
    var has = pairUsd(r.pocket) > 0.005;
    h += '<div class="card pad"><div class="row between"><b style="font-size:16px">' + esc(LANG === 'ar' ? (r.b.name_ar || r.b.name) : r.b.name) + '</b>';
    if (r.left.bills) h += '<span class="status owes">' + esc(t(r.left.bills + ' open', r.left.bills + ' مفتوحة')) + '</span>'; else h += '<span class="status paid">' + esc(t('All collected', 'تم التحصيل')) + '</span>';
    h += '</div><div class="kv"><span>' + esc(t('In your pocket', 'معك الآن')) + '</span><b>' + esc(fmtPair(r.pocket)) + '</b></div>';
    h += '<div class="kv"><span>' + esc(t('Still to collect', 'باقي للتحصيل')) + '</span><b>' + esc(fmtPair(r.left.left)) + '</b></div>';
    h += '<div class="row" style="margin-top:10px;align-items:stretch"><button class="btn pri sm grow" onclick="colCollect(' + jsArg(r.b.id) + ')">' + esc(t('Collect', 'التحصيل')) + '</button>';
    if (r.pending) h += '<button class="btn sec sm grow" disabled>' + esc(t('Handover waiting', 'تسليم بالانتظار')) + '</button>';
    else if (has) h += '<button class="btn sec sm grow" onclick="colHand(' + jsArg(r.b.id) + ')">' + esc(t('Hand over', 'سلّم')) + '</button>';
    h += '</div></div>';
  });
  h += '</div></div>';
  var due = [];
  UI.cb.forEach(function(r) { r.tasks.forEach(function(x) { due.push(x); }); });
  if (due.length) h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Do today', 'اليوم')) + '</h2></div><div class="card">' + due.map(taskRow).join('') + '</div></div>';
  return h;
}

/* Collect: book, then bill, then names grouped by block. */
function colPickBook(bid) { colOpen(bid, function() { UI.tab = 'collect'; render(); }); }
function colBill() {
  var c = UI.cycleId && byId(S.cycles, UI.cycleId);
  if (c && visibleCycles().indexOf(c) >= 0) return c;
  var all = visibleCycles(), open = all.filter(function(x) { return billLeft(x) > 0; });
  c = open[0] || all[0] || null;
  UI.cycleId = c ? c.id : null;
  return c;
}
function colRow(u, c) {
  var chs = chargesOf(c.id).map(function(ch) { return { ch: ch, c: cell(ch, u) }; }).filter(function(x) { return x.c.due > 0 || x.c.paid > 0; });
  if (!chs.length) return '';
  var owes = chs.some(function(x) { return x.c.left > 0; });
  var h = '<div class="crow' + (owes ? '' : ' done') + '"><div class="ucode">' + esc(unitTag(u)) + '</div><div class="grow"><div class="uname">' + esc(unitName(u) || unitTag(u)) + '</div></div>';
  if (u.phone) h += '<button class="crow-wa" aria-label="WhatsApp" onclick="openSheet(\'remind\',{u:' + jsArg(u.id) + ',cyc:' + jsArg(c.id) + '})">📣</button>';
  h += '</div><div class="crow-ticks' + (owes ? '' : ' done') + '">';
  chs.forEach(function(x) {
    var st = x.c.state, on = st === 'paid';
    h += '<button class="ctick' + (on ? ' on' : st === 'part' ? ' part' : '') + '" aria-pressed="' + on + '" onclick="tapCell(' + jsArg(x.ch.id) + ',' + jsArg(u.id) + ')"><span class="ctick-box">' + (on ? '✓' : '') + '</span><span class="grow">' + esc(L(x.ch)) + '</span><b>' + esc(fmt(st === 'part' ? x.c.left : x.c.due, x.ch.cur)) + '</b></button>';
  });
  return h + '</div>';
}
function renderColCollect() {
  var h = colPreviewBar() + renderTopbar(t('Collect', 'التحصيل'));
  if (UI.cb && UI.cb.length > 1) {
    h += '<div class="chips" style="margin-top:6px">';
    UI.cb.forEach(function(r) { h += '<button class="chip' + (r.b.id === S.building.id ? ' on' : '') + '" onclick="colPickBook(' + jsArg(r.b.id) + ')">' + esc(LANG === 'ar' ? (r.b.name_ar || r.b.name) : r.b.name) + '</button>'; });
    h += '</div>';
  } else if (!UI.cb) loadColBooks();
  var c = colBill();
  if (!c) return h + '<div class="sec"><div class="card empty">' + esc(t('No bills here yet.', 'لا فواتير هنا بعد.')) + '</div></div>';
  h += '<div class="chips" style="margin-top:8px">';
  visibleCycles().forEach(function(x) {
    var n = billLeft(x);
    if (!n && x.id !== c.id && !UI.cAll) return;
    h += '<button class="chip' + (x.id === c.id ? ' on' : '') + '" onclick="UI.cycleId=' + jsArg(x.id) + ';render()">' + esc(cycleTitle(x)) + (n ? ' <span class="cnt">' + n + '</span>' : ' ✓') + '</button>';
  });
  h += '</div>';
  var due = pair(), paid = pair(), n = 0, np = 0;
  activeUnits().forEach(function(u) {
    var any = false, out = false;
    chargesOf(c.id).forEach(function(ch) { var x = cell(ch, u); if (x.due > 0) { any = true; addTo(due, ch.cur, x.due); addTo(paid, ch.cur, Math.min(x.paid, x.due)); if (x.left > 0) out = true; } });
    if (any) { n++; if (!out) np++; }
  });
  var pct = pairUsd(due) > 0 ? Math.round(pairUsd(paid) * 100 / pairUsd(due)) : 0;
  h += '<div class="sec" style="margin-top:8px"><div class="card pad"><div class="row between"><b>' + esc(fmtPair(paid)) + '</b><span class="muted" style="font-size:13px">' + esc(t('of ', 'من ') + fmtPair(due)) + '</span></div><div class="bar" style="margin:8px 0 6px"><i class="paid" style="width:' + pct + '%"></i></div><div class="muted" style="font-size:12.5px;font-weight:600">' + esc(t(np + ' of ' + n + ' paid', np + ' من ' + n + ' سددوا')) + '</div></div></div>';
  var f = UI.cFilter || 'owing';
  h += '<div class="row" style="margin:8px 16px 0;gap:6px"><button class="chip' + (f === 'owing' ? ' on' : '') + '" onclick="UI.cFilter=\'owing\';render()">' + esc(t('Still owe', 'لم يسددوا')) + ' <span class="cnt">' + (n - np) + '</span></button><button class="chip' + (f === 'all' ? ' on' : '') + '" onclick="UI.cFilter=\'all\';render()">' + esc(t('All', 'الكل')) + ' <span class="cnt">' + n + '</span></button><button class="chip' + (UI.cAll ? ' on' : '') + '" onclick="UI.cAll=!UI.cAll;render()">' + esc(t('Closed bills', 'فواتير مغلقة')) + '</button></div>';
  var groups = blocks().length > 1 ? blocks() : [null], shown = 0;
  groups.forEach(function(b) {
    var rows = activeUnits().filter(function(u) { return !b || blockOf(u) === b; }).filter(function(u) {
      if (f === 'all') return true;
      return chargesOf(c.id).some(function(ch) { return cell(ch, u).left > 0; });
    }).map(function(u) { return colRow(u, c); }).filter(Boolean);
    if (!rows.length) return;
    shown += rows.length;
    h += '<div class="sec" style="margin-top:12px">';
    if (b) h += '<div class="sec-h"><h2>' + esc(blockLabel(b)) + '</h2></div>';
    h += '<div class="card">' + rows.join('') + '</div></div>';
  });
  if (!shown) h += '<div class="sec"><div class="card empty">' + esc(t('Everyone has paid ✓', 'الجميع سدّد ✓')) + '</div></div>';
  return h;
}
SHEETS.colmore = function() {
  return '<h3>' + esc(t('News & contacts', 'الأخبار وجهات الاتصال')) + '</h3>' + renderNewsCard() + renderContactsCard();
};
