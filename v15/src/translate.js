/* ============================================================================
   Suggested translations: type English, get the Arabic proposed (and back).
   1) Ready-made lists and a dictionary of Lebanese names: instant, offline.
   2) Otherwise the "translate" function on the server (AI, key kept there).
   A suggestion only fills the field when tapped.
   ============================================================================ */
var NAME_DICT = {
  // first names
  ahmad: 'أحمد', ahmed: 'أحمد', mohammad: 'محمد', mohamad: 'محمد', mohamed: 'محمد', muhammad: 'محمد', ali: 'علي', hassan: 'حسن', hussein: 'حسين',
  hussain: 'حسين', omar: 'عمر', khaled: 'خالد', khalil: 'خليل', karim: 'كريم', kareem: 'كريم', rami: 'رامي', ramy: 'رامي', samir: 'سمير', sami: 'سامي',
  ziad: 'زياد', ziyad: 'زياد', hadi: 'هادي', fadi: 'فادي', rabih: 'ربيع', walid: 'وليد', nabil: 'نبيل', jamil: 'جميل', georges: 'جورج', george: 'جورج',
  elie: 'إيلي', eli: 'إيلي', joseph: 'جوزيف', youssef: 'يوسف', yousef: 'يوسف', joe: 'جو', tony: 'طوني', antoine: 'أنطوان', charbel: 'شربل',
  michel: 'ميشال', pierre: 'بيار', paul: 'بول', marc: 'مارك', jad: 'جاد', ralph: 'رالف', carl: 'كارل', charles: 'شارل', nicolas: 'نيكولا',
  maroun: 'مارون', fouad: 'فؤاد', fuad: 'فؤاد', nader: 'نادر', bilal: 'بلال', anas: 'أنس', tarek: 'طارق', tarik: 'طارق', wassim: 'وسيم', wael: 'وائل',
  issam: 'عصام', imad: 'عماد', emad: 'عماد', bassam: 'بسام', hisham: 'هشام', majed: 'ماجد', maher: 'ماهر', mazen: 'مازن', nizar: 'نزار',
  raed: 'رائد', ghassan: 'غسان', salim: 'سليم', selim: 'سليم', toufic: 'توفيق', tawfik: 'توفيق', abbas: 'عباس', mahmoud: 'محمود', mustafa: 'مصطفى',
  moustafa: 'مصطفى', ibrahim: 'إبراهيم', ismail: 'إسماعيل', jihad: 'جهاد', kamal: 'كمال', abu: 'أبو', abou: 'أبو', um: 'أم', oum: 'أم',
  nadia: 'ناديا', nada: 'ندى', rania: 'رانيا', lina: 'لينا', rima: 'ريما', reem: 'ريم', maya: 'مايا', mira: 'ميرا', layla: 'ليلى', leila: 'ليلى',
  zeina: 'زينة', zaina: 'زينة', hiba: 'هبة', fatima: 'فاطمة', fatmeh: 'فاطمة', zahra: 'زهراء', mariam: 'مريم', maryam: 'مريم', sara: 'سارة',
  sarah: 'سارة', nour: 'نور', noor: 'نور', joelle: 'جويل', rita: 'ريتا', carla: 'كارلا', christine: 'كريستين', nancy: 'نانسي', hala: 'هالة',
  dana: 'دانا', tanya: 'تانيا', tania: 'تانيا', samar: 'سمر', amal: 'أمل', hanan: 'حنان', souad: 'سعاد', ghada: 'غادة', mona: 'منى', muna: 'منى',
  yasmine: 'ياسمين', yasmin: 'ياسمين', lara: 'لارا', nathalie: 'ناتالي', josephine: 'جوزفين', georgette: 'جورجيت', therese: 'تريز',
  // family names
  khoury: 'خوري', khouri: 'خوري', haddad: 'حداد', hallal: 'حلال', halal: 'حلال', khatib: 'الخطيب', 'el-khatib': 'الخطيب', mansour: 'منصور',
  salameh: 'سلامة', salame: 'سلامة', nasser: 'ناصر', saab: 'صعب', farah: 'فرح', haidar: 'حيدر', haydar: 'حيدر', hamdan: 'حمدان', hammoud: 'حمود',
  khalife: 'خليفة', khalifeh: 'خليفة', karam: 'كرم', aoun: 'عون', gemayel: 'الجميل', frangieh: 'فرنجية', geagea: 'جعجع', sfeir: 'صفير',
  chamoun: 'شمعون', chehab: 'شهاب', shehab: 'شهاب', harb: 'حرب', abboud: 'عبود', azar: 'عازار', bou: 'بو', 'abi': 'أبي', daou: 'ضو', diab: 'دياب',
  fakhoury: 'فاخوري', ghanem: 'غانم', habib: 'حبيب', hajj: 'الحاج', 'el-hajj': 'الحاج', hachem: 'هاشم', hashem: 'هاشم', issa: 'عيسى', jaber: 'جابر',
  kassem: 'قاسم', qassem: 'قاسم', makdessi: 'المقدسي', moussa: 'موسى', nassar: 'نصار', rizk: 'رزق', saade: 'سعادة', saadeh: 'سعادة', sleiman: 'سليمان',
  suleiman: 'سليمان', tannous: 'طنوس', younes: 'يونس', yammine: 'يمين', zein: 'الزين', 'el-zein': 'الزين', chahine: 'شاهين', shahine: 'شاهين',
  daher: 'ضاهر', hayek: 'الحايك', 'el-hayek': 'الحايك', ayoub: 'أيوب', baz: 'الباز', kanaan: 'كنعان', maalouf: 'معلوف', matar: 'مطر', nakhle: 'نخلة',
  nehme: 'نعمة', obeid: 'عبيد', rahme: 'رحمة', sabbagh: 'الصباغ', salem: 'سالم', srour: 'سرور', tabbara: 'طبارة', wehbe: 'وهبة', zoghbi: 'الزغبي',
  'el-hassan': 'الحسن', husseini: 'الحسيني', berri: 'بري', hariri: 'الحريري', mikati: 'ميقاتي', karami: 'كرامي', jumblatt: 'جنبلاط', arslan: 'أرسلان',
  osman: 'عثمان', othman: 'عثمان', itani: 'عيتاني', beydoun: 'بيضون', fawaz: 'فواز', merhi: 'مرعي', mrad: 'مراد', murad: 'مراد', hamieh: 'حمية',
  dagher: 'داغر', nassif: 'ناصيف', tabet: 'ثابت', ziadeh: 'زيادة', abdallah: 'عبدالله', abdullah: 'عبدالله'
};

