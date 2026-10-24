/* ============================================================================
   App shell: routing, top bar, dock, sheets, toast, Home and Collect
   ============================================================================ */
var UI = { screen: 'splash', tab: 'home', cycleId: null, filter: 'all', channel: null, booksView: 'money', booksCycle: 'all',
           bsec: null, sheet: null, open: {} };
var APP = document.getElementById('app');

var ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6h6v6"/></svg>',
  collect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
  books: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2"/><path d="M8 7h7M8 11h7"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>'
};

function render() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  var h = '';
  switch (UI.screen) {
    case 'splash': h = '<div class="splash"><div class="logo">ب</div></div>'; break;
    case 'welcome': h = renderWelcome(); break;
    case 'ob': h = renderOnboarding(); break;
    case 'auth': h = renderAuth(); break;
    case 'join': h = renderJoin(); break;
    case 'pick': h = renderPick(); break;
    case 'overview': h = renderOverview(); break;
    case 'resident': h = renderResident(); break;
    case 'error': h = renderFatal(); break;
    default: h = renderApp();
  }
  APP.innerHTML = h + renderSheet();
  afterRender();
}
function afterRender() {
  var f = document.querySelector('[data-autofocus]');
  if (f && !f._focused) { f._focused = true; try { f.focus({ preventScroll: true }); } catch (e) {} }
  setSync(SYNC);
  trRefresh();
}

function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('pop');
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.classList.remove('pop'); }, 2800);
}
function fail(e) { console.error(e); toast((e && e.message) || String(e)); }

function setLang(l) {
  LANG = l || (LANG === 'ar' ? 'en' : 'ar');
  try { localStorage.setItem('bny15_lang', LANG); } catch (e) {}
  render();
}
function go(tab) { UI.tab = tab; UI.bsec = null; render(); window.scrollTo(0, 0); }

/* ---------------------------------------------------------------------------
   Sheets (bottom panels)
   --------------------------------------------------------------------------- */
function openSheet(name, data) { UI.sheet = { name: name, data: data || {} }; render(); }
function closeSheet() { UI.sheet = null; render(); }
function renderSheet() {
  if (!UI.sheet) return '';
  var fn = SHEETS[UI.sheet.name];
  if (!fn) return '';
  return '<div class="scrim" onclick="if(event.target===this)closeSheet()"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + fn(UI.sheet.data) + '</div></div>';
}
var SHEETS = {};
function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function sheetErr(msg) { var el = document.getElementById('sheet-err'); if (el) el.textContent = msg; else toast(msg); }

/* ---------------------------------------------------------------------------
   App frame
   --------------------------------------------------------------------------- */
function currentCycle() {
  var c = UI.cycleId && byId(S.cycles, UI.cycleId);
  if (c && c.published === false && !isManager()) c = null;
  if (!c) { c = latestMonth() || visibleCycles()[0] || null; UI.cycleId = c ? c.id : null; }
  return c;
}
function renderTopbar(sub) {
  var h = '<header class="topbar">';
  if (UI.multi) h += '<button class="iconbtn" onclick="showOverview()" aria-label="' + esc(t('All my buildings', 'كل بناياتي')) + '">' + (LANG === 'ar' ? '›' : '‹') + ' 🏢</button>';
  h += '<button class="bpill" onclick="openSheet(\'menu\')" aria-label="' + esc(t('Building menu', 'قائمة البناية')) + '"><span class="logo">' + esc((bName() || 'B').trim().charAt(0).toUpperCase()) + '</span><span class="grow"><b>' + esc(bName()) + '</b>';
  h += '<small><span id="sync-dot" class="sync"></span>' + esc(sub || (roleLabel(S.role) + (isCloud() ? '' : ' · ' + t('on this phone', 'على هذا الهاتف')))) + '</small></span></button>';
  h += '<button class="iconbtn" onclick="setLang()" aria-label="Language">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button>';
  h += '</header>';
  return h;
}
function renderDock() {
  var tabs = isManager()
    ? [['home', t('Home', 'الرئيسية')], ['collect', t('Collect', 'التحصيل')], ['fab'], ['books', t('Books', 'الحسابات')], ['building', t('Building', 'البناية')]]
    : [['home', t('Home', 'الرئيسية')], ['collect', t('Collect', 'التحصيل')], ['fab'], ['books', t('Books', 'الحسابات')], ['tasks', t('Tasks', 'المهام')]];
  var h = '<nav class="dock">';
  tabs.forEach(function(x) {
    if (x[0] === 'fab') { h += '<button class="fab" onclick="openSheet(\'add\')" aria-label="' + esc(t('Add', 'إضافة')) + '">+</button>'; return; }
    h += '<button class="tab' + (UI.tab === x[0] ? ' on' : '') + '" onclick="go(\'' + x[0] + '\')">' + ICONS[x[0]] + '<span>' + esc(x[1]) + '</span></button>';
  });
  return h + '</nav>';
}
function renderApp() {
  if (!S.building) return renderFatal();
  var body = '';
  if (UI.tab === 'home') body = isManager() ? renderHomeManager() : renderHomeCollector();
  else if (UI.tab === 'collect') body = renderCollect();
  else if (UI.tab === 'books') body = renderBooks();
  else if (UI.tab === 'tasks') body = renderTasksScreen();
  else body = renderBuilding();
  return '<div class="shell">' + body + '</div>' + renderDock();
}
function renderFatal() {
  return '<div class="shell"><div class="sec"><div class="card pad"><h2 class="h-title">' + esc(t('Something went wrong', 'حدث خطأ')) + '</h2><p class="muted">' + esc(UI.fatal || '') + '</p><button class="btn pri" onclick="location.reload()">' + esc(t('Try again', 'حاول مجدداً')) + '</button></div></div></div>';
}

/* ---------------------------------------------------------------------------
   The living building, driven by real data and the real clock
   --------------------------------------------------------------------------- */
