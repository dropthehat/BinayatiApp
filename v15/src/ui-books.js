/* ============================================================================
   Books: where the money is, every movement, and who did what
   ============================================================================ */
function renderBooks() {
  var h = renderTopbar(t('Books', 'الحسابات'));
  h += '<div class="sec" style="margin-top:4px"><div class="seg"><button class="' + (UI.booksView !== 'activity' ? 'on' : '') + '" onclick="UI.booksView=\'money\';render()">' + esc(t('Money', 'المال')) + '</button><button class="' + (UI.booksView === 'activity' ? 'on' : '') + '" onclick="UI.booksView=\'activity\';render()">' + esc(t('Who did what', 'من فعل ماذا')) + '</button></div></div>';
  return h + (UI.booksView === 'activity' ? renderActivity() : renderMoney());
}

function renderMoney() {
  var cash = cashState(), h = '';
  cash.pending.forEach(function(ho) {
    h += '<div class="sec"><div class="banner warn"><div class="grow"><b>' + esc(memberName(ho.collector_id) + ' → ' + fmtPair({ USD: num(ho.usd), LBP: num(ho.lbp) })) + '</b>' + esc(t('Handover waiting for confirmation', 'تسليم بانتظار التأكيد')) + '</div>' + (isManager() ? '<button class="btn sm ok" onclick="openSheet(\'handover\',{id:' + jsArg(ho.id) + '})">' + esc(t('Review', 'مراجعة')) + '</button>' : '') + '</div></div>';
  });
  h += '<div class="sec"><div class="tiles">';
  h += tile(t('In the safe', 'في الصندوق'), fmtPairBig(cash.safe), t('Opening balance + received − spent', 'الرصيد الافتتاحي + المقبوض − المصروف'), '', 'var(--ok)');
  h += tile(t('With collectors', 'مع الجباة'), fmtPairBig(cash.withCollector), Object.keys(cash.pockets).filter(function(k) { return pairUsd(cash.pockets[k]) > 0.005; }).map(function(k) { return pocketName(k) + ' ' + fmtPair(cash.pockets[k]); }).join(' · ') || t('Nothing outstanding · tap for details', 'لا شيء معلّق · اضغط للتفاصيل'), 'openSheet(\'colbook\',{})', 'var(--warn)');
  if (pairUsd(cash.supplier) > 0.005) h += tile(t('Of which for suppliers', 'منها للموردين'), fmtPairBig(cash.supplier), t('Moteur, internet… not building money', 'موتور، إنترنت… ليست أموال البناية'), 'openSheet(\'suppliers\',{})', 'var(--info)');
  h += tile(t('Building money', 'أموال البناية'), fmtPairBig(cash.building), t('Safe + collectors − suppliers', 'الصندوق + الجباة − الموردين'), '', 'var(--acc)', 'wide');
  h += '</div>';
  if (isManager() && collectorsHolding().length) h += '<button class="btn sec block" style="margin-top:10px" onclick="openSheet(\'handrecv\',{})">⇄ ' + esc(t('Received cash from a collector', 'استلمت نقداً من الجابي')) + '</button>';
  h += '</div>';

  // Supplier bills: who collected each one and whether it reached the supplier
  h += supplierBillsHtml(false);

  // Cycle filter + ledger
  var f = UI.booksCycle || 'all';
  h += '<div class="chips" style="margin-top:16px"><button class="chip' + (f === 'all' ? ' on' : '') + '" onclick="UI.booksCycle=\'all\';render()">' + esc(t('Everything', 'الكل')) + '</button>';
  visibleCycles().forEach(function(c) { h += '<button class="chip' + (f === c.id ? ' on' : '') + '" onclick="UI.booksCycle=' + jsArg(c.id) + ';render()">' + esc(cycleTitle(c)) + '</button>'; });
  h += '</div>';
  var all = ledger(f === 'all' ? null : f);
  // Building money only: supplier money (collected for internet, dish, the collector's fee…) is shown apart.
  var tin = pair(), tout = pair(), sin = pair(), sout = pair();
  all.forEach(function(e) { var a = e.sup ? (e.kind === 'in' ? sin : sout) : (e.kind === 'in' ? tin : e.kind === 'out' ? tout : null); if (a && e.kind !== 'move') addTo(a, e.cur, e.amount); });
  var showSup = !!UI.showSup, entries = all.filter(function(e) { return showSup ? e.sup : !e.sup; });
  h += '<div class="sec"><div class="card pad"><div class="kv"><span>' + esc(t('Money in', 'المقبوض')) + '</span><b style="color:var(--ok)">' + esc(fmtPair(tin)) + '</b></div><div class="kv"><span>' + esc(t('Money out', 'المصروف')) + '</span><b style="color:var(--bad)">' + esc(fmtPair(tout)) + '</b></div>';
  if (pairUsd(sin) > 0.005 || pairUsd(sout) > 0.005) h += '<button class="kv" style="width:100%;background:none;border:0;padding:8px 0 0;color:inherit;font:inherit;text-align:start;cursor:pointer" onclick="UI.showSup=!UI.showSup;render()"><span style="color:var(--mut)">' + esc(t('Supplier money, not the building\'s', 'مال الموردين، ليس للبناية')) + '<br><small>' + esc(t('Collected ', 'جُبي ') + fmtPair(sin) + t(' · passed on ', ' · سُلّم ') + fmtPair(sout)) + '</small></span><b style="color:var(--info);font-size:13px">' + esc(showSup ? t('Hide ‹', 'إخفاء ‹') : t('Show ›', 'عرض ›')) + '</b></button>';
  if (f !== 'all') h += '<button class="btn sec block" style="margin-top:10px" onclick="shareReport(' + jsArg(f) + ')">' + esc(t('Share the month\'s report on WhatsApp', 'شارك تقرير الشهر على واتساب')) + '</button>';
  h += '</div>';
  var day = '';
  if (showSup) h += '<div class="banner info" style="margin-top:12px"><div class="grow">' + esc(t('Showing supplier money only: collected for suppliers and passed on to them.', 'يُعرض مال الموردين فقط: ما جُبي لهم وما سُلّم إليهم.')) + '</div><button class="btn sm sec" onclick="UI.showSup=false;render()">' + esc(t('Back', 'رجوع')) + '</button></div>';
  if (!entries.length) h += '<div class="card empty" style="margin-top:12px">' + esc(t('Nothing recorded yet', 'لا شيء مسجّل بعد')) + '</div>';
  entries.slice(0, 200).forEach(function(e, i) {
    var d = dayKey(String(e.at));
    if (d !== day) { if (day) h += '</div>'; h += '<div class="daylbl">' + esc(dateLabel(d)) + '</div><div class="card list">'; day = d; }
    h += '<button class="li" onclick="' + (e.onclick || '') + '"><div class="ic ' + e.kind + '">' + e.icon + '</div><div class="grow"><b>' + esc(e.title) + '</b><small>' + esc(e.sub) + '</small></div><span class="amt ' + e.kind + '">' + (e.kind === 'in' ? '+' : e.kind === 'out' ? '−' : '') + esc(e.amtText || fmt(e.amount, e.cur)) + '</span></button>';
  });
  if (day) h += '</div>';
  h += '</div>';
  return h;
}

