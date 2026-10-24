/* ============================================================================
   First run: show the building first, ask for an account last.
   Full screen, one idea per step, never scrolls.
   ============================================================================ */
var OB = null;
var OB_TIMER = null;

function renderWelcome() {
  var h = '<div class="ob"><div class="ob-in">';
  h += '<div class="ob-top"><span style="font-weight:800;font-size:15px">' + esc(t('Binayati', 'بنايتي')) + '</span><button class="iconbtn" onclick="setLang()">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button></div>';
  h += '<div class="ob-stage">' + obScene(welcomeLit(), 9, 'Binayati', true) + '</div>';
  h += '<div class="ob-body"><h1>' + esc(t('Every apartment, every dollar, clear to everyone.', 'كل شقة، كل دولار، واضح للجميع.')) + '</h1>';
  h += '<div class="features">';
  h += '<div class="feat"><i>✓</i><span>' + esc(t('Tick who paid. The window lights up.', 'علّم من سدّد، فيضيء شباكه.')) + '<small>' + esc(t('Dollars and lira, fees, bills, moteur.', 'دولار وليرة، رسوم، فواتير، موتور.')) + '</small></span></div>';
  h += '<div class="feat"><i>⇄</i><span>' + esc(t('Know where the cash is.', 'اعرف أين النقد.')) + '<small>' + esc(t('With the collector until handed over, then in the safe.', 'مع الجابي حتى يسلّمه، ثم في الصندوق.')) + '</small></span></div>';
  h += '<div class="feat"><i>🧾</i><span>' + esc(t('Residents get receipts and see the books.', 'السكان يستلمون إيصالات ويرون الحسابات.')) + '<small>' + esc(t('A private link on WhatsApp. No app to install.', 'رابط خاص على واتساب. بلا تطبيق.')) + '</small></span></div>';
  h += '</div></div>';
  h += '<div class="ob-foot"><button class="btn pri block" onclick="startSetup()">' + esc(t('Set up my building', 'أعدّ بنايتي')) + '</button>';
  if (isCloud()) {
    h += '<button class="btn ghost block" onclick="UI.screen=\'auth\';UI.auth={mode:\'in\'};render()">' + esc(t('I already have an account', 'لدي حساب')) + '</button>';
    h += '<button class="btn ghost block" onclick="demoSignIn(\'manager\')">' + esc(t('Try the demo building', 'جرّب البناية التجريبية')) + '</button>';
  }
  else h += '<button class="btn ghost block" onclick="loadSample()">' + esc(t('Look around with a sample building', 'جرّب ببناية نموذجية')) + '</button>';
  h += '</div></div></div>';
  return h;
}
function welcomeLit() {
  var n = (Math.floor(Date.now() / 700) % 12);
  return Math.min(9, n);
}
/* n is a count, or a list of apartment codes so floors (and underground floors) are drawn right. */
function obScene(lit, n, sign, celebrate, extra) {
  var codes = Array.isArray(n) ? n : null, count = codes ? codes.length : n;
  var wins = [];
  for (var i = 0; i < count; i++) wins.push({ state: i < lit ? 'paid' : 'closed' });
  var levels = codes ? levelsFor(codes.map(function(c, i) { return { code: c, win: wins[i] }; })) : null;
  return buildBuildingScene({ phase: { key: 'day', sunX: 0, sunY: 0 }, bare: true, wins: wins, levels: levels, signText: sign || 'Building', idp: 'ob',
                              safe: extra && extra.safe, solar: true, extraCls: 'studio bh-bare bh-ob nopop', celebrate: celebrate });
}
function tickWelcome() {
  clearInterval(OB_TIMER);
  OB_TIMER = setInterval(function() {
    if (UI.screen !== 'welcome') { clearInterval(OB_TIMER); return; }
    var st = document.querySelector('.ob-stage');
    if (st) st.innerHTML = obScene(welcomeLit(), 9, 'Binayati', true);
  }, 700);
}

