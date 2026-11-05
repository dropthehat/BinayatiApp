/* ============================================================================
   Sealed preview: the real app running on sample data, used by the admin's
   Screen wall and Workflows. The switch is at the top of the page (see build.js):
   any load with ?preview, or inside a frame, gets no server config, no network
   access and storage that lives only in memory. Nothing here can reach a real
   building. Internal captions are English only.
   ============================================================================ */
var PV = { st: {}, quiet: false, ready: false };

function pvWait(ms) { return new Promise(function(r) { setTimeout(r, ms || 60); }); }
function pvDb() { return localLoad(); }
function pvPersona() { return pvDb().persona || 'u-manager'; }
/* Be this person. Going back from the resident page reopens the building. */
function pvAs(uid) {
  var was = UI.screen === 'resident', same = pvPersona() === uid && S.role && !was;
  UI.sheet = null; UI.screen = 'app';
  if (same) return;
  var db = pvDb(); db.persona = uid; localSave();
  localLoadBuilding(db.current || db.buildings[0].id);
  UI.tab = 'home'; UI.bsec = null;
}
function pvTab(uid, tab) { pvAs(uid); UI.sheet = null; UI.tab = tab; UI.bsec = null; render(); window.scrollTo(0, 0); }
function pvSec(sec) { pvAs('u-manager'); UI.sheet = null; UI.tab = 'building'; UI.bsec = sec; render(); window.scrollTo(0, 0); }
function pvSheet(uid, tab, name, data) { pvTab(uid, tab); openSheet(name, data || {}); }
function pvDesk(page) { pvAs('u-manager'); DESK.page = page; UI.sheet = null; UI.tab = 'home'; render(); window.scrollTo(0, 0); }
function pvWide() { return window.innerWidth >= 1000; }
/* Sample people to point at: one who still owes, one who has paid. */
function pvOwing() {
  var cyc = currentCycle();
  return activeUnits().filter(function(u) { return pairUsd(unitCycle(u, cyc).left) > 0.005; })[0] || activeUnits()[0];
}
function pvPaid() {
  var cyc = currentCycle();
  return activeUnits().filter(function(u) { return unitCycle(u, cyc).state === 'paid'; })[0] || activeUnits()[0];
}
function pvPaidCell() {
  var cyc = currentCycle(), out = null;
  activeUnits().forEach(function(u) { chargesOf(cyc.id).forEach(function(ch) { if (!out && cell(ch, u).payments.length) out = { ch: ch.id, u: u.id }; }); });
  return out || {};
}
function pvResident(u) { pvAs('u-manager'); return loadResident((u || pvOwing()).resident_token).then(function() { window.scrollTo(0, 0); }); }
function seeResident(tok) {
  if (window.NATOUR_PREVIEW) loadResident(tok); else location.href = '?r=' + tok;
}

