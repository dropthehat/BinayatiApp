/* ============================================================================
   Building tab: apartments, charges, months & projects, team, tasks, settings
   ============================================================================ */
function renderBuilding() {
  var sec = UI.bsec;
  var h = renderTopbar(t('Building', 'البناية'));
  if (sec) h += '<div class="sec" style="margin-top:0"><button class="btn ghost sm" onclick="UI.bsec=null;render()">‹ ' + esc(t('Building', 'البناية')) + '</button></div>';
  if (sec === 'units') return h + renderUnitsSec();
  if (sec === 'charges') return h + renderChargesSec();
  if (sec === 'cycles') return h + renderCyclesSec();
  if (sec === 'team') return h + renderTeamSec();
  if (sec === 'tasks') return h + renderTasksSec();
  if (sec === 'settings') return h + renderSettingsSec();
  if (sec === 'compound') return h + renderCompoundSec();
  var cyc = currentCycle();
  var items = [
    ['units', '🏠', t('Apartments', 'الشقق'), t(activeUnits().length + ' apartments · names, phones, shares', activeUnits().length + ' شقق · أسماء، هواتف، حصص')],
    ['charges', '🧾', t('What each apartment pays', 'ما تدفعه كل شقة'), cyc ? cycleTitle(cyc) + ' · ' + chargesOf(cyc.id).length + t(' charges', ' رسوم') : t('No month open', 'لا شهر مفتوح')],
    ['cycles', '📅', t('Months & projects', 'الأشهر والمشاريع'), S.cycles.length + t(' in total', ' بالمجموع')],
    ['team', '👥', t('Team', 'الفريق'), S.members.map(function(m) { return m.display_name || roleLabel(m.role); }).join(', ')],
    ['compound', '🏘', t('Compound', 'المجمّع'), S.building.compound_id ? t('Shared with other buildings · split shared bills', 'مشترك مع بنايات أخرى · قسّم الفواتير المشتركة') : t('Group with neighbouring buildings', 'اجمعها مع بنايات مجاورة')],
    ['tasks', '✅', t('Tasks & reminders', 'المهام والتذكيرات'), openTasks().length + t(' open', ' مفتوحة')],
    ['settings', '⚙️', t('Settings', 'الإعدادات'), t('Rate, opening balance, what residents see', 'سعر الصرف، الرصيد الافتتاحي، ما يراه السكان')]
  ];
  h += '<div class="sec"><div class="card list">';
  items.forEach(function(x) { h += '<button class="li" onclick="UI.bsec=\'' + x[0] + '\';render();window.scrollTo(0,0)"><div class="ic">' + x[1] + '</div><div class="grow"><b>' + esc(x[2]) + '</b><small>' + esc(x[3]) + '</small></div><span class="chev">›</span></button>'; });
  h += '</div></div>';
  return h;
}

/* ---------------- Apartments ---------------- */
function renderUnitsSec() {
  var h = '<div class="sec"><button class="card li" style="border-radius:18px" onclick="openSheet(\'layout\',{})"><div class="ic">🏢</div><div class="grow"><b>' + esc(t('Floors, apartments & blocks', 'الطوابق والشقق والبلوكات')) + '</b><small>' + esc(blocks().length > 1 ? blocks().map(function(b) { return b + ': ' + layoutSummary(currentLayout(b)); }).join(' · ') : layoutSummary(currentLayout())) + '</small></div><span class="chev">›</span></button></div>';
  var bl = blocks();
  var groups = bl.length > 1 ? bl.map(function(b) { return { b: b, us: S.units.filter(function(u) { return blockOf(u) === b; }) }; }).concat([{ b: '', us: S.units.filter(function(u) { return !blockOf(u) || bl.indexOf(blockOf(u)) < 0; }) }])
                             : [{ b: '', us: S.units }];
  h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Apartments', 'الشقق')) + '</h2><button onclick="openSheet(\'unitEdit\',{})">＋ ' + esc(t('Add', 'إضافة')) + '</button></div>';
  groups.forEach(function(g, gi) {
    if (!g.us.length) return;
    if (bl.length > 1) h += '<div class="daylbl">' + esc(g.b ? blockLabel(g.b) : t('No block', 'بلا بلوك')) + '</div>';
    h += '<div class="card list">';
    g.us.slice().sort(function(a, b) { return (a.sort || 0) - (b.sort || 0) || String(a.code).localeCompare(String(b.code), 'en', { numeric: true }); }).forEach(function(u) {
      h += '<button class="li" onclick="openSheet(\'unitEdit\',{id:' + jsArg(u.id) + '})"><div class="ic">' + esc(u.code) + '</div><div class="grow"><b>' + esc(unitName(u) || '—') + '</b><small>' + esc([u.phone ? '\u2066' + u.phone + '\u2069' : t('no phone', 'بلا هاتف'), num(u.weight) !== 1 ? t('share ×', 'حصة ×') + num(u.weight) : '', u.active === false ? t('inactive', 'غير فعّالة') : ''].filter(Boolean).join(' · ')) + '</small></div><span class="chev">›</span></button>';
    });
    h += '</div>';
  });
  h += '<div>';
  h += '</div><p class="hint">' + esc(t('Share is how much of a split bill an apartment carries: 1 is a normal apartment, 1.5 a bigger one, 0.5 a small shop.', 'الحصة هي نسبة الشقة من الفاتورة المقسّمة: 1 شقة عادية، 1.5 أكبر، 0.5 محل صغير.')) + '</p></div>';
  return h;
}
SHEETS.unitEdit = function(d) {
  var u = d.id ? byId(S.units, d.id) : null;
  var v = u || { code: '', name: '', name_ar: '', phone: '', lang: 'both', weight: 1, active: true };
  var h = '<h3>' + esc(u ? t('Apartment ', 'الشقة ') + u.code : t('New apartment', 'شقة جديدة')) + '</h3>';
  h += '<div class="two"><label class="field"><span>' + esc(t('Code', 'الرمز')) + '</span><input class="input" id="u-code" value="' + esc(v.code) + '" placeholder="2B"' + (u ? '' : ' data-autofocus') + '></label>';
  h += '<label class="field"><span>' + esc(t('Share', 'الحصة')) + '</span><input class="input" id="u-w" inputmode="decimal" value="' + esc(v.weight == null ? 1 : v.weight) + '"></label></div>';
  var blist = blocks();
  h += '<label class="field"><span>' + esc(t('Block (only for compounds with several blocks)', 'البلوك (للمجمّعات فقط)')) + '</span><input class="input" id="u-block" list="u-blocks" value="' + esc(v.block || (d.block || '')) + '" placeholder="' + esc(t('e.g. A', 'مثلاً A')) + '"><datalist id="u-blocks">' + blist.map(function(b) { return '<option value="' + esc(b) + '">'; }).join('') + '</datalist></label>';
  h += '<label class="field"><span>' + esc(t('Resident name', 'اسم الساكن')) + '</span><input class="input" id="u-name" data-tr="u-name-ar" data-tr-kind="name" value="' + esc(v.name) + '"><div class="tr-box" id="trs-u-name"></div></label>';
  h += '<label class="field"><span>' + esc(t('Name in Arabic (optional)', 'الاسم بالعربية (اختياري)')) + '</span><input class="input" id="u-name-ar" data-tr="u-name" data-tr-kind="name" dir="rtl" value="' + esc(v.name_ar || '') + '"><div class="tr-box" id="trs-u-name-ar"></div></label>';
  h += '<label class="field"><span>' + esc(t('WhatsApp number', 'رقم واتساب')) + '</span><input class="input" id="u-ph" inputmode="tel" value="' + esc(v.phone || '') + '" placeholder="03 123 456"></label>';
  h += '<label class="field"><span>' + esc(t('Messages in', 'الرسائل بـ')) + '</span><select class="input" id="u-lang"><option value="both"' + (v.lang === 'both' ? ' selected' : '') + '>' + esc(t('Arabic + English', 'عربي + إنكليزي')) + '</option><option value="ar"' + (v.lang === 'ar' ? ' selected' : '') + '>العربية</option><option value="en"' + (v.lang === 'en' ? ' selected' : '') + '>English</option></select></label>';
  h += '<div class="switch-row"><div><b>' + esc(t('Active', 'فعّالة')) + '</b><small>' + esc(t('Inactive apartments are not charged', 'الشقق غير الفعّالة لا تُحتسب')) + '</small></div><button class="sw' + (v.active !== false ? ' on' : '') + '" id="u-act" onclick="this.classList.toggle(\'on\')" aria-label="active"></button></div>';
  h += '<div id="sheet-err" class="err"></div><div class="foot">';
  if (u) h += '<button class="btn danger" onclick="deleteUnit(' + jsArg(u.id) + ')">' + esc(t('Remove', 'حذف')) + '</button>';
  h += '<button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveUnit(' + jsArg(u ? u.id : '') + ')">' + esc(t('Save', 'حفظ')) + '</button></div>';
  return h;
};
function saveUnit(id) {
  var row = { code: val('u-code').trim().toUpperCase(), name: val('u-name').trim(), name_ar: val('u-name-ar').trim() || null, phone: val('u-ph').trim() || null,
              lang: val('u-lang'), weight: num(val('u-w') || 1), active: document.getElementById('u-act').classList.contains('on'),
              block: val('u-block').trim().toUpperCase() || null };
  if (!row.code) return sheetErr(t('Give it a code like 2B', 'أعطها رمزاً مثل 2B'));
  if (S.units.some(function(x) { return x.code === row.code && blockOf(x) === (row.block || '') && x.id !== id; })) return sheetErr(t('That code is already used', 'هذا الرمز مستعمل'));
  if (!id) { row.resident_token = token(); row.sort = S.units.length; }
  (id ? dbUpdate('units', id, row) : dbInsert('units', row)).then(function() { closeSheet(); toast(t('Saved', 'تم الحفظ')); }, function(e) { sheetErr(e.message); });
}
function deleteUnit(id) {
  var has = S.payments.some(function(p) { return p.unit_id === id && !p.voided_at; });
  if (has) { dbUpdate('units', id, { active: false }).then(function() { closeSheet(); toast(t('It has payments, so it was set inactive instead', 'لها دفعات، فجُعلت غير فعّالة')); }, fail); return; }
  if (!confirm(t('Remove this apartment?', 'حذف هذه الشقة؟'))) return;
  dbDelete('units', id).then(function() { closeSheet(); }, fail);
}

