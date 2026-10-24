/* ============================================================================
   Several buildings: an overview for people who work in more than one
   (a Natour covering three buildings, a manager running a compound), and
   compounds that group separate buildings while each keeps its own safe.
   ============================================================================ */

/* ---------------- Which buildings do I belong to? ---------------- */
function myBuildingList() {
  if (isCloud()) return cloudMyBuildings();
  var db = localLoad(), me = localUser().id;
  return Promise.resolve(db.buildings.map(function(b) {
    var m = null; db.members.forEach(function(x) { if (x.building_id === b.id && x.user_id === me) m = x; });
    return m ? { id: b.id, role: m.role, name: b.name, name_ar: b.name_ar } : null;
  }).filter(Boolean));
}
function compoundsList() {
  if (isCloud()) return cloudCall(SB.from('compounds').select('*')).then(function(r) { return r || []; }, function() { return []; });
  return Promise.resolve(localLoad().compounds || []);
}

/* ---------------- Overview ---------------- */
function showOverview() {
  UI.screen = 'overview'; UI.ov = null; UI.sheet = null; render();
  Promise.all([myBuildingList(), compoundsList()]).then(function(r) {
    var list = r[0], comps = r[1];
    UI.myBuildings = list;
    return Promise.all(list.map(function(b) {
      return buildingState(b.id).then(function(ns) { return { b: b, ns: ns }; }, function(e) { return { b: b, err: e.message }; });
    })).then(function(rows) { UI.ov = { rows: rows, comps: comps }; render(); });
  }).catch(function(e) { UI.ov = { error: e.message, rows: [] }; render(); });
}
function overviewStats(ns) {
  return withState(ns, function() {
    var cyc = latestMonth(), s = cycleSummary(cyc), cash = cashState();
    var mine = cash.pockets[S.me.id] || pair();
    var mgr = S.role === 'manager' || S.role === 'comanager';
    var tasks = openTasks(mgr ? null : 'collector');
    var late = tasks.filter(function(x) { return x.due_on && x.due_on <= todayIso(); }).length;
    return { cyc: cyc, s: s, cash: cash, mine: { USD: mine.USD || 0, LBP: mine.LBP || 0 }, mgr: mgr,
             pending: mgr ? cash.pending.length : cash.pending.filter(function(h) { return h.collector_id === S.me.id; }).length,
             tasks: tasks.length, late: late, owing: s.owing.length, compound: S.building.compound_id || null, hero: heroThumb(cyc) };
  });
}
function heroThumb(cyc) {
  var units = activeUnits().slice(0, 30);
  var wins = units.map(function(u) { var st = unitCycle(u, cyc).state; return { state: st === 'paid' ? 'paid' : st === 'none' ? 'closed' : 'owes' }; });
  if (!wins.length) wins = [{ state: 'closed' }];
  var levels = levelsFor(units.map(function(u, i) { return { code: u.code, win: wins[i] }; }));
  return buildBuildingScene({ phase: { key: 'day', sunX: 0, sunY: 0 }, bare: true, wins: wins, levels: levels, signText: S.building.name, elevator: !!setting('elevator'), idp: 'ov' + Math.random().toString(36).slice(2, 6), extraCls: 'studio bh-bare nopop' });
}
function renderOverview() {
  var h = '<div class="shell"><header class="topbar"><div class="grow"><b style="font-size:20px;font-weight:800">' + esc(t('Your buildings', 'بناياتك')) + '</b></div><button class="iconbtn" onclick="setLang()">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button></header>';
  var ov = UI.ov;
  if (!ov) return h + '<div class="sec"><div class="card empty">' + esc(t('Loading your buildings…', 'جارٍ تحميل بناياتك…')) + '</div></div></div>';
  if (ov.error) h += '<div class="sec"><div class="banner warn">' + esc(ov.error) + '</div></div>';
  var rows = ov.rows.map(function(r) { if (r.ns) r.st = overviewStats(r.ns); return r; });
  // Totals across everything
  var pocket = pair(), safe = pair(), pend = 0, late = 0, anyCol = false, anyMgr = false;
  rows.forEach(function(r) {
    if (!r.st) return;
    addTo(pocket, 'USD', r.st.mine.USD); addTo(pocket, 'LBP', r.st.mine.LBP);
    if (r.st.mgr) { anyMgr = true; addTo(safe, 'USD', r.st.cash.safe.USD); addTo(safe, 'LBP', r.st.cash.safe.LBP); }
    else anyCol = true;
    pend += r.st.pending; late += r.st.late;
  });
  h += '<div class="sec" style="margin-top:4px"><div class="tiles">';
  if (anyCol || pairUsd(pocket) > 0.005) h += tile(t('In your pocket, all buildings', 'معك من كل البنايات'), fmtPairBig(pocket), t('Hand over each building separately', 'سلّم كل بناية على حدة'), '', 'var(--warn)', pairUsd(pocket) > 0.005 ? 'alert' : '');
  if (anyMgr) h += tile(t('In the safes', 'في الصناديق'), fmtPairBig(safe), t('Each building keeps its own', 'لكل بناية صندوقها'), '', 'var(--ok)');
  h += tile(t('Needs you', 'بانتظارك'), '<span>' + (pend + late) + '</span>', t(pend + ' handovers · ' + late + ' tasks due', pend + ' تسليم · ' + late + ' مهام مستحقة'), '', 'var(--acc)');
  h += '</div></div>';

  // Group by compound
  var groups = {}, order = [];
  rows.forEach(function(r) {
    var c = (r.st && r.st.compound) || '';
    if (!groups[c]) { groups[c] = []; order.push(c); }
    groups[c].push(r);
  });
  order.sort(function(a, b) { return (a ? 0 : 1) - (b ? 0 : 1); });
  order.forEach(function(c) {
    var comp = c ? (ov.comps || []).filter(function(x) { return x.id === c; })[0] : null;
    h += '<div class="sec"><div class="sec-h"><h2>' + esc(c ? (comp ? comp.name : t('Compound', 'مجمّع')) : (order.length > 1 ? t('Other buildings', 'بنايات أخرى') : t('Buildings', 'البنايات'))) + '</h2></div><div class="stack">';
    groups[c].forEach(function(r) { h += overviewCard(r); });
    h += '</div></div>';
  });
  h += '<div class="sec"><button class="btn sec block" onclick="startSetup()">＋ ' + esc(t('Set up a new building', 'أعدّ بناية جديدة')) + '</button>';
  if (isCloud()) h += '<button class="btn ghost block" style="margin-top:6px" onclick="signOut()">' + esc(t('Sign out', 'خروج')) + '</button>';
  h += '</div></div>';
  return h;
}
function overviewCard(r) {
  var b = r.b;
  if (!r.st) return '<div class="card pad"><b>' + esc(b.name) + '</b><div class="err">' + esc(r.err || '') + '</div></div>';
  var st = r.st, s = st.s;
  var h = '<button class="card pad" style="width:100%;text-align:start;display:block" onclick="openFromOverview(' + jsArg(b.id) + ')">';
  h += '<div class="row" style="align-items:flex-start"><div style="width:84px;height:84px;flex:none;display:flex;align-items:flex-end;justify-content:center;overflow:hidden">' + st.hero + '</div><div class="grow">';
  h += '<div class="row between"><b style="font-size:16px">' + esc(LANG === 'ar' ? (b.name_ar || b.name) : b.name) + '</b><span class="status none">' + esc(roleLabel(b.role)) + '</span></div>';
  if (st.cyc) {
    h += '<div class="muted" style="font-size:12.5px;font-weight:600;margin-top:2px">' + esc(cycleTitle(st.cyc) + ' · ' + t(s.settled + ' of ' + s.units + ' paid', s.settled + ' من ' + s.units + ' سددوا')) + '</div>';
    h += '<div class="bar" style="margin:8px 0 6px"><i class="paid" style="width:' + s.pct + '%"></i></div>';
  }
  var chips = [];
  if (pairUsd(st.mine) > 0.005) chips.push(['owes', t('In your pocket ', 'معك ') + fmtPair(st.mine)]);
  if (st.pending) chips.push(['part', st.mgr ? t(st.pending + ' handover to confirm', st.pending + ' تسليم للتأكيد') : t('Handover waiting', 'تسليم بالانتظار')]);
  if (st.late) chips.push(['owes', t(st.late + ' tasks due', st.late + ' مهام مستحقة')]);
  else if (st.tasks) chips.push(['none', t(st.tasks + ' tasks', st.tasks + ' مهام')]);
  if (st.owing) chips.push(['none', t(st.owing + ' still owe', st.owing + ' لم يسددوا')]);
  h += '<div class="row" style="flex-wrap:wrap;gap:6px">' + chips.map(function(c) { return '<span class="status ' + c[0] + '">' + esc(c[1]) + '</span>'; }).join('') + '</div>';
  h += '</div></div></button>';
  return h;
}
function openFromOverview(bid) {
  openBuilding(bid).then(function() { UI.screen = 'app'; UI.tab = 'home'; UI.block = null; render(); window.scrollTo(0, 0); }, fail);
}