function startSetup() {
  OB = { step: 1, name: '', nameAr: '', floors: 4, per: 2, under: 0, blocks: 1, fee: '', cur: 'USD', split: 'each', who: 'other', colName: '', openUsd: '', openLbp: '' };
  UI.screen = 'ob';
  render();
}
var OB_STEPS = 5;
function layoutCodes(floors, per, under) {
  var out = [], letters = 'ABCDEFGH';
  for (var b = under || 0; b >= 1; b--) for (var k = 0; k < per; k++) out.push(per === 1 ? 'SS' + b : 'SS' + b + letters.charAt(k));
  for (var f = 1; f <= floors; f++) for (var k2 = 0; k2 < per; k2++) out.push(per === 1 ? String(f) : f + letters.charAt(k2));
  return out;
}
function obUnits() { return layoutCodes(OB.floors, OB.per, OB.under || 0); }
function renderOnboarding() {
  var n = (OB.floors + (OB.under || 0)) * OB.per * (OB.blocks || 1), step = OB.step;
  var lit = { 1: 0, 2: 0, 3: Math.round(n * 0.3), 4: Math.round(n * 0.6), 5: n, 6: n }[step] || 0;
  var safe = step >= 5 ? { split: true, usdH: Math.min(22, 4 + num(OB.openUsd) / 40), lbpH: Math.min(22, 4 + num(OB.openLbp) / 4e6) } : null;
  var h = '<div class="ob"><div class="ob-in">';
  h += '<div class="ob-top"><button class="iconbtn" onclick="obBack()" aria-label="' + esc(t('Back', 'رجوع')) + '">' + (LANG === 'ar' ? '›' : '‹') + '</button><div class="ob-dots">';
  for (var i = 1; i <= OB_STEPS; i++) h += '<i class="' + (i <= Math.min(step, OB_STEPS) ? 'on' : '') + '"></i>';
  h += '</div><button class="iconbtn" onclick="setLang()">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button></div>';
  h += '<div class="ob-stage">' + obScene(lit, obUnits(), OB.name || t('Your building', 'بنايتك'), step === 6, { safe: safe }) + '</div>';
  h += '<div class="ob-body">';
  if (step === 1) {
    h += '<h1>' + esc(t('What\'s the building called?', 'ما اسم البناية؟')) + '</h1><p class="sub">' + esc(t('It goes on the sign and on every receipt.', 'يظهر على اللافتة وعلى كل إيصال.')) + '</p>';
    h += '<label class="field"><input class="input" id="ob-name" data-tr="ob-name-ar" data-tr-kind="phrase" value="' + esc(OB.name) + '" placeholder="' + esc(t('e.g. Block C, Bayt Haddad', 'مثلاً البلوك C، بيت حداد')) + '" oninput="OB.name=this.value;obSign()" data-autofocus><div class="tr-box" id="trs-ob-name"></div></label>';
    h += '<label class="field"><input class="input" id="ob-name-ar" data-tr="ob-name" data-tr-kind="phrase" dir="rtl" value="' + esc(OB.nameAr) + '" placeholder="' + esc(t('Arabic name (optional)', 'الاسم بالعربية (اختياري)')) + '" oninput="OB.nameAr=this.value"><div class="tr-box" id="trs-ob-name-ar"></div></label>';
  } else if (step === 2) {
    h += '<h1>' + esc(t(n + ' apartments', n + ' شقق')) + '</h1><p class="sub">' + esc(t('Roughly is fine. You can rename, add shops or remove any later.', 'تقريباً يكفي. يمكنك التعديل وإضافة محلات لاحقاً.')) + '</p>';
    h += '<div class="ob-step"><div><b>' + esc(t('Floors', 'الطوابق')) + '</b></div><div class="stepper"><button onclick="obBump(\'floors\',-1)">−</button><span>' + OB.floors + '</span><button onclick="obBump(\'floors\',1)">+</button></div></div>';
    h += '<div class="ob-step"><div><b>' + esc(t('Apartments per floor', 'شقق في الطابق')) + '</b><small>' + esc(obUnits().filter(function(c) { return c.indexOf('SS') !== 0; }).slice(0, 4).join(', ') + '…') + '</small></div><div class="stepper"><button onclick="obBump(\'per\',-1)">−</button><span>' + OB.per + '</span><button onclick="obBump(\'per\',1)">+</button></div></div>';
    h += '<div class="ob-step"><div><b>' + esc(t('Underground floors', 'طوابق سفلية')) + '</b><small>' + esc(OB.under ? obUnits().filter(function(c) { return c.indexOf('SS') === 0; }).slice(0, 3).join(', ') + (OB.under * OB.per > 3 ? '…' : '') : t('SS1, SS2… if any', 'SS1، SS2… إن وُجدت')) + '</small></div><div class="stepper"><button onclick="obBump(\'under\',-1)">−</button><span>' + (OB.under || 0) + '</span><button onclick="obBump(\'under\',1)">+</button></div></div>';
    h += '<div class="ob-step"><div><b>' + esc(t('Blocks', 'البلوكات')) + '</b><small>' + esc((OB.blocks || 1) > 1 ? t('One compound, one safe: blocks A–' + 'ABCDEF'.charAt(OB.blocks - 1), 'مجمّع واحد وصندوق واحد: بلوكات A–' + 'ABCDEF'.charAt(OB.blocks - 1)) : t('Just one building', 'بناية واحدة')) + '</small></div><div class="stepper"><button onclick="obBump(\'blocks\',-1)">−</button><span>' + (OB.blocks || 1) + '</span><button onclick="obBump(\'blocks\',1)">+</button></div></div>';
  } else if (step === 3) {
    h += '<h1>' + esc(t('The monthly fee', 'الرسم الشهري')) + '</h1><p class="sub">' + esc(t('What each apartment pays for upkeep. Bills, moteur and projects come later.', 'ما تدفعه كل شقة للصيانة. الفواتير والموتور والمشاريع لاحقاً.')) + '</p>';
    h += '<label class="field"><div class="money-in"><input class="input" id="ob-fee" inputmode="decimal" value="' + esc(OB.fee) + '" placeholder="20" oninput="OB.fee=this.value" data-autofocus><div class="seg"><button class="' + (OB.cur === 'USD' ? 'on' : '') + '" onclick="OB.cur=\'USD\';render()">USD</button><button class="' + (OB.cur === 'LBP' ? 'on' : '') + '" onclick="OB.cur=\'LBP\';render()">LBP</button></div></div></label>';
    h += '<div class="seg" style="margin-top:10px"><button class="' + (OB.split === 'each' ? 'on' : '') + '" onclick="OB.split=\'each\';render()">' + esc(t('Same for all', 'نفس المبلغ للجميع')) + '</button><button class="' + (OB.split === 'weight' ? 'on' : '') + '" onclick="OB.split=\'weight\';render()">' + esc(t('By apartment size', 'حسب المساحة')) + '</button></div>';
  } else if (step === 4) {
    h += '<h1>' + esc(t('Who collects the money?', 'من يجمع المال؟')) + '</h1><p class="sub">' + esc(t('Cash they collect stays "with them" until they hand it over.', 'النقد الذي يجمعه يبقى "معه" حتى يسلّمه.')) + '</p>';
    h += '<div style="margin-top:10px"><button class="choice' + (OB.who === 'other' ? ' on' : '') + '" onclick="OB.who=\'other\';render()"><span class="ic">💵</span><span class="grow"><b>' + esc(t('Someone goes door to door', 'شخص يمرّ على الشقق')) + '</b><small>' + esc(t('Natour, concierge or a neighbour', 'ناطور أو حارس أو جار')) + '</small></span></button>';
    if (OB.who === 'other') {
      h += '<div class="two" style="margin-top:8px"><div><input class="input" id="ob-col" dir="ltr" data-tr="ob-col-ar" data-tr-kind="name" value="' + esc(OB.colName) + '" placeholder="' + esc(t('Name, e.g. Anas', 'الاسم، مثلاً Anas')) + '" oninput="OB.colName=this.value"><div class="tr-box" id="trs-ob-col"></div></div>';
      h += '<div><input class="input" id="ob-col-ar" dir="rtl" data-tr="ob-col" data-tr-kind="name" value="' + esc(OB.colNameAr || '') + '" placeholder="أنس" oninput="OB.colNameAr=this.value"><div class="tr-box" id="trs-ob-col-ar"></div></div></div>';
    }
    h += '<button class="choice' + (OB.who === 'me' ? ' on' : '') + '" onclick="OB.who=\'me\';render()"><span class="ic">🙋</span><span class="grow"><b>' + esc(t('I collect it myself', 'أنا أجمعه بنفسي')) + '</b><small>' + esc(t('Or residents transfer to me', 'أو يحوّل لي السكان')) + '</small></span></button></div>';
  } else if (step === 5) {
    h += '<h1>' + esc(t('Anything in the safe already?', 'هل يوجد مال في الصندوق؟')) + '</h1><p class="sub">' + esc(t('Leave it at zero if you\'re starting fresh.', 'اتركه صفراً إذا كنت تبدأ من جديد.')) + '</p>';
    h += '<div class="two" style="margin-top:10px"><input class="input" inputmode="decimal" value="' + esc(OB.openUsd) + '" placeholder="$ 0" oninput="OB.openUsd=this.value"><input class="input" inputmode="numeric" value="' + esc(OB.openLbp) + '" placeholder="LBP 0" oninput="OB.openLbp=this.value"></div>';
  } else if (step === 6) {
    h += '<h1>' + esc(t((OB.name || 'Your building') + ' is ready', (OB.name || 'بنايتك') + ' جاهزة')) + '</h1>';
    h += '<p class="sub">' + esc(t(n + ' apartments · ' + fmt(num(OB.fee), OB.cur) + ' a month · ' + (OB.who === 'other' ? (OB.colName || 'a collector') + ' collects' : 'you collect'), n + ' شقق · ' + fmt(num(OB.fee), OB.cur) + ' شهرياً · ' + (OB.who === 'other' ? 'يجمع ' + (OB.colName || 'الجابي') : 'أنت تجمع'))) + '</p>';
    if (isCloud()) h += '<p class="sub">' + esc(t('Last step: an account, so it\'s saved and your collector can join from their phone.', 'خطوة أخيرة: حساب، لتُحفظ ويستطيع الجابي الانضمام من هاتفه.')) + '</p>';
  }
  h += '<div id="ob-err" class="err"></div></div>';
  h += '<div class="ob-foot"><button class="btn pri block" onclick="obNext()">' + esc(step === 6 ? (isCloud() ? t('Create my account', 'أنشئ حسابي') : t('Open my building', 'افتح بنايتي')) : t('Continue', 'متابعة')) + '</button></div>';
  h += '</div></div>';
  return h;
}
function obSign() {
  var el = document.getElementById('ob-sign'); if (!el) return;
  var txt = String(OB.name || '').toUpperCase().slice(0, 12);
  el.textContent = txt;
  if (txt.length > 8) { el.setAttribute('textLength', '38'); el.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } else el.removeAttribute('textLength');
}
function obBump(k, d) {
  var min = k === 'under' ? 0 : 1, max = k === 'floors' ? 12 : k === 'under' ? 3 : 6;
  var was = OB[k] || (k === 'blocks' ? 1 : 0);
  OB[k] = Math.max(min, Math.min(max, was + d));
  if ((OB.floors + (OB.under || 0)) * OB.per > 48 || (OB.floors + (OB.under || 0)) * OB.per * (OB.blocks || 1) > 150) OB[k] = was;
  render();
}
function obBack() { if (OB.step <= 1) { UI.screen = 'welcome'; render(); tickWelcome(); return; } OB.step--; render(); }
function obNext() {
  var err = document.getElementById('ob-err');
  if (OB.step === 1 && !OB.name.trim()) { err.textContent = t('Give it a name', 'أعطها اسماً'); return; }
  if (OB.step === 3 && !(num(OB.fee) > 0)) { err.textContent = t('Enter the monthly fee', 'أدخل الرسم الشهري'); return; }
  if (OB.step < 6) { OB.step++; render(); return; }
  if (isCloud()) { UI.screen = 'auth'; UI.auth = { mode: 'up', then: 'create' }; render(); return; }
  finishSetup();
}