/* Apartment detail: balance, history, WhatsApp, private link */
SHEETS.unit = function(d) {
  var u = byId(S.units, d.id);
  if (!u) return '';
  var cyc = currentCycle(), r = unitCycle(u, cyc), b = unitBalance(u, cyc);
  var h = '<div class="row"><div class="ucode">' + esc(u.code) + '</div><div class="grow"><h3 style="margin:0">' + esc(unitName(u) || t('Apartment ', 'شقة ') + u.code) + '</h3><div class="muted" style="font-size:13px"><bdi dir="ltr">' + esc(u.phone || '') + '</bdi></div></div></div>';
  h += '<div class="card pad" style="margin-top:12px"><div style="font-size:12.5px;font-weight:800;color:var(--mut)">' + esc(cycleTitle(cyc)) + '</div>';
  r.cells.forEach(function(x) { h += '<div class="kv"><span>' + esc(L(x.ch)) + '</span><b>' + (x.c.state === 'paid' ? '<span style="color:var(--ok)">✓ </span>' : '') + esc(fmt(x.c.due, x.ch.cur)) + '</b></div>'; });
  if (!r.cells.length) h += '<div class="muted">' + esc(t('Nothing due this month', 'لا مستحقات هذا الشهر')) + '</div>';
  h += '<div class="bill-total"><span>' + esc(t('Owes in total', 'المستحق الكلي')) + '</span><span>' + esc(pairUsd(b.owed) > 0.005 ? fmtPair(b.owed) : t('Nothing ✓', 'لا شيء ✓')) + '</span></div>';
  if (pairUsd(b.arrears) > 0.005) h += '<div class="hint" style="color:var(--bad)">' + esc(t('Including earlier months: ', 'منها أشهر سابقة: ') + fmtPair(b.arrears)) + '</div>';
  h += '</div>';
  h += '<div class="row" style="margin-top:12px;flex-wrap:wrap">';
  if (pairUsd(b.owed) > 0.005) h += '<button class="btn pri sm grow" onclick="openSheet(\'pay\',{unit:' + jsArg(u.id) + '})">' + esc(t('Record a payment', 'سجّل دفعة')) + '</button>';
  if (cyc) h += '<button class="btn wa sm grow" onclick="openSheet(\'remind\',{u:' + jsArg(u.id) + ',cyc:' + jsArg(cyc.id) + '})">WhatsApp</button>';
  h += '</div>';
  if (u.resident_token && isManager()) {
    h += '<div class="field"><span>' + esc(t('Their private page (bill, receipts, building books)', 'صفحتهم الخاصة (الفاتورة، الإيصالات، الحسابات)')) + '</span><div class="linkbox"><span class="grow">' + esc(residentLink(u)) + '</span><button class="btn sm sec" onclick="copyText(' + jsArg(residentLink(u)) + ')">' + esc(t('Copy', 'نسخ')) + '</button></div>';
    h += '<div class="hint">' + esc(isCloud() ? t('Anyone with this link sees this apartment\'s bill. Reset it from Edit if it leaks.', 'من لديه الرابط يرى فاتورة هذه الشقة.') : t('Works on this phone only until the server is connected.', 'يعمل على هذا الهاتف فقط حتى ربط الخادم.')) + '</div></div>';
  }
  var pays = S.payments.filter(function(p) { return p.unit_id === u.id && !p.voided_at; }).sort(function(a, b2) { return String(b2.received_at).localeCompare(String(a.received_at)); }).slice(0, 12);
  if (pays.length) {
    h += '<div class="daylbl">' + esc(t('Payments', 'الدفعات')) + '</div><div class="card list">';
    pays.forEach(function(p) {
      var ch = byId(S.charges, p.charge_id), c = ch && byId(S.cycles, ch.cycle_id);
      h += '<div class="li"><div class="ic in">✓</div><div class="grow"><b>' + esc((ch ? L(ch) : '') + (c ? ' · ' + cycleTitle(c) : '')) + '</b><small>' + esc(dateLabel(p.received_at, true) + ' · ' + (p.channel === 'transfer' ? p.method : memberName(p.received_by))) + '</small></div><span class="amt in">' + esc(fmt(p.amount, p.cur)) + '</span></div>';
    });
    h += '</div>';
  }
  h += '<div class="foot">' + (isManager() ? '<button class="btn sec" onclick="openSheet(\'unitEdit\',{id:' + jsArg(u.id) + '})">' + esc(t('Edit', 'تعديل')) + '</button>' : '') + '<button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
  return h;
};
function copyText(s) {
  function done() { toast(t('Copied', 'تم النسخ')); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(done, function() { prompt('', s); });
  else prompt('', s);
}

/* ---------------- Charges ---------------- */
var KIND_INFO = {
  fixed: ['Monthly fee', 'رسم شهري', 'Same every month: maintenance, cleaning, the collector\'s pay', 'كل شهر: صيانة، تنظيف، أجر الجابي'],
  due: ['Bill to split', 'فاتورة للتقسيم', 'One-off: water bill, tanker fill, a repair', 'لمرة واحدة: فاتورة مياه، صهريج، تصليح'],
  service: ['Supplier service', 'خدمة مورّد', 'Collected for someone else: moteur, internet, dish', 'تُجمع لطرف آخر: موتور، إنترنت، دش']
};
/* A lira charge is shown in LBP and in dollars. Its own fx wins; otherwise the building rate.
   A missing rate is left blank so the screen can ask the manager to set one — the 89,500 fallback is not used here. */
function statedRate() { var r = num(setting('rate')); return r > 0 ? r : 0; }
function isLiraPriced(ch) { return !!(ch && (ch.cur === 'LBP' || ch.orig_cur === 'LBP')); }
function chargeRateInfo(ch) {
  var own = ch && num(ch.fx) > 0 ? num(ch.fx) : 0, bld = statedRate();
  if (own) return { rate: own, src: 'charge', building: bld };
  if (bld) return { rate: bld, src: 'building', building: bld };
  return { rate: 0, src: 'missing', building: 0 };
}
function usdOfLbp(lbp, ch) { var r = chargeRateInfo(ch).rate; return r > 0 ? Math.round(num(lbp) / r * 100) / 100 : null; }
function lbpOfUsd(usd, ch) { var r = chargeRateInfo(ch).rate; return r > 0 ? Math.round(num(usd) * r) : null; }
function rateDiffers(info) { return !!(info && info.rate && (!info.building || Math.round(info.rate) !== Math.round(info.building))); }
function fmtDual(amt, ch) {
  if (!ch) return fmt(amt, 'USD');
  if (ch.cur === 'LBP') { var usd = usdOfLbp(amt, ch); return usd == null ? fmt(amt, 'LBP') : fmt(amt, 'LBP') + ' ≈ ' + fmt(usd, 'USD'); }
  if (ch.orig_cur === 'LBP') { var lbp = lbpOfUsd(amt, ch); return lbp == null ? fmt(amt, 'USD') : fmt(amt, 'USD') + ' ≈ ' + fmt(lbp, 'LBP'); }
  return fmt(amt, ch.cur || 'USD');
}
function fmtDualRange(min, max, ch) {
  var cur = ch.cur || 'USD', native = fmt(min, cur) + '–' + fmt(max, cur);
  if (cur === 'LBP') { var a = usdOfLbp(min, ch), b = usdOfLbp(max, ch); return a == null ? native : native + ' ≈ ' + fmt(a, 'USD') + '–' + fmt(b, 'USD'); }
  if (ch.orig_cur === 'LBP') { var c = lbpOfUsd(min, ch), d = lbpOfUsd(max, ch); return c == null ? native : native + ' ≈ ' + fmt(c, 'LBP') + '–' + fmt(d, 'LBP'); }
  return native;
}
function explicitOverride(ch, u) { var ov = (ch && ch.overrides) || {}; return ov[u.id] != null && ov[u.id] !== ''; }
/* A typed amount that is not what the share or meter formula would charge. Subscriber prices are entered per apartment, so they are not all marked changed. */
function amountChanged(ch, u) {
  if (!explicitOverride(ch, u)) return false;
  if (ch.meter) {
    var k = ch.meter.kwh ? ch.meter.kwh[u.id] : null;
    if (k == null || k === '') return num(ch.overrides[u.id]) > 0;
    var calc = meterAmount(ch.meter, k, ch.cur);
    return calc == null || !tiny(num(ch.overrides[u.id]) - calc, ch.cur);
  }
  if (ch.pass_through || ch.split === 'custom') return false;
  return !tiny(dueFor(ch, u) - dueFor(Object.assign({}, ch, { overrides: {} }), u), ch.cur);
}
function chargeAudience(ch) {
  var cyc = byId(S.cycles, ch.cycle_id);
  return activeUnits().filter(function(u) { return unitInCycle(u, cyc) && inBlock(u, ch); });
}
function chargeSpread(ch) {
  var selective = !!(ch.meter || ch.pass_through || ch.split === 'custom');
  var people = [], priced = [];
  chargeAudience(ch).forEach(function(u) {
    var due = dueFor(ch, u), changed = amountChanged(ch, u);
    var off = selective && !(due > 0) && !changed;
    people.push({ u: u, due: due, changed: changed, off: off });
    if (!off) priced.push(due);
  });
  var min = priced.length ? priced.reduce(function(a, b) { return a < b ? a : b; }) : null;
  var max = priced.length ? priced.reduce(function(a, b) { return a > b ? a : b; }) : null;
  return { people: people, min: min, max: max, same: min == null || tiny(max - min, ch.cur || 'USD'), total: chargeTotal(ch), empty: min == null };
}
function eachApartmentText(ch, spread) {
  if (spread.empty) return '—';
  return spread.same ? fmtDual(spread.min, ch) : fmtDualRange(spread.min, spread.max, ch);
}
function rateCaption(ch) {
  if (!isLiraPriced(ch)) return '';
  var info = chargeRateInfo(ch);
  if (!info.rate) return t('Set a dollar rate to see this in dollars', 'حدّد سعر الدولار لترى هذا بالدولار');
  if (!rateDiffers(info)) return '';
  return t('This charge\'s rate: ', 'سعر هذا الرسم: ') + Math.round(info.rate).toLocaleString('en-US') + t(' LBP per $1', ' ل.ل لكل دولار');
}
/* "1.5M LBP ≈ $16.76": the amount on one line, its equivalent small underneath */
function dualHtml(txt) { var i = txt.indexOf(' ≈ '); return i < 0 ? '<span class="main">' + esc(txt) + '</span>' : '<span class="main">' + esc(txt.slice(0, i)) + '</span><small class="eq">≈ ' + esc(txt.slice(i + 3)) + '</small>'; }
function emptyBag() { return { usd: 0, lbp: 0, derivedLbp: 0, dollars: 0, missing: false }; }
function addLine(bag, ch, amt) {
  amt = num(amt);
  if (!(amt > 0)) return bag;
  if (ch.cur === 'LBP') {
    bag.lbp += amt;
    var usd = usdOfLbp(amt, ch);
    if (usd == null) bag.missing = true; else bag.dollars += usd;
  } else {
    bag.usd += amt; bag.dollars += amt;
    if (ch.orig_cur === 'LBP') {
      var lbp = lbpOfUsd(amt, ch);
      if (lbp == null) bag.missing = true; else bag.derivedLbp += lbp;
    }
  }
  return bag;
}
function bagText(bag) {
  var hasUsd = !tiny(bag.usd, 'USD'), hasLbp = !tiny(bag.lbp, 'LBP'), hasDer = !tiny(bag.derivedLbp || 0, 'LBP');
  if (!hasUsd && !hasLbp && !hasDer) return fmt(0, 'USD');
  var bits = [];
  if (hasUsd) bits.push(fmt(round(bag.usd, 'USD'), 'USD'));
  if (hasLbp) bits.push(fmt(round(bag.lbp, 'LBP'), 'LBP'));
  var native = bits.join(' + ') || fmt(0, 'USD');
  if (hasLbp && !bag.missing) native += ' ≈ ' + fmt(round(bag.dollars, 'USD'), 'USD');
  if (hasDer && !bag.missing) native += ' ≈ ' + fmt(round(bag.derivedLbp, 'LBP'), 'LBP');
  return native;
}
function earlierOpen(u, cyc) {
  var curKey = cyc ? cycleOrderKey(cyc) : '9999', out = [];
  S.cycles.forEach(function(c) {
    if (c.published === false) return;
    if (!(cyc && c.id !== cyc.id && cycleOrderKey(c) < curKey && c.kind === 'month')) return;
    chargesOf(c.id).forEach(function(ch) {
      var x = cell(ch, u);
      if (x.left > 0) out.push({ ch: ch, left: x.left, cycle: c });
    });
  });
  return out;
}
function toggleChg(id) { var y = window.scrollY; UI.chgOpen = UI.chgOpen || {}; UI.chgOpen[id] = !UI.chgOpen[id]; render(); window.scrollTo(0, y); }
function toggleApt(id) { var y = window.scrollY; UI.aptOpen = UI.aptOpen || {}; UI.aptOpen[id] = !UI.aptOpen[id]; render(); window.scrollTo(0, y); }
function openRateSetting() {
  UI.tab = 'building'; UI.bsec = 'settings'; UI.sheet = null; render();
  setTimeout(function() { var el = document.getElementById('s-rate'); if (el) { try { el.focus(); el.scrollIntoView({ block: 'center' }); } catch (e) {} } }, 60);
}
function chargeHow(ch) {
  var how = ch.meter ? fmt(ch.meter.rate, ch.cur) + ' / kWh' + (Object.keys(ch.meter.kwh || {}).length ? '' : ' · ' + t('readings missing', 'القراءات ناقصة')) : ch.pass_through ? t('per subscriber', 'لكل مشترك') : ch.split === 'total' ? t('total split by share', 'المجموع مقسّم بالحصص') : ch.split === 'weight' ? t('each × share', 'لكل شقة × الحصة') : t('each apartment', 'لكل شقة');
  if (!ch.meter && Object.keys(ch.overrides || {}).length && !(ch.pass_through || ch.split === 'custom')) how += ' · ' + t('some amounts changed', 'بعض المبالغ معدّلة');
  var np = livePayments().filter(function(p) { return p.charge_id === ch.id; }).length;
  if (np) how += ' · ' + (np === 1 ? t('1 payment', 'دفعة واحدة') : t(np + ' payments', np + ' دفعات'));
  return how;
}
function renderChargeBlocks(chs) {
  var h = '<div class="card list">', closed = LANG === 'ar' ? '◂' : '▸';
  chs.forEach(function(ch) {
    var spread = chargeSpread(ch), open = !!(UI.chgOpen && UI.chgOpen[ch.id]);
    var cap = rateCaption(ch);
    h += '<div class="chg-block"><div class="li chg"><button class="rowbtn" onclick="toggleChg(' + jsArg(ch.id) + ')"><div class="ic">' + (ch.kind === 'service' ? '↗' : ch.kind === 'due' ? '÷' : '↻') + '</div><div class="grow">';
    h += '<b class="chg-name">' + esc(L(ch)) + (ch.recurring ? '' : ' · ' + esc(t('one-off', 'لمرة واحدة'))) + '</b>';
    h += '<small>' + esc((LANG === 'ar' ? KIND_INFO[ch.kind][1] : KIND_INFO[ch.kind][0]) + ' · ' + chargeHow(ch) + (ch.block ? ' · ' + blockLabel(ch.block) : '')) + '</small>';
    h += '<div class="chg-figs"><div class="line"><span class="k">' + esc(t('Each apartment', 'لكل شقة')) + '</span><span class="v">' + dualHtml(eachApartmentText(ch, spread)) + '</span></div>';
    h += '<div class="line"><span class="k">' + esc(t('Building total', 'مجموع البناية')) + '</span><span class="v">' + dualHtml(fmtDual(spread.total, ch)) + '</span></div></div>';
    if (cap) h += '<small class="chg-rate">' + esc(cap) + '</small>';
    h += '</div><span class="chev">' + (open ? '▾' : closed) + '</span></button>';
    if (isManager()) h += '<button class="btn sm danger" onclick="deleteCharge(' + jsArg(ch.id) + ')">' + esc(t('Remove', 'حذف')) + '</button>';
    h += '</div>';
    if (open) {
      h += '<div class="chg-people">';
      spread.people.forEach(function(p) {
        var paid = paidFor(ch, p.u);
        h += '<div class="who' + (p.changed ? ' ov' : '') + '"><span>' + esc(p.u.code + (unitName(p.u) ? ' · ' + unitName(p.u) : '')) + (p.changed ? ' <span class="pill-ov">' + esc(t('changed', 'معدّل')) + '</span>' : '');
        if (paid > 0) h += '<small class="muted" style="display:block">' + esc(t('paid ', 'مدفوع ') + fmtDual(paid, ch)) + '</small>';
        h += '</span><b>' + esc(p.off ? t('Not charged', 'غير مُطالب') : fmtDual(p.due, ch)) + '</b></div>';
      });
      if (!spread.people.length) h += '<div class="muted">' + esc(t('No apartments in this charge', 'لا شقق في هذا الرسم')) + '</div>';
      if (isManager()) h += '<button class="btn sm sec" style="margin-top:8px" onclick="openSheet(\'charge\',{id:' + jsArg(ch.id) + '})">' + esc(t('Edit amounts', 'عدّل المبالغ')) + '</button>';
      h += '</div>';
    }
    h += '</div>';
  });
  return h + '</div>';
}
function renderReviewTotals(cyc, chs) {
  var bld = emptyBag(), sup = emptyBag(), own = false, usedBuilding = false, missing = false;
  chs.forEach(function(ch) {
    if (isLiraPriced(ch)) {
      var info = chargeRateInfo(ch);
      if (!info.rate) missing = true;
      else if (rateDiffers(info)) own = true;
      else usedBuilding = true;
    }
    activeUnits().forEach(function(u) {
      var d = dueFor(ch, u);
      if (d > 0) addLine(ch.pass_through ? sup : bld, ch, d);
    });
  });
  var h = '<div class="card pad tot-card" style="margin-top:12px">';
  h += '<div class="kv"><span>' + esc(t('Building total', 'مجموع البناية')) + '</span><b class="dual">' + dualHtml(bagText(bld)) + '</b></div>';
  var supAny = !tiny(sup.usd, 'USD') || !tiny(sup.lbp, 'LBP');
  if (supAny) {
    var all = { usd: bld.usd + sup.usd, lbp: bld.lbp + sup.lbp, derivedLbp: (bld.derivedLbp || 0) + (sup.derivedLbp || 0), dollars: bld.dollars + sup.dollars, missing: bld.missing || sup.missing };
    h += '<div class="kv"><span>' + esc(t('Collected for suppliers', 'يُجمع للموردين')) + '</span><b>' + esc(bagText(sup)) + '</b></div>';
    h += '<div class="kv"><span>' + esc(t('All charges together', 'كل الرسوم معاً')) + '</span><b>' + esc(bagText(all)) + '</b></div>';
  }
  h += '</div>';
  if (missing) h += '<div class="banner warn" style="margin-top:10px"><div class="grow"><b>' + esc(t('Set a dollar rate', 'حدّد سعر الدولار')) + '</b>' + esc(t('A charge is in lira and has no exchange rate, so its dollar value is not shown.', 'رسم بالليرة بلا سعر صرف، لذا لا يظهر مبلغه بالدولار.')) + '</div><button class="btn sm pri" onclick="openRateSetting()">' + esc(t('Set rate', 'حدّد السعر')) + '</button></div>';
  else if (usedBuilding && statedRate()) {
    var note = t('Lira amounts in dollars use the building rate, ', 'مبالغ الليرة بالدولار بسعر البناية، ') + Math.round(statedRate()).toLocaleString('en-US') + t(' LBP per $1.', ' ل.ل لكل دولار.');
    if (own) note += ' ' + t('A charge with its own rate shows that rate on its row.', 'الرسم الذي له سعره يظهر سعره في صفه.');
    h += '<p class="hint">' + esc(note) + '</p>';
  } else if (own) h += '<p class="hint">' + esc(t('Each lira charge shows the rate used for its dollar amount.', 'كل رسم بالليرة يظهر السعر المستعمل لمبلغه بالدولار.')) + '</p>';
  return h;
}
function renderAptMonth(cyc) {
  var units = activeUnits().filter(function(u) { return unitInCycle(u, cyc); });
  var closed = LANG === 'ar' ? '◂' : '▸';
  var h = '<div class="sec-h" style="margin-top:18px"><h2>' + esc(t('By apartment', 'حسب الشقة')) + '</h2></div>';
  h += '<p class="hint">' + esc(t('What each apartment owes this month, across every charge. Earlier months are what is still unpaid.', 'ما تستحقه كل شقة هذا الشهر من كل الرسوم. الأشهر السابقة هي ما لم يُدفع بعد.')) + '</p><div class="card">';
  units.forEach(function(u) {
    var nowBag = emptyBag(), arrBag = emptyBag(), nowLines = [], arrLines = earlierOpen(u, cyc), open = !!(UI.aptOpen && UI.aptOpen[u.id]);
    chargesOf(cyc.id).forEach(function(ch) {
      if (!inBlock(u, ch)) return;
      var due = dueFor(ch, u);
      if (!(due > 0)) return;
      addLine(nowBag, ch, due);
      nowLines.push({ ch: ch, amt: due });
    });
    arrLines.forEach(function(x) { addLine(arrBag, x.ch, x.left); });
    var arrAny = !tiny(arrBag.usd, 'USD') || !tiny(arrBag.lbp, 'LBP');
    h += '<div class="apt-bill"><button class="rowbtn" onclick="toggleApt(' + jsArg(u.id) + ')"><div class="ucode" style="width:40px;height:40px;min-width:40px">' + esc(u.code) + '</div><div class="grow">';
    h += '<b>' + esc(unitName(u) || t('Apartment ', 'شقة ') + u.code) + '</b>';
    h += '<small>' + esc(t('This month', 'هذا الشهر') + ' · ' + bagText(nowBag)) + '</small>';
    if (arrAny) h += '<small style="color:var(--bad)">' + esc(t('Earlier months', 'أشهر سابقة') + ' · ' + bagText(arrBag)) + '</small>';
    h += '</div><span class="chev">' + (open ? '▾' : closed) + '</span></button>';
    if (open) {
      h += '<div class="apt-lines">';
      if (!nowLines.length) h += '<div class="muted" style="font-size:13px;padding:6px 0">' + esc(t('Nothing this month', 'لا شيء هذا الشهر')) + '</div>';
      nowLines.forEach(function(x) {
        h += '<div class="who"><span>' + esc(L(x.ch) + (x.ch.pass_through ? ' · ' + t('supplier', 'مورّد') : '')) + '</span><b>' + esc(fmtDual(x.amt, x.ch)) + '</b></div>';
      });
      arrLines.forEach(function(x) {
        h += '<div class="who"><span>' + esc(t('Earlier', 'سابق') + ' · ' + cycleTitle(x.cycle) + ' · ' + L(x.ch)) + '</span><b>' + esc(fmtDual(x.left, x.ch)) + '</b></div>';
      });
      h += '</div>';
    }
    h += '</div>';
  });
  return h + '</div>';
}
function renderChargesSec() {
  var cyc = currentCycle();
  var h = cycleChips(cyc, 'pickCycle');
  if (!cyc) return h;
  h += '<div class="sec">';
  if (isManager() && cyc.published === false) {
    h += '<div class="banner info"><div class="grow"><b>' + esc(t('Draft — residents can\'t see it yet', 'مسودة — السكان لا يرونها بعد')) + '</b>' + esc(t('Change a unit\'s amount, add a one-off, or remove a charge that does not apply. Then show it.', 'غيّر مبلغ شقة، أو أضف رسماً لمرة واحدة، أو احذف رسماً لا ينطبق. ثم أظهرها.')) + '</div></div>';
    h += '<div class="row" style="margin-top:10px"><button class="btn pri sm grow" onclick="setCyclePublished(' + jsArg(cyc.id) + ',true)">' + esc(t('Show to residents', 'أظهرها للسكان')) + '</button><button class="btn danger sm" onclick="discardCycle(' + jsArg(cyc.id) + ')">' + esc(t('Discard', 'تجاهل')) + '</button></div>';
  }
  h += '<div class="sec-h month-head" style="margin-top:12px"><h2>' + esc(cycleTitle(cyc)) + '</h2>';
  if (isManager()) {
    h += '<span class="month-acts"><button onclick="openSheet(\'extra\',{cycle:' + jsArg(cyc.id) + '})">＋ ' + esc(t('One-off', 'لمرة واحدة')) + '</button>';
    h += '<button onclick="openSheet(\'charge\',{cycle:' + jsArg(cyc.id) + '})">＋ ' + esc(t('Add', 'إضافة')) + '</button></span>';
  }
  h += '</div>';
  var chs = chargesOf(cyc.id);
  if (!chs.length) h += '<div class="card empty">' + esc(t('No charges yet. Add the monthly fee, or a one-off for this month only.', 'لا رسوم بعد. أضف الرسم الشهري، أو رسماً لهذا الشهر فقط.')) + '</div>';
  else {
    h += renderChargeBlocks(chs);
    h += renderReviewTotals(cyc, chs);
    h += renderAptMonth(cyc);
    if (isManager()) h += '<p class="hint">' + esc(t('Tap a charge to see what each apartment pays. Edit amounts to change one. Payments already recorded are kept.', 'اضغط رسماً لترى ما تدفعه كل شقة. عدّل المبالغ لتغيير واحدة. الدفعات المسجّلة تبقى.')) + '</p>';
  }
  h += '</div>';
  return h;
}
SHEETS.charge = function(d) {
  var ch = d.id ? byId(S.charges, d.id) : null;
  var st = d;
  var v = ch || { title: '', title_ar: '', kind: 'fixed', cur: 'USD', amount: '', split: 'each', overrides: {}, pass_through: false, recurring: true, cycle_id: d.cycle };
  var kind = st.kind || v.kind, cur = st.cur || v.cur, split = st.split || (kind === 'due' && !ch ? 'total' : v.split);
  var mt = st.meter !== undefined ? st.meter : (v.meter ? JSON.parse(JSON.stringify(v.meter)) : null);
  if (kind === 'due') mt = null;
  if (kind === 'service' || mt) split = 'custom';
  else if (split === 'custom') split = 'each';
  var ov = st.ov || Object.assign({}, v.overrides || {});
  var h = '<h3>' + esc(ch ? L(ch) : t('New charge', 'رسم جديد')) + '</h3>';
  h += '<div class="seg" style="margin-top:8px">';
  ['fixed', 'due', 'service'].forEach(function(k) { h += '<button class="' + (kind === k ? 'on' : '') + '" onclick="keepCharge();UI.sheet.data.kind=\'' + k + '\';UI.sheet.data.split=null;render()">' + esc(LANG === 'ar' ? KIND_INFO[k][1] : KIND_INFO[k][0]) + '</button>'; });
  h += '</div><p class="hint">' + esc(LANG === 'ar' ? KIND_INFO[kind][3] : KIND_INFO[kind][2]) + '</p>';
  h += '<label class="field"><span>' + esc(t('Common ones', 'الشائعة')) + '</span>' + presetSelect('c-pre', CHARGE_PRESETS[kind], 'chargePreset(this.value)') + '</label>';
  h += '<label class="field"><span>' + esc(t('Name', 'الاسم')) + '</span><input class="input" id="c-title" data-tr="c-title-ar" data-tr-kind="phrase" value="' + esc(st.title != null ? st.title : v.title) + '" placeholder="' + esc(kind === 'service' ? 'Moteur' : kind === 'due' ? t('Water bill', 'فاتورة المياه') : t('Maintenance', 'الصيانة')) + '"><div class="tr-box" id="trs-c-title"></div></label>';
  h += '<label class="field"><span>' + esc(t('Name in Arabic (optional)', 'الاسم بالعربية (اختياري)')) + '</span><input class="input" id="c-title-ar" data-tr="c-title" data-tr-kind="phrase" dir="rtl" value="' + esc(st.title_ar != null ? st.title_ar : (v.title_ar || '')) + '"><div class="tr-box" id="trs-c-title-ar"></div></label>';
  if (blocks().length > 1) {
    var cb = st.block != null ? st.block : (v.block || '');
    h += '<label class="field"><span>' + esc(t('Applies to', 'ينطبق على')) + '</span><select class="input" id="c-block" onchange="keepCharge();chargePreview()"><option value="">' + esc(t('Whole building (all blocks)', 'كل البناية (كل البلوكات)')) + '</option>' + blocks().map(function(b) { return '<option value="' + esc(b) + '"' + (cb === b ? ' selected' : '') + '>' + esc(blockLabel(b)) + '</option>'; }).join('') + '</select></label>';
  }
  if (kind !== 'due') h += '<div class="switch-row"><div><b>' + esc(t('Priced by kWh', 'حسب الكيلوواط')) + '</b><small>' + esc(t('Generator with a meter per apartment: price × consumption', 'مولد بعداد لكل شقة: السعر × الاستهلاك')) + '</small></div><button class="sw' + (mt ? ' on' : '') + '" onclick="keepCharge();UI.sheet.data.meter=' + (mt ? 'null' : '{rate:\'\',fixed:\'\',kwh:{}}') + ';render()"></button></div>';
  if (mt) {
    h += '<div class="two"><label class="field"><span>' + esc(t('Price per kWh', 'سعر الكيلوواط')) + '</span><input class="input" id="m-rate" inputmode="decimal" value="' + esc(mt.rate) + '" placeholder="' + (cur === 'USD' ? '0.45' : '40000') + '" oninput="keepCharge();chargePreview()"></label>';
    h += '<label class="field"><span>' + esc(t('Fixed fee (optional)', 'رسم ثابت (اختياري)')) + '</span><input class="input" id="m-fixed" inputmode="decimal" value="' + esc(mt.fixed) + '" placeholder="0" oninput="keepCharge();chargePreview()"></label></div>';
    h += '<label class="field"><span>' + esc(t('Currency', 'العملة')) + '</span><div class="seg"><button class="' + (cur === 'USD' ? 'on' : '') + '" onclick="keepCharge();UI.sheet.data.cur=\'USD\';render()">USD</button><button class="' + (cur === 'LBP' ? 'on' : '') + '" onclick="keepCharge();UI.sheet.data.cur=\'LBP\';render()">LBP</button></div></label>';
  } else if (kind !== 'service') {
    h += '<label class="field"><span>' + esc(t('How to split it', 'طريقة التقسيم')) + '</span><div class="seg">';
    [['each', t('Same for each', 'نفس المبلغ لكل شقة')], ['total', t('Split a total', 'تقسيم مبلغ كلي')], ['weight', t('Each × share', 'لكل شقة × الحصة')]].forEach(function(x) {
      h += '<button class="' + (split === x[0] ? 'on' : '') + '" onclick="keepCharge();UI.sheet.data.split=\'' + x[0] + '\';render()">' + esc(x[1]) + '</button>';
    });
    h += '</div></label>';
    h += '<label class="field"><span>' + esc(split === 'total' ? t('Total to split', 'المبلغ الكلي') : t('Amount per apartment', 'المبلغ لكل شقة')) + '</span><div class="money-in"><input class="input" id="c-amt" inputmode="decimal" value="' + esc(st.amount != null ? st.amount : v.amount) + '" oninput="keepCharge();chargePreview()"><div class="seg"><button class="' + (cur === 'USD' ? 'on' : '') + '" onclick="keepCharge();UI.sheet.data.cur=\'USD\';render()">USD</button><button class="' + (cur === 'LBP' ? 'on' : '') + '" onclick="keepCharge();UI.sheet.data.cur=\'LBP\';render()">LBP</button></div></div></label>';
  } else {
    h += '<label class="field"><span>' + esc(t('Currency', 'العملة')) + '</span><div class="seg"><button class="' + (cur === 'USD' ? 'on' : '') + '" onclick="keepCharge();UI.sheet.data.cur=\'USD\';render()">USD</button><button class="' + (cur === 'LBP' ? 'on' : '') + '" onclick="keepCharge();UI.sheet.data.cur=\'LBP\';render()">LBP</button></div></label>';
  }
  h += fxField('c-fx', cur, st.fx || v.fx, mt ? 'm-rate' : 'c-amt');
  if (mt) h += '<div class="field"><span>' + esc(t('kWh used this month (leave empty if not subscribed)', 'الاستهلاك هذا الشهر بالكيلوواط (فارغ لغير المشترك)')) + '</span><div class="card" id="c-prev" style="padding:4px 12px"></div></div>';
  else h += '<div class="field"><span>' + esc(kind === 'service' ? t('What each subscriber pays (leave empty if not subscribed)', 'ما يدفعه كل مشترك (اتركه فارغاً لغير المشترك)') : t('Per apartment — type to change one. A payment already recorded is not deleted.', 'لكل شقة — اكتب لتغيير واحدة. الدفعة المسجّلة لا تُحذف.')) + '</span><div class="card" id="c-prev" style="padding:4px 12px"></div></div>';
  if (kind !== 'due') h += '<div class="switch-row"><div><b>' + esc(t('Repeat next month', 'كرّر الشهر القادم')) + '</b><small>' + esc(t('Copied when you open the next month', 'يُنسخ عند فتح الشهر التالي')) + '</small></div><button class="sw' + ((st.recurring != null ? st.recurring : v.recurring) ? ' on' : '') + '" id="c-rec" onclick="this.classList.toggle(\'on\');keepCharge()"></button></div>';
  h += '<div id="sheet-err" class="err"></div><div class="foot">';
  if (ch) h += '<button class="btn danger" onclick="deleteCharge(' + jsArg(ch.id) + ')">' + esc(t('Remove', 'حذف')) + '</button>';
  h += '<button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveCharge()">' + esc(t('Save', 'حفظ')) + '</button></div>';
  UI.sheet.data.kind = kind; UI.sheet.data.cur = cur; UI.sheet.data.split = split; UI.sheet.data.ov = ov; UI.sheet.data.meter = mt;
  setTimeout(chargePreview, 0);
  return h;
};
function chargePreset(i) {
  if (i === '') return;
  keepCharge();
  var d = UI.sheet.data, p = CHARGE_PRESETS[d.kind][i];
  d.title = p.en; d.title_ar = p.ar; d.cur = p.cur;
  if (p.amt != null) d.amount = p.amt;
  if (d.kind !== 'service' && p.split) d.split = p.split;
  render();
}
function keepCharge() {
  var d = UI.sheet.data;
  if (document.getElementById('c-title')) d.title = val('c-title');
  if (document.getElementById('c-title-ar')) d.title_ar = val('c-title-ar');
  if (document.getElementById('c-amt')) d.amount = val('c-amt');
  var r = document.getElementById('c-rec'); if (r) d.recurring = r.classList.contains('on');
  var cbk = document.getElementById('c-block'); if (cbk) d.block = cbk.value;
  if (document.getElementById('c-fx')) d.fx = val('c-fx');
  if (d.meter) { if (document.getElementById('m-rate')) d.meter.rate = val('m-rate'); if (document.getElementById('m-fixed')) d.meter.fixed = val('m-fixed'); }
}
/* kWh charge: each subscriber pays fixed + kWh × price; empty kWh = not subscribed */
function meterAmount(m, kwh, cur) {
  if (kwh === '' || kwh == null) return null;
  return round(num(m.fixed) + num(kwh) * num(m.rate), cur);
}
function meterOverrides(m, cur) {
  var ov = {};
  Object.keys(m.kwh || {}).forEach(function(uid) { var a = meterAmount(m, m.kwh[uid], cur); if (a != null) ov[uid] = a; });
  return ov;
}
function kwhSet(uid, v) {
  var m = UI.sheet.data.meter; if (v === '') delete m.kwh[uid]; else m.kwh[uid] = num(v);
  var a = meterAmount(m, m.kwh[uid], UI.sheet.data.cur), el = document.getElementById('kw-' + uid);
  if (el) el.textContent = a == null ? '—' : fmt(a, UI.sheet.data.cur);
}
function paidMark(ch, u) {
  if (!ch || !u) return '';
  var paid = paidFor(ch, u);
  if (!(paid > 0)) return '';
  return '<small class="muted" style="display:block;font-weight:600">' + esc(t('paid ', 'مدفوع ') + fmt(paid, ch.cur)) + '</small>';
}
function chargePreview() {
  var el = document.getElementById('c-prev');
  if (!el || !UI.sheet) return;
  var d = UI.sheet.data;
  var ch0 = d.id ? byId(S.charges, d.id) : null;
  var tmp = { amount: num(d.amount), cur: d.cur, split: d.split, overrides: {}, pass_through: d.kind === 'service', cycle_id: d.cycle || (ch0 || {}).cycle_id, block: d.block != null ? d.block : (ch0 || {}).block };
  var h = '';
  if (d.meter) {
    activeUnits().filter(function(u) { return inBlock(u, tmp); }).forEach(function(u) {
      var k = d.meter.kwh[u.id], a = meterAmount(d.meter, k, d.cur);
      h += '<div class="kv" style="align-items:center;gap:8px"><span class="grow">' + esc(u.code + (unitName(u) ? ' · ' + unitName(u) : '')) + paidMark(ch0, u) + '</span><input class="input" style="max-width:86px;min-height:38px;padding:6px 10px;font-size:15px;text-align:end" inputmode="decimal" placeholder="kWh" value="' + esc(k != null ? k : '') + '" oninput="kwhSet(' + jsArg(u.id) + ',this.value)"><b id="kw-' + esc(u.id) + '" style="min-width:74px;text-align:end">' + esc(a == null ? '—' : fmt(a, d.cur)) + '</b></div>';
    });
    el.innerHTML = h || '<div class="muted">' + esc(t('Add apartments first', 'أضف الشقق أولاً')) + '</div>';
    return;
  }
  activeUnits().filter(function(u) { return inBlock(u, tmp); }).forEach(function(u) {
    var calc = dueFor(tmp, u), o = d.ov[u.id];
    h += '<div class="kv" style="align-items:center"><span>' + esc(u.code + (unitName(u) ? ' · ' + unitName(u) : '')) + paidMark(ch0, u) + '</span><input class="input" style="max-width:130px;min-height:38px;padding:6px 10px;font-size:15px;text-align:end" inputmode="decimal" placeholder="' + esc(d.kind === 'service' ? '—' : String(calc)) + '" value="' + esc(o != null ? o : '') + '" oninput="ovSet(' + jsArg(u.id) + ',this.value)"></div>';
  });
  el.innerHTML = h || '<div class="muted">' + esc(t('Add apartments first', 'أضف الشقق أولاً')) + '</div>';
}
function ovSet(uid, v) { if (v === '') delete UI.sheet.data.ov[uid]; else UI.sheet.data.ov[uid] = num(v); }
/* True when the edit is safe to save. Payments are never rewritten here. */
function confirmChargeEdit(ch, row) {
  var preview = JSON.parse(JSON.stringify(row));
  toBase('charges', preview);
  var pays = livePayments().filter(function(p) { return p.charge_id === ch.id; });
  if (!pays.length) return true;
  if (pays.some(function(p) { return p.cur !== preview.cur; })) {
    var cn = pays[0].cur === 'LBP' ? t('lira', 'الليرة') : t('dollars', 'الدولار');
    sheetErr(t('Payments on this charge are in ' + cn + '. Undo them before changing the currency.', 'دفعات هذا الرسم ب' + cn + '. ألغها قبل تغيير العملة.'));
    return false;
  }
  var tmp = Object.assign({}, ch, preview, { id: ch.id, cycle_id: ch.cycle_id });
  var under = [];
  activeUnits().forEach(function(u) {
    var due = dueFor(tmp, u), paid = paidFor(ch, u);
    if (paid - due > (preview.cur === 'LBP' ? 1 : 0.009)) under.push(u.code + ': ' + fmt(paid, preview.cur) + ' → ' + fmt(due, preview.cur));
  });
  if (!under.length) return true;
  return confirm(t(
    'Some apartments already paid more than the new amount. The extra stays in the books and is not deleted:\n' + under.slice(0, 8).join('\n'),
    'بعض الشقق دفعت أكثر من المبلغ الجديد. الزيادة تبقى في الحسابات ولا تُحذف:\n' + under.slice(0, 8).join('\n')
  ));
}
function saveCharge() {
  if (!isManager()) return sheetErr(t('Only a manager can change charges', 'فقط المدير يعدّل الرسوم'));
  keepCharge();
  var d = UI.sheet.data, ch = d.id ? byId(S.charges, d.id) : null;
  var row = { title: (d.title || '').trim(), title_ar: (d.title_ar || '').trim() || null, kind: d.kind, cur: d.cur, amount: d.kind === 'service' ? 0 : num(d.amount),
              split: d.split, overrides: d.ov || {}, pass_through: d.kind === 'service', block: (d.block != null ? d.block : (ch && ch.block)) || null, recurring: d.kind === 'due' ? false : (d.recurring != null ? d.recurring : true) };
  if (d.meter) {
    if (!(num(d.meter.rate) > 0)) return sheetErr(t('Enter the price per kWh', 'أدخل سعر الكيلوواط'));
    row.meter = { rate: num(d.meter.rate), fixed: num(d.meter.fixed), kwh: d.meter.kwh || {} };
    row.split = 'custom'; row.amount = 0;
    var computed = meterOverrides(row.meter, row.cur);
    // Keep an exact amount for a unit that has no kWh reading and never had one
    // (a waived remainder). Clearing a reading that was there still drops the charge.
    if (ch && ch.overrides) {
      var oldK = (ch.meter && ch.meter.kwh) || {}, newK = row.meter.kwh || {};
      Object.keys(ch.overrides).forEach(function(uid) {
        if (newK[uid] == null && oldK[uid] == null && num(ch.overrides[uid]) > 0) computed[uid] = num(ch.overrides[uid]);
      });
    }
    row.overrides = computed;
  } else row.meter = null;
  if (row.cur === 'LBP') row.fx = num(d.fx) || rate();
  if (!row.title) return sheetErr(t('Give it a name', 'أعطه اسماً'));
  if (!d.meter && d.kind !== 'service' && !(row.amount > 0) && !Object.keys(row.overrides).length) return sheetErr(t('Enter an amount', 'أدخل المبلغ'));
  if (!d.meter && d.kind === 'service' && !Object.keys(row.overrides).length) return sheetErr(t('Enter at least one subscriber', 'أدخل مشتركاً واحداً على الأقل'));
  if (!ch) { row.cycle_id = d.cycle || UI.cycleId; row.sort = chargesOf(row.cycle_id).length; }
  else if (!confirmChargeEdit(ch, row)) return;
  (ch ? dbUpdate('charges', ch.id, row) : dbInsert('charges', row)).then(function() { closeSheet(); toast(t('Saved', 'تم الحفظ')); }, function(e) { sheetErr(e.message); });
}
function chargePayRows(id) {
  return livePayments().filter(function(p) { return p.charge_id === id; });
}
function chargeExpRows(id) {
  return liveExpenses().filter(function(e) { return e.charge_id === id; });
}
function chargeHasUnpaid(ch) {
  return activeUnits().some(function(u) { return cell(ch, u).left > 0; });
}
function reallyDeleteCharge(id) {
  return dbDelete('charges', id).then(function() {
    S.payments = S.payments.filter(function(p) { return p.charge_id !== id; });
    S.expenses.forEach(function(e) { if (e.charge_id === id) e.charge_id = null; });
    if (!isCloud()) {
      var db = localLoad();
      db.payments = (db.payments || []).filter(function(p) { return p.charge_id !== id; });
      (db.expenses || []).forEach(function(e) { if (e.charge_id === id) e.charge_id = null; });
      localSave();
    }
    S._rev = (S._rev || 0) + 1;
  });
}
function deleteCharge(id) {
  if (!isManager()) return;
  var ch = byId(S.charges, id);
  if (!ch) return;
  var n = chargePayRows(id).length;
  if (!n) {
    if (!confirm(t('Remove this charge?', 'حذف هذا الرسم؟'))) return;
    reallyDeleteCharge(id).then(function() { closeSheet(); toast(t('Removed', 'تم الحذف')); }, fail);
    return;
  }
  openSheet('chargeRemove', { id: id });
}
/* Payments stay. Apartments that have not paid the full amount stop owing the rest. */
function waiveUnpaid(id) {
  if (!isManager()) return;
  var ch = byId(S.charges, id);
  if (!ch) return;
  var gap = ch.cur === 'LBP' ? 1 : 0.009;
  var ov = JSON.parse(JSON.stringify(ch.overrides || {}));
  var meter = ch.meter ? JSON.parse(JSON.stringify(ch.meter)) : null;
  if (meter && !meter.kwh) meter.kwh = {};
  activeUnits().forEach(function(u) {
    if (!inBlock(u, ch)) return;
    var paid = paidFor(ch, u), due = dueFor(ch, u);
    if (!(due > 0)) return;
    if (paid <= 0) {
      ov[u.id] = 0;
      if (meter) delete meter.kwh[u.id];
    } else if (due - paid > gap) {
      ov[u.id] = round(paid, ch.cur);
      if (meter) delete meter.kwh[u.id];
    }
  });
  var patch = { overrides: ov };
  if (meter) patch.meter = meter;
  dbUpdate('charges', id, patch).then(function() {
    closeSheet();
    toast(t('Unpaid amounts were dropped. Payments stay. Review the copy when you open next month.', 'أُسقط ما لم يُدفع. الدفعات تبقى. راجع النسخة عند فتح الشهر القادم.'));
  }, fail);
}
function undoAndRemoveCharge(id) {
  if (!isManager()) return;
  var ch = byId(S.charges, id);
  if (!ch) return;
  if (chargeExpRows(id).length) return sheetErr(t('Cancel the supplier payout first.', 'ألغِ دفع المورد أولاً.'));
  var pays = chargePayRows(id);
  var tot = pair();
  pays.forEach(function(p) { addTo(tot, p.cur, num(p.amount)); });
  if (!confirm(t(
    'Undo these payments (' + fmtPair(tot) + ') and remove the charge. The money leaves the safe or the collector\'s pocket.',
    'إلغاء هذه الدفعات (' + fmtPair(tot) + ') وحذف الرسم. المبلغ يخرج من الصندوق أو من جيب الجابي.'
  ))) return;
  var p = Promise.resolve();
  pays.forEach(function(pay) { p = p.then(function() { return rpc('void_payment', { p_payment: pay.id }); }); });
  p.then(function() { return reallyDeleteCharge(id); }).then(function() {
    closeSheet();
    toast(t('Charge removed and its payments undone', 'حُذف الرسم وأُلغيت دفعاته'));
    if (isCloud()) reloadBuilding();
  }, function(e) { sheetErr((e && e.message) || String(e)); if (isCloud()) reloadBuilding(); });
}
SHEETS.chargeRemove = function(d) {
  var ch = byId(S.charges, d.id);
  if (!ch) return '';
  var pays = chargePayRows(ch.id), exps = chargeExpRows(ch.id), tot = pair();
  pays.forEach(function(p) { addTo(tot, p.cur, num(p.amount)); });
  var h = '<h3>' + esc(t('Remove ', 'حذف ') + L(ch)) + '</h3>';
  h += '<p class="lead">' + esc(t('Payments totalling ' + fmtPair(tot) + ' are already recorded. Deleting the charge must not erase that money by itself.', 'دفعات مجموعها ' + fmtPair(tot) + ' مسجّلة. حذف الرسم وحده لا يمحو هذا المبلغ.')) + '</p>';
  h += '<div class="card list">';
  var seen = {};
  pays.forEach(function(p) {
    var u = byId(S.units, p.unit_id), k = p.unit_id + '|' + p.cur;
    if (!seen[k]) seen[k] = { code: u ? u.code : '?', cur: p.cur, amt: 0 };
    seen[k].amt += num(p.amount);
  });
  Object.keys(seen).forEach(function(k) {
    var x = seen[k];
    h += '<div class="li"><div class="ic in">✓</div><div class="grow"><b>' + esc(x.code) + '</b><small>' + esc(t('Stays in the books unless you undo it', 'يبقى في الحسابات إلا إذا ألغيتها')) + '</small></div><span class="amt">' + esc(fmt(x.amt, x.cur)) + '</span></div>';
  });
  h += '</div>';
  if (exps.length) h += '<p class="hint">' + esc(t('A supplier payout is recorded on this charge. Cancel that expense before undoing the payments.', 'سُجّل دفع للمورد على هذا الرسم. ألغِ ذلك المصروف قبل إلغاء الدفعات.')) + '</p>';
  if (pays.some(function(p) { return p.handover_id && handoverConfirmed(p.handover_id); })) h += '<p class="hint">' + esc(t('Some of this cash was already handed over. Undoing it lowers the safe. The handover note is not rewritten.', 'بعض هذا النقد سُلّم مسبقاً. إلغاؤه ينقص الصندوق. ملاحظة التسليم لا تتغير.')) + '</p>';
  h += '<div id="sheet-err" class="err"></div><div class="foot" style="flex-wrap:wrap">';
  if (chargeHasUnpaid(ch)) h += '<button class="btn sec" style="flex:1" onclick="waiveUnpaid(' + jsArg(ch.id) + ')">' + esc(t('Drop what is still unpaid', 'أسقط ما لم يُدفع')) + '</button>';
  if (!exps.length) h += '<button class="btn danger" style="flex:1" onclick="undoAndRemoveCharge(' + jsArg(ch.id) + ')">' + esc(t('Undo payments and remove', 'ألغِ الدفعات واحذف')) + '</button>';
  h += '<button class="btn sec" onclick="openSheet(\'charge\',{id:' + jsArg(ch.id) + '})">' + esc(t('Back', 'رجوع')) + '</button></div>';
  return h;
};

/* A one-off line: one apartment, or a total split by each apartment's share. Not copied next month. */
function keepExtra() {
  var d = UI.sheet && UI.sheet.data;
  if (!d) return;
  if (document.getElementById('x-title')) d.title = val('x-title');
  if (document.getElementById('x-title-ar')) d.title_ar = val('x-title-ar');
  if (document.getElementById('x-amt')) d.amount = val('x-amt');
  if (document.getElementById('x-unit')) d.unit = val('x-unit');
  if (document.getElementById('x-block')) d.block = val('x-block');
  if (document.getElementById('x-fx')) d.fx = val('x-fx');
}
function extraHint(d) {
  var amt = num(d.amount), cur = d.cur || 'USD', who = d.who || 'shares';
  if (!(amt > 0)) return t('Enter an amount to see who pays.', 'أدخل المبلغ لترى من يدفع.');
  if (who === 'one') {
    var one = byId(S.units, d.unit);
    return one ? t(one.code + ' owes ' + fmt(amt, cur) + '. Other apartments are not charged.', one.code + ' تدفع ' + fmt(amt, cur) + '. الشقق الأخرى لا تُحاسب.') : t('Pick an apartment', 'اختر شقة');
  }
  var tmp = { amount: amt, cur: cur, split: who === 'shares' ? 'total' : 'each', overrides: {}, pass_through: false, cycle_id: d.cycle || UI.cycleId, block: d.block || null };
  var n = 0, sample = '';
  activeUnits().forEach(function(u) {
    var due = dueFor(tmp, u);
    if (due > 0) { n++; if (!sample) sample = u.code + ' ' + fmt(due, cur); }
  });
  if (!n) return t('No apartment is charged. Check the block.', 'لا شقة تُحاسب. تحقق من البلوك.');
  if (who === 'shares') return t('Split ' + fmt(amt, cur) + ' by share across ' + n + ' apartments. Example: ' + sample, 'يُقسّم ' + fmt(amt, cur) + ' بالحصص على ' + n + ' شقق. مثال: ' + sample);
  return t(fmt(amt, cur) + ' each for ' + n + ' apartments.', fmt(amt, cur) + ' لكل شقة من ' + n + '.');
}
function extraPreview() {
  keepExtra();
  var el = document.getElementById('x-hint');
  if (el && UI.sheet) el.textContent = extraHint(UI.sheet.data);
}
SHEETS.extra = function(d) {
  if (!isManager()) return '';
  var who = d.who || 'shares', cur = d.cur || 'USD', units = activeUnits();
  if (who === 'one' && !d.unit && units[0]) d.unit = units[0].id;
  var cyc = byId(S.cycles, d.cycle || UI.cycleId);
  var h = '<h3>' + esc(t('One-off charge', 'رسم لمرة واحدة')) + '</h3>';
  h += '<p class="lead">' + esc(t('Added only to ' + (cyc ? cycleTitle(cyc) : t('this month', 'هذا الشهر')) + '. It is not copied next month.', 'يُضاف إلى ' + (cyc ? cycleTitle(cyc) : 'هذا الشهر') + ' فقط، ولا يُنسخ للشهر القادم.')) + '</p>';
  h += '<label class="field"><span>' + esc(t('Name', 'الاسم')) + '</span><input class="input" id="x-title" data-tr="x-title-ar" data-tr-kind="phrase" value="' + esc(d.title || '') + '" placeholder="' + esc(t('e.g. Tanker', 'مثلاً صهريج')) + '" data-autofocus><div class="tr-box" id="trs-x-title"></div></label>';
  h += '<label class="field"><span>' + esc(t('Name in Arabic (optional)', 'الاسم بالعربية (اختياري)')) + '</span><input class="input" id="x-title-ar" dir="rtl" data-tr="x-title" data-tr-kind="phrase" value="' + esc(d.title_ar || '') + '"><div class="tr-box" id="trs-x-title-ar"></div></label>';
  h += '<div class="chips" style="padding:2px 0 8px;flex-wrap:wrap">';
  [['one', t('One apartment', 'شقة واحدة')], ['shares', t('Split by shares', 'تقسيم بالحصص')], ['each', t('Same for each', 'نفس المبلغ لكل شقة')]].forEach(function(x) {
    h += '<button type="button" class="chip' + (who === x[0] ? ' on' : '') + '" onclick="keepExtra();UI.sheet.data.who=\'' + x[0] + '\';render()">' + esc(x[1]) + '</button>';
  });
  h += '</div>';
  if (who === 'one') {
    h += '<label class="field"><span>' + esc(t('Apartment', 'الشقة')) + '</span><select class="input" id="x-unit" onchange="extraPreview()">';
    units.forEach(function(u) { h += '<option value="' + esc(u.id) + '"' + (u.id === d.unit ? ' selected' : '') + '>' + esc(u.code + (unitName(u) ? ' · ' + unitName(u) : '') + (blockOf(u) && blocks().length > 1 ? ' · ' + blockOf(u) : '')) + '</option>'; });
    h += '</select></label>';
  } else if (blocks().length > 1) {
    h += '<label class="field"><span>' + esc(t('Applies to', 'ينطبق على')) + '</span><select class="input" id="x-block" onchange="keepExtra();extraPreview()"><option value="">' + esc(t('Whole building', 'كل البناية')) + '</option>';
    blocks().forEach(function(b) { h += '<option value="' + esc(b) + '"' + ((d.block || '') === b ? ' selected' : '') + '>' + esc(blockLabel(b)) + '</option>'; });
    h += '</select></label>';
  }
  var amtLabel = who === 'shares' ? t('Total to split', 'المبلغ الكلي') : who === 'one' ? t('Amount for that apartment', 'مبلغ هذه الشقة') : t('Amount per apartment', 'المبلغ لكل شقة');
  h += '<label class="field"><span>' + esc(amtLabel) + '</span><div class="money-in"><input class="input" id="x-amt" inputmode="decimal" value="' + esc(d.amount || '') + '" oninput="extraPreview()"><div class="seg"><button type="button" class="' + (cur === 'USD' ? 'on' : '') + '" onclick="keepExtra();UI.sheet.data.cur=\'USD\';render()">USD</button><button type="button" class="' + (cur === 'LBP' ? 'on' : '') + '" onclick="keepExtra();UI.sheet.data.cur=\'LBP\';render()">LBP</button></div></div></label>';
  h += fxField('x-fx', cur, d.fx, 'x-amt');
  h += '<p class="hint" id="x-hint">' + esc(extraHint(d)) + '</p>';
  h += '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveExtra()">' + esc(t('Add', 'إضافة')) + '</button></div>';
  return h;
};
function saveExtra() {
  if (!isManager()) return sheetErr(t('Only a manager can change charges', 'فقط المدير يعدّل الرسوم'));
  keepExtra();
  var d = UI.sheet.data, title = (d.title || '').trim(), amt = num(d.amount), who = d.who || 'shares';
  var cycleId = d.cycle || UI.cycleId;
  if (!title) return sheetErr(t('Give it a name', 'أعطه اسماً'));
  if (!(amt > 0)) return sheetErr(t('Enter an amount', 'أدخل المبلغ'));
  var row = { cycle_id: cycleId, title: title, title_ar: (d.title_ar || '').trim() || null, kind: 'due', cur: d.cur || 'USD', pass_through: false, recurring: false, sort: chargesOf(cycleId).length, block: null, overrides: {}, amount: amt, split: 'each' };
  if (who === 'one') {
    if (!d.unit) return sheetErr(t('Pick an apartment', 'اختر شقة'));
    row.split = 'custom'; row.amount = 0; row.overrides[d.unit] = amt;
  } else if (who === 'shares') {
    row.split = 'total'; row.amount = amt; if (d.block) row.block = d.block;
  } else if (d.block) row.block = d.block;
  if (row.cur === 'LBP') row.fx = num(d.fx) || rate();
  var btn = document.querySelector('.sheet .foot .btn.pri'); if (btn) btn.disabled = true;
  dbInsert('charges', row).then(function() { closeSheet(); toast(t('Added to this month only', 'أُضيف لهذا الشهر فقط')); }, function(e) { if (btn) btn.disabled = false; sheetErr(e.message); });
}

/* ---------------- Months & projects ---------------- */
function cycleAdjustBar(cyc) {
  if (!isManager() || !cyc) return '';
  if (cyc.published === false) {
    return '<div class="sec"><div class="banner info"><div class="grow"><b>' + esc(t('Draft', 'مسودة')) + '</b>' + esc(t('Residents can\'t see ' + cycleTitle(cyc) + ' yet.', 'السكان لا يرون ' + cycleTitle(cyc) + ' بعد.')) + '</div></div><div class="row" style="margin-top:8px"><button class="btn pri sm grow" onclick="openCycleAdjust(' + jsArg(cyc.id) + ')">' + esc(t('Adjust charges', 'تعديل الرسوم')) + '</button><button class="btn sec sm" onclick="setCyclePublished(' + jsArg(cyc.id) + ',true)">' + esc(t('Show', 'إظهار')) + '</button></div></div>';
  }
  return '<div class="sec" style="margin-top:8px"><button class="btn sec sm" onclick="openCycleAdjust(' + jsArg(cyc.id) + ')">' + esc(t('Adjust charges', 'تعديل الرسوم')) + '</button></div>';
}
function openCycleAdjust(id) {
  if (!isManager()) return;
  UI.cycleId = id;
  UI.tab = 'building';
  UI.bsec = 'charges';
  UI.sheet = null;
  render();
  window.scrollTo(0, 0);
}
function setCyclePublished(id, on) {
  if (!isManager()) return;
  var cyc = byId(S.cycles, id);
  if (!cyc) return;
  if (on && chargesOf(id).some(function(ch) { return ch.meter && !Object.keys(ch.meter.kwh || {}).length; })) {
    if (!confirm(t('A generator charge has no kWh readings yet, so it bills nothing. Show this month to residents anyway?', 'رسم مولّد بلا قراءات كيلوواط، فلن يُحاسب أحداً. إظهار هذا الشهر للسكان على أي حال؟'))) return;
  }
  dbUpdate('cycles', id, { published: !!on }).then(function() {
    toast(on ? t('Residents can see ' + cycleTitle(cyc), 'السكان يرون ' + cycleTitle(cyc)) : t(cycleTitle(cyc) + ' is hidden from residents', 'أُخفي ' + cycleTitle(cyc) + ' عن السكان'));
    render();
  }, fail);
}
function cycleMoneyBlock(id) {
  var ids = {};
  chargesOf(id).forEach(function(c) { ids[c.id] = 1; });
  if (livePayments().some(function(p) { return ids[p.charge_id]; })) return 'pay';
  if (liveExpenses().some(function(e) { return e.cycle_id === id || (e.charge_id && ids[e.charge_id]); })) return 'exp';
  return '';
}
function discardCycle(id) {
  if (!isManager()) return;
  var cyc = byId(S.cycles, id);
  if (!cyc) return;
  var why = cycleMoneyBlock(id);
  if (why === 'pay') { toast(t('This month has payments, so it can\'t be discarded. Adjust the charges instead.', 'هذا الشهر فيه دفعات، لا يمكن تجاهله. عدّل الرسوم.')); return; }
  if (why === 'exp') { toast(t('This month has expenses. Cancel those before discarding it.', 'هذا الشهر عليه مصاريف. ألغها قبل التجاهل.')); return; }
  if (!confirm(t('Discard ' + cycleTitle(cyc) + '? Its charges are removed. Nothing has been paid.', 'تجاهل ' + cycleTitle(cyc) + '؟ تُحذف رسومه. لم يُدفع شيء.'))) return;
  var chs = chargesOf(id).slice(), p = Promise.resolve();
  chs.forEach(function(ch) { p = p.then(function() { return dbDelete('charges', ch.id); }); });
  p.then(function() { return dbDelete('cycles', id); }).then(function() {
    if (UI.cycleId === id) UI.cycleId = null;
    UI.tab = 'home'; UI.bsec = null;
    toast(t('Discarded', 'تم التجاهل'));
    render();
  }, fail);
}
function copiedCharge(ch, cycleId, sort) {
  var row = {
    cycle_id: cycleId, kind: ch.kind, title: ch.title, title_ar: ch.title_ar, cur: ch.cur, amount: ch.amount, split: ch.split,
    overrides: ch.meter ? {} : JSON.parse(JSON.stringify(ch.overrides || {})),
    pass_through: !!ch.pass_through, recurring: true, sort: sort, block: ch.block || null,
    meter: ch.meter ? { rate: ch.meter.rate, fixed: ch.meter.fixed || 0, kwh: {} } : null
  };
  if (ch.fx) row.fx = ch.fx;
  if (ch.orig_amount) { row.orig_amount = ch.orig_amount; row.orig_cur = ch.orig_cur || 'LBP'; }
  return row;
}
function renderCyclesSec() {
  var h = '<div class="sec"><div class="row" style="gap:8px"><button class="btn pri sm grow" onclick="newMonth()">＋ ' + esc(t('Next month', 'الشهر التالي')) + '</button><button class="btn sec sm grow" onclick="openSheet(\'project\',{})">＋ ' + esc(t('Project', 'مشروع')) + '</button></div></div>';
  h += '<div class="sec"><div class="card list">';
  visibleCycles().forEach(function(c) {
    var s = cycleSummary(c);
    h += '<div class="li"><div class="ic">' + (c.kind === 'project' ? '◆' : '📅') + '</div><div class="grow" role="button" tabindex="0" onclick="UI.cycleId=' + jsArg(c.id) + ';go(\'collect\')"><b>' + esc(cycleTitle(c) + (c.published === false ? ' · ' + t('draft', 'مسودة') : '')) + '</b><small>' + esc(s.pct + '% · ' + fmtPair(s.paid) + t(' of ', ' من ') + fmtPair(s.due) + (c.kind === 'project' && c.budget ? ' · ' + t('budget ', 'الميزانية ') + fmt(c.budget, 'USD') : '')) + '</small></div>';
    h += '<button class="btn sm sec" onclick="openCycleAdjust(' + jsArg(c.id) + ')">' + esc(t('Adjust', 'تعديل')) + '</button>';
    h += '<button class="sw' + (c.published !== false ? ' on' : '') + '" title="' + esc(t('Visible to residents', 'ظاهر للسكان')) + '" onclick="setCyclePublished(' + jsArg(c.id) + ',' + (c.published === false) + ')"></button></div>';
  });
  if (!S.cycles.length) h += '<div class="empty">' + esc(t('Nothing yet', 'لا شيء بعد')) + '</div>';
  h += '</div><p class="hint">' + esc(t('Adjust changes the charges. The switch decides whether residents see that month.', 'تعديل يغيّر الرسوم. المفتاح يحدد إذا كان السكان يرون الشهر.')) + '</p></div>';
  return h;
}
function newMonth() {
  if (!isManager()) return;
  var ms = monthCycles(), draft = null;
  for (var i = 0; i < ms.length; i++) if (ms[i].published === false) { draft = ms[i]; break; }
  if (draft) {
    toast(t(cycleTitle(draft) + ' is still a draft', cycleTitle(draft) + ' ما زال مسودة'));
    openCycleAdjust(draft.id);
    return;
  }
  var last = ms[0];
  var period = last ? nextPeriod(last.period) : currentPeriod();
  var existing = null;
  S.cycles.forEach(function(c) { if (c.period === period) existing = c; });
  if (existing) {
    toast(t('That month is already open — you can still adjust it', 'هذا الشهر مفتوح — يمكنك تعديله'));
    openCycleAdjust(existing.id);
    return;
  }
  var cyc = { kind: 'month', period: period, title: periodLabel(period, 'en'), title_ar: periodLabel(period, 'ar'), published: false };
  dbInsert('cycles', cyc).then(function() {
    var rows = last ? chargesOf(last.id).filter(function(ch) { return ch.recurring; }).map(function(ch, i) { return copiedCharge(ch, cyc.id, i); }) : [];
    return dbInsertMany('charges', rows).then(function() {
      UI.cycleId = cyc.id;
      toast(t(periodLabel(period) + ' is a draft. Adjust the charges, then show it to residents.', periodLabel(period) + ' مسودة. عدّل الرسوم ثم أظهرها للسكان.'));
      openCycleAdjust(cyc.id);
    });
  }).catch(fail);
}
SHEETS.project = function(d) {
  var h = '<h3>' + esc(t('New project', 'مشروع جديد')) + '</h3><p class="lead">' + esc(t('A one-time contribution like solar panels or an elevator repair, paid at once or in installments.', 'مساهمة لمرة واحدة مثل الطاقة الشمسية أو تصليح المصعد، دفعة واحدة أو بالتقسيط.')) + '</p>';
  h += '<label class="field"><span>' + esc(t('Name', 'الاسم')) + '</span><input class="input" id="p-title" placeholder="' + esc(t('Solar 6kW', 'طاقة شمسية 6kW')) + '" data-autofocus></label>';
  h += '<label class="field"><span>' + esc(t('Total cost (USD)', 'الكلفة الإجمالية (دولار)')) + '</span><input class="input" id="p-total" inputmode="decimal" oninput="projPreview()"></label>';
  h += '<div class="two"><label class="field"><span>' + esc(t('Installments', 'الأقساط')) + '</span><input class="input" id="p-n" inputmode="numeric" value="1" oninput="projPreview()"></label>';
  h += '<label class="field"><span>' + esc(t('Split', 'التقسيم')) + '</span><select class="input" id="p-split" onchange="projPreview()"><option value="total">' + esc(t('By share', 'بالحصص')) + '</option><option value="equal">' + esc(t('Equal', 'بالتساوي')) + '</option></select></label></div>';
  h += '<p class="hint" id="p-prev"></p><div id="sheet-err" class="err"></div>';
  h += '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveProject()">' + esc(t('Create', 'إنشاء')) + '</button></div>';
  return h;
};
function projPreview() {
  var tot = num(val('p-total')), n = Math.max(1, Math.round(num(val('p-n')) || 1)), units = activeUnits().length || 1;
  var el = document.getElementById('p-prev');
  if (el) el.textContent = tot > 0 ? t('About ' + fmt(tot / units / n, 'USD') + ' per apartment per installment', 'حوالي ' + fmt(tot / units / n, 'USD') + ' لكل شقة في كل قسط') : '';
}
function saveProject() {
  var title = val('p-title').trim(), tot = num(val('p-total')), n = Math.max(1, Math.min(24, Math.round(num(val('p-n')) || 1))), split = val('p-split');
  if (!title) return sheetErr(t('Give it a name', 'أعطه اسماً'));
  if (!(tot > 0)) return sheetErr(t('Enter the total cost', 'أدخل الكلفة'));
  var cyc = { kind: 'project', title: title, budget: tot, published: true };
  dbInsert('cycles', cyc).then(function() {
    var rows = [];
    for (var i = 1; i <= n; i++) {
      var part = round(tot / n, 'USD');
      rows.push({ cycle_id: cyc.id, kind: 'due', title: n === 1 ? t('Contribution', 'المساهمة') : 'Installment ' + i + '/' + n, title_ar: n === 1 ? 'المساهمة' : 'القسط ' + i + '/' + n,
                  cur: 'USD', amount: split === 'equal' ? round(part / (activeUnits().length || 1), 'USD') : part, split: split === 'equal' ? 'each' : 'total', overrides: {}, pass_through: false, recurring: false, sort: i });
    }
    return dbInsertMany('charges', rows);
  }).then(function() { UI.cycleId = cyc.id; openCycleAdjust(cyc.id); }).catch(function(e) { sheetErr(e.message); });
}

/* ---------------- Team ---------------- */
function renderTeamSec() {
  var h = '<div class="sec"><div class="card list">';
  S.members.forEach(function(m) {
    h += '<div class="li"><div class="ic">' + esc((m.display_name || '?').charAt(0).toUpperCase()) + '</div><div class="grow"><b>' + esc(m.display_name || '—') + (m.display_name_ar ? ' · ' + esc(m.display_name_ar) : '') + (S.me && m.user_id === S.me.id ? ' · ' + esc(t('you', 'أنت')) : '') + '</b><small>' + esc(roleLabel(m.role)) + '</small></div>';
    if (S.me && (m.user_id === S.me.id || isManager())) h += '<button class="btn sm sec" onclick="openSheet(\'memberName\',{uid:' + jsArg(m.user_id) + '})">' + esc(t('Name', 'الاسم')) + '</button>';
    if (S.role === 'manager' && m.role !== 'manager') h += '<button class="btn sm danger" onclick="removeMember(' + jsArg(m.user_id) + ')">' + esc(t('Remove', 'إزالة')) + '</button>';
    h += '</div>';
  });
  h += '</div></div>';
  h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Invite someone', 'ادعُ شخصاً')) + '</h2></div><div class="card list">';
  h += '<button class="li" onclick="openSheet(\'invite\',{role:\'collector\'})"><div class="ic">💵</div><div class="grow"><b>' + esc(t('A collector', 'جابٍ')) + '</b><small>' + esc(t('Natour, concierge or a neighbour who collects. Ticks payments, holds cash until handover.', 'ناطور أو حارس أو جار يجمع المال. يسجّل الدفعات ويحمل النقد حتى التسليم.')) + '</small></div><span class="chev">›</span></button>';
  h += '<button class="li" onclick="openSheet(\'invite\',{role:\'comanager\'})"><div class="ic">🤝</div><div class="grow"><b>' + esc(t('A co-manager', 'مدير مساعد')) + '</b><small>' + esc(t('Can do everything you can, except remove people.', 'يستطيع كل شيء ما عدا إزالة الأشخاص.')) + '</small></div><span class="chev">›</span></button>';
  h += '</div></div>';
  if (!isCloud()) h += '<div class="sec"><div class="banner info"><div class="grow"><b>' + esc(t('Working on this phone only', 'تعمل على هذا الهاتف فقط')) + '</b>' + esc(t('Invites need the server. Until then you can preview what a collector sees from the building menu.', 'الدعوات تحتاج الخادم. حتى ذلك يمكنك معاينة ما يراه الجابي من قائمة البناية.')) + '</div></div></div>';
  return h;
}
SHEETS.invite = function(d) {
  var role = d.role;
  var h = '<h3>' + esc(role === 'collector' ? t('Invite a collector', 'ادعُ جابياً') : t('Invite a co-manager', 'ادعُ مديراً مساعداً')) + '</h3>';
  if (d.code) {
    var link = ((window.BINAYATI_CONFIG || {}).publicUrl || (location.origin + location.pathname)) + '?join=' + d.code;
    h += '<p class="lead">' + esc(t('Send this link. It works once and expires in 14 days.', 'أرسل هذا الرابط. يعمل مرة واحدة وينتهي بعد 14 يوماً.')) + '</p><div class="linkbox"><span class="grow">' + esc(link) + '</span></div>';
    var msg = t('Hi ' + (d.name || '') + ', join ' + bName() + ' on Binayati: ', 'مرحباً ' + (d.name || '') + '، انضم إلى ' + bName() + ' على بنايتي: ') + link;
    h += '<div class="foot"><button class="btn sec" onclick="copyText(' + jsArg(link) + ')">' + esc(t('Copy', 'نسخ')) + '</button><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + esc(encodeURIComponent(msg)) + '">WhatsApp</a></div>';
    return h;
  }
  h += '<label class="field"><span>' + esc(t('Their name', 'اسمه')) + '</span><input class="input" id="inv-name" data-tr="inv-name-ar" data-tr-kind="name" placeholder="' + esc(role === 'collector' ? t('e.g. Anas', 'مثلاً أنس') : '') + '" data-autofocus><div class="tr-box" id="trs-inv-name"></div></label><label class="field"><span>' + esc(t('Name in Arabic', 'الاسم بالعربية')) + '</span><input class="input" id="inv-name-ar" dir="rtl" data-tr="inv-name" data-tr-kind="name" placeholder="أنس"><div class="tr-box" id="trs-inv-name-ar"></div></label><div id="sheet-err" class="err"></div>';
  if (!isCloud()) {
    h += '<p class="hint">' + esc(t('The server isn\'t connected, so this adds them on this phone only, to preview their view.', 'الخادم غير متصل، فسيُضاف على هذا الهاتف فقط للمعاينة.')) + '</p>';
    h += '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="localAddMember(' + jsArg(role) + ')">' + esc(t('Add', 'إضافة')) + '</button></div>';
    return h;
  }
  h += '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="makeInvite(' + jsArg(role) + ')">' + esc(t('Create link', 'أنشئ الرابط')) + '</button></div>';
  return h;
};
function makeInvite(role) {
  var name = val('inv-name').trim(), nameAr = val('inv-name-ar').trim();
  rpc('create_invite', { p_building: S.building.id, p_role: role, p_display_name: name }).then(function(code) {
    if (nameAr) cloudCall(SB.from('invites').update({ display_name_ar: nameAr }).eq('code', code)).catch(function() {});
    UI.sheet.data.code = code; UI.sheet.data.name = name; render();
  }, function(e) { sheetErr(e.message); });
}
function localAddMember(role) {
  var name = val('inv-name').trim() || roleLabel(role), nameAr = val('inv-name-ar').trim() || null;
  var uid = role === 'collector' ? 'u-collector' : 'u-comanager';
  if (S.members.some(function(m) { return m.user_id === uid; })) uid = uid + '-' + token().slice(0, 4);
  dbInsert('members', { user_id: uid, role: role, display_name: name, display_name_ar: nameAr }).then(function() { closeSheet(); toast(t(name + ' added', 'أُضيف ' + name)); }, fail);
}
function removeMember(uid) {
  var m = member(uid);
  if (!confirm(t('Remove ' + (m && m.display_name) + '?', 'إزالة ' + (m && m.display_name) + '؟'))) return;
  var p = isCloud() ? cloudCall(SB.from('members').delete().eq('building_id', S.building.id).eq('user_id', uid)).then(function() { S.members = S.members.filter(function(x) { return x.user_id !== uid; }); })
                    : dbDelete('members', m.id);
  p.then(render, fail);
}

/* ---------------- Tasks ---------------- */
function renderTasksSec() {
  var h = '<div class="sec"><div class="sec-h"><h2>' + esc(t('Tasks & reminders', 'المهام والتذكيرات')) + '</h2><button onclick="openSheet(\'task\',{})">＋ ' + esc(t('Add', 'إضافة')) + '</button></div>';
  var open = openTasks();
  h += open.length ? taskLists(open) : '<div class="card empty">' + esc(t('No tasks', 'لا مهام')) + '</div>';
  var done = S.tasks.filter(function(x) { return x.done_at; }).sort(function(a, b) { return String(b.done_at).localeCompare(String(a.done_at)); }).slice(0, 8);
  if (done.length) h += '<div class="daylbl">' + esc(t('Done', 'منجزة')) + '</div><div class="card">' + done.map(taskRow).join('') + '</div>';
  return h + '</div>';
}

SHEETS.task = function(d) {
  var x = d.id ? byId(S.tasks, d.id) : null;
  var v = x || { title: '', title_ar: '', due_on: todayIso(), repeat: 'none', assignee: collectors().length ? 'collector' : 'manager' };
  var h = '<h3>' + esc(x ? t('Task', 'مهمة') : t('New task', 'مهمة جديدة')) + '</h3>';
  if (!x) {
    h += '<label class="field"><span>' + esc(t('Common tasks', 'مهام شائعة')) + '</span>' + presetSelect('t-pre', TASK_PRESETS, 'taskPreset(this.value)') + '</label>';
  }
  h += '<label class="field"><span>' + esc(t('What (English)', 'ماذا (بالإنكليزية)')) + '</span><input class="input" id="t-title" dir="ltr" data-tr="t-title-ar" data-tr-kind="phrase" value="' + esc(v.title || '') + '"><div class="tr-box" id="trs-t-title"></div></label>';
  h += '<label class="field"><span>' + esc(t('In Arabic', 'بالعربية')) + '</span><input class="input" id="t-title-ar" dir="rtl" data-tr="t-title" data-tr-kind="phrase" value="' + esc(v.title_ar || '') + '"><div class="tr-box" id="trs-t-title-ar"></div></label>';
  h += '<div class="two"><label class="field"><span>' + esc(t('When', 'متى')) + '</span><input class="input" type="date" id="t-date" value="' + esc(v.due_on || '') + '"></label>';
  h += '<label class="field"><span>' + esc(t('Repeats', 'يتكرر')) + '</span><select class="input" id="t-rep">' + Object.keys(REPEATS).map(function(k) { return '<option value="' + k + '"' + (v.repeat === k ? ' selected' : '') + '>' + esc(LANG === 'ar' ? REPEATS[k][1] : REPEATS[k][0]) + '</option>'; }).join('') + '</select></label></div>';
  h += '<label class="field"><span>' + esc(t('Who does it', 'من ينفذها')) + '</span><select class="input" id="t-who"><option value="manager"' + (v.assignee === 'manager' ? ' selected' : '') + '>' + esc(t('Managers', 'الإدارة')) + '</option><option value="collector"' + (v.assignee === 'collector' ? ' selected' : '') + '>' + esc(collectorLabel()) + '</option></select></label>';
  h += '<div id="sheet-err" class="err"></div><div class="foot">';
  if (x) h += '<button class="btn danger" onclick="dbDelete(\'tasks\',' + jsArg(x.id) + ').then(closeSheet,fail)">' + esc(t('Delete', 'حذف')) + '</button>';
  h += '<button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveTask(' + jsArg(x ? x.id : '') + ')">' + esc(t('Save', 'حفظ')) + '</button></div>';
  return h;
};
function taskPreset(i) {
  if (i === '') return;
  var p = TASK_PRESETS[i];
  document.getElementById('t-title').value = p.en;
  document.getElementById('t-title-ar').value = p.ar;
  document.getElementById('t-rep').value = p.rep;
  if (p.who === 'manager' || collectors().length) document.getElementById('t-who').value = p.who;
  UI.sheet.data.preset = Number(i);
}
function saveTask(id) {
  var en = val('t-title').trim(), ar = val('t-title-ar').trim();
  if (!en && !ar) return sheetErr(t('What needs doing?', 'ما المطلوب؟'));
  var row = { title: en || ar, title_ar: ar || null, due_on: val('t-date') || null, repeat: val('t-rep'), assignee: val('t-who') };
  (id ? dbUpdate('tasks', id, row) : dbInsert('tasks', row)).then(function() { closeSheet(); }, function(e) { sheetErr(e.message); });
}

/* ---------------- Settings ---------------- */
function renderSettingsSec() {
  var st = S.building.settings || {};
  var h = '<div class="sec"><div class="card pad">';
  h += '<label class="field" style="margin-top:0"><span>' + esc(t('Building name', 'اسم البناية')) + '</span><input class="input" id="s-name" data-tr="s-name-ar" data-tr-kind="phrase" value="' + esc(S.building.name) + '"><div class="tr-box" id="trs-s-name"></div></label>';
  h += '<label class="field"><span>' + esc(t('Name in Arabic', 'الاسم بالعربية')) + '</span><input class="input" id="s-name-ar" data-tr="s-name" data-tr-kind="phrase" dir="rtl" value="' + esc(S.building.name_ar || '') + '"><div class="tr-box" id="trs-s-name-ar"></div></label>';
  h += '<label class="field"><span>' + esc(t('Dollar rate (LBP per $1)', 'سعر الدولار (ليرة لكل دولار)')) + '</span><input class="input" id="s-rate" inputmode="numeric" value="' + esc(st.rate || 89500) + '"></label>';
  h += '<div class="two"><label class="field"><span>' + esc(t('Safe at the start ($)', 'الصندوق عند البدء ($)')) + '</span><input class="input" id="s-ou" inputmode="decimal" value="' + esc(st.opening_usd || 0) + '"></label>';
  h += '<label class="field"><span>' + esc(t('Safe at the start (LBP)', 'الصندوق عند البدء (ل.ل)')) + '</span><input class="input" id="s-ol" inputmode="numeric" value="' + esc(st.opening_lbp || 0) + '"></label></div>';
  h += '<button class="btn pri block" style="margin-top:14px" onclick="saveSettings()">' + esc(t('Save', 'حفظ')) + '</button></div></div>';
  h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('The building', 'البناية')) + '</h2></div><div class="card pad">';
  h += switchRow('base_cur_usd', setting('base_cur') === 'USD', t('Keep the books in dollars', 'الحسابات بالدولار'), t('Bills entered in LBP are converted at your dollar rate when saved. Totals show in $ only.', 'الفواتير بالليرة تُحوَّل بسعر الدولار عند الحفظ، والمجاميع بالدولار فقط.'));
  h += switchRow('elevator', !!st.elevator, t('Has an elevator', 'فيها مصعد'), t('Shown on the building picture, going up and down', 'يظهر في صورة البناية صاعداً ونازلاً'));
  h += '</div></div>';
  h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('What residents see', 'ما يراه السكان')) + '</h2></div><div class="card pad">';
  h += switchRow('books_public', st.books_public !== false, t('The building\'s books', 'حسابات البناية'), t('Money in, money out and the safe, on every resident\'s page', 'المقبوض والمصروف والصندوق في صفحة كل ساكن'));
  h += switchRow('show_who_paid', !!st.show_who_paid, t('Who has paid', 'من سدّد'), t('Light up neighbours\' windows on their page. Off keeps it private.', 'إظهار شبابيك الجيران المضاءة. الإيقاف يبقيها خاصة.'));
  h += '</div></div>';
  h += '<div class="sec"><div class="sec-h"><h2>' + esc(t('Data', 'البيانات')) + '</h2></div><div class="card list">';
  h += '<button class="li" onclick="openSheet(\'layout\',{})"><div class="ic">🏢</div><div class="grow"><b>' + esc(t('Floors & apartments', 'الطوابق والشقق')) + '</b><small>' + esc(layoutSummary(currentLayout())) + '</small></div><span class="chev">›</span></button>';
  h += '<button class="li" onclick="exportData()"><div class="ic">⬇︎</div><div class="grow"><b>' + esc(t('Download a copy', 'تنزيل نسخة')) + '</b><small>' + esc(t('Everything in this building, as a file', 'كل بيانات البناية في ملف')) + '</small></div></button>';
  h += '<button class="li" onclick="openSheet(\'server\')"><div class="ic">☁︎</div><div class="grow"><b>' + esc(t('Server', 'الخادم')) + '</b><small>' + esc(isCloud() ? t('Connected · syncing between phones', 'متصل · مزامنة بين الهواتف') : t('Not connected · this phone only', 'غير متصل · هذا الهاتف فقط')) + '</small></div><span class="chev">›</span></button>';
  h += '</div></div>';
  return h;
}
function switchRow(key, on, title, sub) {
  return '<div class="switch-row"><div><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></div><button class="sw' + (on ? ' on' : '') + '" onclick="toggleSetting(\'' + key + '\',' + !on + ')"></button></div>';
}
function toggleSetting(k, v) {
  var st = Object.assign({}, S.building.settings || {}); if (k === 'base_cur_usd') { k = 'base_cur'; v = v ? 'USD' : null; } st[k] = v;
  dbUpdate('buildings', S.building.id, { settings: st }).then(render, fail);
  S.building.settings = st; render();
}
function saveSettings() {
  var st = Object.assign({}, S.building.settings || {});
  st.rate = num(val('s-rate')) || 89500; st.opening_usd = num(val('s-ou')); st.opening_lbp = num(val('s-ol'));
  var patch = { name: val('s-name').trim() || S.building.name, name_ar: val('s-name-ar').trim() || null, settings: st };
  dbUpdate('buildings', S.building.id, patch).then(function() { Object.assign(S.building, patch); toast(t('Saved', 'تم الحفظ')); render(); }, fail);
}
function exportData() {
  var data = { exported_at: nowIso(), app: 'Binayati V15' };
  ['building', 'members', 'units', 'cycles', 'charges', 'payments', 'handovers', 'expenses', 'tasks', 'events'].forEach(function(k) { data[k] = S[k]; });
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'binayati-' + (S.building.name || 'building').replace(/\W+/g, '-').toLowerCase() + '-' + todayIso() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
}
SHEETS.server = function() {
  var c = cfg();
  var h = '<h3>' + esc(t('Server', 'الخادم')) + '</h3><p class="lead">' + esc(t('Connect a Supabase project so the building syncs between phones and residents can open their links.', 'اربط مشروع Supabase لتتزامن البناية بين الهواتف ويفتح السكان روابطهم.')) + '</p>';
  h += '<label class="field"><span>Project URL</span><input class="input" id="sv-url" value="' + esc(c.url) + '" placeholder="https://xxxx.supabase.co"></label>';
  h += '<label class="field"><span>' + esc(t('Publishable key', 'المفتاح العام')) + '</span><input class="input" id="sv-key" value="' + esc(c.key) + '" placeholder="sb_publishable_…"></label>';
  h += '<p class="hint">' + esc(t('Only the publishable (or anon) key. Never paste the secret or service_role key here.', 'المفتاح العام فقط. لا تضع المفتاح السري هنا.')) + '</p>';
  if (!isCloud() && localLoad().buildings.length) h += '<p class="hint">' + esc(t('Your building on this phone stays here. After connecting, set it up once on the server (it takes a minute).', 'بنايتك على هذا الهاتف تبقى هنا. بعد الربط أنشئها مرة على الخادم.')) + '</p>';
  h += '<div class="foot">';
  if (c.url) h += '<button class="btn danger" onclick="saveServer(true)">' + esc(t('Disconnect', 'فصل')) + '</button>';
  h += '<button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveServer()">' + esc(t('Connect', 'ربط')) + '</button></div>';
  return h;
};
function saveServer(off) {
  try {
    if (off) localStorage.removeItem('bny15_server');
    else {
      var url = val('sv-url').trim(), key = val('sv-key').trim();
      if (!/^https:\/\/.+/.test(url) || !key) return sheetErr(t('Enter both the URL and the key', 'أدخل الرابط والمفتاح'));
      if (/service_role|sb_secret_/.test(key)) return sheetErr(t('That is a secret key. Use the publishable one.', 'هذا مفتاح سري. استعمل العام.'));
      localStorage.setItem('bny15_server', JSON.stringify({ url: url, key: key }));
    }
  } catch (e) {}
  location.href = location.pathname;
}

