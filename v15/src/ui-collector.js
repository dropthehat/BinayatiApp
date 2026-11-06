/* ============================================================================
   Collector page (test build): two tabs. Dashboard has the quick numbers across
   every book; Collect is only names, amounts and ticks. A manager can preview it
   with writes switched off.
   ============================================================================ */
function colUI() { return testBuild() && !!S.building && !isManager(); }
function pvBlocked() { return new Error(t('Preview only: nothing is saved', 'معاينة فقط: لا يُحفظ شيء')); }
function startColPreview() { UI.pvCol = true; UI.sheet = null; UI.tab = 'collect'; UI.cShowPaid = false; UI.cTicked = {}; UI.cb = null; render(); window.scrollTo(0, 0); }
function stopColPreview() { UI.pvCol = false; UI.tab = 'home'; UI.cycleId = null; UI.cb = null; render(); window.scrollTo(0, 0); }
function colPreviewBar() {
  if (!UI.pvCol) return '';
  return '<div class="pvbar"><span>' + esc(t('Preview of the collector page. Ticks are off.', 'معاينة صفحة الجابي. التأشير معطّل.')) + '</span><button onclick="stopColPreview()">' + esc(t('Exit', 'خروج')) + '</button></div>';
}

/* Every book is kept in memory, so switching between them is instant. */
function colBooks() { return (UI.cb || []).map(function(r) { return { b: r.b, ns: S.building && r.b.id === S.building.id ? S : r.ns }; }); }
function loadColBooks() {
  if (UI.cbLoading) return;
  UI.cbLoading = true;
  myBuildingList().then(function(list) {
    return Promise.all(list.map(function(b) {
      return buildingState(b.id).then(function(ns) { return { b: b, ns: scopeToMyBlocks(ns) }; });
    }));
  }).then(function(rows) { UI.cb = rows; UI.cbLoading = false; render(); }, function(e) { UI.cbLoading = false; if (!UI.cb) UI.cb = []; fail(e); });
}
function colSwitch(bid, after) {
  var row = (UI.cb || []).filter(function(r) { return r.b.id === bid; })[0];
  if (S.building && S.building.id === bid) { if (after) after(); return; }
  if (!row) { openBuilding(bid).then(function() { if (after) after(); render(); }, fail); return; }
  (UI.cb || []).forEach(function(r) { if (S.building && r.b.id === S.building.id) r.ns = S; });
  S = row.ns; UI.cycleId = null; UI.cTicked = {}; UI.cShowPaid = false; UI.cOpen = null;
  try { localStorage.setItem('bny15_last', bid); } catch (e) {}
  if (after) after();
  render(); window.scrollTo(0, 0);
  if (isCloud()) { subscribe(bid); loadConfig(bid); }
  // Quietly refresh this book, unless a tick happened meanwhile.
  var n = S.payments.length;
  buildingState(bid).then(function(ns) {
    if (S.building && S.building.id === bid && S.payments.length === n) { S = scopeToMyBlocks(ns); if (!UI.sheet) render(); }
  }, function() {});
}
function colHand(bid) { colSwitch(bid, function() { UI.tab = 'home'; openSheet('handreq'); }); }