/* Create the building from the answers, in whichever backend is active. */
function finishSetup(displayName) {
  var settings = { rate: 89500, opening_usd: num(OB.openUsd), opening_lbp: num(OB.openLbp), books_public: true, show_who_paid: false,
                   collector_name: OB.who === 'other' ? (OB.colName || '') : '', collector_name_ar: OB.who === 'other' ? (OB.colNameAr || '') : '' };
  var bid;
  return rpc('create_building', { p_name: OB.name.trim(), p_name_ar: OB.nameAr.trim() || null, p_settings: settings, p_display_name: displayName || t('Manager', 'المدير') })
    .then(function(id) { bid = id; return openBuilding(bid); })
    .then(function() {
      var units = [], nb = OB.blocks || 1;
      for (var bi = 0; bi < nb; bi++) obUnits().forEach(function(code) {
        units.push({ code: code, name: '', sort: units.length, weight: 1, lang: 'both', active: true, resident_token: token(), block: nb > 1 ? 'ABCDEF'.charAt(bi) : null });
      });
      return dbInsertMany('units', units);
    })
    .then(function() {
      var p = currentPeriod();
      var cyc = { kind: 'month', period: p, title: periodLabel(p, 'en'), title_ar: periodLabel(p, 'ar'), published: true };
      return dbInsert('cycles', cyc).then(function() {
        return dbInsert('charges', { cycle_id: cyc.id, kind: 'fixed', title: 'Maintenance', title_ar: 'الصيانة', cur: OB.cur, amount: num(OB.fee),
                                     split: OB.split, overrides: {}, pass_through: false, recurring: true, sort: 0 });
      }).then(function() { UI.cycleId = cyc.id; });
    })
    .then(function() {
      if (OB.who === 'other' && !isCloud()) return dbInsert('members', { user_id: 'u-collector', role: 'collector', display_name: OB.colName || t('Collector', 'الجابي'), display_name_ar: OB.colNameAr || null });
    })
    .then(function() {
      return dbInsertMany('tasks', [
        { title: 'Clean water tanks', title_ar: 'تنظيف خزانات المياه', due_on: rollDate(todayIso(), 'monthly'), repeat: 'halfyear', assignee: OB.who === 'other' ? 'collector' : 'manager' },
        { title: 'Wash trash bins', title_ar: 'غسل مستوعبات النفايات', due_on: rollDate(todayIso(), 'weekly'), repeat: 'weekly', assignee: OB.who === 'other' ? 'collector' : 'manager' }
      ]);
    })
    .then(function() {
      var askInvite = OB.who === 'other' && isCloud();
      var name = OB.colName, nameAr = OB.colNameAr;
      OB = null;
      UI.screen = 'app'; UI.tab = 'home'; HERO_REVEAL = true;
      render(); window.scrollTo(0, 0); launchConfetti();
      if (askInvite) setTimeout(function() { openSheet('invite', { role: 'collector' }); setTimeout(function() { var el = document.getElementById('inv-name'); if (el) el.value = name || ''; var ea = document.getElementById('inv-name-ar'); if (ea) ea.value = nameAr || ''; }, 50); }, 1600);
    })
    .catch(function(e) { fail(e); });
}