/* ---------------- Menu and "+" ---------------- */
SHEETS.menu = function() {
  var h = '<h3>' + esc(bName()) + '</h3><p class="lead">' + esc(roleLabel(S.role) + (isCloud() ? ' · ' + t('synced', 'متزامن') : ' · ' + t('this phone only', 'هذا الهاتف فقط'))) + '</p><div class="card list menu">';
  h += '<button class="li" onclick="showOverview()"><div class="ic">🏢</div><div class="grow"><b>' + esc(t('All my buildings', 'كل بناياتي')) + '</b><small>' + esc(t('Summary of each, switch or add one', 'ملخص كل منها، بدّل أو أضف')) + '</small></div></button>';
  if (isCloud()) {}
  else {
    h += '<button class="li" onclick="closeSheet();startSetup()"><div class="ic">＋</div><div class="grow"><b>' + esc(t('Set up another building', 'أعدّ بناية أخرى')) + '</b></div></button>';
    var others = localLoad().buildings.filter(function(b) { return b.id !== S.building.id; });
    others.forEach(function(b) { h += '<button class="li" onclick="closeSheet();openLocalBuilding(' + jsArg(b.id) + ')"><div class="ic">🏢</div><div class="grow"><b>' + esc(b.name) + '</b></div></button>'; });
    var cols = S.members.filter(function(m) { return m.role !== 'manager'; });
    if (S.role !== 'manager') h += '<button class="li" onclick="viewAs(\'u-manager\')"><div class="ic">👁</div><div class="grow"><b>' + esc(t('Back to the manager view', 'عودة لعرض المدير')) + '</b></div></button>';
    else cols.forEach(function(m) { h += '<button class="li" onclick="viewAs(' + jsArg(m.user_id) + ')"><div class="ic">👁</div><div class="grow"><b>' + esc(t('See what ' + m.display_name + ' sees', 'شاهد ما يراه ' + m.display_name)) + '</b><small>' + esc(roleLabel(m.role)) + '</small></div></button>'; });
    var u0 = activeUnits()[0];
    if (u0 && isManager()) h += '<button class="li" onclick="location.href=' + jsArg('?r=' + u0.resident_token) + '"><div class="ic">👁</div><div class="grow"><b>' + esc(t('See a resident\'s page', 'شاهد صفحة ساكن')) + '</b><small>' + esc(u0.code) + '</small></div></button>';
  }
  if (isCloud() && typeof isDemo === 'function' && isDemo()) {
    var asMgr = S.role === 'manager';
    h += '<button class="li" onclick="demoSignIn(' + (asMgr ? '\'collector\'' : '\'manager\'') + ')"><div class="ic">⇄</div><div class="grow"><b>' + esc(asMgr ? t('Switch to the collector (Anas)', 'بدّل إلى الجابي (أنس)') : t('Switch to the manager (Rima)', 'بدّل إلى المدير (ريما)')) + '</b><small>' + esc(t('Demo: see the same building from the other side', 'تجربة: نفس البناية من الجهة الأخرى')) + '</small></div></button>';
    h += '<button class="li" onclick="demoReset()"><div class="ic">↺</div><div class="grow"><b>' + esc(t('Reset the demo data', 'أعد بيانات التجربة')) + '</b><small>' + esc(t('Back to the original sample', 'العودة للنموذج الأصلي')) + '</small></div></button>';
  }
  h += '<button class="li" onclick="closeSheet();setLang()"><div class="ic">ع</div><div class="grow"><b>' + esc(LANG === 'ar' ? 'English' : 'العربية') + '</b></div></button>';
  if (isManager()) h += '<button class="li" onclick="closeSheet();go(\'building\');UI.bsec=\'settings\';render()"><div class="ic">⚙️</div><div class="grow"><b>' + esc(t('Settings', 'الإعدادات')) + '</b></div></button>';
  if (isCloud()) h += '<button class="li" onclick="signOut()"><div class="ic">⎋</div><div class="grow"><b>' + esc(t('Sign out', 'تسجيل الخروج')) + '</b></div></button>';
  else h += '<button class="li" onclick="openSheet(\'server\')"><div class="ic">☁︎</div><div class="grow"><b>' + esc(t('Connect the server', 'اربط الخادم')) + '</b><small>' + esc(t('Sync between phones, resident links', 'مزامنة بين الهواتف، روابط السكان')) + '</small></div></button>';
  h += '</div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
  return h;
};
function viewAs(uid) {
  var db = localLoad(); db.persona = uid; localSave();
  UI.sheet = null; UI.tab = 'home';
  localLoadBuilding(S.building.id);
  if (!S.role) { showOverview(); return; }
  render();
  myBuildingList().then(function(l) { UI.multi = l.length > 1; render(); });
}
SHEETS.add = function() {
  var items = [];
  if (isManager()) {
    items.push(['pay', '↓', t('Record a payment', 'سجّل دفعة'), t('Any amount, oldest charges first', 'أي مبلغ، الأقدم أولاً')]);
    items.push(['expense', '↑', t('Money spent', 'مصروف'), t('Fuel, repairs, cleaning…', 'مازوت، تصليح، تنظيف…')]);
    if (aiReady()) items.splice(1, 0, ['scanpay', '📷', t('Read a transfer screenshot', 'اقرأ لقطة تحويل'), t('Whish, OMT, bank: fills the payment for you', 'Whish، OMT، بنك: تملأ الدفعة عنك')]);
    if (aiReady()) items.push(['scanexp', '🧾', t('Scan a receipt', 'امسح إيصالاً'), t('Photo of an invoice becomes an expense', 'صورة الفاتورة تصبح مصروفاً')]);
    items.push(['charge', '🧾', t('Add a charge', 'أضف رسماً'), t('A bill to split, a fee, a supplier service', 'فاتورة، رسم، خدمة مورّد')]);
    items.push(['month', '📅', t('Open the next month', 'افتح الشهر التالي'), t('Copies repeating charges for you to review', 'ينسخ الرسوم المتكررة لتراجعها')]);
    if (collectorsHolding().length) items.push(['handrecv', '⇄', t('Cash received from a collector', 'استلمت نقداً من الجابي'), t('Even if they didn\'t send a handover', 'حتى لو لم يرسل تسليماً')]);
    items.push(['project', '◆', t('New project', 'مشروع جديد'), t('Solar, elevator, painting…', 'طاقة شمسية، مصعد، دهان…')]);
    items.push(['task', '✅', t('Add a task', 'أضف مهمة'), t('Reminders that repeat', 'تذكيرات متكررة')]);
  } else {
    items.push(['pay', '↓', t('Record a payment', 'سجّل دفعة'), t('Someone paid part of their bill', 'دفع أحدهم جزءاً من فاتورته')]);
    items.push(['expense', '↑', t('I spent building cash', 'صرفت من مال البناية'), t('Comes off what you hand over', 'يُخصم مما تسلّمه')]);
    if (aiReady()) items.push(['scanexp', '🧾', t('Scan a receipt', 'امسح إيصالاً'), t('Take a photo, the form fills itself', 'صوّر والإستمارة تمتلئ')]);
    items.push(['handreq', '⇄', t('Hand over cash', 'سلّم النقد'), t('To the manager', 'للمدير')]);
  }
  var h = '<h3>' + esc(t('Add', 'إضافة')) + '</h3><div class="card list menu" style="margin-top:10px">';
  items.forEach(function(x) { h += '<button class="li" onclick="addPick(\'' + x[0] + '\')"><div class="ic">' + x[1] + '</div><div class="grow"><b>' + esc(x[2]) + '</b><small>' + esc(x[3]) + '</small></div></button>'; });
  return h + '</div>';
};
function addPick(k) {
  if (k === 'scanpay') { UI.sheet = { name: 'pay', data: {} }; render(); scanTransfer(); return; }
  if (k === 'scanexp') { UI.sheet = { name: 'expense', data: {} }; render(); scanReceipt(); return; }
  if (k === 'month') { UI.sheet = null; newMonth(); return; }
  if (k === 'charge') { var c = currentCycle(); if (!c) { toast(t('Open a month first', 'افتح شهراً أولاً')); return; } openSheet('charge', { cycle: c.id }); return; }
  openSheet(k, {});
}


