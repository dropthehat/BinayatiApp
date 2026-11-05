/* ============================================================================
   Natour admin: Screen wall and Workflows. Frames run the sealed preview from
   preview.js. They live in their own layer outside #app, so the app's normal
   re-renders never reload them.
   ============================================================================ */
var STD_DEVICES = [
  { id: 'se', l: 'iPhone SE', w: 375, h: 667 }, { id: 'ip', l: 'iPhone 15', w: 393, h: 852 }, { id: 'max', l: 'iPhone Pro Max', w: 430, h: 932 },
  { id: 'and', l: 'Android', w: 360, h: 800 }, { id: 'ipad', l: 'iPad', w: 820, h: 1180, big: true }, { id: 'lap', l: 'Laptop', w: 1440, h: 900, big: true, wide: true }
];
var STD = {
  page: null, mode: 'devices', role: 'm', screen: 'home', device: 'ip', lang: 'en', theme: 'light', zoom: 0.6,
  flow: 'collect', step: 0, fdevice: 'ip', busy: false, err: null, queue: [], loading: 0, io: null
};
var STD_PAGES = { wall: 1, flows: 1 };

function stdHost() {
  var el = document.getElementById('std-host');
  if (!el) { el = document.createElement('div'); el.id = 'std-host'; el.setAttribute('dir', 'ltr'); document.body.appendChild(el); }
  return el;
}
/* Called after every app render: show, hide or leave the layer alone. */
function stdSync() {
  var active = UI.screen === 'admin' && IS_ADMIN && STD_PAGES[ADM.tab];
  var el = document.getElementById('std-host');
  if (!active) {
    if (el && STD.page) { el.innerHTML = ''; el.style.display = 'none'; STD.page = null; stdStopLoading(); }
    return;
  }
  el = stdHost(); el.style.display = 'block';
  var side = document.querySelector('.adm .desk-side');
  el.style.top = side && window.innerWidth < 1000 ? side.offsetHeight + 'px' : '0';
  if (STD.page !== ADM.tab) { STD.page = ADM.tab; stdBuild(); }
}
function stdBuild() { stdStopLoading(); if (STD.page === 'wall') stdWall(); else if (STD.page === 'flows') stdFlows(); }
function stdSrc(params) {
  var q = new URLSearchParams(params);
  return location.pathname + '?' + q.toString();
}
function stdFrameSandbox() { return 'allow-scripts allow-forms allow-modals'; }

/* ---------- Loading a few frames at a time ---------- */
function stdStopLoading() {
  if (STD.io) { STD.io.disconnect(); STD.io = null; }
  STD.queue = []; STD.loading = 0;
}
function stdPump() {
  while (STD.loading < 3 && STD.queue.length) {
    var f = STD.queue.shift();
    if (!f.isConnected) continue;
    STD.loading++;
    f.setAttribute('src', f.getAttribute('data-src'));
    f._limit = setTimeout((function(x) { return function() { stdFrameDone(x); }; })(f), 12000);
  }
}
function stdFrameDone(f, err) {
  if (!f || f._done) return;
  f._done = true; clearTimeout(f._limit);
  STD.loading = Math.max(0, STD.loading - 1);
  var box = f.closest('.std-frame');
  if (box) { box.classList.add('ready'); if (err) { box.classList.add('bad'); var c = box.querySelector('.std-state'); if (c) c.textContent = 'This screen failed: ' + err; } }
  stdPump();
}
window.addEventListener('message', function(e) {
  if (!e.data || !e.data.natour) return;
  var frames = document.querySelectorAll('#std-host iframe'), f = null;
  for (var i = 0; i < frames.length; i++) if (frames[i].contentWindow === e.source) f = frames[i];
  if (!f) return;
  if (e.data.ready) {
    stdFrameDone(f, e.data.error);
    if (f.id === 'std-flow-frame') { STD.busy = false; STD.err = e.data.error || null; stdFlowPanel(); }
  }
  if (e.data.stepDone != null && f.id === 'std-flow-frame') { STD.busy = false; STD.err = e.data.error || null; STD.step = e.data.stepDone; stdFlowPanel(); }
});