/* Every movement, newest first. Payments for the same apartment, day and hand are grouped. */
function ledger(cycleId) {
  var out = [], groups = {}, direct = sharedDirectIds();
  var cycCharges = {};
  if (cycleId) chargesOf(cycleId).forEach(function(c) { cycCharges[c.id] = 1; });
  livePayments().forEach(function(p) {
    if (cycleId && !cycCharges[p.charge_id]) return;
    var u = byId(S.units, p.unit_id), ch = byId(S.charges, p.charge_id), sup = !!(ch && (ch.pass_through || (direct[ch.id] && p.channel === 'collector')));
    var k = p.unit_id + '|' + dayKey(p.received_at) + '|' + p.channel + '|' + p.received_by + '|' + p.cur + '|' + sup;
    var g = groups[k];
    if (!g) {
      g = groups[k] = { kind: 'in', icon: '↓', at: p.received_at, amount: 0, cur: p.cur, titles: [], unit: u, p: p, sup: sup };
      out.push(g);
    }
    g.amount += num(p.amount);
    if (ch) g.titles.push(L(ch));
    if (p.received_at > g.at) g.at = p.received_at;
  });
  out.forEach(function(g) {
    var p = g.p;
    g.title = (g.unit ? unitTag(g.unit) + (unitName(g.unit) ? ' · ' + unitName(g.unit) : '') : t('Apartment', 'شقة'));
    var who = p.channel === 'collector' ? (handoverConfirmed(p.handover_id) ? pocketName(p.received_by) + ' → ' + t('safe', 'الصندوق') : t('with ', 'مع ') + pocketName(p.received_by)) : p.channel === 'transfer' ? (p.method || t('Transfer', 'تحويل')) : pocketName(p.received_by);
    g.sub = g.titles.join(', ') + ' · ' + who;
    if (g.unit) g.onclick = 'openSheet(\'unit\',{id:' + jsArg(g.unit.id) + '})';
  });
  var autoG = {};
  liveExpenses().forEach(function(e) {
    if (cycleId && e.cycle_id !== cycleId && !(e.charge_id && cycCharges[e.charge_id])) return;
    if (e.payment_id) { // passed on automatically, one per payment: one line per charge and collector
      var k = e.charge_id + '|' + (e.paid_by || 'unknown') + '|' + e.cur, x = autoG[k], at = e.spent_on + 'T12:00:00';
      if (!x) { x = autoG[k] = { sup: true, kind: 'out', icon: catIcon('supplier'), at: at, amount: 0, cur: e.cur, title: L(e), sub: t('Passed on by ', 'سلّمها ') + pocketName(e.paid_by) + t(' · counted when collected', ' · تُحتسب عند الجباية'), onclick: isManager() ? 'openSheet(\'colbook\',{k:' + jsArg(e.paid_by || 'unknown') + '})' : '' }; out.push(x); }
      x.amount += num(e.amount); if (at > x.at) x.at = at;
      return;
    }
    out.push({ sup: !!e.charge_id, kind: 'out', icon: catIcon(e.charge_id ? 'supplier' : e.cat), at: (e.spent_on === dayKey(e.created_at) ? e.created_at : e.spent_on + 'T12:00:00'), amount: num(e.amount), cur: e.cur,
               title: L(e), sub: catName(e.charge_id ? 'supplier' : e.cat) + ' · ' + (e.paid_from === 'collector' ? t('paid by ', 'دفعه ') + pocketName(e.paid_by) : t('from the safe', 'من الصندوق')) + (e.ref ? ' · #' + e.ref : '') + (e.note ? ' · ' + e.note : '') + origNote(e),
               onclick: isManager() || e.paid_by === (S.me && S.me.id) ? 'openSheet(\'expense\',{id:' + jsArg(e.id) + '})' : '' });
  });
  if (!cycleId) S.handovers.forEach(function(ho) {
    if (ho.status === 'rejected') return;
    out.push({ kind: 'move', icon: '⇄', at: ho.resolved_at || ho.created_at, amount: 0, cur: 'USD', amtText: fmtPair({ USD: num(ho.usd), LBP: num(ho.lbp) }),
               title: t('Handover from ', 'تسليم من ') + memberName(ho.collector_id), sub: ho.status === 'confirmed' ? t('Confirmed by ', 'أكّده ') + memberName(ho.resolved_by) : t('Waiting for confirmation', 'بانتظار التأكيد'),
               onclick: isManager() && ho.status === 'pending' ? 'openSheet(\'handover\',{id:' + jsArg(ho.id) + '})' : '' });
  });
  out.sort(function(a, b) { return String(b.at).localeCompare(String(a.at)); });
  return out;
}

function shareReport(cycId) {
  var cyc = byId(S.cycles, cycId);
  var s = cycleSummary(cyc), spent = liveExpenses().filter(function(e) { return e.cycle_id === cycId && !e.charge_id; });
  var cash = cashState();
  var lines = [];
  lines.push('🏢 *' + bName() + '* · ' + cycleTitle(cyc));
  lines.push('');
  lines.push(t('Collected: ', 'المحصّل: ') + fmtPair(s.paid) + t(' of ', ' من ') + fmtPair(s.due) + ' (' + s.pct + '%)');
  lines.push(t(s.settled + ' of ' + s.units + ' apartments have paid', s.settled + ' من ' + s.units + ' شقق سددت'));
  if (pairUsd(s.supPaid) > 0.005) lines.push(t('Also collected for suppliers (internet, dish…) and passed on: ', 'جُبي أيضاً للموردين (إنترنت، دش…) وسُلّم لهم: ') + fmtPair(s.supPaid));
  if (spent.length) {
    lines.push('');
    lines.push('*' + t('Spent', 'المصاريف') + '*');
    spent.forEach(function(e) { lines.push('• ' + L(e) + ': ' + fmt(e.amount, e.cur)); });
  }
  lines.push('');
  lines.push(t('In the safe now: ', 'في الصندوق الآن: ') + fmtPair(cash.safe));
  lines.push(t('Each resident can see their own receipts from the link in their bill.', 'يمكن لكل ساكن رؤية إيصالاته من الرابط في فاتورته.'));
  window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
}

/* ---------------------------------------------------------------------------
   Activity: the audit trail in plain words
   --------------------------------------------------------------------------- */
function renderActivity() {
  var ev = S.events.slice().reverse();
  var h = '<div class="sec">';
  if (!ev.length) return h + '<div class="card empty">' + esc(t('Every change will show here with who made it.', 'كل تغيير سيظهر هنا مع من قام به.')) + '</div></div>';
  var day = '';
  ev.slice(0, 300).forEach(function(e) {
    var d = dayKey(String(e.at));
    if (d !== day) { if (day) h += '</div>'; h += '<div class="daylbl">' + esc(dateLabel(d)) + '</div><div class="card">'; day = d; }
    h += eventRow(e);
  });
  return h + '</div></div>';
}
function eventText(e) {
  var d = (e.data && e.data.new) ? e.data.new : (e.data || {});
  var old = (e.data && e.data.old) || {};
  var who = e.actor_name || (e.actor ? memberName(e.actor) : (e.tbl === 'payments' || e.tbl === 'expenses' ? t('The sheet', 'الجدول') : memberName(e.actor)));
  var u = d.unit_id && byId(S.units, d.unit_id), ch = d.charge_id && byId(S.charges, d.charge_id);
  var code = u ? unitTag(u) : '';
  switch (e.tbl) {
    case 'support':
      if (e.action === 'view') return d.mode === 'full' ? t('Natour app support opened the building', 'فتح دعم تطبيق ناطور البناية') : t('Natour app support looked at the building (read-only)', 'اطّلع دعم تطبيق ناطور على البناية (قراءة فقط)');
      if (e.action === 'grant') return t(who + ' let Natour app support look until ' + dateLabel(d.until, true), who + ' سمح لدعم تطبيق ناطور بالاطّلاع حتى ' + dateLabel(d.until, true));
      if (e.action === 'revoke') return t(who + ' turned off support access', who + ' أوقف وصول الدعم');
      return null;
    case 'payments':
      if (e.action === 'insert') return t(who + ' recorded ' + fmt(d.amount, d.cur) + ' from ' + code + (ch ? ' · ' + ch.title : ''), who + ' سجّل ' + fmt(d.amount, d.cur) + ' من ' + code + (ch ? ' · ' + (ch.title_ar || ch.title) : ''));
      if (d.voided_at && !old.voided_at) return t(who + ' undid ' + fmt(d.amount, d.cur) + ' from ' + code, who + ' ألغى ' + fmt(d.amount, d.cur) + ' من ' + code);
      return null;
    case 'expenses':
      if (d.payment_id) return null; // supplier money passed on automatically: the payment already shows
      if (e.action === 'insert') return t(who + ' spent ' + fmt(d.amount, d.cur) + ' · ' + d.title, who + ' صرف ' + fmt(d.amount, d.cur) + ' · ' + d.title);
      if (e.action === 'delete') return t(who + ' removed the expense ' + d.title, who + ' حذف المصروف ' + d.title);
      if (d.voided_at && !old.voided_at) return t(who + ' cancelled the expense ' + d.title, who + ' ألغى المصروف ' + d.title);
      return t(who + ' edited the expense ' + d.title, who + ' عدّل المصروف ' + d.title);
    case 'handovers':
      var amt = fmtPair({ USD: num(d.usd), LBP: num(d.lbp) });
      if (e.action === 'insert' && d.status === 'confirmed') { var cn = memberName(d.collector_id); return t(who + ' received ' + amt + ' from ' + cn, who + ' استلم ' + amt + ' من ' + cn); }
      if (e.action === 'insert') return t(who + ' handed over ' + amt, who + ' سلّم ' + amt);
      if (d.status === 'confirmed') return t(who + ' confirmed receiving ' + amt, who + ' أكّد استلام ' + amt);
      if (d.status === 'rejected') return t(who + ' said the handover of ' + amt + ' did not arrive', who + ' أفاد بعدم وصول ' + amt);
      return null;
    case 'charges':
      var ct = LANG === 'ar' ? (d.title_ar || d.title) : d.title;
      return { insert: t(who + ' added the charge ' + ct, who + ' أضاف رسم ' + ct), update: t(who + ' changed the charge ' + ct, who + ' عدّل رسم ' + ct), delete: t(who + ' removed the charge ' + ct, who + ' حذف رسم ' + ct) }[e.action];
    case 'units':
      return { insert: t(who + ' added apartment ' + d.code, who + ' أضاف الشقة ' + d.code), update: t(who + ' edited apartment ' + d.code, who + ' عدّل الشقة ' + d.code), delete: t(who + ' removed apartment ' + d.code, who + ' حذف الشقة ' + d.code) }[e.action];
    case 'cycles':
      var title = cycleTitle(d);
      return { insert: t(who + ' opened ' + title, who + ' فتح ' + title), update: t(who + ' changed ' + title, who + ' عدّل ' + title), delete: t(who + ' deleted ' + title, who + ' حذف ' + title) }[e.action];
    case 'tasks':
      var tt = LANG === 'ar' ? (d.title_ar || d.title) : d.title;
      if (e.action === 'update' && d.done_at && !old.done_at) return t(who + ' ticked off ' + tt, who + ' أنجز ' + tt);
      if (e.action === 'insert') return t(who + ' added the task ' + tt, who + ' أضاف مهمة ' + tt);
      return null;
    case 'members':
      if (e.action === 'insert') return t((d.display_name || who) + ' joined as ' + roleLabel(d.role), (d.display_name || who) + ' انضم ك' + roleLabel(d.role));
      if (e.action === 'delete') return t(who + ' removed ' + (d.display_name || ''), who + ' أزال ' + (d.display_name || ''));
      return null;
  }
  return null;
}
/* Home shows money only: payments, expenses, handovers. Everything else stays under Who did what. */
function moneyEvents(n) {
  var out = [];
  for (var i = S.events.length - 1; i >= 0 && out.length < n; i--) {
    var e = S.events[i];
    if ((e.tbl === 'payments' || e.tbl === 'expenses' || e.tbl === 'handovers') && eventText(e)) out.push(e);
  }
  return out;
}
function eventRow(e) {
  var txt = eventText(e);
  if (!txt) return '';
  var who = e.actor_name || (e.actor ? memberName(e.actor) : (e.tbl === 'payments' || e.tbl === 'expenses' ? t('The sheet', 'الجدول') : memberName(e.actor)));
  return '<div class="ev"><div class="who">' + esc((who || '?').charAt(0).toUpperCase()) + '</div><div class="grow">' + esc(txt) + '<small>' + esc(dateLabel(e.at, true)) + '</small></div></div>';
}