/* ---------------- Building layout: fix floors after setup ---------------- */
var LAYOUT_CODE = /^(SS\d+|\d+)[A-H]?$/;
function currentLayout(block) {
  var floors = 0, under = 0, per = 1, by = {};
  activeUnits().filter(function(u) { return block == null || blockOf(u) === block; }).forEach(function(u) {
    var lv = unitLevel(u.code);
    if (lv == null || lv === 0) return;
    if (lv > 0) floors = Math.max(floors, lv); else under = Math.max(under, -lv);
    by[lv] = (by[lv] || 0) + 1;
    per = Math.max(per, by[lv]);
  });
  return { floors: Math.max(1, floors), per: Math.min(6, per), under: Math.min(3, under) };
}
function layoutSummary(l) {
  return t(l.floors + ' floors × ' + l.per + (l.under ? ' · ' + l.under + ' underground' : ''), l.floors + ' طوابق × ' + l.per + (l.under ? ' · ' + l.under + ' سفلية' : ''));
}
function layoutPlan(l, block) {
  block = block || '';
  var target = layoutCodes(l.floors, l.per, l.under), want = {};
  target.forEach(function(c) { want[c] = 1; });
  var byCode = {};
  S.units.forEach(function(u) { if (blockOf(u) === block) byCode[String(u.code).toUpperCase()] = u; });
  var add = [], revive = [], drop = [];
  target.forEach(function(c) { var u = byCode[c]; if (!u) add.push(c); else if (u.active === false) revive.push(u); });
  activeUnits().forEach(function(u) { var c = String(u.code).toUpperCase(); if (blockOf(u) === block && LAYOUT_CODE.test(c) && !want[c]) drop.push(u); });
  return { target: target, add: add, revive: revive, drop: drop };
}
SHEETS.layout = function(d) {
  var bl = blocks();
  if (bl.length > 1 && d.block == null) d.block = bl[0];
  if (!d.l) d.l = currentLayout(bl.length > 1 ? d.block : null);
  var l = d.l, plan = layoutPlan(l, bl.length > 1 ? d.block : '');
  var h = '<h3>' + esc(t('Floors & apartments', 'الطوابق والشقق')) + '</h3>';
  h += '<div class="chips" style="padding:4px 0 8px;flex-wrap:wrap">';
  bl.forEach(function(b) { h += '<button class="chip' + (d.block === b ? ' on' : '') + '" onclick="UI.sheet.data={block:' + jsArg(b) + '};render()">' + esc(blockLabel(b)) + '</button>'; });
  h += '<button class="chip" onclick="addBlock()">＋ ' + esc(bl.length > 1 ? t('Another block', 'بلوك آخر') : t('This is a compound with blocks', 'هذا مجمّع ببلوكات')) + '</button></div>';
  h += '<p class="lead">' + esc(t('Fix the building if setup got it wrong. Apartments you renamed yourself are left alone.', 'صحّح البناية إذا أخطأ الإعداد. الشقق التي سمّيتها بنفسك لا تتغير.')) + '</p>';
  h += '<div class="ob-stage" style="height:190px;padding:0">' + obScene(plan.target.length, plan.target, d.block ? (S.building.name + ' ' + d.block).slice(0, 12) : S.building.name, false) + '</div>';
  [['floors', t('Floors', 'الطوابق'), 1, 12], ['per', t('Apartments per floor', 'شقق في الطابق'), 1, 6], ['under', t('Underground floors', 'طوابق سفلية'), 0, 3]].forEach(function(x) {
    h += '<div class="ob-step"><div><b>' + esc(x[1]) + '</b></div><div class="stepper"><button onclick="layoutBump(\'' + x[0] + '\',-1,' + x[2] + ',' + x[3] + ')">−</button><span>' + l[x[0]] + '</span><button onclick="layoutBump(\'' + x[0] + '\',1,' + x[2] + ',' + x[3] + ')">+</button></div></div>';
  });
  var lines = [];
  if (plan.add.length) lines.push(t('Adds ', 'يضيف ') + plan.add.join(', '));
  if (plan.revive.length) lines.push(t('Brings back ', 'يعيد ') + plan.revive.map(function(u) { return u.code; }).join(', '));
  if (plan.drop.length) {
    var paid = plan.drop.filter(function(u) { return S.payments.some(function(p) { return p.unit_id === u.id && !p.voided_at; }); });
    lines.push(t('Removes ', 'يحذف ') + plan.drop.map(function(u) { return u.code; }).join(', ') + (paid.length ? t(' (those with payments are kept as inactive)', ' (التي لها دفعات تبقى غير فعّالة)') : ''));
  }
  h += '<div class="card pad" style="margin-top:8px;font-size:13.5px">' + (lines.length ? lines.map(function(x) { return '<div style="padding:3px 0">' + esc(x) + '</div>'; }).join('') : '<span class="muted">' + esc(t('No change', 'لا تغيير')) + '</span>') + '</div>';
  h += '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" ' + (lines.length ? '' : 'disabled ') + 'onclick="applyLayout()">' + esc(t('Apply', 'تطبيق')) + '</button></div>';
  return h;
};
function layoutBump(k, dlt, min, max) {
  var l = UI.sheet.data.l, was = l[k];
  l[k] = Math.max(min, Math.min(max, was + dlt));
  if ((l.floors + l.under) * l.per > 60) l[k] = was;
  render();
}
function applyLayout() {
  var blk = blocks().length > 1 ? UI.sheet.data.block : '';
  var plan = layoutPlan(UI.sheet.data.l, blk), ops = Promise.resolve();
  var base = S.units.length;
  var rows = plan.add.map(function(c, i) { return { code: c, name: '', sort: base + i, weight: 1, lang: 'both', active: true, resident_token: token(), block: blk || null }; });
  if (rows.length) ops = ops.then(function() { return dbInsertMany('units', rows); });
  plan.revive.forEach(function(u) { ops = ops.then(function() { return dbUpdate('units', u.id, { active: true }); }); });
  plan.drop.forEach(function(u) {
    var used = S.payments.some(function(p) { return p.unit_id === u.id; });
    ops = ops.then(function() { return used ? dbUpdate('units', u.id, { active: false }) : dbDelete('units', u.id); });
  });
  // keep the list in building order: underground first, then floor by floor
  ops.then(function() {
    var all = S.units.slice().sort(function(a, b) {
      if (blockOf(a) !== blockOf(b)) return blockOf(a).localeCompare(blockOf(b));
      var la = unitLevel(a.code), lb = unitLevel(b.code);
      if (la == null) la = 99; if (lb == null) lb = 99;
      return la - lb || String(a.code).localeCompare(String(b.code), 'en', { numeric: true });
    });
    var p2 = Promise.resolve();
    all.forEach(function(u, i) { if (u.sort !== i) p2 = p2.then(function() { return dbUpdate('units', u.id, { sort: i }); }); });
    return p2;
  }).then(function() { closeSheet(); toast(t('Building updated', 'تم تحديث البناية')); }, function(e) { sheetErr(e.message); });
}