/* ---------- Screen wall ---------- */
function stdSeg(key, opts, fn) {
  return '<div class="seg std-seg">' + opts.map(function(o) { return '<button class="' + (STD[key] === o[0] ? 'on' : '') + '" onclick="stdSet(\'' + key + '\',\'' + o[0] + '\'' + (fn ? ',' + fn : '') + ')">' + o[1] + '</button>'; }).join('') + '</div>';
}
function stdSet(key, v, then) {
  STD[key] = v;
  if (key === 'role') {
    var list = stdScreens();
    if (!list.some(function(s) { return s.id === STD.screen; })) STD.screen = list[0].id;
  }
  stdBuild();
}
function stdScreens() { return PV_SCREENS.filter(function(s) { return s.role === STD.role; }); }
function stdScreenOn(s, d) {
  if (d.wide) return !s.phone;
  return !s.laptop;
}
function stdCombos() {
  var ls = STD.lang === 'both' ? ['en', 'ar'] : [STD.lang], ts = STD.theme === 'both' ? ['light', 'dark'] : [STD.theme], out = [];
  ls.forEach(function(l) { ts.forEach(function(th) { out.push({ lang: l, theme: th }); }); });
  return out;
}
function stdFrameHtml(s, d, c) {
  var z = STD.zoom * (d.wide ? 0.62 : d.big ? 0.75 : 1);
  var w = Math.round(d.w * z), h2 = Math.round(d.h * z);
  var src = stdSrc({ preview: s.id, lang: c.lang, theme: c.theme });
  var cap = [STD.mode === 'devices' ? d.l + ' · ' + d.w + '×' + d.h : s.l];
  if (STD.lang === 'both') cap.push(c.lang === 'ar' ? 'Arabic' : 'English');
  if (STD.theme === 'both') cap.push(c.theme === 'dark' ? 'Dark' : 'Light');
  cap = cap.join(' · ');
  return '<figure class="std-frame' + (d.wide ? ' wide' : '') + '" style="width:' + w + 'px"><figcaption><span title="' + esc(cap) + '">' + esc(cap) + '</span><a href="' + esc(src) + '" target="_blank" rel="noopener" title="Open full size in a new tab">Open</a></figcaption>' +
    '<div class="std-clip" style="width:' + w + 'px;height:' + h2 + 'px"><span class="std-state">Loading…</span><iframe title="' + esc(cap) + '" data-src="' + esc(src) + '" sandbox="' + stdFrameSandbox() + '" width="' + d.w + '" height="' + d.h + '" style="transform:scale(' + z + ')"></iframe></div></figure>';
}
function stdWall() {
  var el = stdHost(), list = stdScreens(), combos = stdCombos(), sc = list.filter(function(s) { return s.id === STD.screen; })[0] || list[0];
  var h = '<div class="std"><div class="desk-head"><h1>Screen wall</h1><div class="desk-acts"><button class="btn ghost sm" onclick="stdBuild()">Reset sample data</button></div></div>';
  h += '<p class="adm-sub">The real app on sample data. Nothing here can reach a real building or send a message, and you can tap around inside any frame.</p>';
  h += '<div class="std-bar">' + stdSeg('mode', [['devices', 'One screen, every size'], ['all', 'One size, every screen']]);
  h += stdSeg('role', Object.keys(PV_ROLES).map(function(k) { return [k, PV_ROLES[k]]; }));
  if (STD.mode === 'devices') h += '<label class="std-pick"><span>Screen</span><select class="input" onchange="stdSet(\'screen\',this.value)">' + list.map(function(s) { return '<option value="' + s.id + '"' + (s.id === sc.id ? ' selected' : '') + '>' + esc(s.l) + '</option>'; }).join('') + '</select></label>';
  else h += '<label class="std-pick"><span>Size</span><select class="input" onchange="stdSet(\'device\',this.value)">' + STD_DEVICES.map(function(d) { return '<option value="' + d.id + '"' + (d.id === STD.device ? ' selected' : '') + '>' + esc(d.l) + '</option>'; }).join('') + '</select></label>';
  h += stdSeg('lang', [['en', 'English'], ['ar', 'Arabic'], ['both', 'Both']]) + stdSeg('theme', [['light', 'Light'], ['dark', 'Dark'], ['both', 'Both']]);
  h += '<label class="std-pick std-zoom"><span>Zoom</span><input type="range" min="0.35" max="1" step="0.05" value="' + STD.zoom + '" aria-label="Zoom" onchange="STD.zoom=parseFloat(this.value);stdBuild()"></label></div>';
  h += '<div class="std-wall">';
  var n = 0;
  if (STD.mode === 'devices') {
    STD_DEVICES.filter(function(d) { return stdScreenOn(sc, d); }).forEach(function(d) { combos.forEach(function(c) { h += stdFrameHtml(sc, d, c); n++; }); });
  } else {
    var dev = STD_DEVICES.filter(function(d) { return d.id === STD.device; })[0] || STD_DEVICES[1];
    list.filter(function(s) { return stdScreenOn(s, dev); }).forEach(function(s) { combos.forEach(function(c) { h += stdFrameHtml(s, dev, c); n++; }); });
  }
  if (!n) h += '<p class="muted">This screen has no version at that size.</p>';
  h += '</div></div>';
  el.innerHTML = h; el.scrollTop = 0;
  stdStopLoading();
  STD.io = new IntersectionObserver(function(entries) {
    entries.forEach(function(en) {
      if (!en.isIntersecting) return;
      STD.io.unobserve(en.target);
      var f = en.target.querySelector('iframe'); if (f) STD.queue.push(f);
    });
    stdPump();
  }, { root: el, rootMargin: '200px' });
  el.querySelectorAll('.std-frame').forEach(function(x) { STD.io.observe(x); });
}