var HERO_REVEAL = false, HERO_KEY = '';
function heroHtml(cyc, opts) {
  opts = opts || {};
  var ph = heroPhase(new Date());
  HERO_KEY = ph.key + '|' + ph.label;
  var bl = blocks();
  var blk = opts.block !== undefined ? opts.block : (bl.length > 1 ? (bl.indexOf(UI.block) >= 0 ? UI.block : bl[0]) : null);
  var units = activeUnits().filter(function(u) { return !blk || blockOf(u) === blk; });
  var wins = units.map(function(u) {
    var st = opts.only ? (u.id === opts.only ? unitCycle(u, cyc).state : 'closed') : (opts.hideWho ? 'closed' : unitCycle(u, cyc).state);
    var state = st === 'paid' ? 'paid' : (st === 'closed' || st === 'none' ? 'closed' : 'owes');
    var lbl = u.code + ' · ' + (state === 'paid' ? t('paid', 'مسدد') : state === 'owes' ? t('still owes', 'لم يسدد بعد') : '');
    return { state: state, label: lbl, onclick: opts.noTap ? null : 'openSheet(\'unit\',{id:' + jsArg(u.id) + '})' };
  });
  if (!wins.length) wins = [{ state: 'closed' }];
  var levels = units.length ? levelsFor(units.map(function(u, i) { return { code: u.code, win: wins[i] }; })) : null;
  var cash = opts.noSafe ? null : cashState();
  var reveal = HERO_REVEAL; HERO_REVEAL = false;
  var safe = cash ? { split: true, usdH: Math.max(2, Math.min(22, 2 + Math.max(0, cash.safe.USD) / 40)), lbpH: Math.max(2, Math.min(22, 2 + Math.max(0, cash.safe.LBP) / 4e6)), usd: cash.safe.USD, lbp: cash.safe.LBP, style: setting('safe_style') || 'lobby', tap: opts.noTap ? null : 'go(\'books\')', sub: t('in the safe', 'في الصندوق') } : null;
  var html = buildBuildingScene({
    phase: ph, wins: wins, levels: levels, interactive: !opts.noTap, idp: opts.idp || 'hm', signText: blk ? (S.building.name + ' ' + blk).slice(0, 12) : S.building.name, chip: opts.only || opts.hideWho ? null : heroChipText(cyc, units),
    safe: safe, elevator: !!setting('elevator'), coreGlow: openTasks().some(function(x) { return x.due_on && x.due_on <= todayIso(); }),
    extraCls: reveal ? 'reveal' : ''
  });
  var paid = wins.filter(function(w) { return w.state === 'paid'; }).length;
  var cap = '';
  return '<div class="hero-wrap">' + html + cap + '</div>';
}
/* Top chip: a few short, useful facts that take turns (tap to go there). */
var HERO_FACTS = [], HERO_FI = 0;
function heroFacts(cyc, units) {
  var f = [];
  if (cyc) {
    var left = pair(), owe = 0;
    units.forEach(function(u) {
      var any = false;
      chargesOf(cyc.id).forEach(function(ch) { var x = cell(ch, u); if (x.left > 0) { addTo(left, ch.cur, x.left); any = true; } });
      if (any) owe++;
    });
    if (!left.USD && !left.LBP) f.push({ dot: '#22B07D', tx: t('All paid ✓', 'الكل سدّد ✓'), go: "go('collect')" });
    else {
      f.push({ dot: '#F5A524', tx: fmtPair(left) + ' ' + t('left', 'متبقٍ'), go: "go('collect')" });
      f.push({ dot: '#F5A524', tx: t(owe + (owe === 1 ? ' apartment owes' : ' apartments owe'), owe + ' شقق لم تسدد'), go: "go('collect')" });
    }
  }
  var late = openTasks().filter(function(x) { return x.due_on && x.due_on <= todayIso(); });
  if (late.length) f.push({ dot: '#EF4444', tx: late.length === 1 ? trName(late[0]) : t(late.length + ' tasks due', late.length + ' مهام مستحقة'), go: "go('building')" });
  return f;
}
function trName(x) { var n = (LANG === 'ar' ? (x.title_ar || x.title) : (x.title || x.title_ar)) || t('Task due', 'مهمة مستحقة'); return n.length > 22 ? n.slice(0, 21) + '…' : n; }
function heroChipText(cyc, units) {
  HERO_FACTS = heroFacts(cyc, units); HERO_FI = HERO_FI % Math.max(1, HERO_FACTS.length);
  return HERO_FACTS.length ? HERO_FACTS[HERO_FI] : null;
}
function heroChipTap() { var f = HERO_FACTS[HERO_FI % HERO_FACTS.length]; if (f && f.go) (new Function(f.go))(); }
setInterval(function() {
  var chip = document.getElementById('bh-time');
  if (!chip || HERO_FACTS.length < 2) return;
  HERO_FI = (HERO_FI + 1) % HERO_FACTS.length;
  chip.classList.add('swap');
  setTimeout(function() {
    var f = HERO_FACTS[HERO_FI]; var sp = chip.querySelector('span'), i = chip.querySelector('i');
    if (sp) sp.textContent = f.tx; if (i) i.style.background = f.dot;
    chip.classList.remove('swap');
  }, 220);
}, 4000);
setInterval(function() {
  var chip = document.getElementById('bh-time');
  if (!chip || UI.sheet) return;
  var ph = heroPhase(new Date());
  if ((ph.key + '|' + ph.label) !== HERO_KEY) { render(); return; }
}, 60000);

/* ---------------------------------------------------------------------------
   Month card (shared by managers, collectors and residents)
   --------------------------------------------------------------------------- */