/* A filled-in example so people can poke around before committing. */
function loadSample() {
  OB = { step: 6, name: 'Block C', nameAr: 'البلوك C', floors: 4, per: 2, under: 0, fee: 20, cur: 'USD', split: 'each', who: 'other', colName: 'Anas', colNameAr: 'أنس', openUsd: 450, openLbp: 18000000 };
  finishSetup('Carl').then(function() {
    var cyc = currentCycle(); if (!cyc) return;
    var us = activeUnits();
    var names = [['Ahmad El-Khatib', 'أحمد الخطيب'], ['Nadia Khoury', 'ناديا خوري'], ['Hadi Mansour', 'هادي منصور'], ['Karim Salameh', 'كريم سلامة'], ['Ziad Nader', 'زياد نادر'], ['Rania Haddad', 'رانيا حداد'], ['Omar Saab', 'عمر صعب'], ['Lina Farah', 'لينا فرح']];
    var db = localLoad();
    us.forEach(function(u, i) { var x = byId(db.units, u.id); x.name = u.name = names[i][0]; x.name_ar = u.name_ar = names[i][1]; x.phone = u.phone = '96170' + (100000 + i * 1111); });
    localSave();
    var water = { cycle_id: cyc.id, kind: 'due', title: 'Water bill', title_ar: 'فاتورة المياه', cur: 'LBP', amount: 10000000, split: 'total', overrides: {}, pass_through: false, recurring: false, sort: 1 };
    var ov = {}; ov[us[0].id] = 45; ov[us[3].id] = 50; ov[us[5].id] = 40;
    var moteur = { cycle_id: cyc.id, kind: 'service', title: 'Moteur', title_ar: 'الموتور', cur: 'USD', amount: 0, split: 'custom', overrides: ov, pass_through: true, recurring: true, sort: 2 };
    return dbInsertMany('charges', [water, moteur]).then(function() {
      var col = collectors()[0], pays = [];
      [0, 1, 3, 6].forEach(function(i) { chargesOf(cyc.id).forEach(function(ch) { var c = cell(ch, us[i]); if (c.left > 0) pays.push({ charge_id: ch.id, unit_id: us[i].id, amount: c.left, cur: ch.cur, channel: i === 6 ? 'transfer' : 'collector', method: i === 6 ? 'Whish' : 'Cash', received_by: i === 6 ? 'u-manager' : col.user_id, received_at: nowIso() }); }); });
      return dbInsertMany('payments', pays);
    }).then(function() {
      return dbInsert('expenses', { title: 'Generator diesel 200L', cat: 'gen', amount: 110, cur: 'USD', paid_from: 'safe', paid_by: 'u-manager', spent_on: todayIso(), cycle_id: cyc.id, ref: 'FUEL-102' });
    }).then(function() { render(); });
  });
}