/* Instant answer from the lists, or null. */
function localTranslate(text, kind, to) {
  var s = String(text || '').trim();
  if (!s) return null;
  if (to === 'ar') {
    var low = s.toLowerCase().replace(/\s+/g, ' ');
    var lists = [].concat(CHARGE_PRESETS.fixed, CHARGE_PRESETS.due, CHARGE_PRESETS.service, TASK_PRESETS, EXPENSE_PRESETS);
    for (var i = 0; i < lists.length; i++) if (lists[i].en.toLowerCase() === low) return lists[i].ar;
    if (kind === 'name') {
      var parts = low.split(/\s+/), out = [];
      for (var j = 0; j < parts.length; j++) {
        var w = parts[j], hit = NAME_DICT[w];
        if (!hit && /^(el|al)-/.test(w) && NAME_DICT[w.slice(3)]) hit = 'ال' + NAME_DICT[w.slice(3)].replace(/^ال/, '');
        if (!hit) return null;
        out.push(hit);
      }
      return out.join(' ');
    }
  } else {
    var lists2 = [].concat(CHARGE_PRESETS.fixed, CHARGE_PRESETS.due, CHARGE_PRESETS.service, TASK_PRESETS, EXPENSE_PRESETS);
    for (var k = 0; k < lists2.length; k++) if (lists2[k].ar === s) return lists2[k].en;
  }
  return null;
}

var TR_CACHE = {};
function serverTranslate(text, kind, to) {
  var key = kind + '|' + to + '|' + text;
  if (TR_CACHE[key] !== undefined) return Promise.resolve(TR_CACHE[key]);
  if (!isCloud()) return Promise.resolve(null);
  return SB.functions.invoke('translate', { body: { text: text, kind: kind, to: to } }).then(function(r) {
    var out = r && !r.error && r.data && r.data.text ? r.data.text : null;
    if (out && out.trim().toLowerCase() === text.trim().toLowerCase()) out = null;
    TR_CACHE[key] = out;
    return out;
  }, function() { return null; });
}

/* Wiring: an input with data-tr="otherId" data-tr-kind="name|phrase" proposes text for #otherId.
   The suggestion appears under #otherId, in a div with id "trs-otherId". */
var _trT = {};
function trInput(el) {
  var dst = el.getAttribute('data-tr'), kind = el.getAttribute('data-tr-kind') || 'phrase';
  var target = document.getElementById(dst), box = document.getElementById('trs-' + dst);
  if (!target || !box) return;
  var src = el.value.trim();
  var arabicSrc = /[؀-ۿ]/.test(src);
  // The pair can go either way: English field → Arabic field, or the reverse.
  var to = target.getAttribute('dir') === 'rtl' ? 'ar' : 'en';
  if (!src || (to === 'ar' && arabicSrc) || (to === 'en' && !arabicSrc)) { box.innerHTML = ''; return; }
  if (target.value.trim() && target.getAttribute('data-tr-auto') !== String(target.value)) { box.innerHTML = ''; return; }
  var quick = localTranslate(src, kind, to);
  if (quick) { showTr(box, dst, quick); return; }
  clearTimeout(_trT[dst]);
  if (!isCloud()) { box.innerHTML = ''; return; }
  box.innerHTML = '<span class="tr-wait">' + esc(t('Suggesting…', 'جارٍ الاقتراح…')) + '</span>';
  _trT[dst] = setTimeout(function() {
    serverTranslate(src, kind, to).then(function(out) {
      if (el.value.trim() !== src) return;
      if (out) showTr(box, dst, out); else box.innerHTML = '';
    });
  }, 650);
}
function showTr(box, dst, text) {
  box.innerHTML = '<button type="button" class="tr-chip" onclick="useTr(' + jsArg(dst) + ',' + jsArg(text) + ')"><span>' + esc(t('Use', 'استعمل')) + '</span> <b dir="auto">' + esc(text) + '</b></button>';
}
function useTr(dst, text) {
  var el = document.getElementById(dst);
  if (!el) return;
  el.value = text;
  el.setAttribute('data-tr-auto', text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  var box = document.getElementById('trs-' + dst); if (box) box.innerHTML = '';
}
document.addEventListener('input', function(e) {
  if (e.target && e.target.getAttribute && e.target.getAttribute('data-tr')) trInput(e.target);
});
/* After a re-render, show a suggestion again for fields that already have text. */
function trRefresh() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-tr]'), function(el) { if (el.value.trim()) trInput(el); });
}

/* Mark a pair of fields: English input id a, Arabic input id b. */
function trPairHtml() {}