function monthCard(cyc, clickable) {
  var s = cycleSummary(cyc);
  var inHand = s.paidEq - s.pocketEq;
  var wPaid = s.dueEq > 0 ? Math.max(0, inHand / s.dueEq * 100) : 0, wPocket = s.dueEq > 0 ? s.pocketEq / s.dueEq * 100 : 0;
  var h = '<div class="card month"' + (clickable ? ' role="button" tabindex="0" onclick="go(\'collect\')"' : '') + '>';
  h += '<div class="month-top"><b>' + esc(cycleTitle(cyc) + (cyc.published === false ? ' · ' + t('draft', 'مسودة') : '')) + '</b><span>' + esc(t(s.settled + ' of ' + s.units + ' paid', s.settled + ' من ' + s.units + ' سددوا')) + ' · ' + s.pct + '%</span></div>';
  h += '<div class="bar"><i class="paid" style="width:' + wPaid.toFixed(1) + '%"></i><i class="pocket" style="width:' + wPocket.toFixed(1) + '%"></i></div>';
  h += '<div class="legend"><span><i style="background:var(--ok)"></i>' + esc(t('Collected', 'محصّل')) + ' ' + esc(fmtPair(s.paid)) + '</span>';
  var left = { USD: s.due.USD - s.paid.USD, LBP: s.due.LBP - s.paid.LBP };
  h += '<span><i style="background:var(--bg2);border:1px solid var(--line)"></i>' + esc(t('Still to collect', 'المتبقي')) + ' ' + esc(fmtPair(left)) + '</span>';
  if (s.pocketEq > 0) h += '<span><i style="background:var(--warn)"></i>' + esc(t('Not handed over yet', 'لم يُسلَّم بعد')) + '</span>';
  h += '</div></div>';
  return h;
}

/* ---------------------------------------------------------------------------
   Home — manager
   --------------------------------------------------------------------------- */
function homeCycle() { return latestMonth() || currentCycle(); }
function renderHomeManager() {
  var cyc = homeCycle();
  var cash = cashState();
  var h = renderTopbar();
  h += blockChips() + heroHtml(cyc);

  cash.pending.forEach(function(ho) {
    h += '<div class="sec"><div class="banner warn"><div class="grow"><b>' + esc(t(memberName(ho.collector_id) + ' handed over ' + fmtPair({ USD: num(ho.usd), LBP: num(ho.lbp) }), memberName(ho.collector_id) + ' سلّم ' + fmtPair({ USD: num(ho.usd), LBP: num(ho.lbp) }))) + '</b>' + esc(t('Confirm once the cash is in your hands.', 'أكّد عند استلام المبلغ.')) + '</div><button class="btn sm ok" onclick="openSheet(\'handover\',{id:' + jsArg(ho.id) + '})">' + esc(t('Review', 'مراجعة')) + '</button></div></div>';
  });
  visibleCycles().filter(function(c) { return c.published === false && (!cyc || c.id !== cyc.id); }).slice(0, 1).forEach(function(d0) {
    h += '<div class="sec"><div class="banner info"><div class="grow"><b>' + esc(cycleTitle(d0) + t(' is a draft', ' مسودة')) + '</b>' + esc(t('Residents can\'t see it until you show it.', 'السكان لا يرونها حتى تُظهرها.')) + '</div><button class="btn sm pri" onclick="openCycleAdjust(' + jsArg(d0.id) + ')">' + esc(t('Review', 'مراجعة')) + '</button></div></div>';
  });

  if (!cyc) {
    h += '<div class="sec"><div class="card pad"><b>' + esc(t('No month open yet', 'لا يوجد شهر مفتوح')) + '</b><p class="muted">' + esc(t('Open a month to start collecting.', 'افتح شهراً لبدء التحصيل.')) + '</p><button class="btn pri" onclick="newMonth()">' + esc(t('Open this month', 'افتح هذا الشهر')) + '</button></div></div>';
    return h;
  }
  h += '<div class="sec">' + monthCard(cyc, true);
  if (isManager()) h += '<div class="row" style="margin-top:8px"><button class="btn sec sm grow" onclick="openCycleAdjust(' + jsArg(cyc.id) + ')">' + esc(t('Adjust charges', 'تعديل الرسوم')) + '</button></div>';
  h += '</div>';

  h += '<div class="sec"><div class="tiles">';
  h += tile(t('In the safe', 'في الصندوق'), fmtPairBig(cash.safe), t('Cash the building holds', 'نقد البناية'), 'go(\'books\')', 'var(--ok)');
  var wc = pairUsd(cash.withCollector);
  h += tile(t('With ' + (collectors().length ? collectorLabel() : 'collector'), 'مع ' + (collectors().length ? collectorLabel() : 'الجابي')), fmtPairBig(cash.withCollector),
            wc > 0.005 ? t('Collected, not handed over', 'محصّل ولم يُسلَّم') : t('Nothing outstanding', 'لا شيء معلّق'), 'go(\'books\')', 'var(--warn)', wc > 0.005 && cash.pending.length ? 'alert' : '');
  var arr = totalArrears(cyc);
  if (arr.units) h += tile(t('Earlier months unpaid', 'متأخرات أشهر سابقة'), fmtPairBig(arr.total), t(arr.units + ' apartment' + (arr.units > 1 ? 's' : ''), arr.units + ' شقق'), 'UI.filter=\'arrears\';go(\'collect\')', 'var(--bad)');
  var sup = cash.supplier;
  if (pairUsd(sup) > 0.005) h += tile(t('Held for suppliers', 'مستحق للموردين'), fmtPairBig(sup), t('Moteur, internet… still to pay out', 'موتور، إنترنت… للدفع'), 'go(\'books\')', 'var(--info)');
  h += '</div></div>';

  var tasks = openTasks().slice(0, 3);
  h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Coming up', 'قريباً')) + '</h2><button onclick="go(\'building\');UI.bsec=\'tasks\';render()">' + esc(t('All tasks', 'كل المهام')) + '</button></div>';
  h += tasks.length ? '<div class="card">' + tasks.map(taskRow).join('') + '</div>' : '<div class="card empty">' + esc(t('Nothing due. Add reminders like water tank cleaning.', 'لا مهام. أضف تذكيرات مثل تنظيف خزان المياه.')) + '</div>';
  h += '</div>';

  var ev = S.events.slice(-6).reverse();
  if (ev.length) {
    h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Latest activity', 'آخر النشاطات')) + '</h2><button onclick="UI.booksView=\'activity\';go(\'books\')">' + esc(t('See all', 'الكل')) + '</button></div><div class="card">' + ev.map(eventRow).join('') + '</div></div>';
  }
  return h;
}
function fmtPairBig(p) {
  var u = p.USD || 0, l = p.LBP || 0;
  if (baseUsd()) return esc(fmt(u + l / rate(), 'USD'));
  if (tiny(l, 'LBP')) return esc(fmt(u, 'USD'));
  if (tiny(u, 'USD')) return esc(fmt(l, 'LBP'));
  return esc(fmt(u, 'USD')) + '<small><bdi dir="ltr">+ ' + esc(fmtRaw(l, 'LBP')) + '</bdi></small>';
}
function tile(lbl, valHtml, sub, onclick, dot, cls) {
  return '<button class="card tile ' + (cls || '') + '" onclick="' + onclick + '"><div class="lbl"><span class="dot" style="background:' + dot + '"></span>' + esc(lbl) + '</div><div class="val">' + valHtml + '</div><div class="sub">' + esc(sub) + '</div></button>';
}