/* ---------- Workflows ---------- */
function stdFlow() { return PV_FLOWS.filter(function(f) { return f.id === STD.flow; })[0] || PV_FLOWS[0]; }
function stdFlows() {
  var el = stdHost();
  if (STD.lang === 'both') STD.lang = 'en';
  if (STD.theme === 'both') STD.theme = 'light';
  var h = '<div class="std std-flows"><div class="desk-head"><h1>Workflows</h1></div><p class="adm-sub">Walk through what people actually do, step by step, in the real app on sample data. You can also tap inside the frame.</p>';
  h += '<div class="std-fl-grid"><nav class="std-fl-list" aria-label="Workflows">' + PV_FLOWS.map(function(f) {
    return '<button class="std-fl' + (f.id === STD.flow ? ' on' : '') + '" onclick="stdPickFlow(\'' + f.id + '\')"><b>' + esc(f.title) + '</b><small>' + esc(f.who) + ' · ' + f.steps.length + ' steps</small></button>';
  }).join('') + '</nav>';
  h += '<div class="std-fl-stage"><div class="std-bar">' + stdSeg('lang', [['en', 'English'], ['ar', 'Arabic']]).replace(/stdSet\('lang','(\w+)'\)/g, "stdFlowSet('lang','$1')") + stdSeg('theme', [['light', 'Light'], ['dark', 'Dark']]).replace(/stdSet\('theme','(\w+)'\)/g, "stdFlowSet('theme','$1')");
  h += '<select class="input std-mini" aria-label="Size" onchange="stdFlowSet(\'fdevice\',this.value)">' + STD_DEVICES.map(function(d) { return '<option value="' + d.id + '"' + (d.id === STD.fdevice ? ' selected' : '') + '>' + esc(d.l) + '</option>'; }).join('') + '</select></div><div id="std-flow-slot"></div></div>';
  h += '<aside id="std-flow-panel" class="std-fl-panel"></aside></div></div>';
  el.innerHTML = h; el.scrollTop = 0;
  stdFlowLoad();
}
function stdFlowLoad() {
  var slot = document.getElementById('std-flow-slot'); if (!slot) return;
  var d = STD_DEVICES.filter(function(x) { return x.id === STD.fdevice; })[0] || STD_DEVICES[1];
  var room = Math.max(320, window.innerHeight - 200), roomW = Math.max(280, slot.offsetWidth || 400);
  var z = Math.min(1, room / d.h, roomW / d.w);
  var src = stdSrc({ preview: 'flow', flow: STD.flow, step: STD.step, lang: STD.lang === 'both' ? 'en' : STD.lang, theme: STD.theme === 'both' ? 'light' : STD.theme });
  STD.busy = true; STD.err = null;
  slot.innerHTML = '<div class="std-frame std-frame-solo" style="width:' + Math.round(d.w * z) + 'px"><div class="std-clip" style="width:' + Math.round(d.w * z) + 'px;height:' + Math.round(d.h * z) + 'px"><span class="std-state">Loading…</span><iframe id="std-flow-frame" title="' + esc(stdFlow().title) + '" src="' + esc(src) + '" sandbox="' + stdFrameSandbox() + '" width="' + d.w + '" height="' + d.h + '" style="transform:scale(' + z + ')"></iframe></div></div>';
  stdFlowPanel();
}
function stdFlowPanel() {
  var p = document.getElementById('std-flow-panel'); if (!p) return;
  var f = stdFlow(), i = STD.step, s = f.steps[i];
  var h = '<h2>' + esc(f.title) + '</h2><p class="muted">' + esc(f.about) + '</p>';
  h += '<ol class="std-steps">' + f.steps.map(function(x, n) {
    return '<li class="' + (n === i ? 'on' : n < i ? 'done' : '') + '"><button onclick="stdFlowJump(' + n + ')"' + (n === i ? ' aria-current="step"' : '') + '><span>' + (n + 1) + '</span><b>' + esc(x.t) + '</b></button>' + (n === i ? '<p>' + esc(x.n) + '</p>' : '') + '</li>';
  }).join('') + '</ol>';
  if (STD.err) h += '<div class="banner warn"><div class="grow"><b>This step failed</b>' + esc(STD.err) + '</div></div>';
  h += '<div class="std-fl-nav"><button class="btn sec" onclick="stdFlowJump(' + (i - 1) + ')"' + (i <= 0 || STD.busy ? ' disabled' : '') + '>Back</button>';
  h += i < f.steps.length - 1 ? '<button class="btn pri" onclick="stdFlowNext()"' + (STD.busy ? ' disabled' : '') + '>Next</button>' : '<button class="btn pri" onclick="stdFlowJump(0)"' + (STD.busy ? ' disabled' : '') + '>Start over</button>';
  p.innerHTML = h + '</div>';
}
function stdPickFlow(id) { STD.flow = id; STD.step = 0; stdFlows(); }
function stdFlowSet(key, v) { STD[key] = v; stdFlows(); }
/* Going forward runs the next step in place. Going back replays from the start, so the data is always right. */
function stdFlowJump(n) {
  var f = stdFlow(); if (n < 0 || n >= f.steps.length) return;
  STD.step = n; stdFlowLoad();
}
function stdFlowNext() {
  var fr = document.getElementById('std-flow-frame'), f = stdFlow();
  if (!fr || STD.busy || STD.step >= f.steps.length - 1) return;
  STD.busy = true; stdFlowPanel();
  fr.contentWindow.postMessage({ natour: true, step: STD.step + 1 }, '*');
}
document.addEventListener('keydown', function(e) {
  if (STD.page !== 'flows' || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
  if (e.key === 'ArrowRight') stdFlowNext();
  else if (e.key === 'ArrowLeft' && !STD.busy && STD.step > 0) stdFlowJump(STD.step - 1);
});