/* Turn the building into a compound with blocks, or add one more block. */
function addBlock() {
  var bl = blocks(), letters = 'ABCDEFGHIJ';
  var ops = Promise.resolve();
  if (bl.length < 2) {
    var first = bl[0] || 'A';
    activeUnits().forEach(function(u) { if (!blockOf(u)) ops = ops.then(function() { return dbUpdate('units', u.id, { block: first }); }); });
    bl = [first];
  }
  var next = '';
  for (var i = 0; i < letters.length; i++) if (bl.indexOf(letters.charAt(i)) < 0) { next = letters.charAt(i); break; }
  var name = prompt(t('Name of the new block', 'اسم البلوك الجديد'), next);
  if (!name) return;
  name = name.trim().toUpperCase().slice(0, 12);
  if (bl.indexOf(name) >= 0) { toast(t('That block exists already', 'هذا البلوك موجود')); return; }
  var l = currentLayout(bl[0]), base = S.units.length;
  var rows = layoutCodes(l.floors, l.per, l.under).map(function(c, i) { return { code: c, name: '', sort: base + i, weight: 1, lang: 'both', active: true, resident_token: token(), block: name }; });
  ops.then(function() { return dbInsertMany('units', rows); }).then(function() {
    UI.sheet = { name: 'layout', data: { block: name } }; render();
    toast(t('Block ' + name + ' added with ' + rows.length + ' apartments. Adjust its floors here.', 'أُضيف البلوك ' + name + ' مع ' + rows.length + ' شقق. عدّل طوابقه هنا.'));
  }, fail);
}

