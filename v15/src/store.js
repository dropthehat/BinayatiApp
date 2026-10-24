/* ============================================================================
   Data layer. Two backends with the same shape:
   - Local: everything in this browser (demo, or before a server is set up).
   - Cloud: Supabase. Accounts, roles, sync between phones, resident links.
   Writes are applied to S straight away so taps feel instant, then sent.
   ============================================================================ */
var TABLES = ['members', 'units', 'cycles', 'charges', 'payments', 'handovers', 'expenses', 'tasks', 'events', 'invites'];
var SB = null;          // supabase client when in cloud mode
var SYNC = 'local';     // local | live | busy | off
var RT_CHANNEL = null;

function cfg() {
  var url = (window.BINAYATI_CONFIG || {}).url || '', key = (window.BINAYATI_CONFIG || {}).key || '';
  try {
    var o = JSON.parse(localStorage.getItem('bny15_server') || 'null');
    if (o && o.url && o.key) { url = o.url; key = o.key; }
  } catch (e) {}
  return { url: url.trim().replace(/\/+$/, ''), key: key.trim() };
}
function cloudConfigured() { var c = cfg(); return !!(c.url && c.key); }
function isCloud() { return !!SB; }

function loadScript(src) {
  return new Promise(function(res, rej) {
    var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function() { rej(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
}
function initCloud() {
  if (!cloudConfigured()) return Promise.resolve(false);
  var c = cfg();
  return (window.supabase ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'))
    .then(function() {
      SB = window.supabase.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bny15_auth' } });
      return true;
    });
}

/* ---------------------------------------------------------------------------
   Local backend
   --------------------------------------------------------------------------- */
var LOCAL_KEY = 'binayati_v15_local';
var LDB = null;
function localLoad() {
  if (LDB) return LDB;
  try { LDB = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { LDB = null; }
  if (!LDB || !LDB.buildings) LDB = { buildings: [], persona: 'u-manager' };
  TABLES.forEach(function(k) { if (!Array.isArray(LDB[k])) LDB[k] = []; });
  return LDB;
}
function localSave() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(LDB)); } catch (e) { toast(t('Storage is full on this device', 'مساحة التخزين ممتلئة')); } }
function localUser() {
  var db = localLoad();
  var id = db.persona || 'u-manager';
  return { id: id };
}
function localEvent(tbl, action, row) {
  if (tbl === 'events' || !S.building) return;
  var m = member(S.me && S.me.id);
  var ev = { id: uuid(), building_id: S.building.id, actor: S.me && S.me.id, actor_name: m ? m.display_name : '',
             tbl: tbl, action: action, row_id: row.id, data: JSON.parse(JSON.stringify(row)), at: nowIso() };
  LDB.events.push(ev);
  S.events.push(ev);
}
function localBuildingState(bid) {
  var db = localLoad();
  var b = byId(db.buildings, bid);
  var ns = emptyState();
  if (!b) return ns;
  ns.building = b;
  TABLES.forEach(function(k) { ns[k] = db[k].filter(function(r) { return r.building_id === bid; }); });
  ns.me = localUser();
  var m = null; ns.members.forEach(function(x) { if (x.user_id === ns.me.id) m = x; });
  ns.role = m ? m.role : 'manager';
  ns._rev = Math.random();
  return ns;
}
function localLoadBuilding(bid) { S = localBuildingState(bid); }

/* ---------------------------------------------------------------------------
   Generic writes (same calls in both modes)
   --------------------------------------------------------------------------- */
function applyLocal(tbl, op, row) {
  // keep S in step
  var list = tbl === 'buildings' ? null : S[tbl];
  if (tbl === 'buildings') { if (op === 'update' && S.building && S.building.id === row.id) Object.assign(S.building, row); }
  else if (op === 'insert') list.push(row);
  else if (op === 'update') { var x = byId(list, row.id); if (x) Object.assign(x, row); }
  else if (op === 'delete') { S[tbl] = list.filter(function(r) { return r.id !== row.id; }); }
  S._rev = (S._rev || 0) + 1;
}

function dbInsert(tbl, row) {
  toBase(tbl, row);
  row.id = row.id || uuid();
  if (tbl !== 'buildings' && !row.building_id) row.building_id = S.building.id;
  if (!row.created_at && tbl !== 'payments') row.created_at = nowIso();
  if (!isCloud()) {
    var db = localLoad();
    db[tbl].push(JSON.parse(JSON.stringify(row)));
    if (S.building && row.building_id === S.building.id) { applyLocal(tbl, 'insert', row); localEvent(tbl, 'insert', row); }
    localSave();
    return Promise.resolve(row);
  }
  applyLocal(tbl, 'insert', row);
  return cloudCall(SB.from(tbl).insert(row).select().single()).then(function(r) {
    var x = byId(S[tbl], row.id); if (x && r) Object.assign(x, r);
    return r || row;
  }, function(e) { S[tbl] = S[tbl].filter(function(r) { return r.id !== row.id; }); S._rev++; render(); throw e; });
}
function dbInsertMany(tbl, rows) {
  rows.forEach(function(r) { toBase(tbl, r); });
  rows.forEach(function(r) { r.id = r.id || uuid(); if (!r.building_id) r.building_id = S.building.id; if (!r.created_at && tbl !== 'payments') r.created_at = nowIso(); });
  if (!isCloud()) {
    var db = localLoad();
    rows.forEach(function(r) { db[tbl].push(JSON.parse(JSON.stringify(r))); applyLocal(tbl, 'insert', r); localEvent(tbl, 'insert', r); });
    localSave();
    return Promise.resolve(rows);
  }
  rows.forEach(function(r) { applyLocal(tbl, 'insert', r); });
  if (!rows.length) return Promise.resolve(rows);
  return cloudCall(SB.from(tbl).insert(rows)).then(function() { return rows; }, function(e) { reloadBuilding(); throw e; });
}
function dbUpdate(tbl, id, patch) {
  if (patch.cur === 'LBP') toBase(tbl, patch);
  var row = Object.assign({ id: id }, patch);
  if (!isCloud()) {
    var db = localLoad();
    var list = tbl === 'buildings' ? db.buildings : db[tbl];
    var x = byId(list, id); if (x) Object.assign(x, patch);
    applyLocal(tbl, 'update', row);
    localEvent(tbl, 'update', x || row);
    localSave();
    return Promise.resolve(x);
  }
  var before = tbl === 'buildings' ? null : JSON.parse(JSON.stringify(byId(S[tbl], id) || null));
  applyLocal(tbl, 'update', row);
  return cloudCall(SB.from(tbl).update(patch).eq('id', id).select()).then(function(r) {
    if (!r || !r.length) { reloadBuilding(); throw new Error(t('Not allowed for your role', 'غير مسموح لدورك')); }
    return r[0];
  }, function(e) { if (before) applyLocal(tbl, 'update', before); render(); throw e; });
}
function dbDelete(tbl, id) {
  if (!isCloud()) {
    var db = localLoad();
    var x = byId(db[tbl], id);
    db[tbl] = db[tbl].filter(function(r) { return r.id !== id; });
    applyLocal(tbl, 'delete', { id: id });
    if (x) localEvent(tbl, 'delete', x);
    localSave();
    return Promise.resolve();
  }
  var keep = byId(S[tbl], id);
  applyLocal(tbl, 'delete', { id: id });
  return cloudCall(SB.from(tbl).delete().eq('id', id)).catch(function(e) { if (keep) applyLocal(tbl, 'insert', keep); render(); throw e; });
}
function cloudCall(q) {
  setSync('busy');
  return q.then(function(res) {
    if (res.error) { setSync('live'); throw new Error(niceError(res.error)); }
    setSync('live');
    return res.data;
  }, function(e) { setSync('off'); throw new Error(t('No connection. Check your internet.', 'لا يوجد اتصال. تحقق من الإنترنت.')); });
}
function niceError(e) {
  var m = (e && (e.message || e.error_description)) || String(e);
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(m)) return t('No connection to the server. Check your internet and try again.', 'لا اتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.');
  if (/row-level security|permission denied/i.test(m)) return t('Your role can\'t do that', 'دورك لا يسمح بذلك');
  if (/Invalid login credentials/i.test(m)) return t('Wrong username or password', 'اسم المستخدم أو كلمة المرور خطأ');
  if (/already registered|already been registered/i.test(m)) return t('There is already an account with this email. Sign in instead.', 'يوجد حساب بهذا البريد. سجّل الدخول.');
  if (/email.*invalid|invalid.*email/i.test(m)) return t('That email address isn\'t accepted. Check it for typos.', 'هذا البريد غير مقبول. تحقق منه.');
  if (/Email not confirmed/i.test(m)) return t('Confirm your email first: open the link we sent you.', 'أكّد بريدك أولاً من الرابط المرسل.');
  if (/Password should be/i.test(m)) return t('Password must be at least 6 characters', 'كلمة المرور 6 أحرف على الأقل');
  if (/schema cache|does not exist/i.test(m)) return t('The server isn\'t set up yet: run schema.sql in Supabase', 'الخادم غير مُعد بعد: شغّل schema.sql في Supabase');
  return m;
}

/* RPCs: the server functions in schema.sql, with local equivalents. */
function rpc(name, args) {
  if (isCloud()) return cloudCall(SB.rpc(name, args));
  return Promise.resolve().then(function() { return LOCAL_RPC[name](args); });
}
var LOCAL_RPC = {
  create_building: function(a) {
    var db = localLoad();
    var b = { id: uuid(), name: a.p_name, name_ar: a.p_name_ar, settings: a.p_settings || {}, created_by: localUser().id, created_at: nowIso() };
    db.buildings.push(b);
    db.members.push({ id: uuid(), building_id: b.id, user_id: 'u-manager', role: 'manager', display_name: a.p_display_name || t('Manager', 'المدير'), created_at: nowIso() });
    db.persona = 'u-manager';
    localSave();
    return b.id;
  },
  create_invite: function(a) {
    var code = token().slice(0, 8).toUpperCase();
    var row = { id: code, code: code, building_id: a.p_building, role: a.p_role, display_name: a.p_display_name, created_at: nowIso() };
    localLoad().invites.push(row); applyLocal('invites', 'insert', row); localSave();
    return code;
  },
  request_handover: function(a) {
    var me = S.me.id, u = 0, l = 0;
    var pays = S.payments.filter(function(p) { return p.channel === 'collector' && p.received_by === me && !p.handover_id && !p.voided_at; });
    var exps = S.expenses.filter(function(e) { return e.paid_from === 'collector' && e.paid_by === me && !e.handover_id && !e.voided_at; });
    if (S.handovers.some(function(h) { return h.collector_id === me && h.status === 'pending'; })) throw new Error(t('A handover is already waiting for confirmation', 'هناك تسليم بانتظار التأكيد'));
    pays.forEach(function(p) { if (p.cur === 'USD') u += num(p.amount); else l += num(p.amount); });
    exps.forEach(function(e) { if (e.cur === 'USD') u -= num(e.amount); else l -= num(e.amount); });
    if (!u && !l) throw new Error(t('Nothing to hand over', 'لا شيء للتسليم'));
    var h = { id: uuid(), building_id: S.building.id, collector_id: me, usd: u, lbp: l, note: a.p_note, status: 'pending', created_at: nowIso() };
    var db = localLoad();
    db.handovers.push(h); applyLocal('handovers', 'insert', h); localEvent('handovers', 'insert', h);
    pays.forEach(function(p) { p.handover_id = h.id; var x = byId(db.payments, p.id); if (x) x.handover_id = h.id; });
    exps.forEach(function(e) { e.handover_id = h.id; var x = byId(db.expenses, e.id); if (x) x.handover_id = h.id; });
    S._rev++; localSave();
    return h.id;
  },
  receive_handover: function(a) {
    var db = localLoad(), now = nowIso(), col = a.p_collector, hid = null;
    S.handovers.forEach(function(h) {
      if (h.collector_id === col && h.status === 'pending') {
        var patch = { status: 'confirmed', resolved_by: S.me.id, resolved_at: now };
        Object.assign(h, patch); var x = byId(db.handovers, h.id); if (x && x !== h) Object.assign(x, patch);
        localEvent('handovers', 'update', h); hid = h.id;
      }
    });
    var pays = S.payments.filter(function(p) { return p.channel === 'collector' && p.received_by === col && !p.handover_id && !p.voided_at; });
    var exps = S.expenses.filter(function(e) { return e.paid_from === 'collector' && e.paid_by === col && !e.handover_id && !e.voided_at; });
    var u = 0, l = 0;
    pays.forEach(function(p) { if (p.cur === 'USD') u += num(p.amount); else l += num(p.amount); });
    exps.forEach(function(e) { if (e.cur === 'USD') u -= num(e.amount); else l -= num(e.amount); });
    if (!u && !l) { if (hid) { S._rev++; localSave(); return hid; } throw new Error(t('Nothing to receive', 'لا شيء للاستلام')); }
    var h = { id: uuid(), building_id: S.building.id, collector_id: col, usd: u, lbp: l, note: a.p_note || null, status: 'confirmed', created_at: now, resolved_by: S.me.id, resolved_at: now };
    db.handovers.push(h); applyLocal('handovers', 'insert', h); localEvent('handovers', 'insert', h);
    pays.forEach(function(p) { p.handover_id = h.id; var x = byId(db.payments, p.id); if (x) x.handover_id = h.id; });
    exps.forEach(function(e) { e.handover_id = h.id; var x = byId(db.expenses, e.id); if (x) x.handover_id = h.id; });
    S._rev++; localSave();
    return h.id;
  },
  resolve_handover: function(a) {
    var db = localLoad(), h = byId(db.handovers, a.p_handover), hs = byId(S.handovers, a.p_handover);
    if (!h || h.status !== 'pending') throw new Error(t('Already resolved', 'تمت المعالجة'));
    var patch = { status: a.p_accept ? 'confirmed' : 'rejected', resolved_by: S.me.id, resolved_at: nowIso() };
    Object.assign(h, patch); if (hs) Object.assign(hs, patch);
    localEvent('handovers', 'update', h);
    if (!a.p_accept) {
      ['payments', 'expenses'].forEach(function(k) {
        db[k].forEach(function(r) { if (r.handover_id === h.id) r.handover_id = null; });
        S[k].forEach(function(r) { if (r.handover_id === h.id) r.handover_id = null; });
      });
    }
    S._rev++; localSave();
  },
  void_payment: function(a) {
    var p = byId(S.payments, a.p_payment);
    if (!p) return;
    if (!isManager() && (p.received_by !== S.me.id || p.handover_id)) throw new Error(t('Only the manager can undo this now', 'المدير فقط يمكنه التراجع الآن'));
    var patch = { voided_at: nowIso(), voided_by: S.me.id };
    Object.assign(p, patch); var x = byId(localLoad().payments, p.id); if (x) Object.assign(x, patch);
    localEvent('payments', 'update', p); S._rev++; localSave();
  },
  resident_view: function(a) {
    var db = localLoad();
    var u = null; db.units.forEach(function(x) { if (x.resident_token === a.p_token) u = x; });
    if (!u) return null;
    var b = byId(db.buildings, u.building_id);
    var pick = function(k) { return db[k].filter(function(r) { return r.building_id === b.id; }); };
    var pub = (b.settings || {}).books_public !== false, who = !!(b.settings || {}).show_who_paid;
    var cyc = pick('cycles').filter(function(c) { return c.published !== false; });
    var cids = {}; cyc.forEach(function(c) { cids[c.id] = 1; });
    var out = { building: b, unit: u, units: pick('units'), cycles: cyc,
                charges: pick('charges').filter(function(c) { return cids[c.cycle_id]; }),
                my_payments: pick('payments').filter(function(p) { return p.unit_id === u.id; }),
                members: pick('members'), books_public: pub };
    if (pub) {
      out.payments = pick('payments').map(function(p) { var q = Object.assign({}, p); if (!who && p.unit_id !== u.id) q.unit_id = null; return q; });
      out.expenses = pick('expenses'); out.handovers = pick('handovers');
    }
    return JSON.parse(JSON.stringify(out));
  }
};

/* ---------------------------------------------------------------------------
   Cloud: sign in, load, live updates
   --------------------------------------------------------------------------- */
/* People sign in with a username (no email needed) or an email. Usernames map to a
   placeholder address on binayati.local that never receives mail. */
function isEmail(u) { return String(u || '').indexOf('@') > 0; }
function cleanUsername(u) { return String(u || '').trim().toLowerCase(); }
function usernameToEmail(u) {
  u = cleanUsername(u);
  if (isEmail(u)) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u)) throw new Error(t('Enter a valid email address', 'أدخل بريداً إلكترونياً صحيحاً'));
    return u;
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(u)) throw new Error(t('Usernames are 3 to 30 letters or numbers, no spaces', 'اسم المستخدم من 3 إلى 30 حرفاً أو رقماً بلا مسافات'));
  return u + '@binayati.local';
}
function cloudSession() {
  return SB.auth.getSession().then(function(r) { return r.data && r.data.session; });
}
function cloudSignIn(username, password) {
  return SB.auth.signInWithPassword({ email: usernameToEmail(username), password: password }).then(function(r) {
    if (r.error) throw new Error(niceError(r.error));
    return r.data.session;
  });
}
function cloudSignUp(username, password, name) {
  var email = usernameToEmail(username);
  if (!isEmail(username)) {
    var c = cfg();
    return fetch(c.url + '/functions/v1/username-signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: c.key },
      body: JSON.stringify({ username: cleanUsername(username), password: password, name: name })
    }).then(function(r) { return r.json().catch(function() { return {}; }); }, function() {
      throw new Error(t('No connection to the server. Check your internet and try again.', 'لا اتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.'));
    }).then(function(res) {
      if (res.error === 'taken') throw new Error(t('That username is taken. Try another, or sign in.', 'اسم المستخدم مستعمل. جرّب غيره أو سجّل الدخول.'));
      if (res.error === 'weak_password') throw new Error(t('Password must be at least 6 characters', 'كلمة المرور 6 أحرف على الأقل'));
      if (res.error === 'bad_username') throw new Error(t('Usernames are 3 to 30 letters or numbers, no spaces', 'اسم المستخدم من 3 إلى 30 حرفاً أو رقماً بلا مسافات'));
      if (!res.ok) throw new Error(t('Couldn\'t create the account. Try again.', 'تعذّر إنشاء الحساب. حاول مجدداً.'));
      return cloudSignIn(username, password);
    });
  }
  return SB.auth.signUp({ email: email, password: password, options: { data: { name: name } } }).then(function(r) {
    if (r.error) throw new Error(niceError(r.error));
    if (!r.data.session) { var e = new Error(t('Almost there: open the confirmation link we just emailed you, then come back and sign in.', 'تقريباً: افتح رابط التأكيد الذي أرسلناه لبريدك ثم عد وسجّل الدخول.')); e.confirm = true; throw e; }
    return r.data.session;
  });
}
function cloudMyBuildings() {
  return cloudSession().then(function(sess) {
    if (!sess) return [];
    return cloudCall(SB.from('members').select('building_id, role, display_name, buildings(id, name, name_ar)').eq('user_id', sess.user.id))
      .then(function(rows) { return (rows || []).map(function(r) { return { id: r.building_id, role: r.role, name: r.buildings && r.buildings.name, name_ar: r.buildings && r.buildings.name_ar }; }); });
  });
}
function cloudBuildingState(bid, light) {
  return cloudSession().then(function(sess) {
    if (!sess) throw new Error('signed out');
    var qs = [SB.from('buildings').select('*').eq('id', bid).single()];
    TABLES.forEach(function(k) {
      var q = SB.from(k).select('*').eq('building_id', bid);
      if (k === 'events') q = q.order('at', { ascending: false }).limit(light ? 1 : 300);
      if (k === 'payments') q = q.order('received_at', { ascending: true });
      qs.push(q);
    });
    return Promise.all(qs).then(function(res) {
      var bad = res.filter(function(r) { return r.error && !(r.error.message || '').match(/invites/); })[0];
      if (res[0].error) throw new Error(niceError(res[0].error));
      if (bad) throw new Error(niceError(bad.error));
      var ns = emptyState();
      ns.building = res[0].data;
      TABLES.forEach(function(k, i) { ns[k] = res[i + 1].data || []; });
      ns.events.reverse();
      ns.me = { id: sess.user.id, email: sess.user.email };
      var m = null; ns.members.forEach(function(x) { if (x.user_id === sess.user.id) m = x; });
      ns.role = m ? m.role : null;
      ns._rev = Math.random();
      return ns;
    });
  });
}
function cloudLoadBuilding(bid) {
  setSync('busy');
  return cloudBuildingState(bid).then(function(ns) {
    S = ns;
    setSync('live');
    subscribe(bid);
  });
}
/* Load any building without switching to it (for the all-buildings overview). */
function buildingState(bid) { return isCloud() ? cloudBuildingState(bid, true) : Promise.resolve(localBuildingState(bid)); }
/* Run money calculations against another building's data. */
function withState(ns, fn) { var old = S; S = ns; try { return fn(); } finally { S = old; } }