/* ---------- Every screen the wall can show ---------- */
var PV_ROLES = { m: 'Manager', c: 'Collector', r: 'Resident' };
var PV_SCREENS = [
  { id: 'home', role: 'm', l: 'Home', desk: 'overview', run: function() { pvWide() ? pvDesk('overview') : pvTab('u-manager', 'home'); } },
  { id: 'collect', role: 'm', l: 'Collect', desk: 'collect', run: function() { pvWide() ? pvDesk('collect') : pvTab('u-manager', 'collect'); } },
  { id: 'books', role: 'm', l: 'Books · money', desk: 'books', run: function() { UI.booksView = 'money'; pvWide() ? pvDesk('books') : pvTab('u-manager', 'books'); } },
  { id: 'activity', role: 'm', l: 'Books · activity', phone: true, run: function() { UI.booksView = 'activity'; pvTab('u-manager', 'books'); } },
  { id: 'building', role: 'm', l: 'Building', phone: true, run: function() { pvTab('u-manager', 'building'); } },
  { id: 'b-units', role: 'm', l: 'Apartments', phone: true, run: function() { pvSec('units'); } },
  { id: 'b-charges', role: 'm', l: 'What each apartment pays', phone: true, run: function() { pvSec('charges'); } },
  { id: 'b-cycles', role: 'm', l: 'Months & projects', phone: true, run: function() { pvSec('cycles'); } },
  { id: 'b-team', role: 'm', l: 'Team', phone: true, run: function() { pvSec('team'); } },
  { id: 'b-tasks', role: 'm', l: 'Tasks & reminders', phone: true, run: function() { pvSec('tasks'); } },
  { id: 'b-contacts', role: 'm', l: 'Contacts', desk: 'contacts', run: function() { pvWide() ? pvDesk('contacts') : pvSec('contacts'); } },
  { id: 'b-settings', role: 'm', l: 'Settings', phone: true, run: function() { pvSec('settings'); } },
  { id: 'd-arrears', role: 'm', l: 'Arrears', laptop: true, run: function() { pvDesk('arrears'); } },
  { id: 'd-reports', role: 'm', l: 'Reports', laptop: true, run: function() { pvDesk('reports'); } },
  { id: 's-add', role: 'm', l: 'Add menu', sheet: true, run: function() { pvSheet('u-manager', 'home', 'add'); } },
  { id: 's-menu', role: 'm', l: 'Building menu', sheet: true, run: function() { pvSheet('u-manager', 'home', 'menu'); } },
  { id: 's-unit', role: 'm', l: 'Apartment card', sheet: true, run: function() { pvTab('u-manager', 'collect'); openSheet('unit', { id: pvOwing().id }); } },
  { id: 's-cell', role: 'm', l: 'A paid charge', sheet: true, run: function() { pvTab('u-manager', 'collect'); openSheet('cell', pvPaidCell()); } },
  { id: 's-pay', role: 'm', l: 'Record a payment', sheet: true, run: function() { pvTab('u-manager', 'collect'); openSheet('pay', { unit: pvOwing().id }); } },
  { id: 's-remind', role: 'm', l: 'WhatsApp message', sheet: true, run: function() { pvTab('u-manager', 'collect'); openSheet('remind', { u: pvOwing().id, cyc: currentCycle().id }); } },
  { id: 's-expense', role: 'm', l: 'Money spent', sheet: true, run: function() { pvSheet('u-manager', 'books', 'expense'); } },
  { id: 's-charge', role: 'm', l: 'Add a charge', sheet: true, run: function() { pvSheet('u-manager', 'building', 'charge', { cycle: currentCycle().id }); } },
  { id: 's-project', role: 'm', l: 'New project', sheet: true, run: function() { pvSheet('u-manager', 'building', 'project'); } },
  { id: 's-task', role: 'm', l: 'Add a task', sheet: true, run: function() { pvSheet('u-manager', 'building', 'task'); } },
  { id: 's-invite', role: 'm', l: 'Invite a collector', sheet: true, run: function() { pvSheet('u-manager', 'building', 'invite', { role: 'collector' }); } },
  { id: 's-handrecv', role: 'm', l: 'Cash from a collector', sheet: true, run: function() { pvSheet('u-manager', 'home', 'handrecv'); } },
  { id: 'c-home', role: 'c', l: 'Home', run: function() { pvTab('u-collector', 'home'); } },
  { id: 'c-collect', role: 'c', l: 'Collect', run: function() { pvTab('u-collector', 'collect'); } },
  { id: 'c-books', role: 'c', l: 'Books', run: function() { pvTab('u-collector', 'books'); } },
  { id: 'c-tasks', role: 'c', l: 'Tasks', run: function() { pvTab('u-collector', 'tasks'); } },
  { id: 'c-add', role: 'c', l: 'Add menu', sheet: true, run: function() { pvSheet('u-collector', 'home', 'add'); } },
  { id: 'c-pay', role: 'c', l: 'Record a payment', sheet: true, run: function() { pvTab('u-collector', 'collect'); openSheet('pay', { unit: pvOwing().id }); } },
  { id: 'c-expense', role: 'c', l: 'I spent building cash', sheet: true, run: function() { pvSheet('u-collector', 'home', 'expense'); } },
  { id: 'c-handreq', role: 'c', l: 'Hand over cash', sheet: true, run: function() { pvSheet('u-collector', 'home', 'handreq'); } },
  { id: 'r-owes', role: 'r', l: 'Page · still owes', run: function() { return pvResident(pvOwing()); } },
  { id: 'r-paid', role: 'r', l: 'Page · fully paid', run: function() { return pvResident(pvPaid()); } }
];