/* ---------------------------------------------------------------------------
   Handover: collector asks, manager confirms
   --------------------------------------------------------------------------- */
SHEETS.handreq = function() {
  var mine = cashState().pockets[S.me.id] || pair();
  return '<h3>' + esc(t('Hand over ' + fmtPair(mine), 'سلّم ' + fmtPair(mine))) + '</h3><p class="lead">' + esc(t('Give the cash to the manager. It moves to the safe once they confirm they received it.', 'سلّم المبلغ للمدير. ينتقل إلى الصندوق بعد تأكيده الاستلام.')) + '</p>' +
    '<label class="field"><span>' + esc(t('Note (optional)', 'ملاحظة (اختياري)')) + '</span><input class="input" id="ho-note" placeholder="' + esc(t('e.g. October cash', 'مثلاً نقد تشرين الأول')) + '"></label><div id="sheet-err" class="err"></div>' +
    '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="requestHandover()">' + esc(t('I handed it over', 'سلّمته')) + '</button></div>';
};
function requestHandover() {
  rpc('request_handover', { p_building: S.building.id, p_note: val('ho-note') || null }).then(function() {
    if (isCloud()) reloadBuilding();
    closeSheet(); toast(t('Sent. The manager will confirm.', 'تم الإرسال. سيؤكد المدير.'));
  }, function(e) { sheetErr(e.message); });
}
SHEETS.handover = function(d) {
  var ho = byId(S.handovers, d.id);
  if (!ho) return '';
  var pays = S.payments.filter(function(p) { return p.handover_id === ho.id && !p.voided_at; });
  var exps = S.expenses.filter(function(e) { return e.handover_id === ho.id && !e.voided_at; });
  var h = '<h3>' + esc(memberName(ho.collector_id) + ' → ' + fmtPair({ USD: num(ho.usd), LBP: num(ho.lbp) })) + '</h3><p class="lead">' + esc(dateLabel(ho.created_at, true) + (ho.note ? ' · ' + ho.note : '')) + '</p>';
  h += '<div class="card pad"><div class="kv"><span>' + esc(t('Collected from ' + pays.length + ' payments', 'من ' + pays.length + ' دفعات')) + '</span><b>' + esc(fmtPair(pays.reduce(function(s, p) { return addTo(s, p.cur, num(p.amount)); }, pair()))) + '</b></div>';
  if (exps.length) h += '<div class="kv"><span>' + esc(t('Spent by the collector', 'صرفها الجابي')) + '</span><b>−' + esc(fmtPair(exps.reduce(function(s, e) { return addTo(s, e.cur, num(e.amount)); }, pair()))) + '</b></div>';
  h += '<div class="kv"><span>' + esc(t('Cash to receive', 'المبلغ المستلم')) + '</span><b>' + esc(fmtPair({ USD: num(ho.usd), LBP: num(ho.lbp) })) + '</b></div></div>';
  if (exps.length) h += '<div class="card list" style="margin-top:10px">' + exps.map(function(e) { return '<div class="li"><div class="ic out">' + catIcon(e.cat) + '</div><div class="grow"><b>' + esc(L(e)) + '</b><small>' + esc(dateLabel(e.spent_on)) + '</small></div><span class="amt out">−' + esc(fmt(e.amount, e.cur)) + '</span></div>'; }).join('') + '</div>';
  h += '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn danger" onclick="resolveHandover(' + jsArg(ho.id) + ',false)">' + esc(t('Didn\'t get it', 'لم أستلم')) + '</button><button class="btn ok" onclick="resolveHandover(' + jsArg(ho.id) + ',true)">' + esc(t('Received, put in safe', 'استلمت، للصندوق')) + '</button></div>';
  return h;
};
/* Manager: "I received cash from the collector" even if he didn't start a handover. */
function collectorsHolding() {
  var cash = cashState();
  return Object.keys(cash.pockets).filter(function(k) { return pairUsd(cash.pockets[k]) > 0.005 || cash.pockets[k].pendingId; }).map(function(k) { return { id: k, p: cash.pockets[k] }; });
}
/* ---------------------------------------------------------------------------
   One collector's own statement, and supplier bills reconciled against what
   each collector collected. Supplier money a collector collects counts as paid
   to the supplier when collected (an automatic expense from the server), unless
   the charge is paid from the safe or the building asks collectors to confirm.
   --------------------------------------------------------------------------- */
