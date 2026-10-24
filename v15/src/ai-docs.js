/* ============================================================================
   Photos in, forms filled: receipts → expenses, transfer screenshots → payments.
   The "read-doc" server function reads the image (AI key kept server-side).
   Nothing is saved until a person checks the form and taps Save.
   ============================================================================ */

/* Ask for an image (camera or gallery) and shrink it so uploads stay small. */
function pickImage(cb) {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = function() {
    var f = inp.files && inp.files[0];
    if (!f) return;
    shrinkImage(f, 1600, 0.8).then(cb, function() { toast(t('Couldn\'t open that image', 'تعذّر فتح الصورة')); });
  };
  inp.click();
}
function shrinkImage(file, max, q) {
  return new Promise(function(res, rej) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function() {
      var s = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      var dataUrl = c.toDataURL('image/jpeg', q);
      c.toBlob(function(blob) { res({ dataUrl: dataUrl, b64: dataUrl.split(',')[1], blob: blob }); }, 'image/jpeg', q);
    };
    img.onerror = rej;
    img.src = url;
  });
}
function aiReady() { return isCloud(); }
function readDoc(kind, b64, extra) {
  var body = Object.assign({ kind: kind, image: b64, mime: 'image/jpeg' }, extra || {});
  return SB.functions.invoke('read-doc', { body: body }).then(function(r) {
    if (r.error || !r.data || !r.data.ok) throw new Error(t('Couldn\'t read it. Fill it in by hand, or try a sharper photo.', 'تعذّرت القراءة. املأها يدوياً أو جرّب صورة أوضح.'));
    return r.data.fields || {};
  });
}
function uploadPhoto(blob) {
  if (!blob || !isCloud()) return Promise.resolve(null);
  var path = S.building.id + '/' + uuid() + '.jpg';
  return SB.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg', upsert: false }).then(function(r) {
    if (r.error) throw new Error(niceError(r.error));
    return path;
  });
}
var PHOTO_URLS = {};
function photoImg(path, cls) {
  if (!path) return '';
  var id = 'ph-' + path.replace(/[^a-z0-9]/gi, '').slice(-16);
  if (PHOTO_URLS[path]) return '<img id="' + id + '" class="' + (cls || 'doc-thumb') + '" src="' + esc(PHOTO_URLS[path]) + '" alt="" onclick="window.open(this.src)">';
  if (isCloud()) SB.storage.from('receipts').createSignedUrl(path, 3600).then(function(r) {
    if (r.data && r.data.signedUrl) { PHOTO_URLS[path] = r.data.signedUrl; var el = document.getElementById(id); if (el) el.src = r.data.signedUrl; }
  });
  return '<img id="' + id + '" class="' + (cls || 'doc-thumb') + '" alt="" onclick="if(this.src)window.open(this.src)">';
}
function scanStatus(d) {
  if (d.scan === 'reading') return '<div class="scan-state"><span class="spin"></span>' + esc(t('Reading the photo…', 'جارٍ قراءة الصورة…')) + '</div>';
  if (d.scan === 'done') return '<div class="scan-state ok">' + esc(d.scanNote || t('Filled in from the photo. Check the amount before saving.', 'مُلئت من الصورة. تحقق من المبلغ قبل الحفظ.')) + '</div>';
  if (d.scan === 'error') return '<div class="scan-state bad">' + esc(d.scanErr || '') + '</div>';
  return '';
}

/* ---------------- 1. Receipts → expenses ---------------- */
function scanBlockExpense(d, e) {
  var h = '<div class="scan-row">';
  if (d.photo) h += '<img class="doc-thumb" src="' + esc(d.photo) + '" alt="" onclick="window.open(this.src)">';
  else if (e && e.photo_path) h += photoImg(e.photo_path);
  if (!e) {
    h += aiReady()
      ? '<button class="btn sec sm grow scan-btn" onclick="scanReceipt()">📷 ' + esc(d.photo ? t('Scan another photo', 'صورة أخرى') : t('Scan the receipt', 'امسح الإيصال')) + '</button>'
      : '<div class="hint grow" style="margin:0">' + esc(t('Receipt scanning works once the app is connected to the server.', 'مسح الإيصالات يعمل عند ربط التطبيق بالخادم.')) + '</div>';
  }
  return h + '</div>' + scanStatus(d);
}
function scanReceipt() {
  keepExpense();
  pickImage(function(img) {
    var d = UI.sheet.data;
    d.photo = img.dataUrl; d.photoBlob = img.blob; d.scan = 'reading'; render();
    readDoc('receipt', img.b64, { cats: Object.keys(CATS).filter(function(k) { return k !== 'supplier'; }) }).then(function(f) {
      if (!UI.sheet || UI.sheet.data !== d) return;
      if (f.title || f.title_ar) d.title = f.title && f.title_ar ? (LANG === 'ar' ? f.title_ar + ' · ' + f.title : f.title + ' · ' + f.title_ar) : (f.title || f.title_ar);
      if (f.supplier && d.title && d.title.indexOf(f.supplier) < 0) d.title += ' (' + f.supplier + ')';
      if (f.amount) d.amount = f.amount;
      if (f.cur) d.cur = f.cur;
      if (f.cat && CATS[f.cat]) d.cat = f.cat;
      if (f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date) && f.date <= todayIso()) d.date = f.date;
      if (f.ref) d.ref = f.ref;
      d.scan = 'done';
      d.scanNote = f.confidence === 'low' ? t('Hard to read: check every field.', 'صعبة القراءة: تحقق من كل الحقول.') : null;
      render();
    }, function(err) { d.scan = 'error'; d.scanErr = err.message; render(); });
  });
}