/* ---------------------------------------------------------------------------
   Home — collector (anyone who goes door to door: Natour, concierge, neighbour)
   --------------------------------------------------------------------------- */
function renderHomeCollector() {
  var cyc = homeCycle();
  var cash = cashState();
  var mine = cash.pockets[S.me.id] || { USD: 0, LBP: 0, pending: pair(), pendingId: null };
  var pend = S.handovers.filter(function(x) { return x.collector_id === S.me.id && x.status === 'pending'; })[0];
  var bl = blocks(), blk = bl.length > 1 ? (bl.indexOf(UI.block) >= 0 ? UI.block : bl[0]) : null;
  var units = activeUnits().filter(function(u) { return !blk || blockOf(u) === blk; });
  // what's left this month, and who owes (oldest debts first)
  var left = pair(), owing = [], paidN = 0;
  units.forEach(function(u) {
    var l = pair();
    if (cyc) chargesOf(cyc.id).forEach(function(ch) { var x = cell(ch, u); if (x.left > 0) addTo(l, ch.cur, x.left); });
    var arr = unitBalance(u, cyc).arrears;
    addTo(left, 'USD', l.USD); addTo(left, 'LBP', l.LBP);
    if (pairUsd(l) > 0.005 || pairUsd(arr) > 0.005) owing.push({ u: u, now: l, arr: arr, tot: pairUsd(l) + pairUsd(arr) });
    else paidN++;
  });
  owing.sort(function(a, b) { return (pairUsd(b.arr) > 0.005) - (pairUsd(a.arr) > 0.005) || b.tot - a.tot; });
  var h = renderTopbar();
  h += blockChips();
  h += '<div class="sec"><div class="tiles">';
  h += tile(t('In your pocket', 'معك الآن'), fmtPairBig({ USD: mine.USD, LBP: mine.LBP }), pend ? t('Handover waiting for the manager', 'تسليم بانتظار المدير') : t('Cash you collected, not handed over yet', 'نقد جمعته ولم تسلّمه بعد'), pairUsd(mine) > 0.005 && !pend ? 'openSheet(\'handreq\')' : '', 'var(--warn)');
  h += tile(t('Still to collect', 'باقي للتحصيل'), fmtPairBig(left), (cyc ? cycleTitle(cyc) + ' · ' : '') + t(paidN + ' of ' + units.length + ' paid', paidN + ' من ' + units.length + ' سدّدوا'), 'go(\'collect\')', 'var(--acc)');
  h += '</div>';
  if (pend) h += '<div class="banner info" style="margin-top:10px"><div class="grow"><b>' + esc(t('Handed over ' + fmtPair({ USD: num(pend.usd), LBP: num(pend.lbp) }), 'سلّمت ' + fmtPair({ USD: num(pend.usd), LBP: num(pend.lbp) }))) + '</b>' + esc(t('Waiting for the manager to confirm.', 'بانتظار تأكيد المدير.')) + '</div></div>';
  else if (pairUsd(mine) > 0.005) h += '<button class="btn pri block" style="margin-top:10px" onclick="openSheet(\'handreq\')">' + esc(t('Hand over to the manager', 'سلّم المبلغ للمدير')) + '</button>';
  h += '<div class="row" style="margin-top:10px"><button class="btn sec sm grow" onclick="go(\'collect\')">' + esc(t('Collect', 'التحصيل')) + '</button><button class="btn sec sm grow" onclick="openSheet(\'expense\',{})">' + esc(t('I spent building cash', 'صرفت من مال البناية')) + '</button></div>';
  h += '</div>';
  // Important now: late tasks, then the doors to knock on
  var tasks = openTasks('collector'), today = todayIso();
  var urgent = tasks.filter(function(x) { return x.due_on && x.due_on <= today; });
  if (urgent.length) h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Do today', 'اليوم')) + '</h2></div><div class="card">' + urgent.map(taskRow).join('') + '</div></div>';
  if (owing.length) {
    h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Doors to knock on', 'أبواب لطرقها')) + '</h2><button onclick="go(\'collect\')">' + esc(t('All', 'الكل')) + '</button></div><div class="card list">';
    owing.slice(0, 5).forEach(function(o) {
      var late = pairUsd(o.arr) > 0.005;
      h += '<button class="li" onclick="openSheet(\'unit\',{id:' + jsArg(o.u.id) + '})"><div class="ic' + (late ? ' out' : '') + '">' + esc(o.u.code) + '</div><div class="grow"><b>' + esc(unitName(o.u) || o.u.code) + '</b><small' + (late ? ' style="color:var(--bad)"' : '') + '>' + esc(late ? t('Also owes earlier months', 'عليه أشهر سابقة') : t('This month', 'هذا الشهر')) + '</small></div><span class="amt">' + esc(fmtPair({ USD: o.now.USD + o.arr.USD, LBP: o.now.LBP + o.arr.LBP })) + '</span></button>';
    });
    h += '</div></div>';
  } else if (units.length) h += '<div class="sec"><div class="card empty">' + esc(t('Everyone has paid ✓', 'الجميع سدّد ✓')) + '</div></div>';
  var rest = tasks.filter(function(x) { return urgent.indexOf(x) < 0; });
  if (rest.length) h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Coming up', 'قادماً')) + '</h2></div><div class="card">' + rest.slice(0, 4).map(taskRow).join('') + '</div></div>';
  return h;
}

