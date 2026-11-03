/* ============================================================================
   Live config: the feature map, feature switches and the app's lists
   (expense categories, common charges/expenses/tasks, transfer methods).
   They live in Supabase and are edited from the admin screen; changes reach
   every open app within seconds. The lists in presets.js / core.js are the
   built-in fallback when the server can't be reached.
   ============================================================================ */
var CFG = { features: {}, bfeat: {}, lists: [], loaded: false };
var IS_ADMIN = false;
var PAY_METHODS = [{ key: 'Whish', en: 'Whish', ar: 'ويش' }, { key: 'OMT', en: 'OMT', ar: 'OMT' }, { key: 'Bank', en: 'Bank transfer', ar: 'تحويل مصرفي' }];
var CATS_ALL = null; // every category ever defined, hidden ones too, so old expenses keep their name
var CODE_LISTS = null;
function snapshotCodeLists() {
  if (CODE_LISTS) return;
  CODE_LISTS = JSON.parse(JSON.stringify({ CATS: CATS, CHARGE_PRESETS: CHARGE_PRESETS, EXPENSE_PRESETS: EXPENSE_PRESETS, TASK_PRESETS: TASK_PRESETS, PAY_METHODS: PAY_METHODS }));
}

/* Is a feature on here? A building's own switch wins, then the global switch, then on. */
function feature(key) {
  if (CFG.bfeat[key] != null) return !!CFG.bfeat[key];
  var f = CFG.features[key];
  if (!f) return true;
  return f.status !== 'off' && f.default_on !== false;
}

function loadConfig(bid) {
  snapshotCodeLists();
  if (!isCloud()) { applyLists(); return Promise.resolve(); }
  var q = [
    SB.from('app_features').select('*'),
    bid ? SB.from('building_features').select('*').eq('building_id', bid) : Promise.resolve({ data: [] }),
    bid ? SB.from('app_lists').select('*').or('building_id.is.null,building_id.eq.' + bid).order('sort') : SB.from('app_lists').select('*').is('building_id', null).order('sort'),
    SB.rpc('am_admin')
  ];
  return Promise.all(q).then(function(r) {
    if (r[0].error && r[2].error) return; // tables not there yet: keep the built-in lists
    CFG.features = {}; (r[0].data || []).forEach(function(f) { CFG.features[f.key] = f; });
    CFG.bfeat = {}; (r[1].data || []).forEach(function(f) { CFG.bfeat[f.key] = f.on; });
    CFG.lists = r[2].data || [];
    IS_ADMIN = !!(r[3] && r[3].data);
    CFG.loaded = true;
    applyLists();
    watchConfig(bid);
    if (bid && typeof loadSupport === 'function') return loadSupport();
  }).catch(function(e) { console.warn('config', e); });
}

/* Rebuild the app's lists from the rows. Global rows first, then the building's own. */
function applyLists() {
  var L0 = CODE_LISTS, rows = CFG.lists.filter(function(r) { return !r.hidden; });
  var has = function(kind) { return CFG.lists.some(function(r) { return r.kind === kind && !r.building_id; }); };
  var by = function(kind) { return rows.filter(function(r) { return r.kind === kind; }).sort(function(a, b) { return (a.building_id ? 1 : 0) - (b.building_id ? 1 : 0) || a.sort - b.sort; }); };
  // Expense categories
  CATS_ALL = JSON.parse(JSON.stringify(L0.CATS));
  CFG.lists.filter(function(r) { return r.kind === 'expense_cat' && r.key; }).forEach(function(r) { CATS_ALL[r.key] = [r.icon || '🧾', r.en, r.ar || r.en]; });
  if (has('expense_cat')) {
    var c = {};
    by('expense_cat').forEach(function(r) { if (r.key) c[r.key] = [r.icon || '🧾', r.en, r.ar || r.en]; });
    c.supplier = c.supplier || L0.CATS.supplier; c.other = c.other || L0.CATS.other;
    CATS = c;
  } else CATS = JSON.parse(JSON.stringify(L0.CATS));
  // Common expenses
  EXPENSE_PRESETS = has('expense_preset') ? by('expense_preset').map(function(r) { return { cat: (r.data && r.data.cat) || 'other', en: r.en, ar: r.ar || r.en }; })
    .sort(function(a, b) { var ka = Object.keys(CATS), x = ka.indexOf(a.cat), y = ka.indexOf(b.cat); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); }) : L0.EXPENSE_PRESETS.slice();
  // Common charges, per kind
  if (has('charge_preset')) {
    var cp = { fixed: [], due: [], service: [] };
    by('charge_preset').forEach(function(r) {
      var d = r.data || {}, k = cp[d.kind] ? d.kind : 'fixed';
      cp[k].push({ g: d.g || [t('Other', 'Other'), 'أخرى'], en: r.en, ar: r.ar || r.en, amt: d.amt, cur: d.cur || 'USD', split: d.split });
    });
    CHARGE_PRESETS = cp;
  } else CHARGE_PRESETS = JSON.parse(JSON.stringify(L0.CHARGE_PRESETS));
  TASK_PRESETS = has('task_preset') ? by('task_preset').map(function(r) { var d = r.data || {}; return { g: d.g || ['Other', 'أخرى'], en: r.en, ar: r.ar || r.en, rep: d.rep || 'none', who: d.who || 'collector' }; }) : L0.TASK_PRESETS.slice();
  PAY_METHODS = has('pay_method') ? by('pay_method').map(function(r) { return { key: r.key || r.en, en: r.en, ar: r.ar || r.en }; }) : L0.PAY_METHODS.slice();
}

var CFG_CHANNEL = null, _cfgT = null;
function watchConfig(bid) {
  if (!isCloud() || (CFG_CHANNEL && CFG_CHANNEL._bid === (bid || ''))) return;
  if (CFG_CHANNEL) { SB.removeChannel(CFG_CHANNEL); CFG_CHANNEL = null; }
  var ch = SB.channel('cfg-' + (bid || 'none'));
  ['app_lists', 'app_features', 'building_features', 'support_grants'].forEach(function(tb) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: tb }, function() {
      clearTimeout(_cfgT);
      _cfgT = setTimeout(function() {
        loadConfig(S.building && S.building.id).then(function() { if (tb === 'support_grants' && typeof loadSupport === 'function') loadSupport(); render(); });
      }, 400);
    });
  });
  ch.subscribe();
  ch._bid = bid || '';
  CFG_CHANNEL = ch;
}
function payMethodLabel(k) { var m = PAY_METHODS.filter(function(x) { return x.key === k; })[0]; return m ? (LANG === 'ar' ? m.ar : m.en) : k; }