var _reloadT = null;
function reloadBuilding() {
  if (!isCloud() || !S.building) return;
  clearTimeout(_reloadT);
  _reloadT = setTimeout(function() {
    var keepUi = JSON.stringify(UI);
    cloudLoadBuilding(S.building.id).then(function() { render(); }).catch(function(e) { setSync('off'); });
  }, 350);
}
function subscribe(bid) {
  if (RT_CHANNEL && RT_CHANNEL._bid === bid) return;
  if (RT_CHANNEL) { SB.removeChannel(RT_CHANNEL); RT_CHANNEL = null; }
  var ch = SB.channel('b-' + bid);
  ['units', 'cycles', 'charges', 'payments', 'handovers', 'expenses', 'tasks', 'members'].forEach(function(tbl) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: tbl, filter: 'building_id=eq.' + bid }, function() { reloadBuilding(); });
  });
  ch = ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'buildings', filter: 'id=eq.' + bid }, function() { reloadBuilding(); });
  ch.subscribe(function(status) {
    if (status === 'SUBSCRIBED') setSync('live');
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSync('off');
  });
  ch._bid = bid;
  RT_CHANNEL = ch;
}
function setSync(s) {
  SYNC = s;
  var el = document.getElementById('sync-dot');
  if (el) el.className = 'sync ' + (isCloud() ? s : 'local');
}