function pocketName(k) { return !k || k === 'unknown' ? collectorLabel() : memberName(k); }
function payHolder(p) { return p.channel === 'collector' && !handoverConfirmed(p.handover_id) ? (p.received_by || 'unknown') : 'safe'; }
function expHolder(e) { return e.paid_from === 'collector' && !handoverConfirmed(e.handover_id) ? (e.paid_by || 'unknown') : 'safe'; }
function supAuto(ch) { return setting('sup_confirm') !== true && (ch.payer || 'collector') === 'collector'; }
/* Every person who has collected cash as a collector here ('unknown' = ticks copied from a sheet). */
function collectorKeys() {
  var ks = collectors().map(function(m) { return m.user_id; });
  S.payments.forEach(function(p) { if (p.channel === 'collector') { var k = p.received_by || 'unknown'; if (ks.indexOf(k) < 0) ks.push(k); } });
  return ks;
}
/* Per supplier charge: collected, passed on, and what is left with each holder (a collector or the safe). */
function supplierState(ch) {
  var r = { c: ch, got: 0, out: 0, by: {} };
  function hb(k) { return r.by[k] = r.by[k] || { got: 0, out: 0 }; }
  livePayments().forEach(function(p) { if (p.charge_id === ch.id) { r.got += num(p.amount); hb(payHolder(p)).got += num(p.amount); } });
  liveExpenses().forEach(function(e) { if (e.charge_id === ch.id) { r.out += num(e.amount); hb(expHolder(e)).out += num(e.amount); } });
  r.left = round(r.got - r.out, ch.cur);
  Object.keys(r.by).forEach(function(k) { r.by[k].left = round(r.by[k].got - r.by[k].out, ch.cur); });
  return r;
}
function supplierRows(onlyKey) {
  var cyc = currentCycle();
  return S.charges.filter(function(c) { return c.pass_through; }).map(supplierState).filter(function(x) {
    if (onlyKey) return x.by[onlyKey] && (x.by[onlyKey].got > 0 || x.by[onlyKey].out > 0);
    return x.left > 0.005 || (cyc && x.c.cycle_id === cyc.id && x.got > 0);
  }).sort(function(a, b) { return String(cycleOrderKey(byId(S.cycles, b.c.cycle_id) || {})).localeCompare(String(cycleOrderKey(byId(S.cycles, a.c.cycle_id) || {}))) || (a.c.sort || 0) - (b.c.sort || 0); });
}
/* The list on Books and in the suppliers sheet. onlyKey: just one collector's share. */
function supplierBillsHtml(onlyKey) {
  var rows = supplierRows(onlyKey);
  if (!rows.length) return '';
  var h = '<div class="sec"><div class="sec-h"><h2>' + esc(onlyKey ? t('Supplier bills he collected', 'فواتير الموردين التي جباها') : t('Supplier bills', 'فواتير الموردين')) + '</h2></div><div class="card list">';
  rows.forEach(function(x) {
    var c = x.c, keys = onlyKey ? [onlyKey] : Object.keys(x.by);
    var parts = [], btns = '';
    keys.forEach(function(k) {
      var b = x.by[k]; if (!b) return;
      var who = k === 'safe' ? t('the safe', 'الصندوق') : pocketName(k);
      if (b.got > 0) parts.push(k === 'safe' ? t('in the safe ', 'في الصندوق ') + fmt(b.got, c.cur) : who + t(' collected ', ' جبى ') + fmt(b.got, c.cur));
      if (b.left > 0.005 && (isManager() || k === (S.me && S.me.id))) {
        if (k === 'safe') { if (isManager()) btns += '<button class="btn sm sec" onclick="openSheet(\'expense\',{charge:' + jsArg(c.id) + ',amt:' + b.left + '})">' + esc(t('Pay ', 'ادفع ') + fmt(b.left, c.cur) + t(' from safe', ' من الصندوق')) + '</button>'; }
        else btns += '<button class="btn sm ok" onclick="supPaidBy(' + jsArg(c.id) + ',' + jsArg(k) + ')">✓ ' + esc(k === (S.me && S.me.id) && !isManager() ? t('I paid it', 'دفعتها') : t(who + ' paid it', 'دفعها ' + who)) + '</button>';
      }
    });
    var lft = onlyKey && x.by[onlyKey] ? x.by[onlyKey].left : x.left, done = lft <= 0.005;
    var status = lft <= 0.005 ? '✓ ' + (onlyKey || keys.every(function(k) { return k !== 'safe'; }) ? t('Passed on', 'سُلّمت للمورد') : t('Paid', 'مدفوعة')) + (supAuto(c) && keys.some(function(k) { return k !== 'safe'; }) ? t(' · counted when collected', ' · تُحتسب عند الجباية') : '') : t('Left ', 'باقي ') + fmt(lft, c.cur);
    h += '<div class="li" style="flex-wrap:wrap"><div class="ic' + (done ? ' in' : '') + '">' + (done ? '✓' : '↗') + '</div><div class="grow"><b>' + esc(L(c)) + '</b><small>' + esc(cycleTitle(byId(S.cycles, c.cycle_id)) + (parts.length ? ' · ' + parts.join(' · ') : '')) + '</small><small style="display:block;color:' + (lft <= 0.005 ? 'var(--ok)' : 'var(--warn)') + '">' + esc(status) + '</small></div>' + (btns ? '<div class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end">' + btns + '</div>' : '') + '</div>';
  });
  return h + '</div></div>';
}
/* The collector handed this supplier bill over himself: one expense from his pocket for what is left with him. */
function supPaidBy(chId, k) {
  var ch = byId(S.charges, chId), x = supplierState(ch), left = x.by[k] ? x.by[k].left : 0;
  if (!(left > 0)) return;
  var row = { title: t('Paid to supplier · ', 'دفع للمورد · ') + ch.title, title_ar: 'دفع للمورد · ' + (ch.title_ar || ch.title), amount: left, cur: ch.cur, cat: 'supplier',
              spent_on: todayIso(), cycle_id: ch.cycle_id, charge_id: ch.id, paid_from: 'collector', paid_by: k === 'unknown' ? null : k, note: t('Confirmed by ', 'أكّده ') + memberName(S.me && S.me.id) };
  dbInsert('expenses', row).then(function() { toast(t('Marked as paid by ' + pocketName(k), 'سُجّلت مدفوعة من ' + pocketName(k))); render(); }, fail);
}
SHEETS.suppliers = function() {
  var h = '<h3>' + esc(t('Supplier bills', 'فواتير الموردين')) + '</h3><p class="lead">' + esc(t('Moteur, internet and the like: collected for a supplier, not building money. Whoever collects it hands it to the supplier.', 'موتور وإنترنت وغيرها: تُجبى للمورد وليست أموال البناية. من يجبيها يسلّمها للمورد.')) + '</p>';
  var b = supplierBillsHtml(false);
  return h + (b || '<div class="card empty">' + esc(t('Nothing collected for suppliers yet', 'لا شيء مجبى للموردين بعد')) + '</div>') + '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
};
SHEETS.colbook = function(d) {
  var ks = collectorKeys();
  if (!isManager() && S.me) ks = [S.me.id];
  if (!ks.length) return '<h3>' + esc(t('Collectors', 'الجباة')) + '</h3><div class="card empty">' + esc(t('No collector has collected anything yet. Invite one from Building › Team.', 'لم يجبِ أي جابٍ شيئاً بعد. ادعُ واحداً من البناية › الفريق.')) + '</div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
  var k = d.k && ks.indexOf(d.k) >= 0 ? d.k : ks[0];
  var cash = cashState(), pk = cash.pockets[k] || { USD: 0, LBP: 0, pending: pair() };
  var mine = function(p) { return p.channel === 'collector' && (p.received_by || 'unknown') === k; };
  var pays = livePayments().filter(mine), exps = liveExpenses().filter(function(e) { return e.paid_from === 'collector' && (e.paid_by || 'unknown') === k; });
  var fees = pair(), forSup = pair(), supOut = pair(), spent = pair(), handed = pair();
  var pass = {}; S.charges.forEach(function(c) { if (c.pass_through) pass[c.id] = 1; });
  pays.forEach(function(p) { addTo(pass[p.charge_id] ? forSup : fees, p.cur, num(p.amount)); if (handoverConfirmed(p.handover_id)) addTo(handed, p.cur, num(p.amount)); });
  exps.forEach(function(e) { addTo(e.charge_id ? supOut : spent, e.cur, num(e.amount)); if (handoverConfirmed(e.handover_id)) addTo(handed, e.cur, -num(e.amount)); });
  var all = pair(); addTo(all, 'USD', fees.USD + forSup.USD); addTo(all, 'LBP', fees.LBP + forSup.LBP);
  var h = '<h3>' + esc(pocketName(k)) + '</h3><p class="lead">' + esc(t('What ' + pocketName(k) + ' collected, passed on and still holds.', 'ما جباه ' + pocketName(k) + ' وما سلّمه وما زال معه.')) + '</p>';
  if (ks.length > 1) h += '<div class="chips" style="padding:0 0 8px">' + ks.map(function(x) { return '<button class="chip' + (x === k ? ' on' : '') + '" onclick="UI.sheet.data.k=' + jsArg(x) + ';render()">' + esc(pocketName(x)) + '</button>'; }).join('') + '</div>';
  function kv(lbl, p, sign, color) { return pairUsd(p) > 0.005 || pairUsd(p) < -0.005 ? '<div class="kv"><span>' + esc(lbl) + '</span><b' + (color ? ' style="color:' + color + '"' : '') + '>' + sign + esc(fmtPair(p)) + '</b></div>' : ''; }
  h += '<div class="card pad">';
  h += kv(t('Collected', 'جبى'), all, '', 'var(--ok)');
  h += kv(t('  · building fees', '  · رسوم البناية'), fees, '');
  h += kv(t('  · for suppliers', '  · للموردين'), forSup, '');
  h += kv(t('Paid to suppliers', 'دفع للموردين'), supOut, '−', 'var(--bad)');
  h += kv(t('Spent for the building', 'صرف للبناية'), spent, '−', 'var(--bad)');
  h += kv(t('Handed to the safe', 'سلّم للصندوق'), handed, '−');
  h += '<div class="bill-total"><span>' + esc(t('Still with ' + pocketName(k), 'ما زال مع ' + pocketName(k))) + '</span><span>' + esc(fmtPair(pk)) + '</span></div>';
  if (pairUsd(pk.pending || pair()) > 0.005) h += '<div class="hint" style="color:var(--warn)">' + esc(t('Of which handed over, waiting for you to confirm: ', 'منها سُلّم وينتظر تأكيدك: ') + fmtPair(pk.pending)) + '</div>';
  if (!pays.length && !exps.length) h += '<div class="muted">' + esc(t('Nothing collected yet', 'لم يجبِ شيئاً بعد')) + '</div>';
  h += '</div>';
  if (isManager() && k !== 'unknown' && pairUsd(pk) > 0.005) h += '<button class="btn sec block" style="margin-top:10px" onclick="openSheet(\'handrecv\',{uid:' + jsArg(k) + '})">⇄ ' + esc(t('I received cash from ' + pocketName(k), 'استلمت نقداً من ' + pocketName(k))) + '</button>';
  h += supplierBillsHtml(k);
  // His movements, newest first: ticks grouped by day and charge, then expenses and handovers.
  var ev = [], g = {};
  pays.forEach(function(p) {
    var ch = byId(S.charges, p.charge_id), key = dayKey(p.received_at) + '|' + p.charge_id + '|' + p.cur, x = g[key];
    if (!x) { x = g[key] = { at: p.received_at, kind: 'in', icon: '↓', amount: 0, cur: p.cur, n: 0, title: ch ? L(ch) : t('Payment', 'دفعة'), units: [] }; ev.push(x); }
    x.amount += num(p.amount); x.n++; var u = byId(S.units, p.unit_id); if (u) x.units.push(unitTag(u));
    if (p.received_at > x.at) x.at = p.received_at;
  });
  ev.forEach(function(x) { x.sub = x.units.slice(0, 6).join(', ') + (x.units.length > 6 ? ' +' + (x.units.length - 6) : ''); });
  var sg = {};
  exps.forEach(function(e) {
    if (e.payment_id) { var key = 'a|' + e.charge_id, y = sg[key]; if (!y) { y = sg[key] = { at: e.spent_on + 'T12:00:00', kind: 'out', icon: '↗', amount: 0, cur: e.cur, title: L(e), sub: t('Counted as paid when collected', 'تُحتسب مدفوعة عند الجباية') }; ev.push(y); } y.amount += num(e.amount); if (e.spent_on + 'T12:00:00' > y.at) y.at = e.spent_on + 'T12:00:00'; return; }
    ev.push({ at: e.spent_on + 'T12:00:00', kind: 'out', icon: catIcon(e.charge_id ? 'supplier' : e.cat), amount: num(e.amount), cur: e.cur, title: L(e), sub: catName(e.charge_id ? 'supplier' : e.cat) + (e.note ? ' · ' + e.note : '') });
  });
  S.handovers.forEach(function(ho) { if ((ho.collector_id || 'unknown') !== k || ho.status === 'rejected') return; ev.push({ at: ho.resolved_at || ho.created_at, kind: 'move', icon: '⇄', amount: 0, cur: 'USD', amtText: fmtPair({ USD: num(ho.usd), LBP: num(ho.lbp) }), title: t('Handed to the safe', 'سلّم للصندوق'), sub: ho.status === 'confirmed' ? t('Confirmed', 'مؤكَّد') : t('Waiting for confirmation', 'بانتظار التأكيد') }); });
  ev.sort(function(a, b) { return String(b.at).localeCompare(String(a.at)); });
  if (ev.length) {
    h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('His history', 'سجلّه')) + '</h2></div>';
    var day = '';
    ev.slice(0, 80).forEach(function(e) {
      var dk = dayKey(String(e.at));
      if (dk !== day) { if (day) h += '</div>'; h += '<div class="daylbl">' + esc(dateLabel(dk)) + '</div><div class="card list">'; day = dk; }
      h += '<div class="li"><div class="ic ' + e.kind + '">' + e.icon + '</div><div class="grow"><b>' + esc(e.title + (e.n > 1 ? ' × ' + e.n : '')) + '</b><small>' + esc(e.sub || '') + '</small></div><span class="amt ' + e.kind + '">' + (e.kind === 'in' ? '+' : e.kind === 'out' ? '−' : '') + esc(e.amtText || fmt(e.amount, e.cur)) + '</span></div>';
    });
    if (day) h += '</div>';
    h += '</div>';
  }
  return h + '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
};
SHEETS.handrecv = function(d) {
  var list = collectorsHolding();
  var h = '<h3>' + esc(t('Cash received from a collector', 'استلمت نقداً من الجابي')) + '</h3><p class="lead">' + esc(t('Everything they hold goes into the safe. They see it in their history.', 'كل ما معه ينتقل إلى الصندوق، ويراه في سجله.')) + '</p>';
  if (!list.length) return h + '<div class="card pad muted">' + esc(t('No collector is holding cash right now.', 'لا يوجد نقد مع أي جابٍ الآن.')) + '</div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
  var sel = d.uid || list[0].id;
  h += '<div class="card list">' + list.map(function(x) {
    return '<button class="li' + (x.id === sel ? ' on' : '') + '" onclick="UI.sheet.data.uid=' + jsArg(x.id) + ';render()"><div class="ic">' + (x.id === sel ? '●' : '○') + '</div><div class="grow"><b>' + esc(memberName(x.id)) + '</b><small>' + esc(x.p.pendingId ? t('Includes a handover waiting for you', 'يشمل تسليماً بانتظارك') : t('Didn\'t send a handover', 'لم يرسل تسليماً')) + '</small></div><span class="amt">' + esc(fmtPair(x.p)) + '</span></button>';
  }).join('') + '</div>';
  h += '<label class="field"><span>' + esc(t('Note (optional)', 'ملاحظة (اختياري)')) + '</span><input class="input" id="hr-note" placeholder="' + esc(t('e.g. Got it at the lobby', 'مثلاً استلمته في المدخل')) + '"></label>';
  var pk = (list.filter(function(x) { return x.id === sel; })[0] || list[0]).p;
  h += '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn ok" onclick="receiveHandover(' + jsArg(sel) + ')">' + esc(t('Received ' + fmtPair(pk) + ', put in safe', 'استلمت ' + fmtPair(pk) + '، للصندوق')) + '</button></div>';
  return h;
};
function receiveHandover(uid) {
  rpc('receive_handover', { p_building: S.building.id, p_collector: uid, p_note: val('hr-note') || null }).then(function() {
    if (isCloud()) reloadBuilding();
    closeSheet(); toast(t('In the safe ✓', 'في الصندوق ✓'));
  }, function(e) { sheetErr(e.message); });
}
function resolveHandover(id, ok) {
  rpc('resolve_handover', { p_handover: id, p_accept: ok }).then(function() {
    if (isCloud()) reloadBuilding();
    closeSheet(); toast(ok ? t('In the safe ✓', 'في الصندوق ✓') : t('Sent back to the collector', 'أُعيد للجابي'));
  }, function(e) { sheetErr(e.message); });
}