/* ---------- Workflows: real steps, using the app's own functions ---------- */
function pvFill(values) {
  Object.keys(values).forEach(function(id) { var el = document.getElementById(id); if (el) { el.value = values[id]; el.dispatchEvent(new Event('input', { bubbles: true })); } });
}
var PV_FLOWS = [
  { id: 'collect', title: 'Collect a payment', who: 'Manager', about: 'An apartment pays, the manager records it and sends a receipt.', steps: [
    { t: 'Start on Home', n: 'Lit windows have paid. Dark ones still owe.', run: function() { pvTab('u-manager', 'home'); } },
    { t: 'Open Collect', n: 'Everyone this month, with what each still owes.', run: function() { pvTab('u-manager', 'collect'); } },
    { t: 'Open the apartment', n: 'The bill, what is owed, and every way to act on it.', hl: '[onclick*="openSheet(\'pay\'"]', run: function() { PV.st.u = pvOwing().id; openSheet('unit', { id: PV.st.u }); } },
    { t: 'Record the payment', n: 'Any amount. It pays off the oldest charges first.', hl: '.sheet .foot .btn.pri', run: function() { openSheet('pay', { unit: PV.st.u, channel: 'manager' }); } },
    { t: 'Saved', n: 'The money is on the books and the apartment moves on.', run: function() { savePay(); return pvWait(120); } },
    { t: 'Send the receipt', n: 'The message is written for them, ready for WhatsApp. Nothing is sent from a preview.', hl: '.btn.wa', run: function() { openSheet('remind', { u: PV.st.u, cyc: currentCycle().id }); } },
    { t: 'Back on Home', n: 'Their window is lit now.', run: function() { pvTab('u-manager', 'home'); } }
  ] },
  { id: 'cash', title: 'Collector cash to the safe', who: 'Collector → Manager', about: 'A collector holds cash, hands it over, and the manager confirms.', steps: [
    { t: 'Collector\'s Home', n: 'What they are holding, and what is left to collect.', run: function() { pvTab('u-collector', 'home'); } },
    { t: 'Open the add menu', n: 'Handing over cash is one tap away.', hl: '[onclick*="addPick(\'handreq\')"]', run: function() { openSheet('add'); } },
    { t: 'Hand over the cash', n: 'The amount comes from what they ticked.', hl: '.sheet .foot .btn.pri', run: function() { openSheet('handreq'); } },
    { t: 'Waiting for the manager', n: 'It stays with the collector until confirmed.', run: function() { requestHandover(); return pvWait(120); } },
    { t: 'Manager sees it on Home', n: 'Now viewed as the manager.', run: function() { pvTab('u-manager', 'home'); } },
    { t: 'Review the handover', n: 'Which payments it covers and the cash to receive.', hl: '.sheet .foot .btn.ok', run: function() {
      var ho = S.handovers.filter(function(x) { return x.status === 'pending'; })[0]; PV.st.ho = ho && ho.id; openSheet('handover', { id: PV.st.ho });
    } },
    { t: 'In the safe', n: 'Confirmed. The cash has moved to the safe.', run: function() { resolveHandover(PV.st.ho, true); return pvWait(120); } },
    { t: 'See it in the books', n: 'The safe and the collector\'s balance have both changed.', run: function() { UI.booksView = 'money'; pvTab('u-manager', 'books'); } }
  ] },
  { id: 'expense', title: 'Record money spent', who: 'Manager', about: 'A bill is paid from the safe and shows in the books.', steps: [
    { t: 'Open the add menu', n: 'The + button is on every main screen.', hl: '[onclick*="addPick(\'expense\')"]', run: function() { pvTab('u-manager', 'books'); openSheet('add'); } },
    { t: 'Fill in the expense', n: 'Filled in here as an example: a repair paid from the safe.', hl: '.sheet .foot .btn.pri', run: function() { openSheet('expense', { cat: 'elev' }); return pvWait(40).then(function() { pvFill({ 'ex-title': 'Elevator repair', 'ex-amt': '85' }); }); } },
    { t: 'Saved', n: 'It comes off the safe straight away.', run: function() { saveExpense('', ''); return pvWait(120); } },
    { t: 'See it in the books', n: 'Money in and out, in one list.', run: function() { UI.booksView = 'money'; pvTab('u-manager', 'books'); } }
  ] },
  { id: 'month', title: 'Open the next month', who: 'Manager', about: 'Repeating charges are copied into a draft to review before residents see it.', steps: [
    { t: 'Open the add menu', n: 'Opening a month starts here.', hl: '[onclick*="addPick(\'month\')"]', run: function() { pvTab('u-manager', 'home'); openSheet('add'); } },
    { t: 'Review the draft', n: 'Repeating charges are copied in. Residents don\'t see it until it is published.', run: function() { UI.sheet = null; newMonth(); return pvWait(160); } }
  ] },
  { id: 'bill', title: 'A resident gets their bill', who: 'Manager → Resident', about: 'The bill goes by WhatsApp with a private link, no login needed.', steps: [
    { t: 'Open Collect', n: 'Bills go out from here.', run: function() { pvTab('u-manager', 'collect'); } },
    { t: 'Write the message', n: 'The bill is written for that apartment, in their language.', hl: '.btn.wa', run: function() { PV.st.u = pvOwing().id; openSheet('remind', { u: PV.st.u, cyc: currentCycle().id }); } },
    { t: 'What they receive', n: 'This is the message. Nothing is sent from a preview.', run: function() { pvMessage(val('rm-text')); } },
    { t: 'They open the link', n: 'Their private page: bill, receipts and the building\'s books.', run: function() { pvMessage(null); return pvResident(byId(S.units, PV.st.u)); } }
  ] },
  { id: 'team', title: 'Add a collector', who: 'Manager', about: 'Invite someone and choose what they can do. On real buildings this makes a link.', steps: [
    { t: 'Open Team', n: 'Who has access to the building.', run: function() { pvSec('team'); } },
    { t: 'Invite them', n: 'On a real building this creates a one-time link and QR code.', run: function() { openSheet('invite', { role: 'collector' }); } }
  ] },
  { id: 'tasks', title: 'Finish a task', who: 'Collector', about: 'A repeating building chore gets ticked off and rolls to its next date.', steps: [
    { t: 'Collector\'s tasks', n: 'What is due, then what comes later.', hl: '.check', run: function() { pvTab('u-collector', 'tasks'); } },
    { t: 'Tick it', n: 'It rolls forward to the next date by itself.', run: function() { var x = openTasks()[0]; if (x) tickTask(x.id); return pvWait(120); } }
  ] }
];