/* ---------------------------------------------------------------------------
   Accounts (cloud only). A username, or an email if they prefer.
   --------------------------------------------------------------------------- */
function renderAuth() {
  var a = UI.auth || { mode: 'in' };
  var up = a.mode === 'up';
  var h = '<div class="ob"><div class="ob-in"><div class="ob-top"><button class="iconbtn" onclick="authBack()">' + (LANG === 'ar' ? '›' : '‹') + '</button><span></span><button class="iconbtn" onclick="setLang()">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button></div>';
  h += '<div class="ob-stage" style="flex:0 1 200px">' + obScene(up ? 99 : 3, OB ? obUnits() : (a.invite ? 6 : 8), OB ? OB.name : (a.invite ? a.invite.building : 'Binayati'), up && !!OB) + '</div>';
  h += '<div class="ob-body">';
  if (a.invite) h += '<h1>' + esc(t('Join ' + a.invite.building, 'انضم إلى ' + (a.invite.building_ar || a.invite.building))) + '</h1><p class="sub">' + esc(t('You were invited as ' + roleLabel(a.invite.role).toLowerCase() + '.', 'دُعيت ك' + roleLabel(a.invite.role) + '.')) + '</p>';
  else h += '<h1>' + esc(up ? t('Create your account', 'أنشئ حسابك') : t('Welcome back', 'أهلاً بعودتك')) + '</h1>';
  if (up) h += '<label class="field"><span>' + esc(t('Your name', 'اسمك')) + '</span><input class="input" id="au-name" dir="ltr" data-tr="au-name-ar" data-tr-kind="name" value="' + esc(a.name || (a.invite && a.invite.display_name) || '') + '" autocomplete="name"><div class="tr-box" id="trs-au-name"></div></label>';
  if (up && a.invite) h += '<label class="field"><span>' + esc(t('Your name in Arabic', 'اسمك بالعربية')) + '</span><input class="input" id="au-name-ar" dir="rtl" data-tr="au-name" data-tr-kind="name" value="' + esc(a.nameAr || a.invite.display_name_ar || '') + '"><div class="tr-box" id="trs-au-name-ar"></div></label>';
  h += '<label class="field"><span>' + esc(t('Username or email', 'اسم المستخدم أو البريد')) + '</span><input class="input" id="au-user" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" dir="ltr" placeholder="' + esc(t('e.g. anas', 'مثلاً anas')) + '"' + (up ? '' : ' data-autofocus') + '></label>';
  if (up) h += '<div class="hint">' + esc(t('No email needed: pick any username, like anas or abuali.', 'لا حاجة لبريد: اختر أي اسم مستخدم مثل anas أو abuali.')) + '</div>';
  h += '<label class="field"><span>' + esc(t('Password', 'كلمة المرور')) + '</span><input class="input" id="au-pass" type="password" autocomplete="' + (up ? 'new-password' : 'current-password') + '" onkeydown="if(event.key===\'Enter\')authGo()"></label>';
  h += '<div id="ob-err" class="err"></div></div>';
  h += '<div class="ob-foot"><button class="btn pri block" id="au-go" onclick="authGo()">' + esc(up ? t('Create account', 'أنشئ الحساب') : t('Sign in', 'دخول')) + '</button>';
  h += '<button class="btn ghost block" onclick="UI.auth.mode=\'' + (up ? 'in' : 'up') + '\';render()">' + esc(up ? t('I already have an account', 'لدي حساب') : t('New here? Create an account', 'جديد؟ أنشئ حساباً')) + '</button></div>';
  return h + '</div></div>';
}
function authBack() {
  if (OB) { UI.screen = 'ob'; render(); return; }
  UI.screen = 'welcome'; render(); tickWelcome();
}
function authGo() {
  var a = UI.auth, up = a.mode === 'up';
  var user = val('au-user').trim(), pass = val('au-pass'), name = up ? val('au-name').trim() : '';
  var err = document.getElementById('ob-err');
  if (!user || !pass) { err.textContent = t('Enter a username and a password', 'أدخل اسم المستخدم وكلمة مرور'); return; }
  if (up && !name) { err.textContent = t('Enter your name', 'أدخل اسمك'); return; }
  var btn = document.getElementById('au-go'); btn.disabled = true;
  if (up) a.name = name;
  Promise.resolve().then(function() { return up ? cloudSignUp(user, pass, name) : cloudSignIn(user, pass); }).then(function() {
    var nameAr = up && document.getElementById('au-name-ar') ? val('au-name-ar').trim() : '';
    if (a.invite) return rpc('join_building', { p_code: a.invite.code, p_display_name: name || a.invite.display_name }).then(function(bid) {
      if (nameAr) return rpc('set_my_name', { p_building: bid, p_name: name || a.invite.display_name, p_name_ar: nameAr }).then(function() { return bid; }, function() { return bid; });
      return bid;
    }).then(function(bid) {
      history.replaceState(null, '', location.pathname);
      return openBuilding(bid).then(function() { UI.screen = 'app'; UI.tab = 'home'; HERO_REVEAL = true; render(); launchConfetti(); });
    });
    if (OB) return finishSetup(name || a.name || user.split('@')[0]);
    return afterSignIn();
  }).catch(function(e) {
    btn.disabled = false;
    if (e.confirm) { a.mode = 'in'; render(); var el = document.getElementById('ob-err'); if (el) { el.style.color = 'var(--ok)'; el.textContent = e.message; } var u = document.getElementById('au-user'); if (u) u.value = user; return; }
    err.textContent = e.message;
  });
}
/* Shared demo accounts: a manager (Rima) and a collector (Anas) on one sample building. */
var DEMO_PASS = 'binayati-demo';
function isDemo() { return !!(S.me && S.me.email && /^demo-(manager|collector)@binayati\.local$/.test(S.me.email)); }
function demoSignIn(who) {
  toast(t('Opening the demo…', 'جارٍ فتح التجربة…'));
  SB.auth.signOut().catch(function() {}).then(function() { return cloudSignIn('demo-' + who, DEMO_PASS); }).then(function() {
    try { localStorage.removeItem('bny15_last'); } catch (e) {}
    location.href = location.pathname;
  }, function(e) { toast(e.message); });
}
function demoReset() {
  rpc('demo_reset', {}).then(function() { try { localStorage.removeItem('bny15_last'); } catch (e) {} location.href = location.pathname; }, function(e) { toast(e.message); });
}
function signOut() {
  SB.auth.signOut().then(function() { try { localStorage.removeItem('bny15_last'); } catch (e) {} location.href = location.pathname; });
}