/* What an apartment or a whole book still owes, across all open bills, oldest first. */
/* Short bill name, no dates: "Water W-004", "EDL October 2026". */
function colBillName(c) {
  var parts = cycleTitle(c).split(' · ');
  return /^E-\d+$/.test(parts[1] || '') && LANG === 'ar' ? parts[0] + ' ' + parts[1] : parts[0];
}
function colCells(u) {
  var out = [], bills = visibleCycles().slice().reverse(), months = bills.length > 1;
  bills.forEach(function(c) {
    chargesOf(c.id).forEach(function(ch) {
      var x = cell(ch, u);
      if (x.due <= 0 && x.paid <= 0) return;
      var title = isSharedBook() ? colBillName(c) : L(ch) + (months ? ' · ' + cycleTitle(c) : '');
      out.push({ c: c, ch: ch, x: x, title: title });
    });
  });
  return out;
}
function colBookTotals() {
  var left = pair(), n = 0, days = {};
  activeUnits().forEach(function(u) {
    var owes = false;
    colCells(u).forEach(function(k) { if (k.x.left > 0) { addTo(left, k.ch.cur, k.x.left); owes = true; days[k.c.id] = 1; } });
    if (owes) n++;
  });
  return { left: left, n: n, bills: Object.keys(days).length };
}
/* One receipt for everything the apartment paid on its latest payment day. */
function colReceiptText(u, lang) {
  var cells = colCells(u).filter(function(k) { return k.x.state === 'paid'; }), latest = '';
  cells.forEach(function(k) { k.x.payments.forEach(function(p) { var d = String(p.received_at || '').slice(0, 10); if (d > latest) latest = d; }); });
  cells = cells.filter(function(k) { return k.x.payments.some(function(p) { return String(p.received_at || '').slice(0, 10) === latest; }); });
  var total = pair();
  cells.forEach(function(k) { addTo(total, k.ch.cur, k.x.due); });
  function one(lg) {
    var T = function(en, ar) { return lg === 'ar' ? ar : en; };
    var name = lg === 'ar' ? (u.name_ar || u.name) : u.name, bname = lg === 'ar' ? (S.building.name_ar || S.building.name) : S.building.name;
    var lines = cells.map(function(k) {
      var title = isSharedBook() ? cycleTitle(k.c, lg).split(' · ')[0] + (lg === 'ar' && /^E-/.test(cycleTitle(k.c, lg).split(' · ')[1] || '') ? ' ' + cycleTitle(k.c, lg).split(' · ')[1] : '')
        : (lg === 'ar' ? (k.ch.title_ar || k.ch.title) : k.ch.title);
      return '• ' + title + ': ' + fmt(k.x.due, k.ch.cur) + ' ✅';
    });
    var s = '🏢 *' + bname + '*\n\n🧾 *' + T('Receipt', 'إيصال') + '*\n' + T('Thank you ', 'شكراً ') + (name ? '*' + name + '* ' : '') + '(' + unitTag(u) + ') 🌸\n' + lines.join('\n');
    if (cells.length > 1) s += '\n\n✅ *' + T('Total received: ', 'المجموع المستلم: ') + fmtPair(total) + '*';
    if (u.resident_token) s += '\n\n' + T('Your bill and receipts:', 'فاتورتك وإيصالاتك:') + '\n' + residentLink(u);
    return s;
  }
  lang = lang || u.lang || 'both';
  return lang === 'both' ? one('ar') + '\n\n━━━━━━━━\n\n' + one('en') : one(lang);
}
function colToggleBlock(b) {
  UI.cOpen = UI.cOpen === b ? null : b;
  render();
  setTimeout(function() { var el = document.getElementById('cb-' + b); if (el && UI.cOpen) el.scrollIntoView({ block: 'start', behavior: 'auto' }); window.scrollBy(0, -8); }, 0);
}
function colTick(chId, uId) { UI.cTicked = UI.cTicked || {}; UI.cTicked[uId] = 1; tapCell(chId, uId); }
function colRow(u) {
  var ticked = UI.cTicked && UI.cTicked[u.id], cells = colCells(u);
  var owed = cells.filter(function(k) { return k.x.left > 0; });
  if (!owed.length && !ticked && !UI.cShowPaid) return '';
  var shown = UI.cShowPaid ? cells : cells.filter(function(k) { return k.x.left > 0 || ticked; });
  if (!shown.length) return '';
  var h = '<div class="crow"><div class="ucode">' + esc(unitTag(u)) + '</div><div class="grow"><div class="uname">' + esc(unitName(u) || unitTag(u)) + '</div></div>';
  var paidCells = cells.filter(function(k) { return k.x.state === 'paid'; });
  if (u.phone && owed.length) h += '<button class="crow-wa" aria-label="WhatsApp" onclick="openSheet(\'remind\',{u:' + jsArg(u.id) + ',cyc:' + jsArg(owed[owed.length - 1].c.id) + '})">📣</button>';
  else if (u.phone && paidCells.length) h += '<button class="btn wa sm" onclick="openSheet(\'remind\',{receipt:true,u:' + jsArg(u.id) + ',cyc:' + jsArg(paidCells[paidCells.length - 1].c.id) + '})">' + esc(t('Send receipt', 'أرسل إيصالاً')) + '</button>';
  h += '</div><div class="crow-ticks">';
  shown.forEach(function(k) {
    var st = k.x.state, on = st === 'paid';
    h += '<button class="ctick' + (on ? ' on' : st === 'part' ? ' part' : '') + '" aria-pressed="' + on + '" onclick="colTick(' + jsArg(k.ch.id) + ',' + jsArg(u.id) + ')"><span class="ctick-box">' + (on ? '✓' : '') + '</span><span class="grow">' + esc(k.title) + '</span><b>' + esc(fmt(st === 'part' ? k.x.left : k.x.due, k.ch.cur)) + '</b></button>';
  });
  return h + '</div>';
}
function renderColCollect() {
  var h = colPreviewBar() + renderTopbar(t('Collect', 'التحصيل'));
  if (!UI.cb) loadColBooks();
  var books = colBooks();
  if (books.length > 1) {
    h += '<div class="sec" style="margin-top:6px"><div class="seg">';
    books.forEach(function(r) { h += '<button class="' + (r.b.id === S.building.id ? 'on' : '') + '" onclick="colSwitch(' + jsArg(r.b.id) + ')">' + esc(LANG === 'ar' ? (r.b.name_ar || r.b.name) : r.b.name) + '</button>'; });
    h += '</div></div>';
  }
  var tot = colBookTotals();
  h += '<div class="sec" style="margin-top:10px"><div class="row between"><span class="muted" style="font-weight:600">' + esc(t('Still to collect', 'باقي للتحصيل')) + '</span><b>' + esc(fmtPair(tot.left)) + '</b></div></div>';
  var groups = blocks().length > 1 ? blocks() : [null], shown = 0;
  groups.forEach(function(b) {
    var us = activeUnits().filter(function(u) { return !b || blockOf(u) === b; });
    var rows = us.map(colRow).filter(Boolean);
    if (!b) {
      if (!rows.length) return;
      shown += rows.length;
      h += '<div class="sec" style="margin-top:12px"><div class="card">' + rows.join('') + '</div></div>';
      return;
    }
    shown += 1;
    var left = pair(), n = 0;
    us.forEach(function(u) { var o = false; colCells(u).forEach(function(k) { if (k.x.left > 0) { addTo(left, k.ch.cur, k.x.left); o = true; } }); if (o) n++; });
    var open = UI.cOpen === b;
    h += '<div class="sec" style="margin-top:10px"><button class="cblock' + (open ? ' on' : '') + '" id="cb-' + esc(b) + '" aria-expanded="' + open + '" onclick="colToggleBlock(' + jsArg(b) + ')"><b>' + esc(blockLabel(b)) + '</b><span class="grow" style="text-align:end">' + (n ? '<small>' + esc(t(n + ' owe', n + ' عليهم')) + '</small> ' + esc(fmtPair(left)) : '✓ ' + esc(t('All paid', 'الكل سدّد'))) + '</span><span class="chev">' + (open ? '▾' : (LANG === 'ar' ? '‹' : '›')) + '</span></button>';
    if (open) h += rows.length ? '<div class="card" style="margin-top:6px">' + rows.join('') + '</div>' : '';
    h += '</div>';
  });
  if (!shown) h += '<div class="sec"><div class="card empty">' + esc(t('Everyone has paid ✓', 'الجميع سدّد ✓')) + '</div></div>';
  h += '<div class="sec" style="margin-top:12px"><button class="btn ghost block" onclick="UI.cShowPaid=!UI.cShowPaid;render()">' + esc(UI.cShowPaid ? t('Hide what is paid', 'إخفاء المدفوع') : t('Show what is paid', 'إظهار المدفوع')) + '</button></div>';
  return h;
}
function renderColDash() {
  var h = colPreviewBar() + renderTopbar(t('Dashboard', 'لوحة المعلومات'));
  if (!UI.cb) { loadColBooks(); return h + '<div class="sec"><div class="card empty">' + esc(t('Loading…', 'جارٍ التحميل…')) + '</div></div>'; }
  var rows = colBooks().map(function(r) {
    return withState(r.ns, function() {
      var cash = cashState(), mine = cash.pockets[r.ns.me.id] || pair();
      return { b: r.b, pocket: UI.pvCol ? cash.withCollector : { USD: mine.USD || 0, LBP: mine.LBP || 0 }, tot: colBookTotals(),
        tasks: openTasks('collector').filter(function(x) { return x.due_on && x.due_on <= todayIso(); }),
        pending: r.ns.handovers.filter(function(x) { return x.status === 'pending' && (UI.pvCol || x.collector_id === r.ns.me.id); }).length };
    });
  });
  h += '<div class="sec"><div class="stack">';
  rows.forEach(function(r) {
    h += '<div class="card pad"><b style="font-size:16px">' + esc(LANG === 'ar' ? (r.b.name_ar || r.b.name) : r.b.name) + '</b>';
    h += '<div class="kv"><span>' + esc(t('In your pocket', 'معك الآن')) + '</span><b>' + esc(fmtPair(r.pocket)) + '</b></div>';
    h += '<div class="kv"><span>' + esc(t('Still to collect', 'باقي للتحصيل')) + '</span><b>' + esc(fmtPair(r.tot.left)) + '</b></div>';
    if (r.pending) h += '<p class="muted" style="margin:10px 0 0;font-weight:600">' + esc(t('Handover waiting for the manager', 'تسليم بانتظار المدير')) + '</p>';
    else if (pairUsd(r.pocket) > 0.005) h += '<button class="btn sec sm block" style="margin-top:10px" onclick="colHand(' + jsArg(r.b.id) + ')">' + esc(t('Hand over', 'سلّم')) + '</button>';
    h += '</div>';
  });
  h += '</div></div>';
  var due = [];
  rows.forEach(function(r) { r.tasks.forEach(function(x) { due.push(x); }); });
  if (due.length) h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Do today', 'اليوم')) + '</h2></div><div class="card">' + due.map(taskRow).join('') + '</div></div>';
  return h;
}
SHEETS.colmore = function() {
  return '<h3>' + esc(t('News & contacts', 'الأخبار وجهات الاتصال')) + '</h3>' + renderNewsCard() + renderContactsCard();
};