/* ---------- Showing a WhatsApp message instead of leaving the preview ---------- */
function pvMessage(text) {
  var old = document.getElementById('pv-msg'); if (old) old.remove();
  if (text == null) return;
  var el = document.createElement('div');
  el.id = 'pv-msg'; el.className = 'pv-msg';
  el.innerHTML = '<div class="pv-msg-card" dir="auto"><small>WhatsApp message · not sent in a preview</small><div class="pv-bubble">' + esc(text) + '</div><button class="btn sec block" onclick="pvMessage(null)">Close</button></div>';
  document.body.appendChild(el);
}
function pvWaLink(url) {
  var text = ''; try { text = new URL(url).searchParams.get('text') || ''; } catch (e) {}
  pvMessage(text || 'A WhatsApp chat would open here.');
}
function pvHighlight(sel) {
  document.querySelectorAll('.pv-hl').forEach(function(x) { x.classList.remove('pv-hl'); });
  if (!sel) return;
  var el = document.querySelector(sel);
  if (el) { el.classList.add('pv-hl'); try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
}

/* ---------- Sample data beyond the app's own example ---------- */
function pvSeed() {
  var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  var period = d.getFullYear() + '-' + pad2(d.getMonth() + 1), us = activeUnits();
  var cyc = { kind: 'month', period: period, title: periodLabel(period, 'en'), title_ar: periodLabel(period, 'ar'), published: true };
  var keep = UI.cycleId;
  return dbInsert('cycles', cyc).then(function() {
    return dbInsert('charges', { cycle_id: cyc.id, kind: 'fixed', title: 'Maintenance', title_ar: 'الصيانة', cur: 'USD', amount: 20, split: 'each', overrides: {}, pass_through: false, recurring: true, sort: 0 });
  }).then(function() {
    var ch = chargesOf(cyc.id)[0], when = new Date(d.getFullYear(), d.getMonth(), 12).toISOString();
    return dbInsertMany('payments', us.slice(0, Math.max(0, us.length - 2)).map(function(u) { return { charge_id: ch.id, unit_id: u.id, amount: 20, cur: 'USD', channel: 'manager', method: 'Cash', received_by: 'u-manager', received_at: when }; }));
  }).then(function() {
    return dbInsertMany('contacts', [
      { cat: 'elevator', name: 'Cedar Lifts', name_ar: 'مصاعد الأرز', phone: '+96170111222', emergency: true, show_residents: true, sort: 0 },
      { cat: 'other', name: 'Plumber', name_ar: 'السنكري', phone: '+96171333444', emergency: false, show_residents: true, sort: 1 }
    ]);
  }).then(function() { UI.cycleId = keep; }, function(e) { console.warn('preview seed', e); UI.cycleId = keep; });
}

/* ---------- Start up and talk to the admin page ---------- */
function pvPost(msg) { msg.natour = true; if (window.parent !== window) window.parent.postMessage(msg, '*'); }
function pvFlow() { return PV_FLOWS.filter(function(f) { return f.id === window.NATOUR_PREVIEW.flow; })[0]; }
function pvRunStep(i) {
  var f = pvFlow(); if (!f || !f.steps[i]) return Promise.resolve();
  var tt = document.getElementById('toast'); if (tt) tt.classList.remove('pop');
  return Promise.resolve(f.steps[i].run()).then(function() { return pvWait(40); }).then(function() { pvHighlight(f.steps[i].hl); PV.step = i; });
}
function previewBoot() {
  var P = window.NATOUR_PREVIEW, realToast = window.toast;
  window.launchConfetti = function() {};
  window.toast = function(m) { if (!PV.quiet) realToast(m); };
  window.open = function(url) { pvWaLink(String(url || '')); return null; };
  document.addEventListener('click', function(e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^https?:|^tel:|^sms:/.test(href)) { e.preventDefault(); if (/wa\.me/.test(href)) pvWaLink(href); }
  }, true);
  window.addEventListener('message', function(e) {
    if (e.source !== window.parent || !e.data || !e.data.natour || e.data.step == null) return;
    PV.quiet = false;
    pvRunStep(e.data.step).then(function() { pvPost({ stepDone: e.data.step }); }, function(err) { console.error(err); pvPost({ stepDone: e.data.step, error: String(err && err.message || err) }); });
  });
  PV.quiet = true;
  render();
  initCloud().then(loadSample).then(pvSeed).then(function() {
    setupState({ open: false });
    if (P.flow) {
      var upto = Math.max(0, parseInt(P.step, 10) || 0), p = Promise.resolve();
      for (var i = 0; i <= upto; i++) (function(n) { p = p.then(function() { return pvRunStep(n); }); })(i);
      return p;
    }
    var sc = PV_SCREENS.filter(function(x) { return x.id === P.screen; })[0] || PV_SCREENS[0];
    return sc.run();
  }).then(function() {
    return pvWait(40);
  }).then(function() {
    PV.quiet = false; PV.ready = true;
    document.documentElement.classList.remove('pv-boot');
    pvPost({ ready: true, screen: P.screen || null, flow: P.flow || null });
  }).catch(function(e) {
    console.error(e); PV.quiet = false;
    document.documentElement.classList.remove('pv-boot');
    pvPost({ ready: true, error: String(e && e.message || e) });
  });
}