/* ---------------------------------------------------------------------------
   Collect: tick who paid; every tick is a payment with who received it
   --------------------------------------------------------------------------- */
function defaultChannel() {
  if (!isManager()) return 'collector:' + S.me.id;
  if (UI.channel) return UI.channel;
  return setting('default_channel') || 'manager';
}
function cycleChips(cur, onPick) {
  var h = '<div class="chips">';
  visibleCycles().forEach(function(c) {
    h += '<button class="chip' + (cur && c.id === cur.id ? ' on' : '') + '" onclick="' + onPick + '(' + jsArg(c.id) + ')">' + (c.kind === 'project' ? '◆ ' : '') + esc(cycleTitle(c)) + (c.published === false ? ' · ' + esc(t('draft', 'مسودة')) : '') + '</button>';
  });
  if (isManager()) h += '<button class="chip" onclick="openSheet(\'add\')">＋ ' + esc(t('Month or project', 'شهر أو مشروع')) + '</button>';
  return h + '</div>';
}
/* Block switcher, shown only when the building has blocks. withAll adds an "All" chip. */
function blockChips(withAll) {
  var bl = blocks();
  if (bl.length < 2) return '';
  var cur = withAll ? (UI.block || '') : (bl.indexOf(UI.block) >= 0 ? UI.block : bl[0]);
  var h = '<div class="chips" style="margin-bottom:10px">';
  if (withAll) h += '<button class="chip' + (!cur ? ' on' : '') + '" onclick="UI.block=null;render()">' + esc(t('All blocks', 'كل البلوكات')) + '</button>';
  bl.forEach(function(b) { h += '<button class="chip' + (cur === b ? ' on' : '') + '" onclick="UI.block=' + jsArg(b) + ';render()">' + esc(blockLabel(b)) + '</button>'; });
  return h + '</div>';
}
function pickCycle(id) { UI.cycleId = id; render(); }