/* ---------------------------------------------------------------------------
   Record a payment of any amount: it settles the oldest unpaid charges first
   --------------------------------------------------------------------------- */
function unpaidCells(u, cur) {
  var out = [];
  S.cycles.slice().filter(function(c) { return c.published !== false; }).sort(function(a, b) { return cycleOrderKey(a).localeCompare(cycleOrderKey(b)); }).forEach(function(c) {
    chargesOf(c.id).forEach(function(ch) {
      if (cur && ch.cur !== cur) return;
      var x = cell(ch, u);
      if (x.left > 0) out.push({ ch: ch, cyc: c, left: x.left });
    });
  });
  return out;
}
function allocate(u, cur, amount) {
  var rest = amount, rows = [];
  unpaidCells(u, cur).forEach(function(x) {
    if (rest <= 0) return;
    var a = round(Math.min(rest, x.left), cur);
    if (a <= 0) return;
    rows.push({ ch: x.ch, cyc: x.cyc, amount: a });
    rest = round(rest - a, cur);
  });
  return { rows: rows, extra: rest };
}
SHEETS.pay = function(d) {
  var units = activeUnits();
  var u = byId(S.units, d.unit) || units[0];
  if (!u) return '<p class="lead">' + esc(t('Add apartments first.', 'أضف الشقق أولاً.')) + '</p>';
  var cur = d.cur || 'USD';
  var owed = unitBalance(u, null).owed;
  var amount = d.amount != null ? d.amount : (owed[cur] || '');
  var h = '<h3>' + esc(t('Record a payment', 'سجّل دفعة')) + '</h3><p class="lead">' + esc(t('Any amount. It pays off the oldest charges first.', 'أي مبلغ. يغطي الرسوم الأقدم أولاً.')) + '</p>';
  h += scanBlockPay(d);
  h += '<label class="field"><span>' + esc(t('Apartment', 'الشقة')) + '</span><select class="input" id="pay-unit" onchange="UI.sheet.data.unit=this.value;if(!UI.sheet.data.scan)UI.sheet.data.amount=null;else if(UI.sheet.data.scan===\'error\'&&!/duplicate|مكرر/.test(UI.sheet.data.scanErr||\'\'))UI.sheet.data.scan=\'done\';render()">' + units.map(function(x) { return '<option value="' + esc(x.id) + '"' + (x.id === u.id ? ' selected' : '') + '>' + esc(unitTag(x) + (unitName(x) ? ' · ' + unitName(x) : '')) + '</option>'; }).join('') + '</select></label>';
  h += '<div class="hint">' + esc(t('Owes in total: ', 'المستحق الكلي: ') + fmtPair(owed)) + '</div>';
  h += '<label class="field"><span>' + esc(t('Amount', 'المبلغ')) + '</span><div class="money-in"><input class="input" id="pay-amt" inputmode="decimal" value="' + esc(amount) + '" oninput="payPreview()"><div class="seg"><button class="' + (cur === 'USD' ? 'on' : '') + '" onclick="UI.sheet.data.cur=\'USD\';UI.sheet.data.amount=null;render()">USD</button><button class="' + (cur === 'LBP' ? 'on' : '') + '" onclick="UI.sheet.data.cur=\'LBP\';UI.sheet.data.amount=null;render()">LBP</button></div></div></label>';
  if (isManager()) {
    var ch = d.channel || defaultChannel();
    h += '<label class="field"><span>' + esc(t('Who received it', 'من استلمه')) + '</span><select class="input" id="pay-ch" onchange="UI.sheet.data.channel=this.value">';
    h += '<option value="manager"' + (ch === 'manager' ? ' selected' : '') + '>' + esc(t('Me, in cash', 'أنا، نقداً')) + '</option>';
    collectors().forEach(function(m) { var k = 'collector:' + m.user_id; h += '<option value="' + esc(k) + '"' + (ch === k ? ' selected' : '') + '>' + esc(m.display_name) + '</option>'; });
    PAY_METHODS.forEach(function(pm, pi) { var m = pm.key; h += '<option value="transfer:' + esc(m) + '"' + (ch === 'transfer:' + m || (ch === 'transfer' && pi === 0) ? ' selected' : '') + '>' + esc(t('Transfer · ', 'تحويل · ') + (LANG === 'ar' ? pm.ar : pm.en)) + '</option>'; });
    h += '</select></label>';
  }
  h += '<div id="pay-prev" class="card pad" style="margin-top:12px"></div><div id="sheet-err" class="err"></div>';
  h += '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="savePay()">' + esc(t('Record', 'سجّل')) + '</button></div>';
  setTimeout(payPreview, 0);
  return h;
};
function payPreview() {
  var el = document.getElementById('pay-prev');
  if (!el || !UI.sheet) return;
  var u = byId(S.units, val('pay-unit')), cur = UI.sheet.data.cur || 'USD', amt = num(val('pay-amt'));
  var a = allocate(u, cur, amt);
  var h = '<div style="font-size:12.5px;font-weight:700;color:var(--mut);margin-bottom:4px">' + esc(t('This covers', 'هذا يغطي')) + '</div>';
  if (!a.rows.length) h += '<div class="muted">' + esc(t('Nothing unpaid in ' + cur, 'لا مستحقات بال' + cur)) + '</div>';
  a.rows.forEach(function(r) { h += '<div class="kv"><span>' + esc(cycleTitle(r.cyc) + ' · ' + L(r.ch)) + '</span><b>' + esc(fmt(r.amount, cur)) + '</b></div>'; });
  if (a.extra > 0 && amt > 0) h += '<div class="hint" style="color:var(--warn)">' + esc(t(fmt(a.extra, cur) + ' more than owed. Only what is owed will be recorded.', fmt(a.extra, cur) + ' أكثر من المستحق. سيُسجّل المستحق فقط.')) + '</div>';
  el.innerHTML = h;
}
function savePay() {
  var u = byId(S.units, val('pay-unit')), cur = UI.sheet.data.cur || 'USD', amt = num(val('pay-amt'));
  if (!(amt > 0)) return sheetErr(t('Enter an amount', 'أدخل المبلغ'));
  var a = allocate(u, cur, amt);
  if (!a.rows.length) return sheetErr(t('Nothing unpaid in ' + cur, 'لا مستحقات بال' + cur));
  var chv = isManager() ? val('pay-ch') : 'collector:' + S.me.id;
  var r = chv.indexOf('collector:') === 0 ? { channel: 'collector', received_by: chv.slice(10), method: 'Cash' }
        : chv.indexOf('transfer') === 0 ? { channel: 'transfer', received_by: S.me.id, method: chv.split(':')[1] || 'Whish' }
        : { channel: 'manager', received_by: S.me.id, method: 'Cash' };
  var d = UI.sheet.data, note = d.ref ? 'Ref ' + d.ref + (d.sender ? ' · ' + d.sender : '') : null;
  var btn = document.querySelector('.sheet .foot .btn.pri'); if (btn) btn.disabled = true;
  uploadPhoto(d.photoBlob).then(function(photo) {
    var rows = a.rows.map(function(x) { return { charge_id: x.ch.id, unit_id: u.id, amount: x.amount, cur: cur, channel: r.channel, method: r.method, received_by: r.received_by, received_at: nowIso(), note: note, photo_path: photo }; });
    return dbInsertMany('payments', rows);
  }).then(function() { closeSheet(); toast(t('Recorded ' + fmt(amt - Math.max(0, a.extra), cur) + ' from ' + unitTag(u), 'سُجّل ' + fmt(amt - Math.max(0, a.extra), cur) + ' من ' + unitTag(u))); }, function(e) { if (btn) btn.disabled = false; sheetErr(e.message); });
}

