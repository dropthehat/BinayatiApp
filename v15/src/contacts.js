/* ============================================================================
   Building contacts: the call sheet. Elevator company, plumber, cleaning
   company, emergencies. One tap to call or WhatsApp. Managers edit; the
   collector and residents see the ones marked for them.
   ============================================================================ */
var CONTACT_CATS_CODE = [
  ['emergency', '🚨', 'Emergency', 'طوارئ'], ['elevator', '🛗', 'Elevator company', 'شركة المصعد'], ['generator', '⚡', 'Generator / moteur', 'المولد / الموتور'],
  ['plumber', '🔧', 'Plumber', 'سنكري'], ['electrician', '💡', 'Electrician', 'كهربائي'], ['water', '💧', 'Water & tanker', 'المياه والصهريج'],
  ['cleaning', '🧹', 'Cleaning company', 'شركة التنظيف'], ['trash', '🗑', 'Trash collection', 'جمع النفايات'], ['internet', '📶', 'Internet & dish', 'الإنترنت والدش'],
  ['security', '🔐', 'Security & locks', 'الأمن والأقفال'], ['municipality', '🏛', 'Municipality', 'البلدية'], ['other', '📇', 'Other', 'أخرى']
];
function contactCats() {
  var rows = (CFG.lists || []).filter(function(r) { return r.kind === 'contact_cat' && !r.hidden; }).sort(function(a, b) { return a.sort - b.sort; });
  return rows.length ? rows.map(function(r) { return [r.key, r.icon || '📇', r.en, r.ar || r.en]; }) : CONTACT_CATS_CODE;
}
function contactCat(k) { var all = contactCats().concat(CONTACT_CATS_CODE); return all.filter(function(c) { return c[0] === k; })[0] || CONTACT_CATS_CODE[CONTACT_CATS_CODE.length - 1]; }
function intlDigits(p) {
  var d = String(p || '').replace(/\D/g, '');
  if (d.indexOf('00') === 0) d = d.slice(2);
  if (d.length === 8 && d.charAt(0) === '0') d = '961' + d.slice(1);
  else if ((d.length === 7 || d.length === 8) && d.indexOf('961') !== 0) d = '961' + d;
  return d;
}
function contactsList() {
  var mine = S.myBlocks;
  return (S.contacts || []).filter(function(c) { return !c.block || !mine || mine.indexOf(c.block) >= 0; })
    .sort(function(a, b) { return (b.emergency ? 1 : 0) - (a.emergency ? 1 : 0) || (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name)); });
}
function contactRow(c, editable) {
  var cat = contactCat(c.cat), nm = LANG === 'ar' ? (c.name_ar || c.name) : c.name;
  var h = '<div class="li contact"><div class="ic' + (c.emergency ? ' sos' : '') + '">' + esc(cat[1]) + '</div><div class="grow"' + (editable ? ' style="cursor:pointer" onclick="openSheet(\'contactEdit\',{id:' + jsArg(c.id) + '})"' : '') + '><b>' + esc(nm) + '</b><small>' + esc([LANG === 'ar' ? cat[3] : cat[2], c.note || '', c.block && blocks().length > 1 ? blockLabel(c.block) : ''].filter(Boolean).join(' · ')) + '</small></div>';
  if (c.phone) h += '<a class="cbtn" href="tel:' + esc(String(c.phone).replace(/[^\d+]/g, '')) + '" aria-label="' + esc(t('Call', 'اتصال')) + '">📞</a><a class="cbtn wa" target="_blank" rel="noopener" href="https://wa.me/' + esc(intlDigits(c.phone)) + '" aria-label="WhatsApp">💬</a>';
  return h + '</div>';
}