/* Invite link: ?join=CODE */
function renderJoin() {
  var j = UI.join || {};
  var h = '<div class="ob"><div class="ob-in"><div class="ob-top"><span></span><span></span><button class="iconbtn" onclick="setLang()">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button></div>';
  h += '<div class="ob-stage">' + obScene(4, 8, j.info ? j.info.building : '…', false) + '</div><div class="ob-body">';
  if (j.error) h += '<h1>' + esc(t('This invite doesn\'t work', 'هذه الدعوة لا تعمل')) + '</h1><p class="sub">' + esc(j.error) + '</p>';
  else if (!j.info) h += '<h1>…</h1>';
  else h += '<h1>' + esc(t('You\'re invited to ' + j.info.building, 'أنت مدعو إلى ' + (j.info.building_ar || j.info.building))) + '</h1><p class="sub">' + esc(j.info.role === 'collector' ? t('As the collector: tick who paid, keep track of the cash you hold, hand it over in one tap.', 'كجابٍ: علّم من سدّد، تابع النقد معك، وسلّمه بلمسة.') : t('As co-manager, with full access to the books.', 'كمدير مساعد مع وصول كامل للحسابات.')) + '</p>';
  h += '</div><div class="ob-foot">';
  if (j.info && j.info.valid) {
    h += '<button class="btn pri block" onclick="UI.screen=\'auth\';UI.auth={mode:\'up\',invite:Object.assign({code:UI.join.code},UI.join.info)};render()">' + esc(t('Create my account', 'أنشئ حسابي')) + '</button>';
    h += '<button class="btn ghost block" onclick="UI.screen=\'auth\';UI.auth={mode:\'in\',invite:Object.assign({code:UI.join.code},UI.join.info)};render()">' + esc(t('I already have an account', 'لدي حساب')) + '</button>';
  } else if (j.info || j.error) h += '<button class="btn sec block" onclick="location.href=location.pathname">' + esc(t('Open Binayati', 'افتح بنايتي')) + '</button>';
  return h + '</div></div></div>';
}

