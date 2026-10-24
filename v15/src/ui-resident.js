/* ============================================================================
   Resident page: opened from the link in their WhatsApp bill. No login.
   ============================================================================ */
function loadResident(tok) {
  UI.screen = 'resident';
  return rpc('resident_view', { p_token: tok }).then(function(v) {
    if (!v) { UI.resident = { missing: true }; render(); return; }
    var ns = emptyState();
    ns.building = v.building;
    ns.units = v.units || [];
    // put the resident's own details on their unit
    ns.units = ns.units.map(function(u) { return u.id === v.unit.id ? Object.assign({}, u, v.unit) : u; });
    ns.cycles = v.cycles || [];
    ns.charges = v.charges || [];
    ns.members = v.members || [];
    var mine = v.my_payments || [];
    var all = v.payments || [];
    var seen = {}; mine.forEach(function(p) { seen[p.id] = 1; });
    ns.payments = mine.concat(all.filter(function(p) { return !seen[p.id]; }));
    ns.expenses = v.expenses || [];
    ns.handovers = v.handovers || [];
    ns.role = 'resident';
    ns.resident = { unit: v.unit, booksPublic: !!v.books_public, who: !!(v.building.settings || {}).show_who_paid };
    ns._rev = 1;
    S = ns;
    UI.resident = { ok: true };
    render();
  }, function(e) { UI.resident = { error: niceError(e) }; render(); });
}