/* Edit a person's name in both languages (yourself, or anyone if you manage). */
SHEETS.memberName = function(d) {
  var m = member(d.uid);
  if (!m) return '';
  var h = '<h3>' + esc(t('Name', 'الاسم')) + '</h3><p class="lead">' + esc(t('Used in messages and receipts, in each resident\'s language.', 'يُستعمل في الرسائل والإيصالات بلغة كل ساكن.')) + '</p>';
  h += '<label class="field"><span>' + esc(t('In English', 'بالإنكليزية')) + '</span><input class="input" id="mn-en" dir="ltr" data-tr="mn-ar" data-tr-kind="name" value="' + esc(m.display_name || '') + '"><div class="tr-box" id="trs-mn-en"></div></label>';
  h += '<label class="field"><span>' + esc(t('In Arabic', 'بالعربية')) + '</span><input class="input" id="mn-ar" dir="rtl" data-tr="mn-en" data-tr-kind="name" value="' + esc(m.display_name_ar || '') + '"><div class="tr-box" id="trs-mn-ar"></div></label>';
  h += '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveMemberName(' + jsArg(d.uid) + ')">' + esc(t('Save', 'حفظ')) + '</button></div>';
  return h;
};
function saveMemberName(uid) {
  var en = val('mn-en').trim(), ar = val('mn-ar').trim();
  var m = member(uid);
  var p;
  if (!isCloud()) { p = dbUpdate('members', m.id, { display_name: en || m.display_name, display_name_ar: ar || null }); }
  else if (uid === S.me.id) p = rpc('set_my_name', { p_building: S.building.id, p_name: en, p_name_ar: ar });
  else p = cloudCall(SB.from('members').update({ display_name: en || m.display_name, display_name_ar: ar || null }).eq('building_id', S.building.id).eq('user_id', uid).select());
  p.then(function() { m.display_name = en || m.display_name; m.display_name_ar = ar || null; closeSheet(); toast(t('Saved', 'تم الحفظ')); if (isCloud()) reloadBuilding(); }, function(e) { sheetErr(e.message); });
}