/* ---------------- 2. Transfer screenshots → payments ---------------- */
function scanTransfer() {
  if (UI.sheet && UI.sheet.name === 'pay') keepPay();
  pickImage(function(img) {
    var d = (UI.sheet && UI.sheet.name === 'pay') ? UI.sheet.data : {};
    d.photo = img.dataUrl; d.photoBlob = img.blob; d.scan = 'reading';
    UI.sheet = { name: 'pay', data: d }; render();
    var units = activeUnits().map(function(u) { return { code: u.code + (blockOf(u) ? ' (' + blockOf(u) + ')' : ''), name: u.name, name_ar: u.name_ar, phone: u.phone }; });
    readDoc('transfer', img.b64, { units: units }).then(function(f) {
      if (!UI.sheet || UI.sheet.data !== d) return;
      var u = matchUnit(f);
      if (u) { d.unit = u.id; }
      if (f.amount) d.amount = f.amount;
      if (f.cur) d.cur = f.cur;
      var m = { Whish: 'Whish', OMT: 'OMT', BOB: 'Whish', Bank: 'Bank' }[f.method] || 'Whish';
      d.channel = 'transfer:' + m;
      d.ref = f.ref || '';
      d.sender = [f.sender_name, f.sender_phone].filter(Boolean).join(' · ');
      d.scan = 'done';
      var dup = d.ref && livePayments().some(function(p) { return p.note && p.note.indexOf(d.ref) >= 0; });
      d.scanNote = dup ? t('This reference was already recorded. Check it isn\'t a duplicate.', 'هذا المرجع مسجّل سابقاً. تأكد أنه ليس مكرراً.')
                 : !u ? t('Pick the apartment: the sender didn\'t clearly match anyone.', 'اختر الشقة: المرسِل لا يطابق أحداً بوضوح.')
                 : f.confidence === 'low' ? t('Hard to read: check every field.', 'صعبة القراءة: تحقق من كل الحقول.') : null;
      if (dup || !u) { d.scan = 'error'; d.scanErr = d.scanNote; }
      render();
    }, function(err) { d.scan = 'error'; d.scanErr = err.message; render(); });
  });
}
/* Find the apartment: AI's pick first, then the phone number, then the name. */
function matchUnit(f) {
  var units = activeUnits();
  if (f.unit_code) {
    var code = String(f.unit_code).split(' (')[0].toUpperCase();
    var hit = units.filter(function(u) { return String(u.code).toUpperCase() === code; });
    if (hit.length === 1) return hit[0];
  }
  var digits = String(f.sender_phone || '').replace(/\D/g, '').slice(-7);
  if (digits.length === 7) {
    var byPhone = units.filter(function(u) { return String(u.phone || '').replace(/\D/g, '').slice(-7) === digits; });
    if (byPhone.length === 1) return byPhone[0];
  }
  var name = String(f.sender_name || '').toLowerCase().trim();
  if (name) {
    var byName = units.filter(function(u) {
      var a = String(u.name || '').toLowerCase(), b = String(u.name_ar || '');
      return (a && (a === name || name.indexOf(a) >= 0 || a.indexOf(name) >= 0)) || (b && (b === f.sender_name || String(f.sender_name).indexOf(b) >= 0));
    });
    if (byName.length === 1) return byName[0];
  }
  return null;
}
function scanBlockPay(d) {
  var h = '';
  if (isManager()) {
    h += '<div class="scan-row">';
    if (d.photo) h += '<img class="doc-thumb" src="' + esc(d.photo) + '" alt="" onclick="window.open(this.src)">';
    h += aiReady() ? '<button class="btn sec sm grow scan-btn" onclick="scanTransfer()">📷 ' + esc(d.photo ? t('Another screenshot', 'لقطة أخرى') : t('Read a transfer screenshot', 'اقرأ لقطة تحويل')) + '</button>' : '';
    h += '</div>';
  }
  if (d.sender || d.ref) h += '<div class="hint">' + esc([d.sender ? t('From ', 'من ') + d.sender : '', d.ref ? t('Ref ', 'مرجع ') + d.ref : ''].filter(Boolean).join(' · ')) + '</div>';
  return h + scanStatus(d);
}
function keepPay() {
  var d = UI.sheet.data;
  if (document.getElementById('pay-unit')) d.unit = val('pay-unit');
  if (document.getElementById('pay-amt')) d.amount = val('pay-amt');
  if (document.getElementById('pay-ch')) d.channel = val('pay-ch');
}
