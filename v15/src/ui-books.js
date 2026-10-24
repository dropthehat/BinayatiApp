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
  h += tile(t('With collectors', 'مع الجباة'), fmtPairBig(cash.withCollector), Object.keys(cash.pockets).filter(function(k) { return pairUsd(cash.pockets[k]) > 0.005; }).map(function(k) { return memberName(k) + ' ' + fmtPair(cash.pockets[k]); }).join(' · ') || t('Nothing outstanding', 'لا شيء معلّق'), '', 'var(--warn)');
  if (pairUsd(cash.supplier) > 0.005) h += tile(t('Of which for suppliers', 'منها للموردين'), fmtPairBig(cash.supplier), t('Moteur, internet… not building money', 'موتور، إنترنت… ليست أموال البناية'), '', 'var(--info)');
  h += tile(t('Building money', 'أموال البناية'), fmtPairBig(cash.building), t('Safe + collectors − suppliers', 'الصندوق + الجباة − الموردين'), '', 'var(--acc)', 'wide');
  h += '</div>';
  if (isManager() && collectorsHolding().length) h += '<button class="btn sec block" style="margin-top:10px" onclick="openSheet(\'handrecv\',{})">⇄ ' + esc(t('Received cash from a collector', 'استلمت نقداً من الجابي')) + '</button>';
  h += '</div>';

  // Supplier pass-through to settle
  var cyc = currentCycle();
  var sups = S.charges.filter(function(c) { return c.pass_through; }).map(function(c) {
    var got = livePayments().filter(function(p) { return p.charge_id === c.id; }).reduce(function(s, p) { return s + num(p.amount); }, 0);
    var out = liveExpenses().filter(function(e) { return e.charge_id === c.id; }).reduce(function(s, e) { return s + num(e.amount); }, 0);
    return { c: c, got: got, out: out, left: round(got - out, c.cur) };
  }).filter(function(x) { return x.left > 0; });
  if (sups.length) {
    h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('To pass on to suppliers', 'للدفع للموردين')) + '</h2></div><div class="card list">';
    sups.forEach(function(x) {
      h += '<div class="li"><div class="ic">↗</div><div class="grow"><b>' + esc(L(x.c)) + '</b><small>' + esc(cycleTitle(byId(S.cycles, x.c.cycle_id)) + ' · ' + t('collected ', 'محصّل ') + fmt(x.got, x.c.cur)) + '</small></div>' + (isManager() ? '<button class="btn sm sec" onclick="openSheet(\'expense\',{charge:' + jsArg(x.c.id) + '})">' + esc(t('Pay ', 'ادفع ') + fmt(x.left, x.c.cur)) + '</button>' : '<span class="amt">' + esc(fmt(x.left, x.c.cur)) + '</span>') + '</div>';
    });
    h += '</div></div>';
  }

  // Cycle filter + ledger
  var f = UI.booksCycle || 'all';
  h += '<div class="chips" style="margin-top:16px"><button class="chip' + (f === 'all' ? ' on' : '') + '" onclick="UI.booksCycle=\'all\';render()">' + esc(t('Everything', 'الكل')) + '</button>';
  visibleCycles().forEach(function(c) { h += '<button class="chip' + (f === c.id ? ' on' : '') + '" onclick="UI.booksCycle=' + jsArg(c.id) + ';render()">' + esc(cycleTitle(c)) + '</button>'; });
  h += '</div>';
  var entries = ledger(f === 'all' ? null : f);
  var tin = pair(), tout = pair();
  entries.forEach(function(e) { if (e.kind === 'in') addTo(tin, e.cur, e.amount); if (e.kind === 'out') addTo(tout, e.cur, e.amount); });
  h += '<div class="sec"><div class="card pad"><div class="kv"><span>' + esc(t('Money in', 'المقبوض')) + '</span><b style="color:var(--ok)">' + esc(fmtPair(tin)) + '</b></div><div class="kv"><span>' + esc(t('Money out', 'المصروف')) + '</span><b style="color:var(--bad)">' + esc(fmtPair(tout)) + '</b></div>';
  if (f !== 'all') h += '<button class="btn sec block" style="margin-top:10px" onclick="shareReport(' + jsArg(f) + ')">' + esc(t('Share the month\'s report on WhatsApp', 'شارك تقرير الشهر على واتساب')) + '</button>';
  h += '</div>';
  var day = '';
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
  var out = [], groups = {};
  var cycCharges = {};
  if (cycleId) chargesOf(cycleId).forEach(function(c) { cycCharges[c.id] = 1; });
  livePayments().forEach(function(p) {
    if (cycleId && !cycCharges[p.charge_id]) return;
    var u = byId(S.units, p.unit_id), ch = byId(S.charges, p.charge_id);
    var k = p.unit_id + '|' + dayKey(p.received_at) + '|' + p.channel + '|' + p.received_by + '|' + p.cur;
    var g = groups[k];
    if (!g) {
      g = groups[k] = { kind: 'in', icon: '↓', at: p.received_at, amount: 0, cur: p.cur, titles: [], unit: u, p: p };
      out.push(g);
    }
    g.amount += num(p.amount);
    if (ch) g.titles.push(L(ch));
    if (p.received_at > g.at) g.at = p.received_at;
  });
  out.forEach(function(g) {
    var p = g.p;
    g.title = (g.unit ? g.unit.code + (unitName(g.unit) ? ' · ' + unitName(g.unit) : '') : t('Apartment', 'شقة'));
    var who = p.channel === 'collector' ? (handoverConfirmed(p.handover_id) ? memberName(p.received_by) + ' → ' + t('safe', 'الصندوق') : t('with ', 'مع ') + memberName(p.received_by)) : p.channel === 'transfer' ? (p.method || t('Transfer', 'تحويل')) : memberName(p.received_by);
    g.sub = g.titles.join(', ') + ' · ' + who;
    if (g.unit) g.onclick = 'openSheet(\'unit\',{id:' + jsArg(g.unit.id) + '})';
  });
  liveExpenses().forEach(function(e) {
    if (cycleId && e.cycle_id !== cycleId && !(e.charge_id && cycCharges[e.charge_id])) return;
    out.push({ kind: 'out', icon: catIcon(e.charge_id ? 'supplier' : e.cat), at: (e.spent_on === dayKey(e.created_at) ? e.created_at : e.spent_on + 'T12:00:00'), amount: num(e.amount), cur: e.cur,
               title: e.title, sub: catName(e.charge_id ? 'supplier' : e.cat) + ' · ' + (e.paid_from === 'collector' ? t('paid by ', 'دفعه ') + memberName(e.paid_by) : t('from the safe', 'من الصندوق')) + (e.ref ? ' · #' + e.ref : '') + origNote(e),
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
  if (spent.length) {
    lines.push('');
    lines.push('*' + t('Spent', 'المصاريف') + '*');
    spent.forEach(function(e) { lines.push('• ' + e.title + ': ' + fmt(e.amount, e.cur)); });
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
  var who = e.actor_name || memberName(e.actor);
  var u = d.unit_id && byId(S.units, d.unit_id), ch = d.charge_id && byId(S.charges, d.charge_id);
  var code = u ? u.code : '';
  switch (e.tbl) {
    case 'payments':
      if (e.action === 'insert') return t(who + ' recorded ' + fmt(d.amount, d.cur) + ' from ' + code + (ch ? ' · ' + ch.title : ''), who + ' سجّل ' + fmt(d.amount, d.cur) + ' من ' + code + (ch ? ' · ' + (ch.title_ar || ch.title) : ''));
      if (d.voided_at && !old.voided_at) return t(who + ' undid ' + fmt(d.amount, d.cur) + ' from ' + code, who + ' ألغى ' + fmt(d.amount, d.cur) + ' من ' + code);
      return null;
    case 'expenses':
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
function eventRow(e) {
  var txt = eventText(e);
  if (!txt) return '';
  var who = e.actor_name || memberName(e.actor);
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
  if (exps.length) h += '<div class="card list" style="margin-top:10px">' + exps.map(function(e) { return '<div class="li"><div class="ic out">' + catIcon(e.cat) + '</div><div class="grow"><b>' + esc(e.title) + '</b><small>' + esc(dateLabel(e.spent_on)) + '</small></div><span class="amt out">−' + esc(fmt(e.amount, e.cur)) + '</span></div>'; }).join('') + '</div>';
  h += '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn danger" onclick="resolveHandover(' + jsArg(ho.id) + ',false)">' + esc(t('Didn\'t get it', 'لم أستلم')) + '</button><button class="btn ok" onclick="resolveHandover(' + jsArg(ho.id) + ',true)">' + esc(t('Received, put in safe', 'استلمت، للصندوق')) + '</button></div>';
  return h;
};
/* Manager: "I received cash from the collector" even if he didn't start a handover. */
function collectorsHolding() {
  var cash = cashState();
  return Object.keys(cash.pockets).filter(function(k) { return pairUsd(cash.pockets[k]) > 0.005 || cash.pockets[k].pendingId; }).map(function(k) { return { id: k, p: cash.pockets[k] }; });
}
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
  h += '<label class="field"><span>' + esc(t('Apartment', 'الشقة')) + '</span><select class="input" id="pay-unit" onchange="UI.sheet.data.unit=this.value;if(!UI.sheet.data.scan)UI.sheet.data.amount=null;else if(UI.sheet.data.scan===\'error\'&&!/duplicate|مكرر/.test(UI.sheet.data.scanErr||\'\'))UI.sheet.data.scan=\'done\';render()">' + units.map(function(x) { return '<option value="' + esc(x.id) + '"' + (x.id === u.id ? ' selected' : '') + '>' + esc(x.code + (unitName(x) ? ' · ' + unitName(x) : '')) + '</option>'; }).join('') + '</select></label>';
  h += '<div class="hint">' + esc(t('Owes in total: ', 'المستحق الكلي: ') + fmtPair(owed)) + '</div>';
  h += '<label class="field"><span>' + esc(t('Amount', 'المبلغ')) + '</span><div class="money-in"><input class="input" id="pay-amt" inputmode="decimal" value="' + esc(amount) + '" oninput="payPreview()"><div class="seg"><button class="' + (cur === 'USD' ? 'on' : '') + '" onclick="UI.sheet.data.cur=\'USD\';UI.sheet.data.amount=null;render()">USD</button><button class="' + (cur === 'LBP' ? 'on' : '') + '" onclick="UI.sheet.data.cur=\'LBP\';UI.sheet.data.amount=null;render()">LBP</button></div></div></label>';
  if (isManager()) {
    var ch = d.channel || defaultChannel();
    h += '<label class="field"><span>' + esc(t('Who received it', 'من استلمه')) + '</span><select class="input" id="pay-ch" onchange="UI.sheet.data.channel=this.value">';
    h += '<option value="manager"' + (ch === 'manager' ? ' selected' : '') + '>' + esc(t('Me, in cash', 'أنا، نقداً')) + '</option>';
    collectors().forEach(function(m) { var k = 'collector:' + m.user_id; h += '<option value="' + esc(k) + '"' + (ch === k ? ' selected' : '') + '>' + esc(m.display_name) + '</option>'; });
    ['Whish', 'OMT', 'Bank'].forEach(function(m) { h += '<option value="transfer:' + m + '"' + (ch === 'transfer:' + m || (ch === 'transfer' && m === 'Whish') ? ' selected' : '') + '>' + esc(t('Transfer · ', 'تحويل · ') + m) + '</option>'; });
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
  }).then(function() { closeSheet(); toast(t('Recorded ' + fmt(amt - Math.max(0, a.extra), cur) + ' from ' + u.code, 'سُجّل ' + fmt(amt - Math.max(0, a.extra), cur) + ' من ' + u.code)); }, function(e) { if (btn) btn.disabled = false; sheetErr(e.message); });
}

/* ---------------------------------------------------------------------------
   Expenses (from the safe, or cash the collector spent)
   --------------------------------------------------------------------------- */
SHEETS.expense = function(d) {
  var e = d.id ? byId(S.expenses, d.id) : null;
  var sup = d.charge ? byId(S.charges, d.charge) : (e && e.charge_id ? byId(S.charges, e.charge_id) : null);
  var cyc = currentCycle();
  var v = e || { title: sup ? L(sup) : '', cat: sup ? 'supplier' : 'other', amount: '', cur: sup ? sup.cur : 'USD', paid_from: isManager() ? 'safe' : 'collector', spent_on: todayIso(), cycle_id: sup ? sup.cycle_id : (cyc && cyc.id), ref: '', note: '' };
  if (sup && !e) {
    var got = livePayments().filter(function(p) { return p.charge_id === sup.id; }).reduce(function(s, p) { return s + num(p.amount); }, 0);
    var out = liveExpenses().filter(function(x) { return x.charge_id === sup.id; }).reduce(function(s, x) { return s + num(x.amount); }, 0);
    v.amount = round(got - out, sup.cur);
    v.title = t('Paid supplier · ', 'دفع للمورد · ') + L(sup);
  }
  var st = UI.sheet.data;
  if (st.cur) v.cur = st.cur; if (st.cat) v.cat = st.cat; if (st.from) v.paid_from = st.from;
  var h = '<h3>' + esc(e ? t('Expense', 'مصروف') : sup ? t('Pay the supplier', 'ادفع للمورد') : t('Money spent', 'مصروف جديد')) + '</h3>';
  if (!e && !sup) h += '<p class="lead">' + esc(t('Anything paid for the building: fuel, repairs, cleaning…', 'أي شيء دُفع للبناية: مازوت، تصليح، تنظيف…')) + '</p>';
  h += scanBlockExpense(st, e);
  if (!sup) {
    h += '<div class="chips" style="padding:2px 0 4px;flex-wrap:wrap">';
    Object.keys(CATS).forEach(function(k) { if (k === 'supplier') return; h += '<button class="chip' + (v.cat === k ? ' on' : '') + '" onclick="UI.sheet.data.cat=\'' + k + '\';keepExpense();render()">' + CATS[k][0] + ' ' + esc(catName(k)) + '</button>'; });
    h += '</div>';
  }
  if (!sup && !e) h += '<label class="field"><span>' + esc(t('Common expenses', 'مصاريف شائعة')) + '</span>' + presetSelect('ex-pre', EXPENSE_PRESETS, 'expensePreset(this.value)') + '</label>';
  h += '<label class="field"><span>' + esc(t('What for', 'لماذا')) + '</span><input class="input" id="ex-title" value="' + esc(st.title != null ? st.title : v.title) + '" placeholder="' + esc(t('e.g. 200L diesel', 'مثلاً 200 ليتر مازوت')) + '"></label>';
  h += '<label class="field"><span>' + esc(t('Amount', 'المبلغ')) + '</span><div class="money-in"><input class="input" id="ex-amt" inputmode="decimal" value="' + esc(st.amount != null ? st.amount : v.amount) + '"><div class="seg"><button class="' + (v.cur === 'USD' ? 'on' : '') + '" onclick="keepExpense();UI.sheet.data.cur=\'USD\';render()">USD</button><button class="' + (v.cur === 'LBP' ? 'on' : '') + '" onclick="keepExpense();UI.sheet.data.cur=\'LBP\';render()">LBP</button></div></div></label>';
  h += fxField('ex-fx', v.cur, st.fx || v.fx || (v.orig_cur === 'LBP' ? v.fx : null), 'ex-amt');
  if (isManager()) {
    h += '<label class="field"><span>' + esc(t('Paid from', 'دُفع من')) + '</span><div class="seg"><button class="' + (v.paid_from === 'safe' ? 'on' : '') + '" onclick="keepExpense();UI.sheet.data.from=\'safe\';render()">' + esc(t('The safe', 'الصندوق')) + '</button>';
    if (collectors().length) h += '<button class="' + (v.paid_from === 'collector' ? 'on' : '') + '" onclick="keepExpense();UI.sheet.data.from=\'collector\';render()">' + esc(t(collectorLabel() + '\'s pocket', 'جيب ' + collectorLabel())) + '</button>';
    h += '</div></label>';
  }
  h += '<div class="two"><label class="field"><span>' + esc(t('Date', 'التاريخ')) + '</span><input class="input" type="date" id="ex-date" value="' + esc(st.date || v.spent_on) + '"></label>';
  h += '<label class="field"><span>' + esc(t('Month', 'الشهر')) + '</span><select class="input" id="ex-cyc">' + visibleCycles().map(function(c) { return '<option value="' + esc(c.id) + '"' + (c.id === (st.cyc || v.cycle_id) ? ' selected' : '') + '>' + esc(cycleTitle(c)) + '</option>'; }).join('') + '</select></label></div>';
  h += '<label class="field"><span>' + esc(t('Receipt or invoice number (optional)', 'رقم الإيصال (اختياري)')) + '</span><input class="input" id="ex-ref" value="' + esc(st.ref != null ? st.ref : (v.ref || '')) + '"></label>';
  h += '<div id="sheet-err" class="err"></div><div class="foot">';
  if (e && (isManager() || (e.paid_by === S.me.id && !e.handover_id))) h += '<button class="btn danger" onclick="voidExpense(' + jsArg(e.id) + ')">' + esc(t('Cancel it', 'إلغاء')) + '</button>';
  h += '<button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button>';
  if (!e || isManager()) h += '<button class="btn pri" onclick="saveExpense(' + jsArg(e ? e.id : '') + ',' + jsArg(sup ? sup.id : '') + ')">' + esc(t('Save', 'حفظ')) + '</button>';
  return h + '</div>';
};
function expensePreset(i) {
  if (i === '') return;
  keepExpense();
  var p = EXPENSE_PRESETS[i];
  UI.sheet.data.title = LANG === 'ar' ? p.ar + ' · ' + p.en : p.en + ' · ' + p.ar;
  UI.sheet.data.cat = p.cat;
  render();
}
function keepExpense() {
  var d = UI.sheet.data;
  if (document.getElementById('ex-fx')) d.fx = val('ex-fx');
  d.title = val('ex-title'); d.amount = val('ex-amt'); d.date = val('ex-date'); d.cyc = val('ex-cyc'); d.ref = val('ex-ref');
}
function saveExpense(id, supId) {
  keepExpense();
  var d = UI.sheet.data, e = id ? byId(S.expenses, id) : null;
  var cat = d.cat || (e && e.cat) || (supId ? 'supplier' : 'other');
  var row = { title: (d.title || '').trim(), amount: num(d.amount), cur: d.cur || (e && e.cur) || (supId ? byId(S.charges, supId).cur : 'USD'), cat: cat,
              spent_on: d.date || todayIso(), cycle_id: d.cyc || null, ref: d.ref || null,
              paid_from: isManager() ? (d.from || (e && e.paid_from) || 'safe') : 'collector' };
  if (row.cur === 'LBP') row.fx = num(d.fx) || rate();
  if (!row.title) return sheetErr(t('Say what it was for', 'اذكر السبب'));
  if (!(row.amount > 0)) return sheetErr(t('Enter an amount', 'أدخل المبلغ'));
  if (supId) row.charge_id = supId;
  if (!e) row.paid_by = row.paid_from === 'collector' && isManager() ? (collectors()[0] || {}).user_id : S.me.id;
  var btn = document.querySelector('.sheet .foot .btn.pri'); if (btn) btn.disabled = true;
  uploadPhoto(d.photoBlob).then(function(photo) {
    if (photo) row.photo_path = photo;
    return e ? dbUpdate('expenses', id, row) : dbInsert('expenses', row);
  }).then(function() { closeSheet(); toast(t('Saved', 'تم الحفظ')); }, function(err) { if (btn) btn.disabled = false; sheetErr(err.message); });
}
function voidExpense(id) {
  dbUpdate('expenses', id, { voided_at: nowIso() }).then(function() { closeSheet(); toast(t('Expense cancelled', 'أُلغي المصروف')); }, function(e) { sheetErr(e.message); });
}