function renderCollect() {
  var cyc = currentCycle();
  var h = renderTopbar(t('Collect', 'التحصيل'));
  h += cycleChips(cyc, 'pickCycle');
  if (!cyc) return h + '<div class="sec"><div class="card empty">' + esc(t('Open a month first.', 'افتح شهراً أولاً.')) + '</div></div>';
  h += cycleAdjustBar(cyc);
  var chs = chargesOf(cyc.id);
  if (!chs.length) {
    return h + '<div class="sec"><div class="card pad"><b>' + esc(t('No charges in ' + cycleTitle(cyc), 'لا رسوم في ' + cycleTitle(cyc))) + '</b><p class="muted">' + esc(t('Add the monthly fee, a bill to split, or a supplier service.', 'أضف الرسم الشهري أو فاتورة للتقسيم أو خدمة مورّد.')) + '</p>' + (isManager() ? '<button class="btn pri" onclick="openSheet(\'charge\',{cycle:' + jsArg(cyc.id) + '})">' + esc(t('Add a charge', 'أضف رسماً')) + '</button>' : '') + '</div></div>';
  }
  if (isManager()) {
    var ch = defaultChannel();
    h += '<div class="sec" style="margin-top:8px"><div class="sec-h"><h2 style="font-size:13px;color:var(--mut)">' + esc(t('A tick means the money went to', 'العلامة تعني أن المبلغ ذهب إلى')) + '</h2></div><div class="seg">';
    h += '<button class="' + (ch === 'manager' ? 'on' : '') + '" onclick="UI.channel=\'manager\';render()">' + esc(t('Me', 'أنا')) + '</button>';
    collectors().forEach(function(m) {
      var k = 'collector:' + m.user_id;
      h += '<button class="' + (ch === k ? 'on' : '') + '" onclick="UI.channel=' + jsArg(k) + ';render()">' + esc(m.display_name || t('Collector', 'الجابي')) + '</button>';
    });
    h += '<button class="' + (ch === 'transfer' ? 'on' : '') + '" onclick="UI.channel=\'transfer\';render()">' + esc(t('Transfer', 'تحويل')) + '</button>';
    h += '</div></div>';
  }
  var units = activeUnits().filter(function(u) { return !UI.block || blocks().length < 2 || blockOf(u) === UI.block; });
  var rows = units.map(function(u) { return { u: u, r: unitCycle(u, cyc), b: unitBalance(u, cyc) }; });
  var cnt = { all: rows.length, owing: 0, paid: 0, arrears: 0 };
  rows.forEach(function(x) {
    if (pairUsd(x.r.allLeft) > 0.005) cnt.owing++; else cnt.paid++;
    if (pairUsd(x.b.arrears) > 0.005) cnt.arrears++;
  });
  var f = UI.filter || 'all';
  if (blocks().length > 1) h += '<div style="margin-top:12px">' + blockChips(true) + '</div>';
  h += '<div class="chips" style="margin-top:' + (blocks().length > 1 ? 0 : 12) + 'px">';
  [['all', t('All', 'الكل')], ['owing', t('Still owe', 'لم يسددوا')], ['paid', t('Paid', 'سددوا')], ['arrears', t('Earlier months', 'متأخرات')]].forEach(function(x) {
    if (x[0] === 'arrears' && !cnt.arrears) return;
    h += '<button class="chip' + (f === x[0] ? ' on' : '') + '" onclick="UI.filter=\'' + x[0] + '\';render()">' + esc(x[1]) + ' <span class="cnt">' + cnt[x[0]] + '</span></button>';
  });
  h += '</div>';
  var shown = rows.filter(function(x) {
    var owes = pairUsd(x.r.allLeft) > 0.005;
    return f === 'all' || (f === 'owing' && owes) || (f === 'paid' && !owes) || (f === 'arrears' && pairUsd(x.b.arrears) > 0.005);
  });
  h += '<div class="sec stack" style="margin-top:8px">';
  if (!shown.length) h += '<div class="card empty">' + esc(f === 'owing' ? t('Everyone has paid 🎉', 'الجميع سدد 🎉') : t('Nobody here', 'لا أحد هنا')) + '</div>';
  shown.forEach(function(x) { h += unitCard(x.u, cyc, x.r, x.b); });
  h += '</div>';
  return h;
}
function unitCard(u, cyc, r, b) {
  var owes = pairUsd(r.allLeft) > 0.005;
  var st = !r.cells.length ? 'none' : (owes ? (pairUsd(r.paid) > 0 ? 'part' : 'owes') : 'paid');
  var stTxt = st === 'paid' ? t('Paid', 'مسدد') : st === 'none' ? t('Nothing due', 'لا مستحقات') : t('Owes', 'عليه') + ' ' + fmtPair(r.allLeft);
  var h = '<div class="card unit' + (st === 'paid' ? ' settled' : '') + '">';
  h += '<div class="unit-h" role="button" tabindex="0" onclick="openSheet(\'unit\',{id:' + jsArg(u.id) + '})"><div class="ucode">' + esc(u.code) + '</div><div class="grow"><div class="uname">' + esc(unitName(u) || t('Apartment ', 'شقة ') + u.code) + '</div>';
  if (blockOf(u) && blocks().length > 1 && !UI.block) h += '<div class="umeta">' + esc(blockLabel(blockOf(u))) + '</div>';
  if (num(u.weight) !== 1) h += '<div class="umeta">' + esc(t('Share ×' + num(u.weight), 'حصة ×' + num(u.weight))) + '</div>';
  h += '</div><span class="status ' + st + '">' + esc(stTxt) + '</span></div>';
  if (pairUsd(b.arrears) > 0.005) h += '<div class="arrears"><span>' + esc(t('From earlier months', 'من أشهر سابقة')) + '</span><b>' + esc(fmtPair(b.arrears)) + '</b></div>';
  h += '<div class="ticks">';
  r.cells.forEach(function(x) {
    var c = x.c, cls = c.state === 'paid' ? (c.pocket ? 'pocket' : 'paid') : c.state === 'part' ? 'part' : '';
    var amt = c.state === 'part' ? fmt(c.left, x.ch.cur) + ' ' + t('left', 'متبقي') : fmt(c.due, x.ch.cur);
    h += '<button class="tick ' + cls + (x.ch.pass_through ? ' sup' : '') + '" onclick="tapCell(' + jsArg(x.ch.id) + ',' + jsArg(u.id) + ')" aria-pressed="' + (c.state === 'paid') + '"><b>' + (c.state === 'paid' ? '✓ ' : '') + esc(L(x.ch)) + '</b><span>' + esc(amt) + '</span></button>';
  });
  h += '</div>';
  h += '<div class="unit-actions">';
  if (owes) h += '<button class="btn sec sm" onclick="payAll(' + jsArg(u.id) + ',' + jsArg(cyc.id) + ')">' + esc(t('Paid it all', 'سدد الكل')) + '</button>';
  if (u.phone || isManager()) h += '<button class="btn wa sm" onclick="openSheet(\'remind\',{u:' + jsArg(u.id) + ',cyc:' + jsArg(cyc.id) + '})">' + esc(owes ? t('Remind', 'تذكير') : t('Send receipt', 'أرسل إيصالاً')) + '</button>';
  h += '</div></div>';
  return h;
}

