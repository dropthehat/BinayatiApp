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
    loadResidentContacts(tok);
    loadResidentNews(tok);
  }, function(e) { UI.resident = { error: niceError(e) }; render(); });
}

function renderResident() {
  var R = UI.resident;
  if (!R) return '<div class="splash"><div class="logo">ن</div></div>';
  if (!R.ok) {
    return '<div class="shell"><div class="res-head"><h1>' + esc(R.missing ? t('This link doesn\'t work anymore', 'هذا الرابط لم يعد يعمل') : t('Couldn\'t open your page', 'تعذّر فتح صفحتك')) + '</h1><p class="muted">' + esc(R.missing ? t('Ask your building manager for a new one.', 'اطلب رابطاً جديداً من مدير البناية.') : R.error || '') + '</p></div></div>';
  }
  var u = byId(S.units, S.resident.unit.id);
  var cyc = latestMonth() || visibleCycles()[0];
  var r = unitCycle(u, cyc), b = unitBalance(u, cyc);
  var h = '<div class="shell" style="padding-bottom:24px">';
  h += '<div class="res-head row between"><div><small>' + esc(bName()) + '</small><h1>' + esc(t('Apartment ', 'الشقة ') + unitTag(u)) + '</h1>' + (unitName(u) ? '<div class="muted" style="font-weight:600">' + esc(unitName(u)) + '</div>' : '') + '</div><button class="iconbtn" onclick="setLang()">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button></div>';
  h += renderResidentNews();
  h += heroHtml(cyc, { block: blockOf(u) || null, idp: 'rs', noTap: true, alive: true, sign: S.building.home_name || (blockOf(u) && S.building.kind === 'shared' ? blockLabel(blockOf(u)) : null), noSafe: !S.resident.booksPublic, only: S.resident.who ? null : u.id });

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
    h += '<p class="hint">' + esc(hasCollector() ? t('You can hand it to ' + collectorLabel('en') + '.', 'يمكنك تسليمه إلى ' + collectorLabel('ar') + '.') : t('Pay the building manager.', 'ادفع لمدير البناية.')) + '</p>';
  }
  h += '</div></div>';

  // Other bills still open for this apartment, and projects
  var others = visibleCycles().filter(function(c) { return c.id !== cyc.id; }).map(function(c) { var rr = unitCycle(u, c), lf = pair(); rr.cells.forEach(function(x) { addTo(lf, x.ch.cur, x.c.left); }); return { c: c, left: lf, any: rr.cells.length > 0 }; })
    .filter(function(x) { return x.any && (pairUsd(x.left) > 0.005 || x.c.kind === 'project'); });
  if (others.length) {
    h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Also open', 'مفتوحة أيضاً')) + '</h2></div><div class="card list">';
    others.forEach(function(x) {
      var done = pairUsd(x.left) <= 0.005;
      h += '<div class="li"><div class="ic' + (done ? ' in' : '') + '">' + (x.c.kind === 'project' ? '◆' : done ? '✓' : '•') + '</div><div class="grow"><b>' + esc(S.building.kind === 'shared' ? colBillName(x.c) : cycleTitle(x.c)) + '</b><small>' + esc(x.c.kind === 'project' ? t('Project', 'مشروع') : cycleTitle(x.c).split(' · ').slice(1).join(' · ')) + '</small></div><span class="amt' + (done ? ' in' : '') + '">' + esc(done ? '✓' : fmtPair(x.left)) + '</span></div>';
    });
    h += '</div></div>';
  }

  // Receipts
  var mine = livePayments().filter(function(p) { return p.unit_id === u.id; }).sort(function(a, c) { return String(c.received_at).localeCompare(String(a.received_at)); });
  h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Your receipts', 'إيصالاتك')) + '</h2></div>';
  if (!mine.length) h += '<div class="card empty">' + esc(t('No payments yet', 'لا دفعات بعد')) + '</div>';
  else {
    var monKey = '';
    mine.slice(0, 40).forEach(function(p) {
      var mk = String(p.received_at || '').slice(0, 7);
      if (mk !== monKey) { if (monKey) h += '</div>'; monKey = mk; h += '<div class="daylbl">' + esc(new Date(mk + '-01T12:00:00').toLocaleDateString(LANG === 'ar' ? 'ar-LB' : 'en-GB', { month: 'long', year: 'numeric' })) + '</div><div class="card list">'; }
      var ch = byId(S.charges, p.charge_id), c = ch && byId(S.cycles, ch.cycle_id);
      var by = p.received_by_name || (p.channel === 'collector' ? collectorLabel() : memberName(p.received_by));
      h += '<div class="li"><div class="ic in">✓</div><div class="grow"><b>' + esc(S.building.kind === 'shared' && c ? colBillName(c) : (ch ? L(ch) : '') + (c ? ' · ' + cycleTitle(c) : '')) + '</b><small>' + esc(dateLabel(p.received_at, true) + ' · ' + (p.channel === 'transfer' ? (p.method || t('Transfer', 'تحويل')) : t('received by ', 'استلمه ') + by)) + '</small></div><span class="amt in">' + esc(fmt(p.amount, p.cur)) + '</span></div>';
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
      spent.forEach(function(e) { h += '<div class="li"><div class="ic out">' + catIcon(e.cat) + '</div><div class="grow"><b>' + esc(L(e)) + '</b><small>' + esc(dateLabel(e.spent_on) + ' · ' + catName(e.cat)) + '</small></div><span class="amt out">' + esc(fmt(e.amount, e.cur)) + '</span></div>'; });
      h += '</div>';
    }
    h += '</div>';
  }
  if (feature('contacts')) h += renderResidentContacts();
  h += '<div class="foot-note">' + esc(t('This page is private to your apartment. Natour app · تطبيق ناطور', 'هذه الصفحة خاصة بشقتك. تطبيق ناطور · Natour app')) + '</div></div>';
  return h;
}
