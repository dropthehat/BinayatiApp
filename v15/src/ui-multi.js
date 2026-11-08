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
    return m ? { id: b.id, role: m.role, name: b.name, name_ar: b.name_ar, kind: b.kind } : null;
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
    var cyc = latestMonth() || visibleCycles()[0] || null, s = cycleSummary(cyc), cash = cashState();
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
  var levels = levelsFor(units.map(function(u, i) { return { code: u.code, u: u, win: wins[i] }; }));
  return buildBuildingScene({ phase: { key: 'day', sunX: 0, sunY: 0 }, bare: true, wins: wins, levels: levels, signText: S.building.name, elevator: !!setting('elevator'), idp: 'ov' + Math.random().toString(36).slice(2, 6), extraCls: 'studio bh-bare nopop' });
}
function renderOverview() {
  var h = '<div class="shell"><header class="topbar"><div class="grow"><b style="font-size:20px;font-weight:800">' + esc(t('Your buildings', 'بناياتك')) + '</b></div><button class="iconbtn" onclick="setLang()">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button></header>';
  var ov = UI.ov;
  if (!ov) return h + skelCards(3, 1) + '</div>';
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
    var canEd = comp && isCloud() && SESSION_UID() === comp.created_by;
    h += '<div class="sec"><div class="sec-h"><h2>' + esc(c ? (comp ? (LANG === 'ar' && comp.name_ar ? comp.name_ar : comp.name) : t('Compound', 'مجمّع')) : (order.length > 1 ? t('Other buildings', 'بنايات أخرى') : t('Buildings', 'البنايات'))) + '</h2>' + (canEd ? '<span class="row" style="gap:12px"><button onclick="UI.sheet={name:\'compcol\',data:{id:' + jsArg(comp.id) + '}};render();loadCompCollectors(' + jsArg(comp.id) + ')">👤 ' + esc(t('Collectors', 'الجباة')) + '</button><button onclick="UI.sheet={name:\'compname\',data:{id:' + jsArg(comp.id) + '}};render()">✎ ' + esc(t('Rename', 'إعادة تسمية')) + '</button></span>' : '') + '</div><div class="stack">';
    groups[c].forEach(function(r) { h += overviewCard(r); });
    h += '</div></div>';
  });
  h += '<div class="sec"><button class="btn sec block" onclick="startSetup()">＋ ' + esc(t('Set up a new building', 'أعدّ بناية جديدة')) + '</button>';
  if (isCloud()) h += '<button class="btn ghost block" style="margin-top:6px" onclick="signOut()">' + esc(t('Sign out', 'خروج')) + '</button>';
  h += '</div></div>';
  return h;
}
function SESSION_UID() { try { var r = UI.ov && (UI.ov.rows || []).filter(function(x) { return x.ns && x.ns.me; })[0]; return r ? r.ns.me.id : (S && S.me ? S.me.id : null); } catch (e) { return null; } }
/* Rename a compound (its creator only). Buildings inside keep their own names. */
SHEETS.compname = function(d) {
  var comp = ((UI.ov && UI.ov.comps) || []).filter(function(x) { return x.id === d.id; })[0];
  if (!comp) return '';
  return '<h3>' + esc(t('Compound name', 'اسم المجمّع')) + '</h3><p class="lead">' + esc(t('The group your buildings belong to. Each building keeps its own name.', 'المجموعة التي تنتمي إليها بناياتك. لكل بناية اسمها.')) + '</p>' +
    '<label class="field"><span>' + esc(t('Name', 'الاسم')) + '</span><input class="input" id="cp-name" value="' + esc(comp.name || '') + '"></label>' +
    '<label class="field"><span>' + esc(t('In Arabic (optional)', 'بالعربية (اختياري)')) + '</span><input class="input" id="cp-ar" dir="rtl" value="' + esc(comp.name_ar || '') + '"></label>' +
    '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button><button class="btn pri" onclick="saveCompName(' + jsArg(comp.id) + ')">' + esc(t('Save', 'حفظ')) + '</button></div>';
};
function saveCompName(id) {
  var nm = val('cp-name').trim(), ar = val('cp-ar').trim();
  if (!nm) return sheetErr(t('Give it a name', 'أعطه اسماً'));
  var row = { name: nm };
  if (UI.ov && UI.ov.comps && UI.ov.comps[0] && 'name_ar' in UI.ov.comps[0]) row.name_ar = ar || null;
  cloudCall(SB.from('compounds').update(row).eq('id', id)).then(function() {
    (UI.ov.comps || []).forEach(function(x) { if (x.id === id) { x.name = nm; if ('name_ar' in row) x.name_ar = row.name_ar; } });
    closeSheet(); toast(t('Saved', 'تم الحفظ')); render();
  }, function(e) { sheetErr(e.message); });
}
/* Compound collectors: invite once, works in the shared book and every building that accepts them. */
function loadCompCollectors(id) {
  cloudCall(SB.from('compound_collectors').select('*').eq('compound_id', id)).then(function(r) {
    if (UI.sheet && UI.sheet.name === 'compcol') { UI.sheet.data.list = r || []; render(); }
  }, function(e) { if (UI.sheet) { UI.sheet.data.list = []; UI.sheet.data.err = e.message; render(); } });
}
SHEETS.compcol = function(d) {
  var comp = ((UI.ov && UI.ov.comps) || []).filter(function(x) { return x.id === d.id; })[0];
  if (!comp) return '';
  var cname = LANG === 'ar' && comp.name_ar ? comp.name_ar : comp.name;
  var h = '<h3>' + esc(t('Collectors for ' + cname, 'جباة ' + cname)) + '</h3>';
  if (d.code) {
    var link = ((window.BINAYATI_CONFIG || {}).publicUrl || (location.origin + location.pathname)) + '?join=' + d.code;
    var msg = t('Hi ' + (d.name || '') + ', join ' + cname + ' on the Natour app as the collector: ', 'مرحباً ' + (d.name || '') + '، انضم إلى ' + cname + ' على تطبيق ناطور كجابٍ: ') + link;
    h += '<p class="lead">' + esc(t('One link for the whole compound. He gets the shared book and every building that lets compound collectors work there. It works once and expires in 14 days.', 'رابط واحد لكل المجمّع. يحصل على الدفتر المشترك وكل بناية تسمح لجباة المجمّع. يعمل مرة واحدة وينتهي بعد 14 يوماً.')) + '</p><div class="linkbox"><span class="grow">' + esc(link) + '</span></div>';
    h += '<div class="foot"><button class="btn sec" onclick="copyText(' + jsArg(link) + ')">' + esc(t('Copy', 'نسخ')) + '</button><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + esc(encodeURIComponent(msg)) + '">WhatsApp</a></div>';
    return h;
  }
  h += '<p class="lead">' + esc(t('Invite a collector once for the whole compound. Each building decides in its Settings whether he collects there; its books stay private.', 'ادعُ جابياً مرة واحدة لكل المجمّع. كل بناية تقرر في إعداداتها إن كان يجبي فيها؛ حساباتها تبقى خاصة.')) + '</p>';
  var list = d.list;
  if (!list) h += '<div class="muted">…</div>';
  else if (list.length) h += '<div class="card list">' + list.map(function(c) { return '<div class="li"><div class="ic">' + esc((c.display_name || '?').charAt(0).toUpperCase()) + '</div><div class="grow"><b>' + esc(c.display_name || '—') + '</b><small>' + esc(t('Compound collector', 'جابي المجمّع')) + '</small></div><button class="btn sm sec" onclick="removeCompCollector(' + jsArg(d.id) + ',' + jsArg(c.user_id) + ',' + jsArg(c.display_name || '') + ')">' + esc(t('Remove', 'إزالة')) + '</button></div>'; }).join('') + '</div>';
  h += '<label class="field" style="margin-top:12px"><span>' + esc(t('Their name', 'اسمه')) + '</span><input class="input" id="cc-name" placeholder="' + esc(t('e.g. Anas', 'مثلاً أنس')) + '"></label>';
  h += '<label class="field"><span>' + esc(t('In Arabic (optional)', 'بالعربية (اختياري)')) + '</span><input class="input" id="cc-ar" dir="rtl" placeholder="أنس"></label>';
  h += '<div id="sheet-err" class="err">' + esc(d.err || '') + '</div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button><button class="btn pri" onclick="makeCompInvite(' + jsArg(d.id) + ')">' + esc(t('Create link', 'أنشئ الرابط')) + '</button></div>';
  return h;
};
function makeCompInvite(id) {
  var nm = val('cc-name').trim(), ar = val('cc-ar').trim();
  if (!nm) return sheetErr(t('Write his name first', 'اكتب اسمه أولاً'));
  rpc('create_compound_invite', { p_compound: id, p_display_name: nm, p_display_name_ar: ar || null }).then(function(code) {
    UI.sheet.data.code = code; UI.sheet.data.name = nm; render();
  }, function(e) { sheetErr(e.message); });
}
function removeCompCollector(id, uid, nm) {
  if (!confirm(t('Remove ' + nm + ' from every building of the compound?', 'إزالة ' + nm + ' من كل بنايات المجمّع؟'))) return;
  rpc('remove_compound_collector', { p_compound: id, p_user: uid }).then(function() { toast(t('Removed', 'أُزيل')); loadCompCollectors(id); }, fail);
}
function overviewCard(r) {
  var b = r.b;
  if (!r.st) return '<div class="card pad"><b>' + esc(b.name) + '</b><div class="err">' + esc(r.err || '') + '</div></div>';
  var st = r.st, s = st.s;
  var h = '<button class="card pad" style="width:100%;text-align:start;display:block" onclick="openFromOverview(' + jsArg(b.id) + ')">';
  h += '<div class="row" style="align-items:flex-start"><div style="width:84px;height:84px;flex:none;display:flex;align-items:flex-end;justify-content:center;overflow:hidden">' + st.hero + '</div><div class="grow">';
  h += '<div class="row between"><b style="font-size:16px">' + esc(LANG === 'ar' ? (b.name_ar || b.name) : b.name) + '</b><span class="status none">' + esc(b.kind === 'shared' ? t('Shared book', 'حساب مشترك') : roleLabel(b.role)) + '</span></div>';
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
    h += '<div class="row" style="flex-wrap:wrap">' + (true ? '' : '<button class="btn pri sm grow" onclick="openSheet(\'shared\',{})">' + esc(t('Split a shared bill', 'قسّم فاتورة مشتركة')) + '</button>') + '<button class="btn sec sm grow" onclick="openSheet(\'compound\',{})">' + esc(t('Add buildings', 'أضف بنايات')) + '</button></div>';
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

/* ============================================================================
   Collector page (test build): two tabs. Dashboard has the quick numbers across
   every book; Collect is only names, amounts and ticks. A manager can preview it
   with writes switched off.
   ============================================================================ */
function colUI() { return !!S.building && !isManager(); }
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
  if (S.building && S.building.id === bid) { if (after) after(); render(); return; }
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
function colCellsIn(u) {
  var out = [], bills = visibleCycles().slice().reverse(), months = bills.length > 1, shared = isSharedBook(), bid = S.building.id;
  bills.forEach(function(c) {
    chargesOf(c.id).forEach(function(ch) {
      var x = cell(ch, u);
      if (x.due <= 0 && x.paid <= 0) return;
      var title = shared ? colBillName(c) : L(ch) + (months ? ' · ' + cycleTitle(c) : '');
      out.push({ c: c, ch: ch, x: x, title: title, bid: bid, uid: u.id });
    });
  });
  return out;
}
/* The shared book this collector also works in, kept in memory. */
function colSharedBook() {
  var r = colBooks().filter(function(x) { return x.ns.building && x.ns.building.kind === 'shared'; })[0];
  return r ? r.ns : null;
}
/* An apartment's bills. In a building's book it also pulls its water and shared bills, so one card has everything. */
function colCells(u, ownOnly) {
  var out = colCellsIn(u);
  if (ownOnly || !u.linked_unit_id) return out;
  if (isSharedBook()) { // from the shared book, add the apartment's own building bills
    var me = S;
    colBooks().forEach(function(r) {
      if (r.ns === me || r.ns.building.kind === 'shared') return;
      var bu = byId(r.ns.units, u.linked_unit_id);
      if (bu) out = withState(r.ns, function() { return colCellsIn(bu); }).concat(out);
    });
    return out;
  }
  var ns = colSharedBook(), lu = ns && byId(ns.units, u.linked_unit_id);
  if (!lu) return out;
  return out.concat(withState(ns, function() { return colCellsIn(lu); }));
}
/* Dollars first, LBP underneath (a setting on each book). */
function colUsdFirst() { return setting('collector_usd') !== false; }
function colAmt(amt, cur) {
  if (!colUsdFirst() || cur !== 'LBP') return '<b>' + esc(fmt(amt, cur)) + '</b>';
  var usd = cur === 'LBP' ? num(amt) / rate() : num(amt), lbp = cur === 'LBP' ? num(amt) : num(amt) * rate();
  return '<span class="camt"><b>' + esc(fmt(usd, 'USD')) + '</b><small>' + esc(fmt(lbp, 'LBP')) + '</small></span>';
}
function colTotal(p) {
  if (!colUsdFirst()) return '<b>' + esc(fmtPair(p)) + '</b>';
  if (Math.abs(p.LBP || 0) < 1) return '<b>' + esc(fmt(p.USD || 0, 'USD')) + '</b>';
  return '<span class="camt"><b>' + esc(fmt(pairUsd(p), 'USD')) + '</b><small>' + esc(fmt(pairUsd(p) * rate(), 'LBP')) + '</small></span>';
}
function colPlain(amt, cur) {
  if (!colUsdFirst() || cur !== 'LBP') return fmt(amt, cur);
  var usd = cur === 'LBP' ? num(amt) / rate() : num(amt), lbp = cur === 'LBP' ? num(amt) : num(amt) * rate();
  return fmt(usd, 'USD') + ' (' + fmt(lbp, 'LBP') + ')';
}
function colPlainPair(p) { return !colUsdFirst() ? fmtPair(p) : Math.abs(p.LBP || 0) < 1 ? fmt(p.USD || 0, 'USD') : fmt(pairUsd(p), 'USD') + ' (' + fmt(pairUsd(p) * rate(), 'LBP') + ')'; }
function colBookTotals(ownOnly) {
  var left = pair(), n = 0, days = {};
  activeUnits().forEach(function(u) {
    var owes = false;
    colCells(u, ownOnly).forEach(function(k) { if (k.x.left > 0) { addTo(left, k.ch.cur, k.x.left); owes = true; days[k.c.id] = 1; } });
    if (owes) n++;
  });
  return { left: left, n: n, bills: Object.keys(days).length };
}
/* One receipt for everything the apartment paid on its latest payment day. */
function colReceiptText(u, lang, cycId) {
  var cells = colCells(u).filter(function(k) { return k.x.state === 'paid' && k.x.due > 0; }), latest = '';
  if (cycId) cells = cells.filter(function(k) { return k.c.id === cycId; }); // one bill, all of it
  else { // the newest bill of each kind (water, EDL, the building's fees), plus anything paid on the latest day
    cells.forEach(function(k) { k.x.payments.forEach(function(p) { var d = String(p.received_at || '').slice(0, 10); if (d > latest) latest = d; }); });
    var newest = {};
    cells.forEach(function(k) {
      var fam = k.bid + '|' + (/^(Water|EDL)\b/.exec(String(cycleTitle(k.c, 'en'))) || ['fees'])[0], key = String(k.c.kind === 'month' ? (k.c.period || '') : '') + String(k.c.created_at || '');
      if (!newest[fam] || key > newest[fam].key) newest[fam] = { key: key, id: k.c.id };
    });
    var keep = {}; Object.keys(newest).forEach(function(f) { keep[newest[f].id] = 1; });
    cells = cells.filter(function(k) { return keep[k.c.id] || k.x.payments.some(function(p) { return String(p.received_at || '').slice(0, 10) === latest; }); });
  }
  var total = pair(), seenC = {};
  cells.forEach(function(k) { addTo(total, k.ch.cur, k.x.due); seenC[k.c.id] = 1; });
  var manyBills = Object.keys(seenC).length > 1;
  function one(lg) {
    var T = function(en, ar) { return lg === 'ar' ? ar : en; };
    var name = lg === 'ar' ? (u.name_ar || u.name) : u.name, bname = colHomeName(u, lg);
    var lines = cells.map(function(k) {
      var title = isSharedBook() ? cycleTitle(k.c, lg).split(' · ')[0] + (lg === 'ar' && /^E-/.test(cycleTitle(k.c, lg).split(' · ')[1] || '') ? ' ' + cycleTitle(k.c, lg).split(' · ')[1] : '')
        : (lg === 'ar' ? (k.ch.title_ar || k.ch.title) : k.ch.title);
      return '• ' + (k.bid === S.building.id && !manyBills ? title : k.title) + ': ' + colPlain(k.x.due, k.ch.cur) + ' ✅';
    });
    var s = '🏢 *' + bname + '*\n\n🧾 *' + T('Receipt', 'إيصال') + '*\n' + T('Thank you ', 'شكراً ') + (name ? '*' + name + '* ' : '') + '(' + unitTag(u) + ') 🌸\n' + lines.join('\n');
    if (cells.length > 1) s += '\n\n✅ *' + T('Total received: ', 'المجموع المستلم: ') + colPlainPair(total) + '*';
    if (u.resident_token) s += '\n\n' + T('Your bill and receipts:', 'فاتورتك وإيصالاتك:') + '\n' + residentLink(u);
    return s;
  }
  lang = lang || u.lang || 'both';
  return lang === 'both' ? one('ar') + '\n\n━━━━━━━━\n\n' + one('en') : one(lang);
}
/* One WhatsApp message with the apartment's whole status: what it paid lately, what is still
   to pay, the total left, who to hand it to, and the link. */
function colStatusText(u, lang) {
  var all = colCells(u).filter(function(k) { return k.x.due > 0; });
  var owed = all.filter(function(k) { return k.x.left > 0; });
  var paid = all.filter(function(k) { return k.x.state === 'paid'; }), latest = '', newest = {};
  paid.forEach(function(k) { k.x.payments.forEach(function(p) { var d = String(p.received_at || '').slice(0, 10); if (d > latest) latest = d; }); });
  paid.forEach(function(k) {
    var fam = k.bid + '|' + (/^(Water|EDL)\b/.exec(String(cycleTitle(k.c, 'en'))) || ['fees'])[0], key = String(k.c.kind === 'month' ? (k.c.period || '') : '') + String(k.c.created_at || '');
    if (!newest[fam] || key > newest[fam].key) newest[fam] = { key: key, id: k.c.id };
  });
  var keep = {}; Object.keys(newest).forEach(function(f) { keep[newest[f].id] = 1; });
  paid = paid.filter(function(k) { return keep[k.c.id] || k.x.payments.some(function(p) { return String(p.received_at || '').slice(0, 10) === latest; }); });
  var left = pair(); owed.forEach(function(k) { addTo(left, k.ch.cur, k.x.left); });
  function one(lg) {
    var T = function(en, ar) { return lg === 'ar' ? ar : en; };
    var name = lg === 'ar' ? (u.name_ar || u.name) : u.name;
    var s = '🏢 *' + colHomeName(u, lg) + '*\n\n' + T('Hello ', 'مرحباً ') + (name ? '*' + name + '* ' : '') + '(' + unitTag(u) + ') 👋';
    if (paid.length) s += '\n\n✅ *' + T('Paid', 'مدفوع') + '*\n' + paid.map(function(k) { return '• ' + k.title + ': ' + colPlain(k.x.due, k.ch.cur); }).join('\n');
    if (owed.length) {
      s += '\n\n⏳ *' + T('Still to pay', 'المتبقي') + '*\n' + owed.map(function(k) { return '• ' + k.title + ': ' + colPlain(k.x.left, k.ch.cur); }).join('\n');
      s += '\n\n*' + T('Total left: ', 'المجموع المتبقي: ') + colPlainPair(left) + '*\n' + T('You can hand it to ', 'يمكنك تسليمه إلى ') + payToName(lg) + '.';
    } else s += '\n\n🎉 *' + T('Nothing left to pay. Thank you!', 'لا شيء متبقٍ. شكراً!') + '*';
    if (u.resident_token) s += '\n\n' + T('Your bill and receipts:', 'فاتورتك وإيصالاتك:') + '\n' + residentLink(u);
    return s;
  }
  lang = lang || u.lang || 'both';
  return lang === 'both' ? one('ar') + '\n\n━━━━━━━━\n\n' + one('en') : one(lang);
}
/* One message with everything the apartment still owes. */
function colBillText(u, lang) {
  var cells = colCells(u).filter(function(k) { return k.x.left > 0; }), total = pair();
  cells.forEach(function(k) { addTo(total, k.ch.cur, k.x.left); });
  function one(lg) {
    var T = function(en, ar) { return lg === 'ar' ? ar : en; };
    var name = lg === 'ar' ? (u.name_ar || u.name) : u.name, bname = colHomeName(u, lg);
    var s = '🏢 *' + bname + '*\n\n' + T('Hello ', 'مرحباً ') + (name ? '*' + name + '* ' : '') + '(' + unitTag(u) + ') 👋\n';
    s += cells.map(function(k) { return '• ' + k.title + ': ' + colPlain(k.x.left, k.ch.cur); }).join('\n');
    s += '\n\n*' + T('Total to pay: ', 'المجموع المطلوب: ') + colPlainPair(total) + '*';
    s += '\n' + T('You can hand it to ', 'يمكنك تسليمه إلى ') + payToName(lg) + '.';
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
function colTick(rowId, bid, chId, uId) {
  UI.cTicked = UI.cTicked || {}; UI.cTicked[rowId] = 1;
  if (bid === S.building.id) return tapCell(chId, uId);
  if (isPend(chId, uId) || doubleTap(chId, uId)) return;
  var ns = colBookNs(bid);
  if (!ns) return;
  var st = withState(ns, function() { return cell(byId(S.charges, chId), byId(S.units, uId)).state; });
  if (st === 'paid' || st === 'part') return colSwitch(bid, function() { UI.tab = 'collect'; openSheet('cell', { ch: chId, u: uId }); });
  var row = withState(ns, function() {
    var ch = byId(S.charges, chId), u = byId(S.units, uId), x = cell(ch, u), r = channelRow();
    return { building_id: bid, charge_id: chId, unit_id: uId, amount: x.left, cur: ch.cur, channel: r.channel, method: r.method, received_by: r.received_by, received_at: nowIso() };
  });
  row.id = uuid(); row.client_key = tickKey(chId, uId);
  withState(ns, function() { applyLocal('payments', 'insert', row); });
  safePay([row], bid).then(function() {
    toastUndo(t('Saved', 'حُفظ'), [row.id]);
    UI.cb = null; render();
  }, function(e) {
    withState(ns, function() { S.payments = S.payments.filter(function(p) { return p.id !== row.id; }); });
    fail(e);
  });
}
function colPayAll(uId) {
  var u = byId(S.units, uId);
  colCells(u).filter(function(k) { return k.x.left > 0 && k.x.state !== 'part'; }).forEach(function(k) { colTick(uId, k.bid, k.ch.id, k.uid); });
}
function colRow(u) {
  // People mode: one total for everything this person owes, one button to settle it, details on demand.
  var ticked = UI.cTicked && UI.cTicked[u.id], cells = colCells(u);
  var owed = cells.filter(function(k) { return k.x.left > 0; });
  if (!owed.length && !ticked && !UI.cShowPaid) return '';
  var left = pair(); owed.forEach(function(k) { addTo(left, k.ch.cur, k.x.left); });
  var paidCells = cells.filter(function(k) { return k.x.state === 'paid'; });
  var open = UI.cOpenU && UI.cOpenU[u.id], settled = !owed.length;
  var q = (unitTag(u) + ' ' + (unitName(u) || '') + ' ' + (u.name_ar || '')).toLowerCase();
  var h = '<div class="ccard pcard' + (settled ? ' settled' : '') + '" data-q="' + esc(q) + '"><div class="crow"><div class="ucode">' + esc(unitTag(u)) + '</div><div class="grow"><div class="uname">' + esc(unitName(u) || unitTag(u)) + '</div><small class="muted">' + esc(settled ? t('All paid ✓', 'سدّد الكل ✓') : t(owed.length + (owed.length === 1 ? ' bill' : ' bills') + ' to pay', owed.length + ' فواتير')) + '</small></div>';
  if (!settled) h += '<div class="ptotal">' + colTotal(left) + '</div>';
  h += '</div>';
  h += '<div class="row" style="gap:8px;padding:0 12px 12px;align-items:center">';
  if (!settled) h += '<button class="btn ok grow" style="min-height:48px;font-size:16px" onclick="colPayAll(' + jsArg(u.id) + ')">✓ ' + esc(t('Paid ', 'دفع ') + (colUsdFirst() ? fmt(pairUsd(left), 'USD') : fmtPair(left))) + '</button>';
  else h += '<span class="grow" style="color:var(--ok);font-weight:700">✓ ' + esc(t('Nothing left to pay', 'لا شيء متبقٍ')) + '</span>';
  if (u.phone) h += '<button class="bico wa" aria-label="' + esc(t('WhatsApp status', 'الوضع على واتساب')) + '" onclick="openSheet(\'remind\',{status:true,u:' + jsArg(u.id) + '})">' + WA_ICON + '</button>';

  h += '<button class="bico" aria-expanded="' + !!open + '" aria-label="' + esc(t('Details', 'التفاصيل')) + '" onclick="UI.cOpenU=UI.cOpenU||{};UI.cOpenU[' + jsArg(u.id) + ']=!UI.cOpenU[' + jsArg(u.id) + '];render()">' + (open ? '▴' : '▾') + '</button></div>';
  if (open) {
    var shown = cells.filter(function(k) { return k.x.due > 0 && (UI.cShowPaid || k.x.left > 0 || ticked || k.x.state === 'paid'); });
    h += '<div class="crow-ticks">';
    shown.forEach(function(k) {
      var st = k.x.state, on = st === 'paid';
      h += '<button class="ctick' + (on ? ' on' : st === 'part' ? ' part' : '') + (isPend(k.ch.id, k.uid) ? ' pend' : '') + '" aria-pressed="' + on + '" onclick="colTick(' + jsArg(u.id) + ',' + jsArg(k.bid) + ',' + jsArg(k.ch.id) + ',' + jsArg(k.uid) + ')"><span class="ctick-box">' + (on ? '✓' : '') + '</span><span class="grow">' + esc(k.title) + '</span>' + colAmt(st === 'part' ? k.x.left : k.x.due, k.ch.cur) + '</button>';
    });
    h += '</div>';
  }
  return h + '</div>';
}
/* Search in People mode: hides cards that don't match, without redrawing (keeps the keyboard open). */
function colFilter(q) {
  UI.cQ = q; q = String(q || '').trim().toLowerCase();
  document.querySelectorAll('.pcard').forEach(function(el) { el.style.display = !q || (el.getAttribute('data-q') || '').indexOf(q) >= 0 ? '' : 'none'; });
  document.querySelectorAll('.pgroup').forEach(function(g) { var any = [].some.call(g.querySelectorAll('.pcard'), function(el) { return el.style.display !== 'none'; }); g.style.display = any ? '' : 'none'; });
}
/* Collector, one bill at a time: who still owes it, tick or remind each one. */
function colOpenBills() {
  return visibleCycles().slice().sort(function(a, b) { return String(cycleOrderKey(b) || '').localeCompare(String(cycleOrderKey(a) || '')) || String(b.created_at || '').localeCompare(String(a.created_at || '')); })
    .filter(function(c) { return chargesOf(c.id).length && colBillState(c).rows.length; });
}
function colBillState(c) {
  var rows = activeUnits().map(function(u) {
    var left = pair(), due = pair(), any = false;
    chargesOf(c.id).forEach(function(ch) { var x = cell(ch, u); if (x.due > 0) { any = true; addTo(due, ch.cur, x.due); addTo(left, ch.cur, x.left); } });
    return { u: u, left: left, due: due, any: any };
  }).filter(function(x) { return x.any; });
  var owe = rows.filter(function(x) { return pairUsd(x.left) > 0.005; }), left = pair();
  owe.forEach(function(x) { addTo(left, 'USD', x.left.USD); addTo(left, 'LBP', x.left.LBP); });
  return { rows: rows, owe: owe, paid: rows.length - owe.length, left: left };
}
/* Bill families for the tabs: in a shared book, one per kind of bill (Water, EDL…); in a
   building's book, one tab with the building's name for its monthly fees. */
function colFamOf(c) { return isSharedBook() ? String(cycleTitle(c, 'en')).split(' ')[0] : 'fees'; }
function colFamLabel(fam) {
  if (fam === 'fees') return LANG === 'ar' ? (S.building.name_ar || S.building.name) : S.building.name;
  var m = { Water: ['💧 Water', '💧 المياه'], EDL: ['⚡ EDL', '⚡ الكهرباء'] }[fam];
  return m ? t(m[0], m[1]) : fam;
}
function colFamTabs() {
  var tabs = [];
  colBooks().forEach(function(r) {
    withState(r.ns, function() {
      var seen = {};
      colOpenBills().forEach(function(c) {
        var f = colFamOf(c); if (seen[f]) return; seen[f] = 1;
        var owe = 0; colOpenBills().filter(function(x) { return colFamOf(x) === f; }).forEach(function(x) { owe += colBillState(x).owe.length; });
        tabs.push({ bid: r.b.id, fam: f, label: colFamLabel(f), owe: owe });
      });
    });
  });
  return tabs;
}
function colPickFam(bid, fam) { colSwitch(bid, function() { UI.cFam = bid + '|' + fam; UI.cBill = null; }); }
/* The short round code on a chip: "W-004", "E-001", or the month. */
function colChipName(c) { var n = colBillName(c), parts = n.split(' '); return isSharedBook() && parts.length > 1 ? parts.slice(1).join(' ') : n; }
function colBillView() {
  var tabs = colFamTabs(), h = '';
  if (!tabs.length) return '<div class="sec"><div class="card empty">' + esc(t('No bills yet', 'لا فواتير بعد')) + '</div></div>';
  var curKey = UI.cFam && UI.cFam.split('|')[0] === S.building.id ? UI.cFam : null;
  var here = tabs.filter(function(x) { return x.bid === S.building.id; });
  var tab = (curKey && tabs.filter(function(x) { return x.bid + '|' + x.fam === curKey; })[0]) || here[0] || tabs[0];
  if (tab.bid !== S.building.id) { setTimeout(function() { colPickFam(tab.bid, tab.fam); }, 0); return skelCards(3, 1); }
  // Bill families
  h += '<div id="cstick-a"></div><div class="csticky" id="cstick">' + (tabs.length < 2 ? '' : '<div class="ftabs" style="padding-top:0">' + tabs.map(function(x) { var on = x === tab; return '<button class="ftab' + (on ? ' on' : '') + '" onclick="colPickFam(' + jsArg(x.bid) + ',' + jsArg(x.fam) + ')">' + esc(x.label) + (x.owe ? '<span class="cnt">' + x.owe + '</span>' : '') + '</button>'; }).join('') + '</div>');
  // Rounds of this family
  var bills = colOpenBills().filter(function(c) { return colFamOf(c) === tab.fam; });
  var c = byId(S.cycles, UI.cBill); if (!c || colFamOf(c) !== tab.fam) c = bills[0];
  if (bills.length > 1) h += '<div class="rchips">' + bills.map(function(x, i) { var s2 = colBillState(x); return '<button class="rchip' + (x.id === c.id ? ' on' : '') + '" onclick="UI.cBill=' + jsArg(x.id) + ';render()"><b>' + esc(colChipName(x)) + '</b><small>' + esc(s2.owe.length ? t(s2.owe.length + ' owe', s2.owe.length + ' متبقٍ') : '✓') + '</small></button>'; }).join('') + '</div>';
  h += '</div><div class="clist' + (UI.cSlide ? ' slide-' + UI.cSlide : '') + '">';
  UI.cSlide = null;
  // The bill: collected, left, where the money is
  var st = colBillState(c), got = pair(), mine = pair(), dueAll = pair();
  st.rows.forEach(function(x) { addTo(dueAll, 'USD', x.due.USD); addTo(dueAll, 'LBP', x.due.LBP); });
  livePayments().forEach(function(p) { var ch = byId(S.charges, p.charge_id); if (!ch || ch.cycle_id !== c.id) return; addTo(got, p.cur, num(p.amount)); if (p.channel === 'collector' && !handoverConfirmed(p.handover_id)) addTo(mine, p.cur, num(p.amount)); });
  var pct = pairUsd(dueAll) > 0 ? Math.min(100, Math.round(pairUsd(got) / pairUsd(dueAll) * 100)) : 0, done = !st.owe.length;
  h += '<div class="sec"><div class="card pad bhead"><div class="row between" style="align-items:flex-start"><div><b class="bh-t">' + esc(colBillName(c)) + '</b><small>' + esc(cycleTitle(c).split(' · ').slice(1).join(' · ')) + '</small></div></div>';
  h += done ? '<div class="bh-big ok"><b>' + esc(t('All paid', 'الكل دفع')) + '</b></div>' : '<div class="bh-big">' + colTotal(st.left) + '<span>' + esc(t('left to collect', 'باقي للتحصيل')) + '</span></div>';
  h += '<div class="bar" style="margin:12px 0 8px"><i class="paid" style="width:' + pct + '%"></i></div>';
  h += '<div class="bh-sub"><span>' + esc(t(st.paid + ' of ' + st.rows.length + ' paid', 'دفع ' + st.paid + ' من ' + st.rows.length)) + '</span>' + colTotal(got) + '<span>' + esc(t('collected', 'تم تحصيلها')) + '</span></div>';
  if (isSharedBook()) h += '<div class="bh-note' + (done ? ' ok' : '') + '">' + esc(done ? t('Everyone paid: counted as paid to the supplier, out of your pocket.', 'الجميع دفع: تُحتسب مدفوعة للمورد وخرجت من جيبك.') : t('With you: ', 'معك: ') + colPlainPair(mine) + t(' · stays with you until everyone has paid this bill.', ' · تبقى معك حتى يدفع الجميع هذه الفاتورة.')) + '</div>';
  var showAll = !!UI.cShowAll;
  h += (st.paid ? '<button class="bh-more" onclick="UI.cShowAll=!UI.cShowAll;render()">' + esc(showAll ? t('Hide who paid', 'إخفاء من دفع') : t('Show who paid', 'إظهار من دفع')) + '</button>' : '') + '</div></div>';
  if (done && !showAll) return h + '</div>';
  // Apartments, by block; blocks where everyone paid fold into one line
  var groups = blocks().length > 1 ? blocks() : [null], allPaid = [];
  groups.forEach(function(b) {
    var rows = st.rows.filter(function(x) { return !b || blockOf(x.u) === b; });
    if (!rows.length) return;
    var left = pair(); rows.forEach(function(x) { addTo(left, 'USD', x.left.USD); addTo(left, 'LBP', x.left.LBP); });
    var shown = showAll ? rows : rows.filter(function(x) { return pairUsd(x.left) > 0.005; });
    if (!shown.length) { allPaid.push(b ? blockLabel(b) : S.building.name); return; }
    h += '<div class="sec bsec">' + (groups.length < 2 ? '' : '<div class="bsec-h"><b>' + esc(b ? blockLabel(b) : (LANG === 'ar' ? (S.building.name_ar || S.building.name) : S.building.name)) + '</b>' + (pairUsd(left) > 0.005 ? colTotal(left) : '<span>✓</span>') + '</div>');
    shown.forEach(function(x) {
      var u = x.u, paid = pairUsd(x.left) <= 0.005, pend = chargesOf(c.id).some(function(ch) { return isPend(ch.id, u.id); });
      var firstCh = chargesOf(c.id).filter(function(ch) { return cell(ch, u).due > 0; })[0];
      h += '<div class="brow' + (paid ? ' paid' : '') + '"><button class="bchk' + (paid ? ' on' : '') + (pend ? ' pend' : '') + '" aria-pressed="' + paid + '" aria-label="' + esc(t('Paid', 'دفع')) + '" onclick="' + (paid ? 'openSheet(\'cell\',{ch:' + jsArg(firstCh.id) + ',u:' + jsArg(u.id) + '})' : 'colTickBill(' + jsArg(u.id) + ',' + jsArg(c.id) + ')') + '">' + (paid ? PEN_TICK : '') + '</button>';
      h += '<div class="grow"><b>' + esc(unitName(u) || unitTag(u)) + '</b><small>' + esc(unitTag(u)) + '</small></div><span class="bamt">' + colTotal(paid ? x.due : x.left) + '</span>';
      if (u.phone) h += '<button class="bico wa" aria-label="' + esc(t('WhatsApp status', 'الوضع على واتساب')) + '" onclick="openSheet(\'remind\',{status:true,u:' + jsArg(u.id) + '})">' + WA_ICON + '</button>';
      else h += '<span class="bico none"></span>';
      h += '</div>';
    });
    h += '</div>';
  });
  if (allPaid.length) h += '<div class="sec"><p class="muted" style="margin:4px 4px 0">✓ ' + esc(t('Everyone paid in ', 'الجميع دفع في ') + allPaid.join(', ')) + '</p></div>';
  return h + '</div>';
}
var PEN_TICK = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4.5 12.8c1.6 1.1 3 2.6 4.3 4.6C11.6 11.6 15 7.4 19.6 4.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function colTickBill(uId, cId) {
  var u = byId(S.units, uId);
  chargesOf(cId).forEach(function(ch) { var x = cell(ch, u); if (x.left > 0 && x.state !== 'part') colTick(uId, S.building.id, ch.id, uId); });
}
function renderColCollect() { return '<div class="colpg">' + renderColCollectIn() + '</div>'; }
function renderColCollectIn() {
  var h = colPreviewBar() + renderTopbar(t('Collect', 'التحصيل')) + staleBar();
  if (!UI.cb) loadColBooks();
  var books = colBooks(), people = UI.cMode === 'apt';
  // Bills: follow each bill and its supplier. People: collect from someone at the door.
  h += '<div class="sec" style="margin-top:6px"><div class="modesw"><button class="' + (!people ? 'on' : '') + '" aria-pressed="' + !people + '" onclick="UI.cMode=\'bill\';render();window.scrollTo(0,0)">' + esc(t('Bills', 'الفواتير')) + '</button><button class="' + (people ? 'on' : '') + '" aria-pressed="' + people + '" onclick="UI.cMode=\'apt\';render();window.scrollTo(0,0)">' + esc(t('People', 'الأشخاص')) + '</button></div></div>';
  if (people) {
    // People: everyone in one list by block. Books only show as tabs when they are not linked
    // to the shared book (a collector working in two unrelated buildings).
    var base = colPeopleBase(), lone = books.filter(function(r) { return base && r.b.id !== base.b.id && !colLinkedToShared(r); });
    if (base && S.building.id !== base.b.id && !lone.some(function(r) { return r.b.id === S.building.id; })) { setTimeout(function() { colSwitch(base.b.id); }, 0); return h + skelCards(4, 1); }
    if (lone.length) h += '<div class="ftabs">' + [base].concat(lone).map(function(r) { return '<button class="ftab' + (r.b.id === S.building.id ? ' on' : '') + '" onclick="colSwitch(' + jsArg(r.b.id) + ')">' + esc(r === base && r.ns.building.kind === 'shared' ? t('Everyone', 'الجميع') : (LANG === 'ar' ? (r.b.name_ar || r.b.name) : r.b.name)) + '</button>'; }).join('') + '</div>';
  }
  if (!people) return h + colBillView();
  var tot = colBookTotals();
  h += '<div class="sec" style="margin-top:10px"><div class="row between"><span class="muted" style="font-weight:600">' + esc(t('Still to collect', 'باقي للتحصيل')) + '</span>' + colTotal(tot.left) + '</div></div>';
  h += '<div id="cstick-a"></div><div class="csticky" id="cstick"><div class="sec" style="margin-top:0"><input class="input" type="search" placeholder="' + esc(t('Find a name or apartment…', 'ابحث عن اسم أو شقة…')) + '" value="' + esc(UI.cQ || '') + '" oninput="colFilter(this.value)"></div>';
  var bl = blocks(), blk = bl.length > 1 && bl.indexOf(UI.cBlk) >= 0 ? UI.cBlk : null;
  if (bl.length > 1) {
    h += '<div class="chips wrapc" style="margin-top:8px"><button class="chip' + (!blk ? ' on' : '') + '" onclick="colGoBlock(null)">' + esc(t('All', 'الكل')) + '</button>';
    bl.forEach(function(b) {
      var n = activeUnits().filter(function(u) { return blockOf(u) === b && colCells(u).some(function(k) { return k.x.left > 0; }); }).length;
      h += '<button class="chip' + (blk === b ? ' on' : '') + '" onclick="colGoBlock(' + jsArg(b) + ')">' + esc(blockLabel(b)) + (n ? ' <span class="cnt">' + n + '</span>' : ' ✓') + '</button>';
    });
    h += '</div>';
  }
  h += '</div><div class="clist' + (UI.cSlide ? ' slide-' + UI.cSlide : '') + '">';
  UI.cSlide = null;
  var groups = bl.length > 1 ? (blk ? [blk] : bl) : [null], shown = 0;
  groups.forEach(function(b) {
    var rows = activeUnits().filter(function(u) { return !b || blockOf(u) === b; }).map(colRow).filter(Boolean);
    if (!rows.length) return;
    shown += rows.length;
    h += '<div class="sec pgroup" style="margin-top:12px">' + (b && !blk ? '<div class="pgroup-h">' + esc(blockLabel(b)) + '</div>' : '') + '<div class="cstack">' + rows.join('') + '</div></div>';
  });
  if (!shown) h += '<div class="sec"><div class="card empty">' + esc(t('Everyone has paid ✓', 'الجميع سدّد ✓')) + '</div></div>';
  h += '</div>';
  h += '<div class="sec" style="margin-top:12px"><button class="btn ghost block" onclick="UI.cShowPaid=!UI.cShowPaid;render()">' + esc(UI.cShowPaid ? t('Hide who paid', 'إخفاء من دفع') : t('Show who paid too', 'إظهار من دفع أيضاً')) + '</button></div>';
  if (UI.cQ) setTimeout(function() { colFilter(UI.cQ); }, 0);
  return h;
}
/* The book People mode lists from: the shared book when there is one (it has every apartment). */
function colPeopleBase() {
  var bs = colBooks();
  return bs.filter(function(r) { return r.ns.building && r.ns.building.kind === 'shared'; })[0] || bs.filter(function(r) { return r.b.id === S.building.id; })[0] || bs[0] || null;
}
function colLinkedToShared(r) { return r.ns.units.some(function(u) { return !!u.linked_unit_id; }); }
/* The apartment's own building name (from the shared book, the building it is linked to). */
function colHomeName(u, lg) {
  var nm = null;
  if (isSharedBook() && u.linked_unit_id) colBooks().forEach(function(r) { if (!nm && r.ns.building.kind !== 'shared' && byId(r.ns.units, u.linked_unit_id)) nm = lg === 'ar' ? (r.b.name_ar || r.b.name) : r.b.name; });
  return nm || (lg === 'ar' ? (S.building.name_ar || S.building.name) : S.building.name);
}
function colBookNs(bid) { var r = colBooks().filter(function(x) { return x.b.id === bid; })[0]; return r ? r.ns : null; }
/* Swipe left/right on the collector page: next or previous bill tab, or block. */
/* Change block or tab without losing your place: if you had scrolled past the sticky bar,
   the new list starts right under it; otherwise the page stays where it is. */
function colPlace() {
  var el = document.getElementById('cstick-a');
  if (!el) return null;
  var top = el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.getElementById('cstick')).top) || 0);
  return { past: window.scrollY > top, top: top };
}
function colRestore(pl) {
  if (!pl) return;
  if (pl.past) window.scrollTo(0, pl.top);
}
function colGoBlock(b, dir) {
  var pl = colPlace();
  if (dir) UI.cSlide = dir > 0 ? 'l' : 'r';
  UI.cBlk = b; render(); colRestore(pl);
}
function colSwipe(dir) {
  if (UI.cMode === 'apt') {
    var list = [null].concat(blocks().length > 1 ? blocks() : []);
    if (list.length < 2) return;
    var i = list.indexOf(blocks().indexOf(UI.cBlk) >= 0 ? UI.cBlk : null), j = i + dir;
    if (j < 0 || j >= list.length) return;
    colGoBlock(list[j], LANG === 'ar' ? -dir : dir); return;
  }
  var tabs = colFamTabs(), cur = UI.cFam || '', k = -1;
  tabs.forEach(function(x, n) { if (x.bid + '|' + x.fam === cur) k = n; });
  if (k < 0) tabs.forEach(function(x, n) { if (k < 0 && x.bid === S.building.id) k = n; });
  var m = k + dir;
  if (m < 0 || m >= tabs.length) return;
  var pl = colPlace();
  UI.cSlide = (LANG === 'ar' ? -dir : dir) > 0 ? 'l' : 'r';
  colPickFam(tabs[m].bid, tabs[m].fam);
  colRestore(pl); setTimeout(function() { colRestore(pl); }, 0);
}
(function() {
  var x0 = null, y0 = 0, t0 = 0;
  document.addEventListener('touchstart', function(e) {
    x0 = null;
    if (UI.screen !== 'app' || UI.sheet || UI.tab !== 'collect' || typeof colUI !== 'function' || !colUI()) return;
    if (e.target.closest && e.target.closest('.rchips, input, textarea, select')) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (x0 == null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - t0 > 700) return;
    var dir = dx < 0 ? 1 : -1;
    if (LANG === 'ar') dir = -dir;
    colSwipe(dir);
  }, { passive: true });
})();
function colOpenBill(bid, cid) { colSwitch(bid, function() { UI.tab = 'collect'; UI.cMode = 'bill'; UI.cBill = cid; var c = byId(S.cycles, cid); if (c) UI.cFam = bid + '|' + colFamOf(c); }); }
function renderColDash() {
  var h = colPreviewBar() + renderTopbar(t('Dashboard', 'لوحة المعلومات'));
  if (!UI.cb) { loadColBooks(); return h + skelCards(3, 3); }
  var rows = colBooks().map(function(r) {
    return withState(r.ns, function() {
      var cash = cashState(), mine = cash.pockets[r.ns.me.id] || pair();
      var bills = colOpenBills().map(function(c) {
        var s2 = colBillState(c), got = pair(), mine = pair();
        livePayments().forEach(function(p) { var ch = byId(S.charges, p.charge_id); if (!ch || ch.cycle_id !== c.id) return; addTo(got, p.cur, num(p.amount)); if (p.channel === 'collector' && !handoverConfirmed(p.handover_id) && (UI.pvCol || p.received_by === S.me.id || !p.received_by)) addTo(mine, p.cur, num(p.amount)); });
        var f = function(p) { return colUsdFirst() ? fmt(pairUsd(p), 'USD') : fmtPair(p); };
        return { id: c.id, name: colBillName(c), n: s2.rows.length, paid: s2.paid, owe: s2.owe.length, left: f(s2.left), got: f(got), mine: f(mine) };
      }).filter(function(x) { return x.owe; });
      return { b: r.b, bills: bills, pocket: UI.pvCol ? cash.withCollector : { USD: mine.USD || 0, LBP: mine.LBP || 0 }, tot: colBookTotals(true),
        tasks: openTasks('collector').filter(function(x) { return x.due_on && x.due_on <= todayIso(); }),
        pending: r.ns.handovers.filter(function(x) { return x.status === 'pending' && (UI.pvCol || x.collector_id === r.ns.me.id); }).length };
    });
  });
  h += '<div class="sec"><div class="stack">';
  rows.forEach(function(r) {
    h += '<div class="card pad"><b style="font-size:16px">' + esc(LANG === 'ar' ? (r.b.name_ar || r.b.name) : r.b.name) + '</b>';
    h += '<div class="kv"><span>' + esc(t('In your pocket', 'معك الآن')) + '</span>' + colTotal(r.pocket) + '</div>';
    h += '<div class="kv"><span>' + esc(t('Still to collect', 'باقي للتحصيل')) + '</span>' + colTotal(r.tot.left) + '</div>';
    if (r.bills && r.bills.length) {
      h += '<div class="cdash-bills">' + r.bills.map(function(x) { return '<button class="li" onclick="colOpenBill(' + jsArg(r.b.id) + ',' + jsArg(x.id) + ')"><div class="grow"><b>' + esc(x.name) + ' <span class="muted" style="font-weight:600;font-size:12px">' + esc(x.paid + '/' + x.n) + '</span></b><small>' + esc(t('Collected ', 'جُبي ') + x.got + t(' · with you ', ' · معك ') + x.mine) + '</small></div><span class="amt" style="color:var(--bad);text-align:end">' + esc(x.left) + '<small style="display:block;color:var(--mut);font-weight:600;font-size:11px">' + esc(t('missing', 'ناقص')) + '</small></span><span class="chev">›</span></button>'; }).join('') + '</div>';
    }
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