/* ---------------- Compounds: separate buildings, separate safes, shared bills ---------------- */
function renderCompoundSec() {
  var h = '<div class="sec">';
  var cid = S.building.compound_id;
  if (!cid) {
    h += '<div class="card pad"><b>' + esc(t('Part of a bigger compound?', 'جزء من مجمّع أكبر؟')) + '</b><p class="muted" style="margin:6px 0 12px">' + esc(t('Group this building with others that share costs (a guard, the garden, a generator). Each keeps its own safe and books; shared bills are split between them.', 'اجمع هذه البناية مع بنايات تتشارك التكاليف (حارس، حديقة، مولّد). لكل بناية صندوقها وحساباتها؛ والفواتير المشتركة تُقسّم بينها.')) + '</p>';
    h += '<p class="hint" style="margin-top:0">' + esc(t('One management and one safe for several blocks? Use blocks instead: Building → Apartments → Floors, apartments & blocks.', 'إدارة واحدة وصندوق واحد لعدة بلوكات؟ استعمل البلوكات: البناية ← الشقق ← الطوابق والشقق والبلوكات.')) + '</p>';
    h += '<button class="btn pri" onclick="openSheet(\'compound\',{})">' + esc(t('Create or join a compound', 'أنشئ مجمّعاً أو انضم إليه')) + '</button></div>';
    return h + '</div>';
  }
  h += '<div class="card pad" id="comp-box"><div class="muted">' + esc(t('Loading…', 'جارٍ التحميل…')) + '</div></div>';
  setTimeout(loadCompoundBox, 0);
  return h + '</div>';
}
function compoundMembers(cid) {
  if (isCloud()) return cloudCall(SB.rpc('compound_buildings', { p_compound: cid }));
  var db = localLoad(), me = localUser().id;
  return Promise.resolve(db.buildings.filter(function(b) { return b.compound_id === cid; }).map(function(b) {
    var m = db.members.filter(function(x) { return x.building_id === b.id && x.user_id === me; })[0];
    return { id: b.id, name: b.name, name_ar: b.name_ar, units: db.units.filter(function(u) { return u.building_id === b.id && u.active !== false; }).length, my_role: m ? m.role : null };
  }));
}
function loadCompoundBox() {
  var el = document.getElementById('comp-box');
  if (!el) return;
  var cid = S.building.compound_id;
  Promise.all([compoundMembers(cid), compoundsList()]).then(function(r) {
    var list = r[0] || [], comp = (r[1] || []).filter(function(c) { return c.id === cid; })[0];
    UI.compound = { id: cid, name: comp ? comp.name : t('Compound', 'مجمّع'), list: list };
    var h = '<b style="font-size:16px">' + esc(UI.compound.name) + '</b><div class="muted" style="font-size:13px;margin-top:2px">' + esc(t(list.length + ' buildings, each with its own safe', list.length + ' بنايات، لكل منها صندوق')) + '</div>';
    h += '<div class="list" style="margin:8px -14px">' + list.map(function(b) {
      return '<div class="li"><div class="ic">🏢</div><div class="grow"><b>' + esc(b.name) + (b.id === S.building.id ? ' · ' + esc(t('this one', 'هذه')) : '') + '</b><small>' + esc(t(b.units + ' apartments', b.units + ' شقق') + ' · ' + (b.my_role ? roleLabel(b.my_role) : t('not yours', 'ليست لك'))) + '</small></div></div>';
    }).join('') + '</div>';
    h += '<div class="row" style="flex-wrap:wrap"><button class="btn pri sm grow" onclick="openSheet(\'shared\',{})">' + esc(t('Split a shared bill', 'قسّم فاتورة مشتركة')) + '</button><button class="btn sec sm grow" onclick="openSheet(\'compound\',{})">' + esc(t('Add buildings', 'أضف بنايات')) + '</button></div>';
    h += '<button class="btn ghost sm" style="margin-top:8px" onclick="leaveCompound()">' + esc(t('Take this building out of the compound', 'أخرج هذه البناية من المجمّع')) + '</button>';
    el.innerHTML = h;
  }, function(e) { el.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
}
SHEETS.compound = function(d) {
  var cid = S.building.compound_id;
  var h = '<h3>' + esc(cid ? t('Add buildings to the compound', 'أضف بنايات إلى المجمّع') : t('Create a compound', 'أنشئ مجمّعاً')) + '</h3>';
  if (!cid) h += '<label class="field"><span>' + esc(t('Compound name', 'اسم المجمّع')) + '</span><input class="input" id="cp-name" placeholder="' + esc(t('e.g. Sahel Alma Residences', 'مثلاً مجمّع ساحل علما')) + '" data-autofocus></label>';
  if (!UI.myBuildings) { myBuildingList().then(function(l) { UI.myBuildings = l; if (UI.sheet && UI.sheet.name === 'compound') render(); }); }
  var others = (UI.myBuildings || []).filter(function(b) { return b.id !== S.building.id && (b.role === 'manager' || b.role === 'comanager'); });
  h += '<div class="field"><span>' + esc(t('Your other buildings to include', 'بناياتك الأخرى لضمّها')) + '</span>';
  if (!others.length) h += '<div class="hint">' + esc(t('You don\'t manage other buildings yet. Their managers can join from their own app: open Building → Compound there.', 'لا تدير بنايات أخرى بعد. يمكن لمديريها الانضمام من تطبيقهم.')) + '</div>';
  others.forEach(function(b) { h += '<label class="switch-row" style="cursor:pointer"><div><b>' + esc(b.name) + '</b><small>' + esc(roleLabel(b.role)) + '</small></div><input type="checkbox" class="cp-b" value="' + esc(b.id) + '" style="width:22px;height:22px"></label>'; });
  h += '</div><div id="sheet-err" class="err"></div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveCompound()">' + esc(t('Save', 'حفظ')) + '</button></div>';
  return h;
};
function saveCompound() {
  var cid = S.building.compound_id;
  var picks = Array.prototype.slice.call(document.querySelectorAll('.cp-b:checked')).map(function(x) { return x.value; });
  var p;
  if (!cid) {
    var name = val('cp-name').trim();
    if (!name) return sheetErr(t('Give the compound a name', 'أعطِ المجمّع اسماً'));
    var row = { id: uuid(), name: name, created_at: nowIso() };
    if (isCloud()) p = cloudCall(SB.from('compounds').insert(row).select().single()).then(function() { return row.id; });
    else { var db = localLoad(); db.compounds = db.compounds || []; row.created_by = localUser().id; db.compounds.push(row); localSave(); p = Promise.resolve(row.id); }
    picks.push(S.building.id);
  } else p = Promise.resolve(cid);
  p.then(function(id) {
    var chain = Promise.resolve();
    picks.forEach(function(bid) { chain = chain.then(function() { return setBuildingCompound(bid, id); }); });
    return chain;
  }).then(function() { closeSheet(); toast(t('Compound saved', 'تم حفظ المجمّع')); render(); }, function(e) { sheetErr(e.message); });
}
function setBuildingCompound(bid, cid) {
  if (bid === S.building.id) { S.building.compound_id = cid; }
  if (isCloud()) return cloudCall(SB.from('buildings').update({ compound_id: cid }).eq('id', bid).select()).then(function(r) { if (!r || !r.length) throw new Error(t('Only that building\'s manager can do this', 'فقط مدير تلك البناية يمكنه ذلك')); });
  var db = localLoad(), b = byId(db.buildings, bid); if (b) b.compound_id = cid; localSave();
  return Promise.resolve();
}
function leaveCompound() {
  if (!confirm(t('Take this building out of the compound? Its own books stay as they are.', 'إخراج هذه البناية من المجمّع؟ تبقى حساباتها كما هي.'))) return;
  setBuildingCompound(S.building.id, null).then(render, fail);
}

/* A bill for the whole compound (guard, garden, shared generator…), split into
   one charge per building. Each building collects its share into its own safe. */
SHEETS.shared = function(d) {
  var c = UI.compound || { list: [] };
  var list = c.list || [];
  var cur = d.cur || 'USD', how = d.how || 'units';
  var h = '<h3>' + esc(t('Split a shared bill', 'قسّم فاتورة مشتركة')) + '</h3><p class="lead">' + esc(t('Each building gets its share as a bill in its current month, split among its apartments.', 'تحصل كل بناية على حصتها كفاتورة في شهرها الحالي، مقسّمة على شققها.')) + '</p>';
  h += '<label class="field"><span>' + esc(t('Common ones', 'الشائعة')) + '</span>' + presetSelect('sh-pre', CHARGE_PRESETS.due.concat(CHARGE_PRESETS.fixed.filter(function(p) { return p.split === 'total'; })), 'sharedPreset(this.value)') + '</label>';
  h += '<label class="field"><span>' + esc(t('Name', 'الاسم')) + '</span><input class="input" id="sh-title" data-tr="sh-title-ar" data-tr-kind="phrase" value="' + esc(d.title || '') + '"><div class="tr-box" id="trs-sh-title"></div></label>';
  h += '<label class="field"><span>' + esc(t('Name in Arabic', 'الاسم بالعربية')) + '</span><input class="input" id="sh-title-ar" data-tr="sh-title" data-tr-kind="phrase" dir="rtl" value="' + esc(d.title_ar || '') + '"><div class="tr-box" id="trs-sh-title-ar"></div></label>';
  h += '<label class="field"><span>' + esc(t('Total for the compound', 'المجموع للمجمّع')) + '</span><div class="money-in"><input class="input" id="sh-amt" inputmode="decimal" value="' + esc(d.amount || '') + '" oninput="sharedPreview()"><div class="seg"><button class="' + (cur === 'USD' ? 'on' : '') + '" onclick="keepShared();UI.sheet.data.cur=\'USD\';render()">USD</button><button class="' + (cur === 'LBP' ? 'on' : '') + '" onclick="keepShared();UI.sheet.data.cur=\'LBP\';render()">LBP</button></div></div></label>';
  h += '<label class="field"><span>' + esc(t('Split between buildings', 'التقسيم بين البنايات')) + '</span><div class="seg"><button class="' + (how === 'units' ? 'on' : '') + '" onclick="keepShared();UI.sheet.data.how=\'units\';render()">' + esc(t('By apartments', 'حسب عدد الشقق')) + '</button><button class="' + (how === 'equal' ? 'on' : '') + '" onclick="keepShared();UI.sheet.data.how=\'equal\';render()">' + esc(t('Equally', 'بالتساوي')) + '</button></div></label>';
  h += '<div class="card pad" id="sh-prev" style="margin-top:12px"></div><div id="sheet-err" class="err"></div>';
  h += '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveShared()">' + esc(t('Create the bills', 'أنشئ الفواتير')) + '</button></div>';
  setTimeout(sharedPreview, 0);
  return h;
};
function keepShared() { var d = UI.sheet.data; d.title = val('sh-title'); d.title_ar = val('sh-title-ar'); d.amount = val('sh-amt'); }
function sharedPreset(i) {
  if (i === '') return;
  keepShared();
  var all = CHARGE_PRESETS.due.concat(CHARGE_PRESETS.fixed.filter(function(p) { return p.split === 'total'; })), p = all[i], d = UI.sheet.data;
  d.title = p.en; d.title_ar = p.ar; d.cur = p.cur; if (p.amt) d.amount = p.amt;
  render();
}
function sharedShares() {
  var d = UI.sheet.data, list = (UI.compound && UI.compound.list) || [], tot = num(val('sh-amt') || d.amount), cur = d.cur || 'USD';
  var units = list.reduce(function(s, b) { return s + (b.units || 0); }, 0) || 1;
  return list.map(function(b) { return { b: b, amt: round(d.how === 'equal' ? tot / (list.length || 1) : tot * (b.units || 0) / units, cur) }; });
}
function sharedPreview() {
  var el = document.getElementById('sh-prev');
  if (!el || !UI.sheet) return;
  var cur = UI.sheet.data.cur || 'USD';
  el.innerHTML = sharedShares().map(function(x) {
    return '<div class="kv"><span>' + esc(x.b.name) + (x.b.my_role ? '' : ' <small style="color:var(--warn)">· ' + esc(t('their manager adds it', 'يضيفها مديرها')) + '</small>') + '</span><b>' + esc(fmt(x.amt, cur)) + '</b></div>';
  }).join('') || '<div class="muted">' + esc(t('No buildings in the compound', 'لا بنايات في المجمّع')) + '</div>';
}
function saveShared() {
  keepShared();
  var d = UI.sheet.data, cur = d.cur || 'USD';
  if (!(d.title || '').trim()) return sheetErr(t('Give it a name', 'أعطه اسماً'));
  if (!(num(d.amount) > 0)) return sheetErr(t('Enter the total', 'أدخل المجموع'));
  var shares = sharedShares(), done = [], skipped = [];
  var chain = Promise.resolve();
  shares.forEach(function(x) {
    if (!(x.b.my_role === 'manager' || x.b.my_role === 'comanager') || !(x.amt > 0)) { skipped.push(x.b.name); return; }
    chain = chain.then(function() { return buildingState(x.b.id); }).then(function(ns) {
      var cyc = withState(ns, function() { return latestMonth(); });
      if (!cyc) { skipped.push(x.b.name); return; }
      var row = { id: uuid(), building_id: x.b.id, cycle_id: cyc.id, kind: 'due', title: d.title.trim(), title_ar: (d.title_ar || '').trim() || null, cur: cur, amount: x.amt,
                  split: 'total', overrides: {}, pass_through: false, recurring: false, sort: 50, created_at: nowIso() };
      if (x.b.id === S.building.id) return dbInsert('charges', row).then(function() { done.push(x.b.name); });
      if (isCloud()) return cloudCall(SB.from('charges').insert(row)).then(function() { done.push(x.b.name); });
      var db = localLoad(); db.charges.push(row); localSave(); done.push(x.b.name);
    });
  });
  chain.then(function() {
    closeSheet();
    toast(t('Added to ' + done.join(', ') + (skipped.length ? '. Ask the managers of ' + skipped.join(', ') + ' to add their share.' : ''), 'أُضيفت إلى ' + done.join('، ') + (skipped.length ? '. اطلب من مديري ' + skipped.join('، ') + ' إضافة حصتهم.' : '')));
  }, function(e) { sheetErr(e.message); });
}