function renderResident() {
  var R = UI.resident;
  if (!R) return '<div class="splash"><div class="logo">ب</div></div>';
  if (!R.ok) {
    return '<div class="shell"><div class="res-head"><h1>' + esc(R.missing ? t('This link doesn\'t work anymore', 'هذا الرابط لم يعد يعمل') : t('Couldn\'t open your page', 'تعذّر فتح صفحتك')) + '</h1><p class="muted">' + esc(R.missing ? t('Ask your building manager for a new one.', 'اطلب رابطاً جديداً من مدير البناية.') : R.error || '') + '</p></div></div>';
  }
  var u = byId(S.units, S.resident.unit.id);
  var cyc = latestMonth() || visibleCycles()[0];
  var r = unitCycle(u, cyc), b = unitBalance(u, cyc);
  var h = '<div class="shell" style="padding-bottom:24px">';
  h += '<div class="res-head row between"><div><small>' + esc(bName()) + '</small><h1>' + esc(t('Apartment ', 'الشقة ') + u.code) + '</h1>' + (unitName(u) ? '<div class="muted" style="font-weight:600">' + esc(unitName(u)) + '</div>' : '') + '</div><button class="iconbtn" onclick="setLang()">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button></div>';
  h += heroHtml(cyc, { block: blockOf(u) || null, idp: 'rs', noTap: true, noSafe: !S.resident.booksPublic, only: S.resident.who ? null : u.id });

  // The bill
  h += '<div class="sec"><div class="card pad"><div class="row between"><b style="font-size:16px">' + esc(cycleTitle(cyc)) + '</b>' + (r.state === 'paid' ? '<span class="receipt-stamp">✓ ' + esc(t('Paid', 'مسدد')) + '</span>' : '') + '</div>';
  r.cells.forEach(function(x) {
    var lastPay = x.c.payments[x.c.payments.length - 1];
    h += '<div class="kv"><span>' + esc(L(x.ch) + kwhNote(x.ch, u)) + (x.c.state === 'paid' && lastPay ? '<br><small style="color:var(--ok)">✓ ' + esc(dateLabel(lastPay.received_at)) + '</small>' : '') + '</span><b>' + esc(fmt(x.c.due, x.ch.cur)) + '</b></div>';
  });
  if (!r.cells.length) h += '<div class="muted">' + esc(t('Nothing due this month', 'لا مستحقات هذا الشهر')) + '</div>';
  var owed = b.owed;
  h += '<div class="bill-total"><span>' + esc(t('Left to pay', 'المتبقي')) + '</span><span style="color:' + (pairUsd(owed) > 0.005 ? 'var(--warn)' : 'var(--ok)') + '">' + esc(pairUsd(owed) > 0.005 ? fmtPair(owed) : t('Nothing 🎉', 'لا شيء 🎉')) + '</span></div>';
  if (pairUsd(b.arrears) > 0.005) h += '<div class="hint" style="color:var(--bad)">' + esc(t('Includes earlier months: ', 'يشمل أشهراً سابقة: ') + fmtPair(b.arrears)) + '</div>';
  if (pairUsd(owed) > 0.005) {
    var col = S.members.filter(function(m) { return m.role === 'collector'; })[0];
    h += '<p class="hint">' + esc(col ? t('You can hand it to ' + mName(col, 'en') + ', or pay the manager directly.', 'يمكنك تسليمه إلى ' + mName(col, 'ar') + ' أو للمدير مباشرة.') : t('Pay the building manager.', 'ادفع لمدير البناية.')) + '</p>';
  }
  h += '</div></div>';

  // Receipts
  var mine = livePayments().filter(function(p) { return p.unit_id === u.id; }).sort(function(a, c) { return String(c.received_at).localeCompare(String(a.received_at)); });
  h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Your receipts', 'إيصالاتك')) + '</h2></div>';
  if (!mine.length) h += '<div class="card empty">' + esc(t('No payments yet', 'لا دفعات بعد')) + '</div>';
  else {
    h += '<div class="card list">';
    mine.slice(0, 30).forEach(function(p) {
      var ch = byId(S.charges, p.charge_id), c = ch && byId(S.cycles, ch.cycle_id);
      var by = p.received_by_name || memberName(p.received_by);
      h += '<div class="li"><div class="ic in">✓</div><div class="grow"><b>' + esc((ch ? L(ch) : '') + (c ? ' · ' + cycleTitle(c) : '')) + '</b><small>' + esc(dateLabel(p.received_at, true) + ' · ' + (p.channel === 'transfer' ? (p.method || t('Transfer', 'تحويل')) : t('received by ', 'استلمه ') + by)) + '</small></div><span class="amt in">' + esc(fmt(p.amount, p.cur)) + '</span></div>';
    });
    h += '</div>';
  }
  h += '</div>';

  // Building books
  if (S.resident.booksPublic) {
    var s = cycleSummary(cyc), cash = cashState();
    var spent = liveExpenses().filter(function(e) { return e.cycle_id === cyc.id && !e.charge_id; });
    h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('The building\'s books', 'حسابات البناية')) + '</h2></div>';
    if (S.resident.who) h += monthCard(cyc, false);
    else {
      var due = s.due, got = collectedIn(cyc), pct = pairUsd(due) > 0 ? Math.min(100, Math.round(pairUsd(got) / pairUsd(due) * 100)) : 0;
      h += '<div class="card month"><div class="month-top"><b>' + esc(cycleTitle(cyc)) + '</b><span>' + pct + '% ' + esc(t('collected', 'محصّل')) + '</span></div>';
      h += '<div class="bar"><i class="paid" style="width:' + pct + '%"></i></div>';
      h += '<div class="legend"><span><i style="background:var(--ok)"></i>' + esc(t('Collected', 'محصّل')) + ' ' + esc(fmtPair(got)) + '</span><span>' + esc(t('of', 'من')) + ' ' + esc(fmtPair(due)) + '</span></div></div>';
    }
    h += '<div class="tiles" style="margin-top:10px">';
    h += tile(t('In the safe', 'في الصندوق'), fmtPairBig(cash.safe), t('Held by the manager', 'لدى المدير'), '', 'var(--ok)');
    h += tile(t('Spent this month', 'مصروف هذا الشهر'), fmtPairBig(spent.reduce(function(a, e) { return addTo(a, e.cur, num(e.amount)); }, pair())), t(spent.length + ' expenses', spent.length + ' مصاريف'), '', 'var(--bad)');
    h += '</div>';
    if (spent.length) {
      h += '<div class="card list" style="margin-top:10px">';
      spent.forEach(function(e) { h += '<div class="li"><div class="ic out">' + catIcon(e.cat) + '</div><div class="grow"><b>' + esc(e.title) + '</b><small>' + esc(dateLabel(e.spent_on) + ' · ' + catName(e.cat)) + '</small></div><span class="amt out">' + esc(fmt(e.amount, e.cur)) + '</span></div>'; });
      h += '</div>';
    }
    h += '</div>';
  }
  h += '<div class="foot-note">' + esc(t('This page is private to your apartment. Binayati · بنايتي', 'هذه الصفحة خاصة بشقتك. بنايتي · Binayati')) + '</div></div>';
  return h;
}