/* Building picker (cloud, several buildings) */
function renderPick() {
  var list = UI.buildings || [];
  var h = '<div class="ob"><div class="ob-in"><div class="ob-top"><span style="font-weight:800">' + esc(t('Your buildings', 'بناياتك')) + '</span><button class="iconbtn" onclick="setLang()">' + (LANG === 'ar' ? 'EN' : 'ع') + '</button></div>';
  h += '<div class="ob-body" style="flex:1;overflow:auto"><div class="card list">';
  list.forEach(function(b) { h += '<button class="li" onclick="openBuilding(' + jsArg(b.id) + ').then(function(){UI.screen=\'app\';UI.tab=\'home\';render();},fail)"><div class="ic">🏢</div><div class="grow"><b>' + esc(LANG === 'ar' ? (b.name_ar || b.name) : b.name) + '</b><small>' + esc(roleLabel(b.role)) + '</small></div><span class="chev">›</span></button>'; });
  h += '</div></div><div class="ob-foot"><button class="btn pri block" onclick="startSetup()">' + esc(t('Set up a new building', 'أعدّ بناية جديدة')) + '</button><button class="btn ghost block" onclick="signOut()">' + esc(t('Sign out', 'خروج')) + '</button></div></div></div>';
  return h;
}
function showPicker() { cloudMyBuildings().then(function(bs) { UI.buildings = bs; UI.screen = 'pick'; render(); }, fail); }