/* Tap a charge: unpaid → paid in full by the chosen channel; paid → offer to undo. */
function channelRow() {
  var ch = defaultChannel();
  if (ch.indexOf('collector:') === 0) return { channel: 'collector', received_by: ch.slice(10), method: 'Cash' };
  if (ch === 'transfer') return { channel: 'transfer', received_by: S.me.id, method: setting('transfer_method') || 'Whish' };
  return { channel: 'manager', received_by: S.me.id, method: 'Cash' };
}
function tapCell(chId, uId) {
  var ch = byId(S.charges, chId), u = byId(S.units, uId);
  if (!ch || !u) return;
  var c = cell(ch, u);
  if (c.state === 'paid' || c.state === 'part') { openSheet('cell', { ch: chId, u: uId }); return; }
  var r = channelRow();
  dbInsert('payments', { charge_id: ch.id, unit_id: u.id, amount: c.left, cur: ch.cur, channel: r.channel, method: r.method, received_by: r.received_by, received_at: nowIso() })
    .then(function() { render(); }, fail);
  render();
}
function payAll(uId, cycId) {
  var u = byId(S.units, uId), r = channelRow(), rows = [];
  chargesOf(cycId).forEach(function(ch) {
    var c = cell(ch, u);
    if (c.left > 0) rows.push({ charge_id: ch.id, unit_id: u.id, amount: c.left, cur: ch.cur, channel: r.channel, method: r.method, received_by: r.received_by, received_at: nowIso() });
  });
  if (!rows.length) return;
  dbInsertMany('payments', rows).then(function() {
    render();
    toast(t(u.code + ' is settled for ' + cycleTitle(byId(S.cycles, cycId)), u.code + ' سدد ' + cycleTitle(byId(S.cycles, cycId))));
  }, fail);
  render();
}
function undoPayments(ids) {
  var p = Promise.resolve();
  ids.forEach(function(id) { p = p.then(function() { return rpc('void_payment', { p_payment: id }); }); });
  return p.then(function() { if (isCloud()) reloadBuilding(); closeSheet(); toast(t('Payment undone', 'تم التراجع عن الدفعة')); }, function(e) { fail(e); });
}
SHEETS.cell = function(d) {
  var ch = byId(S.charges, d.ch), u = byId(S.units, d.u);
  if (!ch || !u) return '';
  var c = cell(ch, u);
  var h = '<h3>' + esc(u.code + ' · ' + L(ch)) + '</h3><p class="lead">' + esc(t('Due', 'المستحق')) + ' ' + esc(fmt(c.due, ch.cur)) + ' · ' + esc(t('Paid', 'المدفوع')) + ' ' + esc(fmt(c.paid, ch.cur)) + '</p>';
  h += '<div class="card list">';
  c.payments.forEach(function(p) {
    var where = p.channel === 'collector' ? (handoverConfirmed(p.handover_id) ? t('handed over to the safe', 'سُلّم للصندوق') : t('with ', 'مع ') + memberName(p.received_by)) : p.channel === 'transfer' ? (p.method || t('transfer', 'تحويل')) : t('received by ', 'استلمه ') + memberName(p.received_by);
    h += '<div class="li"><div class="ic in">✓</div><div class="grow"><b>' + esc(fmt(p.amount, p.cur)) + '</b><small>' + esc(dateLabel(p.received_at, true) + ' · ' + where) + '</small></div></div>';
  });
  h += '</div>';
  var ids = c.payments.map(function(p) { return p.id; });
  var canUndo = isManager() || c.payments.every(function(p) { return p.received_by === S.me.id && !p.handover_id; });
  h += '<div class="foot">';
  if (c.left > 0) h += '<button class="btn pri" onclick="closeSheet();openSheet(\'pay\',{unit:' + jsArg(u.id) + ',cur:' + jsArg(ch.cur) + ',amount:' + c.left + '})">' + esc(t('Record the rest', 'سجّل الباقي')) + '</button>';
  if (canUndo) h += '<button class="btn danger" onclick="undoPayments(' + jsArg(ids) + ')">' + esc(t('Undo', 'تراجع')) + '</button>';
  h += '<button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
  if (!canUndo) h += '<p class="hint">' + esc(t('This cash was already handed over, so only the manager can undo it.', 'تم تسليم هذا المبلغ، فقط المدير يمكنه التراجع.')) + '</p>';
  return h;
};

/* ---------------------------------------------------------------------------
   Tasks
   --------------------------------------------------------------------------- */
function taskRow(x) {
  var late = x.due_on && x.due_on < todayIso() && !x.done_at;
  if (x.done_at) {
    var dsub = t('Done ', 'أُنجزت ') + dateLabel(x.done_at) + (x.done_by ? ' · ' + memberName(x.done_by) : '');
    return '<div class="task done"><button class="check on" onclick="tickTask(' + jsArg(x.id) + ')" aria-label="' + esc(t('Undo', 'تراجع')) + '">✓</button><div class="grow"><b>' + esc(L(x)) + '</b><small>' + esc(dsub) + '</small></div></div>';
  }
  var sub = (x.due_on ? dateLabel(x.due_on) : t('No date', 'بلا تاريخ')) + (x.repeat !== 'none' ? ' · ' + (LANG === 'ar' ? REPEATS[x.repeat][1] : REPEATS[x.repeat][0]) : '') + (x.assignee === 'collector' ? ' · ' + collectorLabel() : '');
  return '<div class="task' + (x.done_at ? ' done' : '') + '"><button class="check' + (x.done_at ? ' on' : '') + '" onclick="tickTask(' + jsArg(x.id) + ')" aria-label="' + esc(t('Done', 'تم')) + '">✓</button><div class="grow" role="button" tabindex="0" onclick="' + (isManager() ? 'openSheet(\'task\',{id:' + jsArg(x.id) + '})' : '') + '"><b>' + esc(L(x)) + '</b><small class="' + (late ? 'late' : '') + '">' + esc(sub) + '</small></div></div>';
}
/* Open tasks: what's due in the next 2 weeks, then a quieter "later" list (e.g. the next tank cleaning in 6 months). */
function taskLists(open) {
  var lim = new Date(); lim.setDate(lim.getDate() + 14);
  var limIso = lim.toISOString().slice(0, 10);
  var soon = open.filter(function(x) { return !x.due_on || x.due_on <= limIso; });
  var later = open.filter(function(x) { return x.due_on && x.due_on > limIso; });
  var h = soon.length ? '<div class="card">' + soon.map(taskRow).join('') + '</div>' : '<div class="card empty">' + esc(t('Nothing due in the next 2 weeks', 'لا شيء مستحق خلال أسبوعين')) + '</div>';
  if (later.length) h += '<div class="daylbl">' + esc(t('Later', 'لاحقاً')) + '</div><div class="card later">' + later.map(taskRow).join('') + '</div>';
  return h;
}
function tickTask(id) {
  var x = byId(S.tasks, id);
  if (!x) return;
  if (x.done_at) { dbUpdate('tasks', id, { done_at: null, done_by: null }).then(render, fail); render(); return; }
  var rep = x.repeat && x.repeat !== 'none' ? x.repeat : null;
  var next = rep ? rollDate(x.due_on, rep) : null;
  // On the server a trigger creates the next one; locally we do the same here.
  var p = dbUpdate('tasks', id, isCloud() ? { done_at: nowIso(), done_by: S.me.id } : { done_at: nowIso(), done_by: S.me.id, repeat: 'none' });
  if (rep) {
    if (!isCloud()) p = p.then(function() { return dbInsert('tasks', { title: x.title, title_ar: x.title_ar, due_on: next, repeat: rep, assignee: x.assignee }); });
    else p = p.then(function() { reloadBuilding(); });
    toast(t('Done. Next one on ' + dateLabel(next), 'تم. التالية في ' + dateLabel(next)));
  }
  p.then(render, fail);
  render();
}
function renderTasksScreen() {
  var h = renderTopbar(t('Tasks', 'المهام'));
  var mine = S.tasks.filter(function(x) { return x.assignee === 'collector' || isManager(); });
  var open = mine.filter(function(x) { return !x.done_at; }).sort(function(a, b) { return String(a.due_on || '9').localeCompare(String(b.due_on || '9')); });
  var done = mine.filter(function(x) { return x.done_at; }).sort(function(a, b) { return String(b.done_at).localeCompare(String(a.done_at)); }).slice(0, 10);
  h += '<div class="sec">' + (open.length ? taskLists(open) : '<div class="card empty">' + esc(t('All done', 'أُنجز كل شيء')) + '</div>') + '</div>';
  if (done.length) h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Done recently', 'أُنجزت مؤخراً')) + '</h2></div><div class="card">' + done.map(taskRow).join('') + '</div></div>';
  return h;
}