/* ---------------------------------------------------------------------------
   Expenses (from the safe, or cash the collector spent)
   --------------------------------------------------------------------------- */
SHEETS.expense = function(d) {
  var e = d.id ? byId(S.expenses, d.id) : null;
  var sup = d.charge ? byId(S.charges, d.charge) : (e && e.charge_id ? byId(S.charges, e.charge_id) : null);
  var cyc = currentCycle();
  if (e && e.payment_id) { // written by the server when the collector collected a supplier bill
    return '<h3>' + esc(L(e)) + '</h3><p class="lead">' + esc(t('Counted as passed on to the supplier by ' + pocketName(e.paid_by) + ' when it was collected. To change this, set who pays it on the charge, or ask collectors to confirm in Settings.', 'تُحتسب مسلّمة للمورد من ' + pocketName(e.paid_by) + ' عند جبايتها. لتغيير ذلك، حدّد من يدفعها في الرسم، أو اطلب تأكيد الجباة من الإعدادات.')) + '</p>' +
      '<div class="card pad"><div class="kv"><span>' + esc(t('Amount', 'المبلغ')) + '</span><b>' + esc(fmt(e.amount, e.cur)) + '</b></div><div class="kv"><span>' + esc(t('Date', 'التاريخ')) + '</span><b>' + esc(dateLabel(e.spent_on)) + '</b></div></div>' +
      '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
  }
  var v = e || { title: sup ? L(sup) : '', cat: sup ? 'supplier' : 'other', amount: '', cur: sup ? sup.cur : 'USD', paid_from: isManager() ? 'safe' : 'collector', spent_on: todayIso(), cycle_id: sup ? sup.cycle_id : (cyc && cyc.id), ref: '', note: '' };
  if (sup && !e) {
    var got = livePayments().filter(function(p) { return p.charge_id === sup.id; }).reduce(function(s, p) { return s + num(p.amount); }, 0);
    var out = liveExpenses().filter(function(x) { return x.charge_id === sup.id; }).reduce(function(s, x) { return s + num(x.amount); }, 0);
    var inSafe = (supplierState(sup).by.safe || {}).left;
    v.amount = d.amt != null ? d.amt : inSafe > 0 ? inSafe : round(got - out, sup.cur);
    v.paid_from = 'safe';
    v.title = t('Paid to supplier · ', 'دفع للمورد · ') + L(sup);
  }
  var st = UI.sheet.data;
  if (st.cur) v.cur = st.cur; if (st.cat) v.cat = st.cat; if (st.from) v.paid_from = st.from;
  var h = '<h3>' + esc(e ? t('Expense', 'مصروف') : sup ? t('Pay the supplier from the safe', 'ادفع للمورد من الصندوق') : t('Money spent', 'مصروف جديد')) + '</h3>';
  if (sup && !e) h += '<p class="lead">' + esc(t('Only for supplier money that reached the safe. Money a collector collected and handed to the supplier himself is ticked from Supplier bills.', 'فقط لمال المورد الذي وصل إلى الصندوق. ما جباه الجابي وسلّمه للمورد بنفسه يُؤشَّر من فواتير الموردين.')) + '</p>';
  if (!e && !sup) h += '<p class="lead">' + esc(t('Anything paid for the building: fuel, repairs, cleaning…', 'أي شيء دُفع للبناية: مازوت، تصليح، تنظيف…')) + '</p>';
  h += scanBlockExpense(st, e);
  if (!sup && !e && d.reg && !st.regApplied) { applyRegular(d.reg, true); }
  if (!sup && !e) h += regularChipsHtml(st);
  if (!sup) {
    h += '<div class="chips" style="padding:2px 0 4px;flex-wrap:wrap">';
    Object.keys(CATS).forEach(function(k) { if (k === 'supplier') return; h += '<button class="chip' + (v.cat === k ? ' on' : '') + '" onclick="UI.sheet.data.cat=\'' + k + '\';keepExpense();render()">' + CATS[k][0] + ' ' + esc(catName(k)) + '</button>'; });
    h += '</div>';
  }
  if (!sup && !e) h += '<label class="field"><span>' + esc(t('Common expenses', 'مصاريف شائعة')) + '</span>' + presetSelect('ex-pre', EXPENSE_PRESETS, 'expensePreset(this.value)') + '</label>';
  h += '<label class="field"><span>' + esc(t('What for', 'لماذا')) + '</span><input class="input" id="ex-title" dir="ltr" data-tr="ex-title-ar" data-tr-kind="phrase" value="' + esc(st.title != null ? st.title : v.title) + '" placeholder="' + esc(t('e.g. 200L diesel', 'مثلاً 200L diesel')) + '"><div class="tr-box" id="trs-ex-title"></div></label>';
  h += '<label class="field"><span>' + esc(t('In Arabic (optional)', 'بالعربية (اختياري)')) + '</span><input class="input" id="ex-title-ar" dir="rtl" data-tr="ex-title" data-tr-kind="phrase" value="' + esc(st.title_ar != null ? st.title_ar : (v.title_ar || '')) + '" placeholder="' + esc('مثلاً 200 ليتر مازوت') + '"><div class="tr-box" id="trs-ex-title-ar"></div></label>';
  if (blocks().length > 1 && setting('safe_mode') === 'block') {
    var eb = st.block != null ? st.block : (v.block || UI.block || blocks()[0]);
    h += '<label class="field"><span>' + esc(t('Whose safe', 'صندوق أي بلوك')) + '</span><div class="seg">' + blocks().map(function(b) { return '<button class="' + (eb === b ? 'on' : '') + '" onclick="keepExpense();UI.sheet.data.block=' + jsArg(b) + ';render()">' + esc(blockLabel(b)) + '</button>'; }).join('') + '</div></label>';
    UI.sheet.data.block = eb;
  }
  h += '<label class="field"><span>' + esc(t('Amount', 'المبلغ')) + '</span><div class="money-in"><input class="input" id="ex-amt" inputmode="decimal" value="' + esc(st.amount != null ? st.amount : v.amount) + '"><div class="seg"><button class="' + (v.cur === 'USD' ? 'on' : '') + '" onclick="keepExpense();UI.sheet.data.cur=\'USD\';render()">USD</button><button class="' + (v.cur === 'LBP' ? 'on' : '') + '" onclick="keepExpense();UI.sheet.data.cur=\'LBP\';render()">LBP</button></div></div></label>';
  h += fxField('ex-fx', v.cur, st.fx || v.fx || (v.orig_cur === 'LBP' ? v.fx : null), 'ex-amt');
  if (isManager()) {
    h += '<label class="field"><span>' + esc(t('Paid from', 'دُفع من')) + '</span><div class="seg"><button class="' + (v.paid_from === 'safe' ? 'on' : '') + '" onclick="keepExpense();UI.sheet.data.from=\'safe\';render()">' + esc(t('The safe', 'الصندوق')) + '</button>';
    if (collectorKeys().length) h += '<button class="' + (v.paid_from === 'collector' ? 'on' : '') + '" onclick="keepExpense();UI.sheet.data.from=\'collector\';render()">' + esc(t(pocketName(collectorKeys()[0]) + '\'s pocket', 'جيب ' + pocketName(collectorKeys()[0]))) + '</button>';
    h += '</div></label>';
  }
  h += '<div class="two"><label class="field"><span>' + esc(t('Date', 'التاريخ')) + '</span><input class="input" type="date" id="ex-date" value="' + esc(st.date || v.spent_on) + '"></label>';
  h += '<label class="field"><span>' + esc(t('Month', 'الشهر')) + '</span><select class="input" id="ex-cyc">' + visibleCycles().map(function(c) { return '<option value="' + esc(c.id) + '"' + (c.id === (st.cyc || v.cycle_id) ? ' selected' : '') + '>' + esc(cycleTitle(c)) + '</option>'; }).join('') + '</select></label></div>';
  h += '<label class="field"><span>' + esc(t('Receipt or invoice number (optional)', 'رقم الإيصال (اختياري)')) + '</span><input class="input" id="ex-ref" value="' + esc(st.ref != null ? st.ref : (v.ref || '')) + '"></label>';
  h += '<label class="field"><span>' + esc(t('Notes (optional)', 'ملاحظات (اختياري)')) + '</span><textarea class="input" id="ex-note" rows="2" style="min-height:64px;resize:vertical" placeholder="' + esc(t('e.g. glass cleaner for the entrance door, bought at Spinneys', 'مثلاً منظّف زجاج لباب المدخل')) + '">' + esc(st.note != null ? st.note : (v.note || '')) + '</textarea></label>';
  if (!sup && !e && isManager() && !st.reg) h += '<button class="btn sec sm" style="margin-top:4px" onclick="keepExpense();regularFromExpense()">☆ ' + esc(t('Make this a regular bill', 'اجعلها فاتورة دورية')) + '</button><small class="hint" style="display:block;margin-top:4px">' + esc(t('Next time it is one tap: only the amount to type.', 'في المرة القادمة بنقرة واحدة: تكتب المبلغ فقط.')) + '</small>';
  h += '<div id="sheet-err" class="err"></div><div class="foot">';
  if (e && (isManager() || (e.paid_by === S.me.id && !e.handover_id))) h += '<button class="btn danger" onclick="voidExpense(' + jsArg(e.id) + ')">' + esc(t('Cancel it', 'إلغاء')) + '</button>';
  h += '<button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button>';
  if (!e || isManager()) h += '<button class="btn pri" onclick="saveExpense(' + jsArg(e ? e.id : '') + ',' + jsArg(sup ? sup.id : '') + ')">' + esc(t('Save', 'حفظ')) + '</button>';
  return h + '</div>';
};
/* ---------------------------------------------------------------------------
   Regular bills: bills the building pays again and again with a changing amount
   (moteur, elevator). Set up once, then Money spent offers them as one tap and
   only the amount is typed. Kept in the building's settings.
   --------------------------------------------------------------------------- */
