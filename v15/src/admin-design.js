/* ============================================================================
   Natour admin: Design elements. Everything is drawn with the app's real
   stylesheet and scene code, so it can't drift from what people see. Colours
   are read from the stylesheet when the page opens. Trying a colour only
   changes this page; the app itself is never touched.
   ============================================================================ */
var DS = { tab: 'colours', dark: false, ar: false, edits: { light: {}, dark: {} } };
var DS_TABS = [['colours', 'Colours'], ['type', 'Type'], ['controls', 'Controls'], ['cards', 'Cards & lists'], ['status', 'Status'], ['scene', 'Building scene'], ['sheets', 'Sheets']];
var DS_GROUPS = [
  ['Surfaces', ['bg', 'bg2', 'card', 'card2', 'sheet']], ['Text', ['ink', 'mut', 'faint']], ['Lines', ['line']],
  ['Brand', ['acc', 'acc-ink', 'on-acc', 'soft']], ['Paid, good', ['ok', 'okbg']], ['Waiting, warning', ['warn', 'wbg']],
  ['Owed, danger', ['bad', 'badbg']], ['Information', ['info', 'infobg']]
];
/* Text on background pairs the app really uses. target 3 = large text or an icon, not body text. */
var DS_PAIRS = [
  ['ink', 'bg', 'Main text on the page', 4.5], ['ink', 'card', 'Main text on a card', 4.5], ['mut', 'bg', 'Quiet text on the page', 4.5], ['mut', 'card', 'Quiet text on a card', 4.5],
  ['faint', 'card', 'Arrows and faint icons', 3], ['on-acc', 'acc', 'Main button', 4.5], ['acc-ink', 'soft', 'Selected item', 4.5], ['acc-ink', 'card', 'Links and ghost buttons', 4.5],
  ['ok', 'okbg', 'Paid labels', 4.5], ['warn', 'wbg', 'Owes labels', 4.5], ['bad', 'badbg', 'Arrears and errors', 4.5], ['info', 'infobg', 'Partly paid labels', 4.5],
  ['#FFFFFF', 'ok', 'Green confirm button', 4.5], ['#FFFFFF', '#1FA855', 'WhatsApp button', 4.5], ['#FFFFFF', 'warn', 'Support bar, read-only', 4.5], ['#FFFFFF', 'bad', 'Support bar, full access', 4.5]
];
function dsDs(en, ar) { return DS.ar ? ar : en; }
function dsMode() { return DS.dark ? 'dark' : 'light'; }