/* Building → Contacts (managers edit here) */
function renderContactsSec() {
  var list = contactsList(), mgr = isManager() && !(S.support && !S.supportFull);
  var h = '<div class="sec"><div class="sec-h"><h2>' + esc(t('Contacts', 'جهات الاتصال')) + '</h2>' + (mgr ? '<button onclick="openSheet(\'contactEdit\',{})">＋ ' + esc(t('Add', 'إضافة')) + '</button>' : '') + '</div>';
  if (!list.length) {
    h += '<div class="card pad"><b>' + esc(t('Your building\'s call sheet', 'دليل اتصال بنايتك')) + '</b><p class="muted">' + esc(t('Add the elevator company, plumber, electrician, cleaning company and emergency numbers. Your collector and residents can call them in one tap.', 'أضف شركة المصعد والسنكري والكهربائي وشركة التنظيف وأرقام الطوارئ. الجابي والسكان يتصلون بلمسة.')) + '</p>' + (mgr ? '<button class="btn pri" onclick="openSheet(\'contactEdit\',{})">' + esc(t('Add the first contact', 'أضف أول جهة اتصال')) + '</button>' : '') + '</div>';
  } else {
    h += '<div class="card list">';
    list.forEach(function(c) { h += contactRow(c, mgr); });
    h += '</div><p class="hint">' + esc(t('🚨 Emergency contacts show first, and on Home. Residents see the ones you share with them on their page.', '🚨 أرقام الطوارئ تظهر أولاً وفي الرئيسية. السكان يرون ما تشاركه معهم في صفحتهم.')) + '</p>';
  }
  return h + '</div>';
}
/* Anyone in the building: the full list in a sheet */
SHEETS.contacts = function() {
  var list = contactsList();
  var h = '<h3>' + esc(t('Building contacts', 'جهات اتصال البناية')) + '</h3>';
  h += list.length ? '<div class="card list">' + list.map(function(c) { return contactRow(c, false); }).join('') + '</div>' : '<p class="muted">' + esc(t('No contacts yet.', 'لا جهات اتصال بعد.')) + '</p>';
  return h + '<div class="foot"><button class="btn sec" onclick="closeSheet()">' + esc(t('Close', 'إغلاق')) + '</button></div>';
};
/* Home: emergency numbers at hand, and a way to the rest */
function renderContactsCard() {
  if (!feature('contacts')) return '';
  var list = contactsList();
  if (!list.length) return '';
  var sos = list.filter(function(c) { return c.emergency && c.phone; }).slice(0, 3);
  var h = '<div class="sec"><div class="card list">';
  sos.forEach(function(c) { h += contactRow(c, false); });
  h += '<button class="li" onclick="openSheet(\'contacts\')"><div class="ic">📇</div><div class="grow"><b>' + esc(t('Building contacts', 'جهات اتصال البناية')) + '</b><small>' + esc(t(list.length + ' numbers: elevator, plumber, cleaning…', list.length + ' أرقام: المصعد، السنكري، التنظيف…')) + '</small></div><span class="chev">›</span></button>';
  return h + '</div></div>';
}
SHEETS.contactEdit = function(d) {
  var c = d.id ? byId(S.contacts || [], d.id) : null;
  var v = c || { cat: d.cat || 'elevator', name: '', name_ar: '', phone: '', phone2: '', note: '', emergency: false, show_residents: true, block: null };
  if (d.cat === undefined) d.cat = v.cat;
  if (d.emergency === undefined) d.emergency = !!v.emergency;
  if (d.show === undefined) d.show = v.show_residents !== false;
  var h = '<h3>' + esc(c ? (LANG === 'ar' ? (c.name_ar || c.name) : c.name) : t('New contact', 'جهة اتصال جديدة')) + '</h3>';
  h += '<div class="chips" style="flex-wrap:wrap;padding:2px 0 6px">';
  contactCats().forEach(function(k) { h += '<button type="button" class="chip' + (d.cat === k[0] ? ' on' : '') + '" onclick="keepContact();UI.sheet.data.cat=' + jsArg(k[0]) + ';if(UI.sheet.data.cat===\'emergency\')UI.sheet.data.emergency=true;render()">' + esc(k[1] + ' ' + (LANG === 'ar' ? k[3] : k[2])) + '</button>'; });
  h += '</div>';
  h += '<label class="field"><span>' + esc(t('Name or company', 'الاسم أو الشركة')) + '</span><input class="input" id="ct-name" data-tr="ct-name-ar" data-tr-kind="name" value="' + esc(d.name != null ? d.name : v.name) + '" placeholder="' + esc(t('e.g. Otis Lebanon, Abou Ali', 'مثلاً أوتيس، أبو علي')) + '"' + (c ? '' : ' data-autofocus') + '><div class="tr-box" id="trs-ct-name"></div></label>';
  h += '<label class="field"><span>' + esc(t('In Arabic (optional)', 'بالعربية (اختياري)')) + '</span><input class="input" id="ct-name-ar" dir="rtl" data-tr="ct-name" data-tr-kind="name" value="' + esc(d.name_ar != null ? d.name_ar : (v.name_ar || '')) + '"><div class="tr-box" id="trs-ct-name-ar"></div></label>';
  h += '<div class="two"><label class="field"><span>' + esc(t('Phone', 'الهاتف')) + '</span><input class="input" id="ct-ph" type="tel" inputmode="tel" value="' + esc(d.phone != null ? d.phone : (v.phone || '')) + '" placeholder="03 123 456"></label>';
  h += '<label class="field"><span>' + esc(t('Second phone', 'هاتف ثانٍ')) + '</span><input class="input" id="ct-ph2" type="tel" inputmode="tel" value="' + esc(d.phone2 != null ? d.phone2 : (v.phone2 || '')) + '"></label></div>';
  h += '<label class="field"><span>' + esc(t('Note (optional)', 'ملاحظة (اختياري)')) + '</span><input class="input" id="ct-note" value="' + esc(d.note != null ? d.note : (v.note || '')) + '" placeholder="' + esc(t('e.g. contract no. 4417, 24/7 line', 'مثلاً عقد رقم 4417، خط 24/7')) + '"></label>';
  if (blocks().length > 1) {
    var cb = d.block !== undefined ? d.block : (v.block || '');
    h += '<label class="field"><span>' + esc(t('For', 'لـ')) + '</span><select class="input" id="ct-block" onchange="UI.sheet.data.block=this.value"><option value="">' + esc(t('Whole building', 'كل البناية')) + '</option>' + blocks().map(function(b) { return '<option value="' + esc(b) + '"' + (cb === b ? ' selected' : '') + '>' + esc(blockLabel(b)) + '</option>'; }).join('') + '</select></label>';
  }
  h += '<div class="switch-row"><div><b>🚨 ' + esc(t('Emergency', 'طوارئ')) + '</b><small>' + esc(t('Shown first, and on Home', 'يظهر أولاً وفي الرئيسية')) + '</small></div><button class="sw' + (d.emergency ? ' on' : '') + '" onclick="keepContact();UI.sheet.data.emergency=!UI.sheet.data.emergency;render()"></button></div>';
  h += '<div class="switch-row"><div><b>' + esc(t('Residents can see it', 'يراه السكان')) + '</b><small>' + esc(t('On their private page', 'في صفحتهم الخاصة')) + '</small></div><button class="sw' + (d.show ? ' on' : '') + '" onclick="keepContact();UI.sheet.data.show=!UI.sheet.data.show;render()"></button></div>';
  h += '<div id="sheet-err" class="err"></div><div class="foot">';
  if (c) h += '<button class="btn danger" onclick="deleteContact(' + jsArg(c.id) + ')">' + esc(t('Remove', 'حذف')) + '</button>';
  h += '<button class="btn sec" onclick="closeSheet()">' + esc(t('Cancel', 'إلغاء')) + '</button><button class="btn pri" onclick="saveContact(' + jsArg(c ? c.id : '') + ')">' + esc(t('Save', 'حفظ')) + '</button></div>';
  return h;
};
function keepContact() {
  var d = UI.sheet.data;
  [['ct-name', 'name'], ['ct-name-ar', 'name_ar'], ['ct-ph', 'phone'], ['ct-ph2', 'phone2'], ['ct-note', 'note']].forEach(function(x) { var el = document.getElementById(x[0]); if (el) d[x[1]] = el.value; });
  var b = document.getElementById('ct-block'); if (b) d.block = b.value;
}
function saveContact(id) {
  keepContact();
  var d = UI.sheet.data;
  var row = { cat: d.cat || 'other', name: (d.name || '').trim(), name_ar: (d.name_ar || '').trim() || null, phone: (d.phone || '').trim() || null, phone2: (d.phone2 || '').trim() || null,
              note: (d.note || '').trim() || null, emergency: !!d.emergency, show_residents: !!d.show, block: d.block || null };
  if (!row.name) return sheetErr(t('Give it a name', 'أعطه اسماً'));
  if (!row.phone) return sheetErr(t('Add a phone number', 'أضف رقم الهاتف'));
  if (!id) row.sort = (S.contacts || []).length;
  (id ? dbUpdate('contacts', id, row) : dbInsert('contacts', row)).then(function() { closeSheet(); toast(t('Saved', 'تم الحفظ')); }, function(e) { sheetErr(e.message); });
}
function deleteContact(id) {
  if (!confirm(t('Remove this contact?', 'حذف جهة الاتصال؟'))) return;
  dbDelete('contacts', id).then(function() { closeSheet(); }, fail);
}
/* Resident page: the contacts the manager shares with residents */
function loadResidentContacts(tok) {
  return rpc('resident_contacts', { p_token: tok }).then(function(list) { if (S.resident) { S.resident.contacts = list || []; render(); } }, function() {});
}
function renderResidentContacts() {
  var list = (S.resident && S.resident.contacts) || [];
  if (!list.length) return '';
  return '<div class="sec"><div class="sec-h"><h2>' + esc(t('Useful numbers', 'أرقام مفيدة')) + '</h2></div><div class="card list">' + list.map(function(c) { return contactRow(c, false); }).join('') + '</div></div>';
}