/* ---------------------------------------------------------------------------
   WhatsApp: reminders and receipts carry the resident's private link
   --------------------------------------------------------------------------- */
function residentLink(u) {
  var base = (window.BINAYATI_CONFIG || {}).publicUrl || (location.origin + location.pathname);
  return base + '?r=' + encodeURIComponent(u.resident_token || '');
}
function waText(u, cyc, lang) {
  var r = unitCycle(u, cyc), b = unitBalance(u, cyc);
  var owes = pairUsd(r.allLeft) > 0.005;
  function one(lg) {
    var T = function(en, ar) { return lg === 'ar' ? ar : en; };
    var lines = r.cells.map(function(x) {
      var title = (lg === 'ar' ? (x.ch.title_ar || x.ch.title) : x.ch.title) + kwhNote(x.ch, u);
      return '• ' + title + ': ' + fmt(x.c.due, x.ch.cur) + (x.c.state === 'paid' ? ' ✅' : '');
    });
    var bname = lg === 'ar' ? (S.building.name_ar || S.building.name) : S.building.name;
    var name = lg === 'ar' ? (u.name_ar || u.name) : u.name;
    var s = '🏢 *' + bname + '* · ' + cycleTitle(cyc, lg) + '\n\n';
    if (owes) {
      s += T('Hello ', 'مرحباً ') + (name ? '*' + name + '* ' : '') + '(' + u.code + ') 👋\n' + lines.join('\n') + '\n\n';
      s += '*' + T('Left to pay: ', 'المتبقي: ') + fmtPair(r.allLeft) + '*';
      if (pairUsd(b.arrears) > 0.005) s += '\n' + T('Plus earlier months: ', 'إضافة لأشهر سابقة: ') + fmtPair(b.arrears);
      s += '\n' + T('You can hand it to ', 'يمكنك تسليمه إلى ') + (collectors().length ? collectorLabel(lg) : T('the building manager', 'مدير البناية')) + '.';
    } else {
      s += '🧾 *' + T('Receipt', 'إيصال') + '*\n' + T('Thank you ', 'شكراً ') + (name ? '*' + name + '* ' : '') + '(' + u.code + ') 🌸\n' + lines.join('\n') + '\n\n';
      s += '✅ *' + T('Fully paid for ', 'مسدد بالكامل عن ') + cycleTitle(cyc, lg) + '*';
    }
    if (u.resident_token) s += '\n\n' + T('Your bill, receipts and the building\'s books:', 'فاتورتك وإيصالاتك وحسابات البناية:') + '\n' + residentLink(u);
    return s;
  }
  lang = lang || u.lang || 'both';
  if (lang === 'both') return one('ar') + '\n\n━━━━━━━━\n\n' + one('en');
  return one(lang);
}
function waLink(u, cyc) {
  var digits = String(u.phone || '').replace(/\D/g, '');
  if (digits.length === 8 && digits.charAt(0) !== '9') digits = '961' + digits.replace(/^0/, '');
  if (digits.length === 7) digits = '961' + digits;
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(waText(u, cyc));
}

/* Pull a sheet down to close it (from the grab bar, or anywhere once it's scrolled to the top). */
(function() {
  var drag = null;
  document.addEventListener('touchstart', function(e) {
    var sh = e.target.closest && e.target.closest('.sheet');
    if (!sh || e.touches.length !== 1) return;
    if (e.target.closest('input,textarea,select')) return;
    var onGrab = !!e.target.closest('.grab') || (e.touches[0].clientY - sh.getBoundingClientRect().top) < 44;
    if (!onGrab && sh.scrollTop > 0) return;
    drag = { sh: sh, y0: e.touches[0].clientY, dy: 0, grab: onGrab };
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!drag) return;
    var dy = e.touches[0].clientY - drag.y0;
    if (!drag.grab && drag.sh.scrollTop > 0) { drag = null; return; }
    if (dy <= 0) { drag.sh.style.transform = ''; drag.dy = 0; return; }
    drag.dy = dy;
    drag.sh.style.transition = 'none';
    drag.sh.style.transform = 'translateY(' + dy + 'px)';
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', function() {
    if (!drag) return;
    var d = drag; drag = null;
    d.sh.style.transition = 'transform .2s ease';
    if (d.dy > 90) { d.sh.style.transform = 'translateY(100%)'; setTimeout(closeSheet, 180); }
    else d.sh.style.transform = '';
  });
})();