/* ---------- Reading colours straight from the stylesheet ---------- */
var DS_TOKENS = null;
function dsTokens() {
  if (DS_TOKENS) return DS_TOKENS;
  var out = { light: {}, dark: {} };
  var read = function(text, into) { var m, re = /--([\w-]+):\s*([^;]+);/g; while ((m = re.exec(text))) into[m[1]] = m[2].trim(); };
  Array.prototype.forEach.call(document.styleSheets, function(sh) {
    var rules; try { rules = sh.cssRules; } catch (e) { return; }
    Array.prototype.forEach.call(rules || [], function(r) {
      if (r.selectorText === ':root') read(r.cssText, out.light);
      else if (r.selectorText === ':root[data-theme="dark"]') read(r.cssText, out.dark);
    });
  });
  DS_TOKENS = out;
  return out;
}
function dsValue(name, mode) { mode = mode || dsMode(); var e = DS.edits[mode]; return e[name] || dsTokens()[mode][name]; }
function dsStageVars() {
  var t0 = dsTokens()[dsMode()], s = '';
  Object.keys(t0).forEach(function(k) { s += '--' + k + ':' + dsValue(k) + ';'; });
  return s;
}
function dsHexOf(v) {
  if (!v) return null;
  v = String(v).trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toUpperCase();
  return null;
}
function dsLum(hex) {
  var c = [1, 3, 5].map(function(i) { return parseInt(hex.substr(i, 2), 16) / 255; }).map(function(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function dsRatio(a, b) { var x = dsLum(a), y = dsLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function dsResolve(n) { return n.charAt(0) === '#' ? n : dsHexOf(dsValue(n)); }
function dsPairResults() {
  return DS_PAIRS.map(function(p) {
    var fg = dsResolve(p[0]), bg = dsResolve(p[1]), r = fg && bg ? dsRatio(fg, bg) : 0;
    return { fg: fg, bg: bg, ratio: r, label: p[2], target: p[3], grade: r >= p[3] ? 'ok' : r >= 3 ? 'near' : 'low' };
  });
}

/* ---------- The page ---------- */
function dsPage() {
  var el = stdHost();
  var h = '<div class="std"><div class="desk-head"><h1>Design elements</h1></div>';
  h += '<p class="adm-sub">The real styles and drawings the app uses, in one place. Colours you try here stay on this page.</p>';
  h += '<div class="std-bar"><div class="seg std-seg">' + DS_TABS.map(function(x) { return '<button class="' + (DS.tab === x[0] ? 'on' : '') + '" onclick="DS.tab=\'' + x[0] + '\';dsPage()">' + x[1] + '</button>'; }).join('') + '</div>';
  h += '<div class="seg std-seg"><button class="' + (!DS.dark ? 'on' : '') + '" onclick="DS.dark=false;dsPage()">Light</button><button class="' + (DS.dark ? 'on' : '') + '" onclick="DS.dark=true;dsPage()">Dark</button></div>';
  h += '<div class="seg std-seg"><button class="' + (!DS.ar ? 'on' : '') + '" onclick="DS.ar=false;dsPage()">English</button><button class="' + (DS.ar ? 'on' : '') + '" onclick="DS.ar=true;dsPage()">Arabic</button></div></div>';
  if (DS.tab === 'sheets') {
    h += dsSheets() + '</div>';
    el.innerHTML = h; el.scrollTop = 0; stdWatchFrames(el);
    return;
  }
  stdStopLoading();
  var body = DS.tab === 'type' ? dsType() : DS.tab === 'controls' ? dsControls() : DS.tab === 'cards' ? dsCards() : DS.tab === 'status' ? dsStatus() : DS.tab === 'scene' ? dsScene() : dsColours();
  h += '<div id="ds-stage" class="ds-stage" dir="' + (DS.ar ? 'rtl' : 'ltr') + '" lang="' + (DS.ar ? 'ar' : 'en') + '" style="' + esc(dsStageVars()) + '">' + body + '</div></div>';
  el.innerHTML = h; el.scrollTop = 0;
  if (DS.tab === 'type') dsTypeMeasure();
}
function dsSection(title, sub, body) {
  return '<section class="ds-sec"><h2>' + esc(title) + '</h2>' + (sub ? '<p class="ds-sub">' + esc(sub) + '</p>' : '') + body + '</section>';
}
function dsItem(name, html, wide) { return '<div class="ds-item' + (wide ? ' wide' : '') + '"><div class="ds-show">' + html + '</div><code>' + esc(name) + '</code></div>'; }
function dsGrid(items) { return '<div class="ds-grid">' + items.join('') + '</div>'; }

/* ---------- Colours ---------- */
function dsUsage() {
  var n = {};
  Array.prototype.forEach.call(document.styleSheets, function(sh) {
    var text = ''; try { Array.prototype.forEach.call(sh.cssRules, function(r) { text += r.cssText; }); } catch (e) { return; }
    var m, re = /var\(--([\w-]+)/g; while ((m = re.exec(text))) n[m[1]] = (n[m[1]] || 0) + 1;
  });
  return n;
}
function dsSwatch(name, used) {
  var v = dsValue(name), hex = dsHexOf(v), edited = DS.edits[dsMode()][name];
  return '<label class="ds-swatch"><span class="ds-chip" id="ds-chip-' + name + '" style="background:' + esc(v) + '">' + (hex ? '<input type="color" value="' + hex + '" aria-label="Try a colour for ' + name + '" oninput="dsTry(\'' + name + '\',this.value)" onchange="dsPage()">' : '') + '</span><b>--' + esc(name) + (edited ? ' <span class="pill-st st-custom">Trying</span>' : '') + '</b><small>' + esc(v) + (used ? ' · used ' + used + '×' : '') + '</small></label>';
}
function dsTry(name, value) {
  DS.edits[dsMode()][name] = value;
  var st = document.getElementById('ds-stage'); if (st) st.style.setProperty('--' + name, value);
  var c = document.getElementById('ds-chip-' + name); if (c) c.style.background = value;
}
function dsColours() {
  var used = dsUsage(), mode = dsMode(), edits = DS.edits[mode], changed = Object.keys(edits);
  var h = '';
  if (changed.length) {
    h += '<div class="banner info ds-edits"><div class="grow"><b>Trying ' + changed.length + ' colour' + (changed.length > 1 ? 's' : '') + ' in ' + mode + ' mode</b>Only on this page. The other tabs here show it too, except the live Sheets. Copy the values and send them to me to make it real.</div><button class="btn sec sm" onclick="dsCopy()">Copy</button><button class="btn ghost sm" onclick="dsReset()">Reset</button></div>';
  }
  var res = dsPairResults(), low = res.filter(function(r) { return r.grade !== 'ok'; });
  var groups = DS_GROUPS.map(function(g) {
    return '<div class="ds-group"><h3>' + g[0] + '</h3><div class="ds-swatches">' + g[1].map(function(k) { return dsSwatch(k, used[k]); }).join('') + '</div></div>';
  }).join('');
  h += dsSection('Colours', 'Click a colour to try another one. Values come straight from the app\'s stylesheet.', groups);
  h += dsSection('Readable contrast · ' + mode, low.length ? low.length + ' of ' + res.length + ' fall short of the usual target: 4.5 for small text, 3 for large text and icons.' : 'All ' + res.length + ' meet the usual target: 4.5 for small text, 3 for large text and icons.',
    '<div class="ds-pairs">' + res.map(function(r) {
      var gr = r.grade === 'ok' ? ['live', 'Clear'] : r.grade === 'near' ? ['idea', 'Hard to read when small'] : ['off', 'Too faint'];
      return '<div class="ds-pair"><span class="ds-aa" style="background:' + r.bg + ';color:' + r.fg + '">Aa</span><div class="grow"><b>' + esc(r.label) + '</b><small>' + r.ratio.toFixed(2) + ' to 1 · needs ' + r.target + '</small></div><span class="pill-st st-' + gr[0] + '">' + gr[1] + '</span></div>';
    }).join('') + '</div>');
  return h;
}
function dsCopy() {
  var mode = dsMode(), e = DS.edits[mode];
  copyText(mode + ' mode:\n' + Object.keys(e).map(function(k) { return '--' + k + ': ' + e[k] + ';  (was ' + dsTokens()[mode][k] + ')'; }).join('\n'));
}
function dsReset() { DS.edits[dsMode()] = {}; dsPage(); }

/* ---------- Type ---------- */
function dsType() {
  var en = 'The building fee is due', ar = 'رسم البناية مستحق', tx = dsDs(en, ar);
  var rows = [
    ['Page title (laptop)', '<div class="desk-head" style="margin:0"><h1 style="margin:0">' + tx + '</h1></div>', '.desk-head h1'],
    ['Screen title', '<h2 class="h-title">' + tx + '</h2>', '.h-title'],
    ['Sheet title', '<div class="sheet ds-inline"><h3>' + tx + '</h3></div>', '.sheet h3'],
    ['Big money', '<div class="tile" style="padding:0"><div class="val">$480</div></div>', '.tile .val'],
    ['Card title', '<div class="month-top"><b>' + tx + '</b></div>', '.month-top b'],
    ['Section heading', '<div class="sec-h" style="margin:0"><h2>' + tx + '</h2></div>', '.sec-h h2'],
    ['Body', '<div>' + tx + '</div>', 'body'],
    ['Apartment name', '<div class="uname">' + tx + '</div>', '.uname'],
    ['Quiet detail', '<div class="umeta">' + tx + '</div>', '.umeta'],
    ['Hint', '<p class="hint" style="margin:0">' + tx + '</p>', '.hint'],
    ['Label', '<span class="status none">' + tx + '</span>', '.status']
  ];
  var h = dsSection('Typefaces', '', '<div class="ds-faces"><div><b style="font-family:\'Plus Jakarta Sans\',sans-serif">Plus Jakarta Sans</b><small>Latin text and numbers</small></div><div><b style="font-family:\'IBM Plex Sans Arabic\',sans-serif">IBM Plex Sans Arabic · الخط العربي</b><small>Arabic text</small></div></div>');
  h += dsSection('Sizes', 'Measured from the page, so these are what people really see.', '<div class="ds-type">' + rows.map(function(r) {
    return '<div class="ds-type-row"><div class="ds-type-l"><b>' + esc(r[0]) + '</b><small class="ds-measure">…</small><code>' + esc(r[2]) + '</code></div><div class="ds-type-s">' + r[1] + '</div></div>';
  }).join('') + '</div>');
  return h;
}
function dsTypeMeasure() {
  document.querySelectorAll('.ds-type-row').forEach(function(row) {
    var host = row.querySelector('.ds-type-s'), el = host, best = host;
    while (el && el.firstElementChild) { el = el.firstElementChild; best = el; }
    var cs = getComputedStyle(best), m = row.querySelector('.ds-measure');
    if (m) m.textContent = Math.round(parseFloat(cs.fontSize) * 10) / 10 + 'px · weight ' + cs.fontWeight;
  });
}

/* ---------- Controls ---------- */
function dsControls() {
  var save = dsDs('Save', 'حفظ'), cancel = dsDs('Cancel', 'إلغاء');
  var h = dsSection('Buttons', '', dsGrid([
    dsItem('.btn.pri', '<button class="btn pri">' + save + '</button>'), dsItem('.btn.sec', '<button class="btn sec">' + cancel + '</button>'),
    dsItem('.btn.ghost', '<button class="btn ghost">' + dsDs('Show more', 'المزيد') + '</button>'), dsItem('.btn.ok', '<button class="btn ok">' + dsDs('Received', 'استلمت') + '</button>'),
    dsItem('.btn.danger', '<button class="btn danger">' + dsDs('Remove', 'حذف') + '</button>'), dsItem('.btn.wa', '<button class="btn wa">WhatsApp</button>'),
    dsItem('.btn.pri.sm', '<button class="btn pri sm">' + save + '</button>'), dsItem('.btn.sec.sm', '<button class="btn sec sm">' + cancel + '</button>'),
    dsItem('.btn[disabled]', '<button class="btn pri" disabled>' + save + '</button>'), dsItem('.btn.pri.block', '<button class="btn pri block">' + save + '</button>', true),
    dsItem('.iconbtn', '<button class="iconbtn">ع</button>'), dsItem('.dock .fab', '<div class="dock ds-dock"><button class="fab">+</button></div>')
  ]));
  h += dsSection('Choosing', '', dsGrid([
    dsItem('.seg', '<div class="seg"><button class="on">' + dsDs('Cash', 'نقداً') + '</button><button>' + dsDs('Transfer', 'تحويل') + '</button></div>', true),
    dsItem('.chips .chip', '<div class="chips" style="padding:0"><button class="chip on">' + dsDs('All', 'الكل') + '</button><button class="chip">' + dsDs('Owe', 'لم يسددوا') + '</button><button class="chip">' + dsDs('Paid', 'سددوا') + '</button></div>', true),
    dsItem('.sw.on', '<button class="sw on" aria-label="On"></button>'), dsItem('.sw', '<button class="sw" aria-label="Off"></button>'),
    dsItem('.check', '<button class="check" aria-label="Not done"></button>'), dsItem('.check.on', '<button class="check on" aria-label="Done">✓</button>'),
    dsItem('.stepper', '<div class="stepper"><button>−</button><span>4</span><button>+</button></div>'),
    dsItem('.switch-row', '<div class="switch-row" style="border:0;padding:0"><div><b>' + dsDs('Show who paid', 'أظهر من دفع') + '</b><small>' + dsDs('Residents can see it', 'يراه السكان') + '</small></div><button class="sw on" aria-label="On"></button></div>', true),
    dsItem('.choice.on', '<button class="choice on"><span class="ic">💵</span><span class="grow"><b>' + dsDs('Door to door', 'من باب إلى باب') + '</b></span></button>', true)
  ]));
  h += dsSection('Typing', '', dsGrid([
    dsItem('.field .input', '<label class="field" style="margin:0"><span>' + dsDs('Name', 'الاسم') + '</span><input class="input" value="' + dsDs('Nadia Khoury', 'ناديا خوري') + '"></label>', true),
    dsItem('placeholder', '<input class="input" placeholder="' + dsDs('e.g. October cash', 'مثلاً نقد تشرين الأول') + '">', true),
    dsItem('select.input', '<select class="input"><option>2A · ' + dsDs('Hadi Mansour', 'هادي منصور') + '</option></select>', true),
    dsItem('.money-in', '<div class="money-in"><input class="input" value="20"><div class="seg"><button class="on">USD</button><button>LBP</button></div></div>', true),
    dsItem('textarea.input', '<textarea class="input" rows="2">' + dsDs('A short note', 'ملاحظة قصيرة') + '</textarea>', true),
    dsItem('.hint', '<p class="hint" style="margin:0">' + dsDs('Any amount. It pays the oldest charges first.', 'أي مبلغ. يغطي الرسوم الأقدم أولاً.') + '</p>', true),
    dsItem('.err', '<div class="err">' + dsDs('Enter an amount', 'أدخل المبلغ') + '</div>', true)
  ]));
  return h;
}

/* ---------- Cards and lists ---------- */
function dsCards() {
  var row = function(ic, cls, a, b) { return '<div class="li"><div class="ic' + cls + '">' + ic + '</div><div class="grow"><b>' + a + '</b><small>' + b + '</small></div><span class="chev">' + (DS.ar ? '‹' : '›') + '</span></div>'; };
  var h = dsSection('Lists', '', dsGrid([
    dsItem('.card.list .li', '<div class="card list">' + row('🏠', '', dsDs('Apartments', 'الشقق'), dsDs('8 apartments', '8 شقق')) + row('↓', ' in', dsDs('Payment', 'دفعة'), '$20') + row('↑', ' out', dsDs('Diesel', 'مازوت'), '$110') + row('⇄', ' move', dsDs('Handover', 'تسليم'), '$155') + '</div>', true),
    dsItem('.card.unit', '<div class="card unit settled"><div class="unit-h"><div class="ucode">1A</div><div class="grow"><div class="uname">' + dsDs('Ahmad El-Khatib', 'أحمد الخطيب') + '</div><div class="umeta">' + dsDs('Maintenance', 'الصيانة') + '</div></div><span class="status paid">' + dsDs('Paid', 'مسدد') + '</span></div><div class="ticks"><button class="tick paid"><b>✓ ' + dsDs('Maintenance', 'الصيانة') + '</b><span>$20</span></button><button class="tick pocket"><b>✓ ' + dsDs('Water', 'المياه') + '</b><span>1,250,000 LBP</span></button></div></div>', true),
    dsItem('.card.unit (owes)', '<div class="card unit"><div class="unit-h"><div class="ucode">2A</div><div class="grow"><div class="uname">' + dsDs('Hadi Mansour', 'هادي منصور') + '</div><div class="umeta">' + dsDs('Two charges', 'رسمان') + '</div></div><span class="status owes">$20</span></div><div class="ticks"><button class="tick"><b>' + dsDs('Maintenance', 'الصيانة') + '</b><span>$20</span></button><button class="tick part"><b>' + dsDs('Water', 'المياه') + '</b><span>' + dsDs('part paid', 'جزئي') + '</span></button></div><div class="arrears">' + dsDs('Earlier months: $40', 'أشهر سابقة: $40') + '</div></div>', true),
    dsItem('.task', '<div class="task"><button class="check" aria-label="Done"></button><div class="grow"><b>' + dsDs('Clean water tanks', 'تنظيف خزانات المياه') + '</b><small>' + dsDs('19 Nov · Collector', '19 تشرين الثاني · الجابي') + '</small></div></div>', true)
  ]));
  h += dsSection('Money', '', dsGrid([
    dsItem('.tile', '<div class="card tile"><div class="lbl"><i class="dot" style="background:var(--ok)"></i>' + dsDs('In the safe', 'في الصندوق') + '</div><div class="val">$480<small>+ 19,250,000 LBP</small></div><div class="sub">' + dsDs('Cash the building holds', 'نقد البناية') + '</div></div>'),
    dsItem('.tile.alert', '<div class="card tile alert"><div class="lbl">' + dsDs('With Anas', 'مع أنس') + '</div><div class="val">$155</div><div class="sub">' + dsDs('Not handed over', 'لم يُسلّم') + '</div></div>'),
    dsItem('.card.month .bar', '<div class="card month"><div class="month-top"><b>' + dsDs('November 2026', 'تشرين الثاني 2026') + '</b><span>' + dsDs('4 of 8 paid · 50%', '4 من 8 سددوا · 50%') + '</span></div><div class="bar"><i class="paid" style="width:25%"></i><i class="pocket" style="width:25%"></i></div><div class="legend"><span><i style="background:var(--ok)"></i>' + dsDs('Collected', 'محصّل') + '</span><span><i style="background:var(--warn)"></i>' + dsDs('Not handed over', 'لم يُسلّم') + '</span></div></div>', true),
    dsItem('.kv .bill-total', '<div class="card pad"><div class="kv"><span>' + dsDs('Maintenance', 'الصيانة') + '</span><b>$20</b></div><div class="kv"><span>' + dsDs('Water bill', 'فاتورة المياه') + '</span><b>1,250,000 LBP</b></div><div class="bill-total"><span>' + dsDs('Left to pay', 'المتبقي') + '</span><span>$20</span></div></div>', true),
    dsItem('.desk-tile', '<div class="desk-tile"><small>' + dsDs('Collected', 'المحصّل') + '</small><b>$80</b><span>50%</span></div>'),
    dsItem('.desk-t', deskTable([dsDs('Apartment', 'الشقة'), dsDs('Name', 'الاسم'), dsDs('Left', 'المتبقي')], [['1A', dsDs('Ahmad', 'أحمد'), '$0'], ['2A', dsDs('Hadi', 'هادي'), '$20']], [2]), true)
  ]));
  h += dsSection('Empty and waiting', '', dsGrid([
    dsItem('.empty', '<div class="empty">' + dsDs('Nothing yet', 'لا شيء بعد') + '</div>'), dsItem('.spin', '<span class="spin"></span>'), dsItem('.daylbl', '<div class="daylbl">' + dsDs('5 November', '5 تشرين الثاني') + '</div>')
  ]));
  return h;
}

/* ---------- Status ---------- */
function dsStatus() {
  var h = dsSection('Labels', 'Colour never works alone here: every label also says what it means.', dsGrid([
    dsItem('.status.paid', '<span class="status paid">' + dsDs('Paid', 'مسدد') + '</span>'), dsItem('.status.owes', '<span class="status owes">' + dsDs('Owes $20', 'عليه $20') + '</span>'),
    dsItem('.status.part', '<span class="status part">' + dsDs('Part paid', 'جزئي') + '</span>'), dsItem('.status.none', '<span class="status none">' + dsDs('Nothing due', 'لا شيء') + '</span>'),
    dsItem('.dcell.ok', '<span class="dcell ok">✓ $20</span>'), dsItem('.dcell.part', '<span class="dcell part">$10</span>'), dsItem('.dcell.due', '<span class="dcell due">$20</span>'),
    dsItem('.pill-st.st-live', '<span class="pill-st st-live">Live</span>'), dsItem('.pill-st.st-beta', '<span class="pill-st st-beta">Beta</span>'), dsItem('.pill-st.st-idea', '<span class="pill-st st-idea">Idea</span>'), dsItem('.pill-st.st-off', '<span class="pill-st st-off">Off</span>'),
    dsItem('.receipt-stamp', '<span class="receipt-stamp">' + dsDs('Paid', 'مسدد') + '</span>')
  ]));
  h += dsSection('Messages', '', dsGrid([
    dsItem('.banner.warn', '<div class="banner warn"><div class="grow"><b>' + dsDs('Anas handed over $155', 'أنس سلّم $155') + '</b>' + dsDs('Confirm when you get it.', 'أكّد عند الاستلام.') + '</div></div>', true),
    dsItem('.banner.info', '<div class="banner info"><div class="grow"><b>' + dsDs('A draft month', 'شهر مسودة') + '</b>' + dsDs('Residents can\'t see it yet.', 'لا يراه السكان بعد.') + '</div></div>', true),
    dsItem('.banner.ok', '<div class="banner ok"><div class="grow"><b>' + dsDs('All paid', 'الكل سدّد') + '</b>' + dsDs('Nothing left this month.', 'لا شيء متبقٍ هذا الشهر.') + '</div></div>', true),
    dsItem('.toast', '<div class="toast pop ds-static">' + dsDs('Saved', 'تم الحفظ') + '</div>'),
    dsItem('.support-bar', '<div class="support-bar ds-static"><b>Support view · read-only</b><span>Block C</span><button>Exit</button></div>', true),
    dsItem('.support-bar.full', '<div class="support-bar full ds-static"><b>Support · full access</b><span>Block C</span><button>Exit</button></div>', true),
    dsItem('.sync', '<span class="row"><span class="sync live"></span><span class="sync busy"></span><span class="sync off"></span><span class="sync"></span></span>')
  ]));
  return h;
}

/* ---------- The building scene, drawn by its real code ---------- */
function dsPhase(key) {
  return { day: { key: 'day', label: 'Afternoon', chip: 'Afternoon', sunX: 240, sunY: 50 }, dusk: { key: 'dusk', label: 'Sunset', chip: 'Sunset', sunX: 320, sunY: 135 }, night: { key: 'night', label: 'Night', chip: 'Night', sunX: 240, sunY: 50 } }[key];
}
var DS_SCENE_N = 0;
function dsDraw(o) {
  var floors = o.floors || 4, per = o.per || 2, paid = o.paid == null ? 0.5 : o.paid, under = o.under || 0, total = (floors + under) * per, wins = [], levels = [], n = 0;
  for (var i = 0; i < total; i++) wins.push({ state: i < Math.round(total * paid) ? 'paid' : 'owes' });
  for (var lv = -under; lv <= floors; lv++) { if (lv === 0) continue; levels.push({ lv: lv, wins: wins.slice(n, n + per) }); n += per; }
  var html = buildBuildingScene({ phase: dsPhase(o.phase || 'day'), wins: wins, levels: levels, interactive: o.cat !== false, idp: 'ds' + (++DS_SCENE_N), signText: o.sign || (DS.ar ? 'البلوك C' : 'BLOCK C'),
    safe: o.safe ? { split: true, usdH: 16, lbpH: 10 } : null, elevator: !!o.elevator, coreGlow: !!o.glow, solar: o.solar });
  return '<div class="hero-wrap ds-scene">' + html + '</div>';
}
function dsScene() {
  var t3 = [['day', 'Day'], ['dusk', 'Sunrise and sunset'], ['night', 'Night']], p3 = [[0, 'Nobody paid'], [0.5, 'Half paid'], [1, 'Everyone paid']];
  var grid = [];
  t3.forEach(function(ph) { p3.forEach(function(p) { grid.push(dsItem(ph[1] + ' · ' + p[1], dsDraw({ phase: ph[0], paid: p[0], safe: true }))); }); });
  var h = dsSection('Time of day and payments', 'Lit windows have paid. The scene follows the real clock in the app.', '<div class="ds-grid ds-scenes">' + grid.join('') + '</div>');
  h += dsSection('Building sizes', 'The drawing adapts to the building\'s real shape.', '<div class="ds-grid ds-scenes">' + [
    dsItem('2 floors, 1 per floor', dsDraw({ floors: 2, per: 1 })), dsItem('4 floors, 2 per floor', dsDraw({})), dsItem('5 floors, 4 per floor', dsDraw({ floors: 5, per: 4 })),
    dsItem('8 floors, a tower', dsDraw({ floors: 8, per: 2 })), dsItem('14 floors, 3 per floor', dsDraw({ floors: 14, per: 3 })), dsItem('4 floors and 2 underground', dsDraw({ floors: 4, per: 2, under: 2 }))
  ].join('') + '</div>');
  h += dsSection('Extras', '', '<div class="ds-grid ds-scenes">' + [
    dsItem('With the safe', dsDraw({ safe: true })), dsItem('With an elevator', dsDraw({ elevator: true })), dsItem('A task is due (core glows)', dsDraw({ glow: true, phase: 'night' })), dsItem('Without the cat', dsDraw({ cat: false }))
  ].join('') + '</div>');
  return h;
}

/* ---------- Every pop-up sheet, live ---------- */
function dsSheets() {
  var dev = STD_DEVICES.filter(function(d) { return d.id === 'ip'; })[0], c = { lang: DS.ar ? 'ar' : 'en', theme: DS.dark ? 'dark' : 'light' };
  var list = PV_SCREENS.filter(function(s) { return s.sheet; });
  return '<p class="adm-sub" style="margin-top:0">' + list.length + ' pop-up sheets, live in the real app. The server connection sheet and the admin\'s own sheets aren\'t shown.</p><div class="std-wall">' +
    list.map(function(s) { return stdFrameHtml(s, dev, c, { cap: PV_ROLES[s.role] + ' · ' + s.l, zoom: 0.5 }); }).join('') + '</div>';
}
