/* ============================================================================
   Reminders that sound like a person: tone picked from the apartment's history,
   written in the resident's language, always with the exact amounts.
   ============================================================================ */
var TONE_INFO = {
  gentle: ['Gentle nudge', 'تذكير لطيف'], warm: ['Warm, regular payer', 'ودّي لمن يدفع دائماً'],
  firm: ['Firm, months behind', 'حازم، أشهر متأخرة'], thanks: ['Thank you', 'شكر']
};
function unitHistory(u, cyc) {
  var months = monthCycles().filter(function(c) { return c.published !== false && cyc && c.period < cyc.period; }).slice(0, 6);
  var paid = 0, behind = 0;
  months.forEach(function(c) {
    var r = unitCycle(u, c);
    if (!r.any) return;
    if (r.state === 'paid') paid++; else behind++;
  });
  return { checked: months.length, paid: paid, behind: behind };
}
function suggestTone(u, cyc) {
  var r = unitCycle(u, cyc);
  if (pairUsd(r.allLeft) < 0.005) return 'thanks';
  var h = unitHistory(u, cyc);
  if (h.behind >= 2) return 'firm';
  if (h.paid >= 3 && h.behind === 0) return 'warm';
  return 'gentle';
}
/* The short standard message: one line of facts, plus the link. */
function waTextShort(u, cyc, lang) {
  var r = unitCycle(u, cyc), b = unitBalance(u, cyc), owes = pairUsd(r.allLeft) > 0.005;
  function one(lg) {
    var T = function(en, ar) { return lg === 'ar' ? ar : en; };
    var name = (lg === 'ar' ? (u.name_ar || u.name) : u.name || '').split(/\s+/)[0];
    var hi = T('Hi', 'مرحباً') + (name ? ' ' + name : '') + ' (' + u.code + ')';
    var s = owes
      ? hi + ' 👋 ' + cycleTitle(cyc, lg) + ': *' + fmtPair(r.allLeft) + '* ' + T('still open', 'متبقي') + (pairUsd(b.arrears) > 0.005 ? T(' (+ ' + fmtPair(b.arrears) + ' earlier)', ' (+ ' + fmtPair(b.arrears) + ' سابقاً)') : '') + '.' + (collectors().length ? T(' You can hand it to ' + collectorLabel('en') + '.', ' يمكنك تسليمه إلى ' + collectorLabel('ar') + '.') : '')
      : hi + ' ✅ ' + T('Received in full for ', 'تم استلام كامل ') + cycleTitle(cyc, lg) + T('. Thank you!', '. شكراً!');
    return s;
  }
  lang = lang || u.lang || 'both';
  var txt = lang === 'both' ? one('ar') + '\n\n' + one('en') : one(lang);
  if (u.resident_token) txt += '\n\n' + residentLink(u);
  return txt;
}
function digitsAscii(s) { return String(s).replace(/[٠-٩]/g, function(d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[٬،]/g, ','); }

SHEETS.remind = function(d) {
  var u = byId(S.units, d.u), cyc = byId(S.cycles, d.cyc) || currentCycle();
  if (!u || !cyc) return '';
  if (!d.tone) d.tone = suggestTone(u, cyc);
  if (!d.len) d.len = 'long';
  if (d.text == null) d.text = d.len === 'long' ? waText(u, cyc) : waTextShort(u, cyc);
  var h = '<h3>' + esc(t('Message to ', 'رسالة إلى ') + u.code + (unitName(u) ? ' · ' + unitName(u) : '')) + '</h3>';
  var hist = unitHistory(u, cyc);
  h += '<p class="lead">' + esc(hist.checked ? t((hist.checked === 1 ? 'Last month' : 'Last ' + hist.checked + ' months') + ': paid ' + hist.paid + ', still open ' + hist.behind + '.', (hist.checked === 1 ? 'الشهر الماضي' : 'آخر ' + hist.checked + ' أشهر') + ': سدد ' + hist.paid + '، متأخر ' + hist.behind + '.') : t('No earlier months yet.', 'لا أشهر سابقة بعد.')) + '</p>';
  // Collectors send the plain detailed bill. The manager can step in with a written message,
  // offered straight away when the apartment is behind (a running due).
  var behind = hist.behind > 0 || pairUsd(unitBalance(u, cyc).arrears) > 0.005;
  var pro = isManager() && (behind || d.pro || d.ai);
  if (isManager() && !pro) h += '<button class="btn sec block" style="margin-bottom:8px" onclick="UI.sheet.data.text=val(\'rm-text\');UI.sheet.data.pro=true;render()">✨ ' + esc(t('Write a personal message instead', 'اكتب رسالة شخصية بدلاً منها')) + '</button>';
  if (pro) {
  h += '<div class="chips" style="padding:0 0 8px;flex-wrap:wrap">';
  Object.keys(TONE_INFO).forEach(function(k) {
    h += '<button class="chip' + (d.tone === k ? ' on' : '') + '" onclick="UI.sheet.data.text=val(\'rm-text\');UI.sheet.data.tone=\'' + k + '\';render()">' + esc(LANG === 'ar' ? TONE_INFO[k][1] : TONE_INFO[k][0]) + (k === suggestTone(u, cyc) ? ' ★' : '') + '</button>';
  });
  h += '</div>';
  h += '<div class="seg" style="margin-bottom:8px"><button class="' + (d.len === 'long' ? 'on' : '') + '" onclick="UI.sheet.data.len=\'long\';UI.sheet.data.text=null;UI.sheet.data.ai=false;UI.sheet.data.scan=null;render()">' + esc(t('Detailed', 'مفصّلة')) + '</button><button class="' + (d.len === 'short' ? 'on' : '') + '" onclick="UI.sheet.data.len=\'short\';UI.sheet.data.text=null;UI.sheet.data.ai=false;UI.sheet.data.scan=null;render()">' + esc(t('Short', 'قصيرة')) + '</button></div>';
  if (aiReady()) h += '<button class="btn sec block" onclick="aiReminder()">✨ ' + esc(d.ai ? t('Write it again', 'أعد الكتابة') : t('Write it in this tone', 'اكتبها بهذه النبرة')) + '</button>';
  }
  h += scanStatus(d);
  h += '<label class="field"><span>' + esc(t('Message (you can edit it)', 'الرسالة (يمكنك تعديلها)')) + '</span><textarea class="input" id="rm-text" dir="auto" style="min-height:' + (d.len === 'long' ? 220 : 140) + 'px;font-size:15px">' + esc(d.text) + '</textarea></label>';
  h += '<div id="sheet-err" class="err"></div><div class="foot"><button class="btn sec" onclick="UI.sheet.data.text=null;UI.sheet.data.ai=false;UI.sheet.data.scan=null;render()">' + '↺ ' + esc(t('Reset message', 'إعادة الرسالة')) + '</button>';
  h += u.phone ? '<button class="btn wa" onclick="sendReminder()">' + esc(t('Send on WhatsApp', 'أرسل على واتساب')) + '</button>' : '<button class="btn sec" onclick="copyText(val(\'rm-text\'))">' + esc(t('Copy (no phone saved)', 'نسخ (لا رقم محفوظ)')) + '</button>';
  return h + '</div>';
};
function aiReminder() {
  var d = UI.sheet.data, u = byId(S.units, d.u), cyc = byId(S.cycles, d.cyc) || currentCycle();
  var r = unitCycle(u, cyc), b = unitBalance(u, cyc), hist = unitHistory(u, cyc);
  var lang = u.lang || 'both';
  var lines = r.cells.map(function(x) { return (lang === 'ar' ? (x.ch.title_ar || x.ch.title) : x.ch.title) + kwhNote(x.ch, u) + ': ' + fmt(x.c.due, x.ch.cur) + (x.c.state === 'paid' ? ' (paid)' : ''); });
  var left = fmtPair(r.allLeft);
  var body = { tone: d.tone, lang: lang, length: d.len === 'long' ? 'long' : 'short', building: lang === 'ar' ? (S.building.name_ar || S.building.name) : S.building.name, unit: u.code,
               name: lang === 'ar' ? (u.name_ar || u.name) : u.name, month: cycleTitle(cyc, lang === 'ar' ? 'ar' : 'en'), items: lines,
               left: d.tone === 'thanks' ? '' : left, arrears: pairUsd(b.arrears) > 0.005 ? fmtPair(b.arrears) : '', monthsBehind: hist.behind,
               payTo: collectors().length ? (lang === 'ar' ? collectorLabel('ar') : lang === 'en' ? collectorLabel('en') : collectorLabel('ar') + ' / ' + collectorLabel('en')) : '', manager: memberName(S.me.id, lang === 'ar' ? 'ar' : 'en') };
  d.text = val('rm-text'); d.scan = 'reading'; render();
  SB.functions.invoke('write-reminder', { body: body }).then(function(res) {
    if (!UI.sheet || UI.sheet.data !== d) return;
    var txt = res && res.data && res.data.ok ? String(res.data.text).replace(/\\([$*_])/g, '$1') : '';
    // The figures must survive word for word, or we don't offer the text.
    var must = [d.tone === 'thanks' ? null : left].filter(Boolean);
    var plain = digitsAscii(txt).replace(/\s/g, '');
    var okFigures = must.every(function(m) { return (m.match(/[\d,.]+/g) || []).every(function(n) { return plain.indexOf(n) >= 0; }); });
    if (!txt || !okFigures) { d.scan = 'error'; d.scanErr = t('The AI version changed the amounts, so it was not used. The standard text is below.', 'النسخة المقترحة غيّرت المبالغ فلم تُستعمل. النص العادي أدناه.'); render(); return; }
    if (u.resident_token) txt += '\n\n' + (d.len === 'long' ? (lang === 'en' ? 'Your bill and receipts:' : lang === 'ar' ? 'فاتورتك وإيصالاتك:' : 'فاتورتك وإيصالاتك · Your bill and receipts:') + '\n' : '') + residentLink(u);
    d.text = txt; d.ai = true; d.scan = 'done';
    d.scanNote = t('Written by AI from your numbers. Read it before sending.', 'كتبها الذكاء الاصطناعي من أرقامك. اقرأها قبل الإرسال.');
    render();
  }, function() { d.scan = 'error'; d.scanErr = t('Couldn\'t write it now. The standard text is below.', 'تعذّرت الكتابة الآن. النص العادي أدناه.'); render(); });
}
function sendReminder() {
  var d = UI.sheet.data, u = byId(S.units, d.u);
  var digits = String(u.phone || '').replace(/\D/g, '');
  if (digits.length === 8 && digits.charAt(0) !== '9') digits = '961' + digits.replace(/^0/, '');
  if (digits.length === 7) digits = '961' + digits;
  window.open('https://wa.me/' + digits + '?text=' + encodeURIComponent(val('rm-text')), '_blank');
}