/* ---------------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------------- */
function openBuilding(bid) {
  try { localStorage.setItem('bny15_last', bid); } catch (e) {}
  setTimeout(function() { myBuildingList().then(function(l) { var m = l.length > 1; if (m !== !!UI.multi) { UI.multi = m; if (UI.screen === 'app') render(); } }, function() {}); }, 0);
  UI.cycleId = null;
  if (isCloud()) return cloudLoadBuilding(bid);
  var db = localLoad(); db.current = bid; localSave();
  localLoadBuilding(bid);
  return Promise.resolve();
}
function openLocalBuilding(bid) { var db = localLoad(); db.persona = 'u-manager'; localSave(); openBuilding(bid).then(function() { UI.screen = 'app'; UI.tab = 'home'; render(); }); }
function afterSignIn() {
  return cloudMyBuildings().then(function(bs) {
    if (!bs.length) { UI.screen = 'welcome'; render(); tickWelcome(); return; }
    UI.multi = bs.length > 1;
    if (bs.length > 1) { showOverview(); return; }
    var last = null; try { last = localStorage.getItem('bny15_last'); } catch (e) {}
    var pick = bs.filter(function(b) { return b.id === last; })[0] || (bs.length === 1 ? bs[0] : null);
    if (!pick) { UI.buildings = bs; UI.screen = 'pick'; render(); return; }
    return openBuilding(pick.id).then(function() { UI.screen = 'app'; render(); });
  });
}
function boot() {
  var q = new URLSearchParams(location.search);
  var r = q.get('r'), join = q.get('join');
  render();
  initCloud().catch(function(e) { console.warn(e); SB = null; toast(t('Couldn\'t reach the server. Working on this phone.', 'تعذّر الوصول للخادم. العمل على هذا الهاتف.')); })
    .then(function() {
      if (r) return loadResident(r);
      if (isCloud()) {
        if (join) {
          UI.screen = 'join'; UI.join = { code: join }; render();
          return rpc('peek_invite', { p_code: join }).then(function(info) {
            if (!info) UI.join.error = t('The code is wrong.', 'الرمز خاطئ.');
            else if (!info.valid) UI.join.error = t('It was already used or has expired. Ask for a new one.', 'استُعملت أو انتهت. اطلب دعوة جديدة.');
            UI.join.info = info; render();
          }, function(e) { UI.join.error = e.message; render(); });
        }
        return cloudSession().then(function(sess) {
          if (!sess) { UI.screen = 'welcome'; render(); tickWelcome(); return; }
          return afterSignIn();
        });
      }
      var db = localLoad();
      if (!db.buildings.length) { UI.screen = 'welcome'; render(); tickWelcome(); return; }
      var mine = db.buildings.filter(function(b) { return db.members.some(function(m) { return m.building_id === b.id && m.user_id === (db.persona || 'u-manager'); }); });
      UI.multi = mine.length > 1;
      openBuilding(byId(db.buildings, db.current) ? db.current : db.buildings[0].id);
      UI.screen = 'app'; render();
    })
    .catch(function(e) { UI.screen = 'error'; UI.fatal = e.message; render(); });
}