function regularBills() { var r = setting('regular_bills'); return Array.isArray(r) ? r : []; }
function regMatch(e, r) { return !e.charge_id && e.cat === r.cat && String(e.title || '').toLowerCase().indexOf(String(r.name || '').toLowerCase()) === 0; }
function regLast(r) {
  var xs = liveExpenses().filter(function(e) { return regMatch(e, r); }).sort(function(a, b) { return String(b.spent_on).localeCompare(String(a.spent_on)); });
  return xs[0] || null;
}
/* Entered this calendar month? */
function regDone(r) { var m = todayIso().slice(0, 7); return liveExpenses().some(function(e) { return regMatch(e, r) && String(e.spent_on).slice(0, 7) === m; }); }
function regularChipsHtml(st) {
  var rs = regularBills();
  if (!rs.length) return '';
  return '<div class="field" style="margin-bottom:6px"><span>' + esc(t('Regular bills', 'فواتير دورية')) + '</span><div class="chips" style="padding:2px 0 4px;flex-wrap:wrap">' + rs.map(function(r) {
    var last = regLast(r);
    return '<button class="chip' + (st.reg === r.id ? ' on' : '') + '" onclick="keepExpense();applyRegular(' + jsArg(r.id) + ')">' + catIcon(r.cat) + ' ' + esc(LANG === 'ar' && r.name_ar ? r.name_ar : r.name) + (last ? ' <span class="cnt">' + esc(fmt(last.amount, last.cur)) + '</span>' : '') + '</button>';
  }).join('') + '</div></div>';
}
function applyRegular(id, silent) {
  var r = regularBills().filter(function(x) { return x.id === id; })[0], d = UI.sheet && UI.sheet.data;
  if (!r || !d) return;
  d.reg = r.id; d.regApplied = true;
  d.title = r.name; d.title_ar = r.name_ar || ''; d.cat = r.cat; d.cur = r.cur || 'USD';
  d.fx = r.cur === 'LBP' && r.fx ? String(r.fx) : d.fx;
  if (isManager()) d.from = r.from || 'safe';
  if (!silent) { render(); setTimeout(function() { var a = document.getElementById('ex-amt'); if (a) a.focus(); }, 50); }
}
function regularFromExpense() {
  var d = UI.sheet.data, name = (d.title || '').trim();
  if (!name) return sheetErr(t('Write what it is for first, e.g. "Bechalani · Moteur"', 'اكتب لماذا أولاً، مثلاً "بشعلاني · موتور"'));
  var r = { id: 'r' + Date.now().toString(36), name: name, name_ar: (d.title_ar || '').trim() || null, cat: d.cat || 'other', cur: d.cur || 'USD', fx: d.cur === 'LBP' && num(d.fx) ? num(d.fx) : null, from: d.from || 'safe' };
  saveRegulars(regularBills().concat([r])).then(function() { d.reg = r.id; d.regApplied = true; toast(t('Saved as a regular bill', 'حُفظت كفاتورة دورية')); render(); }, fail);
}
function saveRegulars(list) {
  var st = Object.assign({}, S.building.settings || {}); st.regular_bills = list;
  S.building.settings = st;
  return dbUpdate('buildings', S.building.id, { settings: st });
}
function regularBillsSettingsHtml() {
  if (!isManager()) return '';
  var rs = regularBills();
  var h = '<div class="sec"><div class="sec-h"><h2>' + esc(t('Regular bills', 'الفواتير الدورية')) + '</h2><button onclick="openSheet(\'regbill\',{})">＋ ' + esc(t('Add', 'إضافة')) + '</button></div>';
  if (!rs.length) return h + '<div class="card empty">' + esc(t('Bills the building pays every month with a different amount, like the moteur or the elevator. Add one and Money spent offers it in one tap.', 'فواتير تدفعها البناية كل شهر بمبلغ مختلف، مثل الموتور أو المصعد. أضف واحدة وتظهر في المصاريف بنقرة.')) + '</div></div>';
  h += '<div class="card list">' + rs.map(function(r) {
    var last = regLast(r);
    return '<button class="li" onclick="openSheet(\'regbill\',{id:' + jsArg(r.id) + '})"><div class="ic">' + catIcon(r.cat) + '</div><div class="grow"><b>' + esc(LANG === 'ar' && r.name_ar ? r.name_ar : r.name) + '</b><small>' + esc([catName(r.cat), r.from === 'collector' ? t('paid by ', 'يدفعها ') + collectorLabel() : t('from the safe', 'من الصندوق'), r.cur === 'LBP' ? 'LBP' + (r.fx ? ' @ ' + num(r.fx).toLocaleString('en-US') : '') : '$', last ? t('last ', 'آخر ') + fmt(last.amount, last.cur) + ' · ' + dateLabel(last.spent_on) : ''].filter(Boolean).join(' · ')) + '</small></div><span class="chev">›</span></button>';
  }).join('') + '</div></div>';
  return h;
}
SHEETS.regbill = function(d) {
  var r = d.id ? regularBills().filter(function(x) { return x.id === d.id; })[0] : null;
  var v = Object.assign({ name: '', name_ar: '', cat: 'gen', cur: 'USD', fx: '', from: 'safe' }, r || {}, d.st || {});
  var h = '<h3>' + esc(r ? t('Regular bill', 'فاتورة دورية') : t('New regular bill', 'فاتورة دورية جديدة')) + '</h3><p class="lead">' + esc(t('Its name, category and who pays stay the same every time; only the amount changes.', 'الاسم والفئة ومن يدفع تبقى نفسها؛ المبلغ فقط يتغيّر.')) + '</p>';
  h += '<label class="field"><span>' + esc(t('Name (supplier · what)', 'الاسم (المورد · ماذا)')) + '</span><input class="input" id="rb-name" value="' + esc(v.name) + '" placeholder="Bechalani · Moteur"></label>';
  h += '<label class="field"><span>' + esc(t('In Arabic (optional)', 'بالعربية (اختياري)')) + '</span><input class="input" id="rb-ar" dir="rtl" value="' + esc(v.name_ar || '') + '"></label>';
  h += '<div class="chips" style="padding:2px 0 8px;flex-wrap:wrap">' + Object.keys(CATS).filter(function(k) { return k !== 'supplier'; }).map(function(k) { return '<button class="chip' + (v.cat === k ? ' on' : '') + '" onclick="regKeep();UI.sheet.data.st.cat=\'' + k + '\';render()">' + CATS[k][0] + ' ' + esc(catName(k)) + '</button>'; }).join('') + '</div>';
  h += '<label class="field"><span>' + esc(t('Usually in', 'عادة بعملة')) + '</span><div class="seg"><button class="' + (v.cur === 'USD' ? 'on' : '') + '" onclick="regKeep();UI.sheet.data.st.cur=\'USD\';render()">USD</button><button class="' + (v.cur === 'LBP' ? 'on' : '') + '" onclick="regKeep();UI.sheet.data.st.cur=\'LBP\';render()">LBP</button></div></label>';
  if (v.cur === 'LBP') h += '<label class="field"><span>' + esc(t('Its own exchange rate (empty = it changes each bill)', 'سعر الصرف الخاص (فارغ = يتغيّر كل فاتورة)')) + '</span><input class="input" id="rb-fx" inputmode="decimal" value="' + esc(v.fx || '') + '" placeholder="' + esc(String(rate())) + '"></label>';
  h += '<label class="field"><span>' + esc(t('Paid from', 'تُدفع من')) + '</span><div class="seg"><button class="' + (v.from !== 'collector' ? 'on' : '') + '" onclick="regKeep();UI.sheet.data.st.from=\'safe\';render()">' + esc(t('The safe', 'الصندوق')) + '</button><button class="' + (v.from === 'collector' ? 'on' : '') + '" onclick="regKeep();UI.sheet.data.st.from=\'collector\';render()">' + esc(t(collectorLabel() + '\'s pocket', 'جيب ' + collectorLabel())) + '</button></div></label>';
  h += '<div id="sheet-err" class="err"></div><div class="foot">' + (r ? '<button class="btn danger" onclick="regDelete(' + jsArg(r.id) + ')">' + esc(t('Remove', 'حذف')) + '</button>' : '') + '<button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button><button class="btn pri" onclick="regSave(' + jsArg(r ? r.id : '') + ')">' + esc(t('Save', 'حفظ')) + '</button></div>';
  return h;
};
function regKeep() {
  var d = UI.sheet.data; d.st = d.st || {};
  d.st.name = val('rb-name'); d.st.name_ar = val('rb-ar');
  if (document.getElementById('rb-fx')) d.st.fx = val('rb-fx');
}
function regSave(id) {
  regKeep();
  var d = UI.sheet.data, r0 = id ? regularBills().filter(function(x) { return x.id === id; })[0] : {};
  var r = Object.assign({}, r0, d.st);
  r.name = (r.name || '').trim(); r.name_ar = (r.name_ar || '').trim() || null;
  if (!r.name) return sheetErr(t('Give it a name', 'أعطها اسماً'));
  r.cat = r.cat || 'gen'; r.cur = r.cur || 'USD'; r.from = r.from || 'safe'; r.fx = r.cur === 'LBP' && num(r.fx) ? num(r.fx) : null;
  if (!id) r.id = 'r' + Date.now().toString(36);
  var list = regularBills().filter(function(x) { return x.id !== r.id; }).concat([r]);
  saveRegulars(list).then(function() { closeSheet(); toast(t('Saved', 'تم الحفظ')); }, function(e) { sheetErr(e.message); });
}
function regDelete(id) {
  saveRegulars(regularBills().filter(function(x) { return x.id !== id; })).then(function() { closeSheet(); toast(t('Removed. Past expenses stay.', 'حُذفت. المصاريف السابقة تبقى.')); }, fail);
}
/* Home: regular bills not entered yet this month. */
function regularDueHtml() {
  if (!isManager() || isSharedBook()) return '';
  var due = regularBills().filter(function(r) { return !regDone(r); });
  if (!due.length) return '';
  var mon = new Date().toLocaleDateString(LANG === 'ar' ? 'ar-LB' : 'en-GB', { month: 'long' });
  return '<div class="sec"><div class="sec-h"><h2>' + esc(t('Bills to enter for ' + mon, 'فواتير لإدخالها عن ' + mon)) + '</h2></div><div class="card list">' + due.map(function(r) {
    var last = regLast(r);
    return '<button class="li" onclick="openSheet(\'expense\',{reg:' + jsArg(r.id) + '})"><div class="ic">' + catIcon(r.cat) + '</div><div class="grow"><b>' + esc(LANG === 'ar' && r.name_ar ? r.name_ar : r.name) + '</b><small>' + esc(last ? t('Last: ', 'الأخيرة: ') + fmt(last.amount, last.cur) + ' · ' + dateLabel(last.spent_on) : t('Not entered yet', 'لم تُدخل بعد')) + '</small></div><span class="chev">›</span></button>';
  }).join('') + '</div></div>';
}
function expensePreset(i) {
  if (i === '') return;
  keepExpense();
  var p = EXPENSE_PRESETS[i];
  UI.sheet.data.title = p.en; UI.sheet.data.title_ar = p.ar;
  UI.sheet.data.cat = p.cat;
  render();
}
function keepExpense() {
  var d = UI.sheet.data;
  if (document.getElementById('ex-fx')) d.fx = val('ex-fx');
  d.title = val('ex-title'); if (document.getElementById('ex-title-ar')) d.title_ar = val('ex-title-ar'); d.amount = val('ex-amt'); d.date = val('ex-date'); d.cyc = val('ex-cyc'); d.ref = val('ex-ref');
  if (document.getElementById('ex-note')) d.note = val('ex-note');
}
function saveExpense(id, supId) {
  keepExpense();
  var d = UI.sheet.data, e = id ? byId(S.expenses, id) : null;
  var cat = d.cat || (e && e.cat) || (supId ? 'supplier' : 'other');
  var row = { title: (d.title || '').trim() || (d.title_ar || '').trim(), title_ar: (d.title_ar || '').trim() || null, amount: num(d.amount), cur: d.cur || (e && e.cur) || (supId ? byId(S.charges, supId).cur : 'USD'), cat: cat,
              spent_on: d.date || todayIso(), cycle_id: d.cyc || null, ref: d.ref || null, note: (d.note || '').trim() || null,
              paid_from: isManager() ? (d.from || (e && e.paid_from) || 'safe') : 'collector' };
  if (row.cur === 'LBP') row.fx = num(d.fx) || rate();
  if (!row.title) return sheetErr(t('Say what it was for', 'اذكر السبب'));
  if (!(row.amount > 0)) return sheetErr(t('Enter an amount', 'أدخل المبلغ'));
  if (supId) row.charge_id = supId;
  if (blocks().length > 1 && setting('safe_mode') === 'block') row.block = d.block || null;
  if (!e) row.paid_by = row.paid_from === 'collector' && isManager() ? (function(k) { return k && k !== 'unknown' ? k : null; })(collectorKeys()[0]) : S.me.id;
  var btn = document.querySelector('.sheet .foot .btn.pri'); if (btn) btn.disabled = true;
  uploadPhoto(d.photoBlob).then(function(photo) {
    if (photo) row.photo_path = photo;
    return e ? dbUpdate('expenses', id, row) : dbInsert('expenses', row);
  }).then(function() { closeSheet(); toast(t('Saved', 'تم الحفظ')); }, function(err) { if (btn) btn.disabled = false; sheetErr(err.message); });
}
function voidExpense(id) {
  dbUpdate('expenses', id, { voided_at: nowIso() }).then(function() { closeSheet(); toast(t('Expense cancelled', 'أُلغي المصروف')); }, function(e) { sheetErr(e.message); });
}
