/* Living building scene — carried over from V13 (windows = who paid, sky = real time of day). */
function sunTimesLocal(d) {
 var lat = 33.89, lon = 35.5;
 var N = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
 var B = (2 * Math.PI / 365) * (N - 81);
 var decl = (23.44 * Math.PI / 180) * Math.sin(B);
 var eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
 var tz = -d.getTimezoneOffset() / 60;
 var noon = 720 - 4 * lon - eot + tz * 60;
 var phi = lat * Math.PI / 180;
 var cosH = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
 var H = Math.acos(Math.max(-1, Math.min(1, cosH))) * 180 / Math.PI;
 return { rise: noon - 4 * H, set: noon + 4 * H };
}

function heroPhase(now) {
 var st = sunTimesLocal(now);
 var m = now.getHours() * 60 + now.getMinutes();
 var key, label;
 if (m < st.rise - 35 || m > st.set + 45) { key = 'night'; label = t('Night', 'ليلاً'); }
 else if (m < st.rise + 45) { key = 'dusk'; label = t('Sunrise', 'الشروق'); }
 else if (m > st.set - 50) { key = 'dusk'; label = t('Sunset', 'الغروب'); }
 else { key = 'day'; label = m < (st.rise + st.set) / 2 ? t('Morning', 'صباحاً') : t('Afternoon', 'بعد الظهر'); }
 var frac = Math.max(0, Math.min(1, (m - st.rise) / (st.set - st.rise)));
 var time = now.toLocaleTimeString(LANG === 'ar' ? 'ar-LB' : 'en-US', { hour: 'numeric', minute: '2-digit' });
 return { key: key, label: label, chip: time + ' · ' + label, sunX: 40 + frac * 286, sunY: 150 - Math.sin(Math.PI * frac) * 118 };
}
function heroR(n) { return Math.round(n * 10) / 10; }

function heroRailPath(x, w, y1, y2) {
 var d = 'M' + heroR(x - 4) + ' ' + heroR(y1) + 'H' + heroR(x + w + 4);
 for (var px = x - 3; px <= x + w + 3; px += 4) d += 'M' + heroR(px) + ' ' + heroR(y1) + 'V' + heroR(y2);
 return d;
}

/* Shared building scene — used by the Home hero and the onboarding wizard.
 o.phase: {key:'day'|'dusk'|'eve'|'night', sunX, sunY}
 o.wins: [{state:'paid'|'owes'|'closed', label?, onclick?}] one per apartment
 Optional: signText, chip, natourFigure, natourAmt, mgrFigure, coreGlow, solar,
 safe {usdH, lbpH, split}, fixedStream, supStream, drops, dropsOn, celebrate, extraCls */
function buildBuildingScene(o) {
 var P = o.idp || 'bh';
 var ph = o.phase;
 /* Rows of windows. o.levels = [{lv, wins}] with lv 1, 2… above ground, 0 = ground floor,
    -1, -2… underground (SS1, SS2). Without levels, windows fill rows of 2 or 4. */
 var levels = o.levels;
 if (!levels) {
   var lc = o.wins.length <= 12 ? 2 : 4;
   levels = [];
   for (var li = 0; li < o.wins.length; li += lc) levels.push({ lv: li / lc + 1, wins: o.wins.slice(li, li + lc) });
 }
 var upRows = levels.filter(function(r) { return r.lv >= 0; }).sort(function(a, b) { return a.lv - b.lv; });
 var downRows = levels.filter(function(r) { return r.lv < 0; }).sort(function(a, b) { return b.lv - a.lv; });
 if (!upRows.length) upRows = [{ lv: 1, wins: [] }];
 var maxPer = 1;
 levels.forEach(function(r) { maxPer = Math.max(maxPer, r.wins.length); });
 maxPer = Math.min(6, maxPer);
 var cols = maxPer;
 var single = maxPer === 1;
 var even = false;  // always split around a stairwell; with 3 or 5, the bigger side is on the left
 var floors = upRows.length, basements = downRows.length, rowsN = floors + basements;
 // More than 5 floors above ground: a tower. Floors keep a readable height and the picture grows taller instead.
 var tower = floors > 5;
 var fh = tower ? Math.max(12, Math.min(22, Math.floor(340 / rowsN))) : rowsN <= 5 ? 28 : Math.max(14, Math.floor(150 / rowsN));
 var bw = maxPer <= 2 ? 150 : maxPer === 3 ? 196 : maxPer === 4 ? 220 : 250;
 var bx = 183 - bw / 2, bx2 = bx + bw;
 var lobbyTop = 197, top = lobbyTop - floors * fh;
 var perSide = Math.ceil(maxPer / 2), gapW = 6;
 var perHalf = (bw - 24 - 26) / 2;
 var ww = single ? perHalf : even ? (bw - 24 - (maxPer - 1) * gapW) / maxPer : (perHalf - (perSide - 1) * gapW) / perSide;
 var wh = fh * 0.61;
 var bH = basements ? basements * fh + 6 : 0;
 var n = o.wins ? o.wins.length : 0;

 var vbBot = (basements ? bH : 0) + 256, vbY = basements ? bH : 0;
 if (tower) vbY = Math.max(vbBot - 440, Math.min(vbY, top - 60));
 var vbH = vbBot - vbY;
 var vb = o.bare ? (bx - 66) + ' ' + (top - 42) + ' ' + (bw + 132) + ' ' + (240 - (top - 42) + bH) : '0 ' + vbY + ' 366 ' + vbH;
 var s = '<svg class="bh-art" viewBox="' + vb + '" preserveAspectRatio="' + (o.bare ? 'xMidYMax meet' : 'xMidYMid slice') + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="' + (o.interactive ? 'false' : 'true') + '">';
 s += '<defs>';
 s += '<linearGradient id="' + P + 'Sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sky1)"/><stop offset="0.55" style="stop-color:var(--sky2)"/><stop offset="1" style="stop-color:var(--sky3)"/></linearGradient>';
 s += '<radialGradient id="' + P + 'Warm" cx="0.5" cy="0.65" r="0.75"><stop offset="0" style="stop-color:var(--w1)"/><stop offset="0.55" style="stop-color:var(--w2)"/><stop offset="1" style="stop-color:var(--w3)"/></radialGradient>';
 s += '<radialGradient id="' + P + 'SunGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" style="stop-color:var(--sun);stop-opacity:.65"/><stop offset="1" style="stop-color:var(--sun);stop-opacity:0"/></radialGradient>';
 s += '<linearGradient id="' + P + 'Cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:#FFE6A6;stop-opacity:.55"/><stop offset="1" style="stop-color:#FFE6A6;stop-opacity:0"/></linearGradient>';
 s += '<linearGradient id="' + P + 'Pnl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:#4C7FE0"/><stop offset="1" style="stop-color:#1F3F8F"/></linearGradient>';
 s += '<linearGradient id="' + P + 'TkW" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:#F1F4FA"/><stop offset="0.6" style="stop-color:#CBD3E3"/><stop offset="1" style="stop-color:#8F99B3"/></linearGradient>';
 s += '<linearGradient id="' + P + 'TkB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:#8FB6EC"/><stop offset="0.6" style="stop-color:#4F7FC8"/><stop offset="1" style="stop-color:#2E4F8C"/></linearGradient>';
 s += '<pattern id="' + P + 'Slat" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="2" style="fill:var(--sh)"/><rect y="2" width="4" height="1" style="fill:var(--sl)"/></pattern>';
 s += '<filter id="' + P + 'Glow" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="2.6"/></filter>';
 s += '<pattern id="' + P + 'Soil" width="11" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2.5" r=".55" class="bh-grain"/><circle cx="7.5" cy="6.5" r=".45" class="bh-grain"/><circle cx="9.5" cy="1.5" r=".35" class="bh-grain"/><circle cx="4" cy="7.5" r=".3" class="bh-grain"/></pattern>';
 s += '<filter id="' + P + 'Blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>';
 s += '</defs>';

 if (!o.bare) {
 s += '<g class="bh-bg">';
 // Sky, sun / moon, stars, clouds
 s += '<rect y="' + Math.min(0, vbY) + '" width="366" height="' + (256 + bH - Math.min(0, vbY)) + '" fill="url(#' + P + 'Sky)"/>';
 s += '<g class="bh-sun"><circle cx="' + heroR(ph.sunX) + '" cy="' + heroR(ph.sunY) + '" r="40" fill="url(#' + P + 'SunGlow)"/><circle cx="' + heroR(ph.sunX) + '" cy="' + heroR(ph.sunY) + '" r="14" style="fill:var(--sun)"/></g>';
 s += '<g class="bh-moon"><circle cx="314" cy="40" r="34" fill="url(#' + P + 'SunGlow)"/><circle cx="314" cy="40" r="12" fill="#F7F1DE"/><circle cx="310" cy="37" r="2.6" fill="#E6DDC2"/><circle cx="318" cy="44" r="1.8" fill="#E6DDC2"/></g>';
 [[90,18],[140,40],[190,14],[236,34],[280,12],[322,76],[112,62],[300,90],[24,84],[166,74],[60,30],[250,58]].forEach(function(p, i) {
 s += '<circle class="bh-star" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i % 3 === 0 ? 1 : 0.7) + '" style="animation-delay:' + (i * 0.35).toFixed(2) + 's"/>';
 });
 s += '<g class="bh-cloud"><ellipse cx="68" cy="66" rx="28" ry="7"/><ellipse cx="62" cy="60" rx="13" ry="8"/></g>';
 s += '<g class="bh-cloud" style="animation-delay:-6s"><ellipse cx="222" cy="36" rx="22" ry="6"/><ellipse cx="228" cy="31" rx="10" ry="6.5"/></g>';
 s += '<g class="bh-cloud" style="animation-delay:-10s"><ellipse cx="312" cy="100" rx="24" ry="6"/><ellipse cx="306" cy="95" rx="11" ry="6.5"/></g>';

 // Fireworks for the finale
 if (o.celebrate) {
 var burst = 'M4 0L11 0M3.5 2L9.5 5.5M2 3.5L5.5 9.5M0 4L0 11M-2 3.5L-5.5 9.5M-3.5 2L-9.5 5.5M-4 0L-11 0M-3.5 -2L-9.5 -5.5M-2 -3.5L-5.5 -9.5M0 -4L0 -11M2 -3.5L5.5 -9.5M3.5 -2L9.5 -5.5';
 [[70, 52, 1, '#FFD27A', '.2'], [250, 30, 0.8, '#FF9EC4', '1.3'], [150, 26, 0.6, '#8FEBD2', '2.2']].forEach(function(b) {
 s += '<g transform="translate(' + b[0] + ' ' + b[1] + ') scale(' + b[2] + ')"><path class="bh-burst" d="' + burst + '" style="fill:none;stroke:' + b[3] + ';stroke-width:1;stroke-linecap:round;animation-delay:' + b[4] + 's"/></g>';
 });
 }

 // Mountains + far skyline
 s += '<path class="bh-mount" d="M0 160 C 40 146, 70 152, 100 142 C 140 128, 170 140, 200 134 C 240 126, 270 142, 306 136 C 330 132, 350 140, 366 136 L366 226 L0 226 Z"/>';
 s += '<rect class="bh-far" x="0" y="150" width="22" height="76"/><rect class="bh-far" x="6" y="136" width="12" height="90"/><rect class="bh-far" x="326" y="112" width="14" height="114"/><rect class="bh-far" x="342" y="152" width="24" height="74"/>';

 // Neighbour buildings
 function neighbour(x1, x2, y1, seed) {
 var out = '<rect class="bh-neigh" x="' + x1 + '" y="' + y1 + '" width="' + (x2 - x1) + '" height="' + (226 - y1) + '"/>';
 var c = 0;
 for (var wy = y1 + 10; wy + 8 < 222; wy += 18) {
 out += '<rect class="bh-nline" x="' + x1 + '" y="' + (wy + 10) + '" width="' + (x2 - x1) + '" height="1"/>';
 for (var wx = x1 + 8; wx + 11 < x2 - 4; wx += 20) {
 c++;
 out += '<rect class="bh-nw' + ((c * 7 + seed) % 5 === 0 ? ' lit' : '') + '" x="' + wx + '" y="' + wy + '" width="11" height="8"/>';
 }
 }
 return out;
 }
 if (bx > 30) s += neighbour(Math.max(0, bx - 90), bx, 108, 2);
 if (bx2 + 10 < 340) s += neighbour(bx2 + 10, Math.min(366, bx2 + 88), 124, 4);

 // Utility pole + Moteur wires
 var poleX = Math.max(12, bx - 58);
 s += '<rect class="bh-pole" x="' + poleX + '" y="92" width="2" height="134"/><rect class="bh-pole" x="' + (poleX - 7) + '" y="99" width="16" height="1.4"/>';
 s += '<path class="bh-wire" d="M' + (poleX - 6) + ' 100 Q ' + ((poleX + bx) / 2) + ' 118 ' + bx + ' ' + Math.max(top + 14, 92) + ' M' + (poleX - 4) + ' 100 Q ' + ((poleX + bx) / 2) + ' 132 ' + bx + ' 124 M' + (poleX + 6) + ' 100 Q ' + ((poleX + bx) / 2) + ' 142 ' + bx + ' 152 M' + (poleX - 6) + ' 100 Q ' + (poleX / 2) + ' 112 0 96"/>';

 s += '</g>';
 } else {
 s += '<ellipse cx="183" cy="229" rx="' + (bw / 2 + 74) + '" ry="7" fill="rgba(91,76,245,.13)"/>';
 s += '<rect class="bh-side" x="' + (bx - 64) + '" y="226" width="' + (bw + 128) + '" height="5" rx="2.5"/>';
 }
 // Main building body
 s += '<path class="bh-shade" d="M' + bx2 + ' ' + top + ' L' + (bx2 + 10) + ' ' + (top + 6) + ' L' + (bx2 + 10) + ' 226 L' + bx2 + ' 226 Z"/>';
 s += '<rect class="bh-facade" x="' + bx + '" y="' + top + '" width="' + bw + '" height="' + (226 - top) + '"/>';
 s += '<rect class="bh-parapet" x="' + (bx - 3) + '" y="' + (top - 6) + '" width="' + (bw + 6) + '" height="6"/>';

 // Roof: water tanks, dish, solar panels
 var tall = top < 52 && !tower;
 if (tower) { // lift machine room and antenna on the roof
   s += '<rect class="bh-parapet" x="171" y="' + (top - 17) + '" width="24" height="11"/><rect class="bh-shade" x="171" y="' + (top - 17) + '" width="24" height="2"/><rect class="bh-glassOff" x="177" y="' + (top - 13) + '" width="12" height="4" rx=".6"/>';
   s += '<rect class="bh-pole" x="190" y="' + (top - 34) + '" width="1.2" height="18"/><circle cx="190.6" cy="' + (top - 34) + '" r="1.4" fill="#FF5A4A" class="bh-blink"/>';
 }
 var tankX = tall ? Math.max(bx + 6, 140) : bx + 4;
 s += '<g transform="translate(' + tankX + ' ' + (top - 26) + ')"><rect class="bh-tankBase" x="0" y="16" width="34" height="4"/><rect x="2" y="2" width="14" height="15" rx="1" fill="url(#' + P + 'TkW)"/><ellipse cx="9" cy="2" rx="7" ry="2.2" fill="#F6F8FC"/><rect x="18" y="4" width="14" height="13" rx="1" fill="url(#' + P + 'TkB)"/><ellipse cx="25" cy="4" rx="7" ry="2.2" fill="#A9C7F2"/></g>';
 if (!tower && (!tall || cols === 4)) s += '<g transform="translate(' + (tall ? tankX + 50 : bx + 66) + ' ' + (top - 16) + ') rotate(-28)"><ellipse rx="6.5" ry="4.3" fill="#E3E8F2"/><ellipse cx="0.5" cy="0.4" rx="4.6" ry="2.8" fill="#C6CEDD"/></g>';
 if (o.solar !== false) {
 var py = top - 3;
 [bx2 - 72, bx2 - 36].forEach(function(px) {
 s += '<path d="M' + (px + 2) + ' ' + py + ' L' + (px + 5) + ' ' + (py - 11) + ' M' + (px + 30) + ' ' + py + ' L' + (px + 27) + ' ' + (py - 11) + '" style="stroke:#4A4560;stroke-width:.9"/>';
 s += '<path d="M' + px + ' ' + py + ' L' + (px + 32) + ' ' + py + ' L' + (px + 27) + ' ' + (py - 12) + ' L' + (px + 5) + ' ' + (py - 12) + ' Z" fill="url(#' + P + 'Pnl)" style="stroke:#C9D8FF;stroke-width:.5"/>';
 s += '<path d="M' + (px + 2.5) + ' ' + (py - 6) + ' H' + (px + 29.5) + ' M' + (px + 16) + ' ' + (py - 12) + ' V' + py + '" style="fill:none;stroke:#8FB0F5;stroke-width:.35"/>';
 });
 }
 if (o.mgrFigure) {
 var mx = tall ? tankX + 42 : bx + 50;
 s += '<g transform="translate(' + mx + ' ' + (top - 6) + ')"><g class="bh-bob">';
 s += '<path d="M-6 0 Q -6 -14 0 -14 Q 6 -14 6 0 Z" fill="#FF6B4A" style="stroke:#FFFFFF;stroke-width:1.3"/>';
 s += '<path d="M5 -10.5 L9.5 -17.5" style="stroke:#FFFFFF;stroke-width:4;stroke-linecap:round"/><path d="M5 -10.5 L9.5 -17.5" style="stroke:#FF6B4A;stroke-width:2.4;stroke-linecap:round"/>';
 s += '<circle cx="0" cy="-18.5" r="4.4" fill="#F1CBA6" style="stroke:#FFFFFF;stroke-width:1.2"/>';
 s += '<path d="M-4.2 -19.5 Q 0 -25 4.2 -19.5 Z" fill="#3B2A22"/>';
 s += '</g></g>';
 }


 // Floors: building core, slabs, AC units
 for (var f = 0; f < floors; f++) {
 var ft = lobbyTop - (f + 1) * fh;
 var coreRects = coreRects || '';
 if (!single && !even) { coreRects += '<rect class="bh-liftLight" x="176" y="' + heroR(ft + fh * 0.18) + '" width="14" height="' + heroR(fh * 0.6) + '" rx="0.6"/>'; }
 if (!single && !even) s += '<rect class="bh-core" x="176" y="' + heroR(ft + fh * 0.18) + '" width="14" height="' + heroR(fh * 0.6) + '" rx="0.6"/>';
 s += '<rect class="bh-slab" x="' + (bx - 4) + '" y="' + heroR(ft + fh * 0.89) + '" width="' + (bw + 8) + '" height="' + heroR(Math.max(2, fh * 0.1)) + '"/>';
 s += '<rect class="bh-slabEdge" x="' + (bx - 4) + '" y="' + heroR(ft + fh * 0.89 + Math.max(2, fh * 0.1)) + '" width="' + (bw + 8) + '" height="0.8"/>';
 if (f % 2 === 1) s += '<rect class="bh-ac" x="' + (bx2 - 9) + '" y="' + heroR(ft + fh * 0.5) + '" width="8" height="5" rx="0.6"/>';
 }

 // Underground floors (SS1, SS2…): a concrete box sunk into the soil, seen in cut-away
 if (basements) {
   var ex0 = o.bare ? bx - 52 : 0, ex1 = o.bare ? bx2 + 52 : 366, eH = bH + 40;
   s += '<rect class="bh-earth" x="' + ex0 + '" y="229" width="' + (ex1 - ex0) + '" height="' + eH + '"' + (o.bare ? ' rx="8"' : '') + '/>';
   s += '<rect x="' + ex0 + '" y="229" width="' + (ex1 - ex0) + '" height="' + eH + '" fill="url(#' + P + 'Soil)"' + (o.bare ? ' rx="8"' : '') + '/>';
   // concrete cut-away: thin grey shell, lighter back wall, slab per level
   s += '<rect class="bh-conc" x="' + (bx + 5) + '" y="229" width="' + (bw - 10) + '" height="' + (bH + 4) + '"/>';
   s += '<rect class="bh-base" x="' + (bx + 6.5) + '" y="231" width="' + (bw - 13) + '" height="' + (bH - 0.5) + '"/>';
   s += '<rect class="bh-concDk" x="' + (bx + 5) + '" y="229" width="1" height="' + (bH + 4) + '"/><rect class="bh-concDk" x="' + (bx2 - 6) + '" y="229" width="1" height="' + (bH + 4) + '"/>';
   for (var bi = 0; bi < basements; bi++) {
     var bt = 231 + bi * fh;
     if (bi > 0) s += '<rect class="bh-conc" x="' + (bx + 6.5) + '" y="' + heroR(bt - 1) + '" width="' + (bw - 13) + '" height="2.4"/>';
     s += '<rect class="bh-floorLine" x="' + (bx + 6.5) + '" y="' + heroR(bt + fh - 2.6) + '" width="' + (bw - 13) + '" height="1.4"/>';
     var sc = [];
     if (!single && !even) {
       var cy0 = bt + fh * 0.16, ch0 = fh * 0.56;
       s += '<rect class="bh-core" x="176" y="' + heroR(cy0) + '" width="14" height="' + heroR(ch0) + '" rx="0.6"/>';
       coreRects += '<rect class="bh-liftLight" x="176" y="' + heroR(cy0) + '" width="14" height="' + heroR(ch0) + '" rx="0.6"/>';
     }
     sc.forEach(function(scx) {
       s += '<circle class="bh-sconceGlow" cx="' + heroR(scx + 1.5) + '" cy="' + heroR(bt + fh * 0.36) + '" r="3.2" filter="url(#' + P + 'Glow)"/>';
       s += '<rect class="bh-sconce" x="' + heroR(scx) + '" y="' + heroR(bt + fh * 0.3) + '" width="2" height="2.8" rx=".5"/>';
     });
   }
 }

 // Windows (one per apartment) + railings
 var rails = '', wi = 0, plants = '';
 // Same building always looks the same: variety is seeded from its name.
 var seed0 = 0, nm = String(o.signText || o.name || 'b');
 for (var ci = 0; ci < nm.length; ci++) seed0 = (seed0 * 31 + nm.charCodeAt(ci)) >>> 0;
 function rnd(i) { var x = Math.sin((seed0 % 9973) * 0.37 + i * 12.9898) * 43758.5453; return x - Math.floor(x); }
 var CURT = ['#7E9E86', '#C98B6B', '#8FA8C8', '#D9C48F', '#B98AA6', '#E9E2D2', '#6F8FA0', '#C2735F'];
 var FLOW = ['#E86A7A', '#F2B441', '#FFFFFF', '#B07CD8', '#F28C38'];
 function plant(x, y, k) {
   if (ww < 15 || fh < 18) return;
   var r = rnd(k), r2 = rnd(k + 0.5);
   if (r < 0.22) return;
   var pot = r2 < 0.5 ? '#8A5A3C' : r2 < 0.8 ? '#B8734E' : '#D8D2C4';
   plants += '<rect x="' + heroR(x) + '" y="' + heroR(y - 2.4) + '" width="6" height="2.4" rx=".4" fill="' + pot + '"/>';
   if (r < 0.45) { // tall cypress
     plants += '<ellipse class="bh-leaf" cx="' + heroR(x + 3) + '" cy="' + heroR(y - 5.6) + '" rx="2" ry="3.6"/>';
   } else if (r < 0.7) { // flowers
     plants += '<circle class="bh-leaf2" cx="' + heroR(x + 1.6) + '" cy="' + heroR(y - 3.2) + '" r="1.5"/><circle class="bh-leaf" cx="' + heroR(x + 4.4) + '" cy="' + heroR(y - 3.2) + '" r="1.5"/>';
     var fc = FLOW[Math.floor(r2 * FLOW.length)];
     plants += '<circle cx="' + heroR(x + 1.4) + '" cy="' + heroR(y - 4.2) + '" r=".7" fill="' + fc + '"/><circle cx="' + heroR(x + 3.2) + '" cy="' + heroR(y - 4.7) + '" r=".7" fill="' + fc + '"/><circle cx="' + heroR(x + 4.8) + '" cy="' + heroR(y - 3.9) + '" r=".7" fill="' + fc + '"/>';
   } else { // round bush
     plants += '<circle class="bh-leaf" cx="' + heroR(x + 1.4) + '" cy="' + heroR(y - 3) + '" r="1.6"/><circle class="bh-leaf2" cx="' + heroR(x + 3.1) + '" cy="' + heroR(y - 3.9) + '" r="1.8"/><circle class="bh-leaf" cx="' + heroR(x + 4.7) + '" cy="' + heroR(y - 3) + '" r="1.5"/>';
   }
 }
 var ww0 = ww;
 // Each side of the stairwell is filled edge to edge, so a side with fewer apartments gets wider ones.
 function jsq(x) { return "'" + String(x).replace(/[^a-zA-Z0-9_ -]/g, '') + "'"; }
 function winX(j, k) {
   if (single) { ww = ww0; return 183 - ww / 2; }
   var L = Math.ceil(k / 2), half = j < L ? 0 : 1, n = half ? k - L : L, kk = half ? j - L : j;
   ww = (perHalf - (n - 1) * gapW) / n;
   return (half ? 183 + 13 : bx + 12) + kk * (ww + gapW);
 }
 function drawWin(w, x, y, wh2) {
   var lit = w.state === 'paid';
   x = heroR(x); y = heroR(y);
   if (w.onclick) {
     var fk = P + seed0 + '-' + wi;
     s += '<g class="bh-win' + (WIN_FLIP[fk] ? ' flip' : '') + '" data-k="' + fk + '" data-go="' + w.onclick + '" role="button" tabindex="0" aria-label="' + esc(w.label || '') + '" onclick="winTap(this,event)" onkeydown=""if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();' + w.onclick + '}">';
     if (w.label) s += '<title>' + esc(w.label) + '</title>';
   } else s += '<g class="bh-win-static">';
   if (lit) s += '<rect class="bh-halo" x="' + x + '" y="' + y + '" width="' + heroR(ww) + '" height="' + heroR(wh2) + '" fill="url(#' + P + 'Warm)" filter="url(#' + P + 'Glow)" opacity=".8"/>';
   s += '<rect class="bh-frame" x="' + heroR(x - 1.2) + '" y="' + heroR(y - 1.2) + '" width="' + heroR(ww + 2.4) + '" height="' + heroR(wh2 + 2.4) + '" rx="1" style="fill:var(--rail)"/>';
   s += '<rect x="' + x + '" y="' + y + '" width="' + heroR(ww) + '" height="' + heroR(wh2) + '" ' + (lit ? 'fill="url(#' + P + 'Warm)"' : 'class="bh-glassOff"') + '/>';
   if (w.onclick) s += '<rect x="' + x + '" y="' + y + '" width="' + heroR(ww) + '" height="' + heroR(wh2) + '" ' + (lit ? 'class="bh-flip bh-glassOff"' : 'class="bh-flip" fill="url(#' + P + 'Warm)"') + '/>';
   var cr = rnd(wi + 100), cc = CURT[Math.floor(rnd(wi + 200) * CURT.length)];
   var open = lit ? 0.12 + cr * 0.12 : 0.3 + cr * 0.2; // share of the pane each curtain covers
   var shW = ww * open, lop = lit ? 0.85 : 0.75;
   if (rnd(wi + 300) < 0.18) { // some keep a roller blind half down instead
     s += '<rect x="' + x + '" y="' + y + '" width="' + heroR(ww) + '" height="' + heroR(wh2 * (0.3 + cr * 0.3)) + '" fill="' + cc + '" opacity="' + lop + '"/>';
   } else {
     [x, heroR(x + ww - shW)].forEach(function(cx0) {
       s += '<rect x="' + cx0 + '" y="' + y + '" width="' + heroR(shW) + '" height="' + heroR(wh2) + '" fill="' + cc + '" opacity="' + lop + '"/>';
       s += '<path d="M' + heroR(cx0 + shW * 0.35) + ' ' + y + 'v' + heroR(wh2) + 'M' + heroR(cx0 + shW * 0.7) + ' ' + y + 'v' + heroR(wh2) + '" stroke="rgba(0,0,0,.13)" stroke-width=".5"/>';
     });
   }
   s += '<rect class="bh-mull" x="' + heroR(x + ww / 2 - 0.6) + '" y="' + y + '" width="1.2" height="' + heroR(wh2) + '"/>';
   if (w.state === 'owes') s += '<circle class="bh-dot" cx="' + heroR(x + ww - 4) + '" cy="' + heroR(y + 4) + '" r="2.6"/>';
   if (o.drops) s += '<circle class="bh-drop" cx="' + heroR(x + ww / 2) + '" cy="' + heroR(y - 1) + '" r="1.8" style="animation-delay:' + (wi * 0.17).toFixed(2) + 's"/>';
   s += '</g>';
   wi++;
 }
 upRows.forEach(function(row, fl) {
   var ft2 = lobbyTop - (fl + 1) * fh;
   row.wins.slice(0, 6).forEach(function(w, j) {
     var x = winX(j, row.wins.length);
     rails += heroRailPath(x, ww, ft2 + fh * 0.64, ft2 + fh * 0.89);
     drawWin(w, x, ft2 + fh * 0.21, wh);
     plant(x + 1, ft2 + fh * 0.64, wi * 2); plant(x + ww - 7, ft2 + fh * 0.64, wi * 2 + 1);
   });
 });
 downRows.forEach(function(row, bi) {
   var bt = 231 + bi * fh;
   row.wins.slice(0, 6).forEach(function(w, j) {
     var x = winX(j, row.wins.length);
     drawWin(w, x, bt + fh * 0.16, fh * 0.56);
     rails += heroRailPath(x, ww, bt + fh * 0.6, bt + fh * 0.88);
     plant(x + 1, bt + fh * 0.6, wi * 2); plant(x + ww - 7, bt + fh * 0.6, wi * 2 + 1);
   });
 });

 // Lobby
 // Elevator: glass shaft on the side wall, cabin wanders between floors and rests
 if (o.elevator && fh >= 14) {
   var mid = !single && !even, shX = mid ? 179.75 : bx2 + 2, shTop = top + 8, shBot = basements ? 231 + basements * fh - 3 : 225;
   if (!mid) {
     s += '<rect class="bh-shaft" x="' + heroR(shX) + '" y="' + heroR(shTop) + '" width="6.5" height="' + heroR(shBot - shTop) + '" rx=".8"/>';
     s += '<path class="bh-cable" d="M' + heroR(shX + 3.25) + ' ' + heroR(shTop) + 'V' + heroR(shBot) + '"/>';
   }
   var cabH = mid ? fh * 0.6 : Math.min(9, fh * 0.55);
   function stopY(lv) { // lv: 0 lobby, 1..floors up, -1..-basements down
     if (mid && lv > 0) return lobbyTop - lv * fh + fh * 0.18;
     if (mid && lv < 0) return 231 + (-lv - 1) * fh + fh * 0.16;
     if (lv > 0) return lobbyTop - lv * fh + fh * 0.84 - cabH;
     if (lv < 0) return 231 + (-lv) * fh - 2.6 - cabH;
     return 225 - cabH;
   }
   // JS drives the cabin (see liftTick) so a tap can send it somewhere
   var stops = [];
   for (var lvv = -basements; lvv <= floors; lvv++) stops.push(lvv + ':' + heroR(stopY(lvv)));
   var lkey = P + seed0;
   var cabOpen = '<g class="bh-cabMove" data-key="' + esc(lkey) + '" data-stops="' + stops.join(',') + '" transform="translate(0 ' + heroR(LIFT[lkey] ? LIFT[lkey].y : stopY(0)) + ')">';
   if (mid) s += coreRects.replace(/<rect class="bh-liftLight" x="176" y="([\d.]+)" width="14" height="([\d.]+)"/g, function(m, y, h) { return '<rect class="bh-liftLight" x="176" y="' + y + '" width="14" height="0" data-y0="' + y + '" data-y1="' + heroR(+y + +h) + '"'; }) + cabOpen.replace('>', ' data-cabh="' + heroR(cabH) + '" data-mid="1">') + '</g>';
   else s += cabOpen + '<g class="bh-cab"><rect x="' + heroR(shX + 0.8) + '" y="0" width="4.9" height="' + heroR(cabH) + '" rx=".6"/><rect class="bh-cabLit" x="' + heroR(shX + 1.6) + '" y="1.2" width="3.3" height="' + heroR(cabH - 2.4) + '" rx=".4"/></g></g>';
   // tap area over the shaft: tap a floor and the elevator goes there
   s += '<rect class="bh-liftTap" x="' + heroR(mid ? 173 : shX - 2) + '" y="' + heroR(shTop - 4) + '" width="' + (mid ? 20 : 10.5) + '" height="' + heroR(shBot - shTop + 8) + '" fill="transparent" onclick="liftTap(event,this,' + jsq(lkey) + ')"/>';
 }
 s += '<rect class="bh-lobby" x="' + bx + '" y="' + lobbyTop + '" width="' + bw + '" height="29"/>';
 s += '<rect class="bh-parapet" x="156" y="199" width="54" height="3" rx="0.6"/>';
 s += '<rect class="bh-doorFrame" x="168" y="204.5" width="30" height="21.5"/><rect class="bh-doorGlass" x="169.5" y="206" width="27" height="20"/><rect class="bh-doorFrame" x="182.6" y="206" width="0.8" height="20"/>';
 var signTxt = String(o.signText || 'Building').toUpperCase().slice(0, 12);
 s += '<rect x="' + (bx + 6) + '" y="204" width="44" height="9" rx="1.5" fill="#FFF1D0"/>';
 s += '<text id="' + P + '-sign" x="' + (bx + 28) + '" y="210.6" style="font-size:5.2px;font-weight:800;letter-spacing:.5px;fill:#2B2858;text-anchor:middle"' + (signTxt.length > 8 ? ' textLength="38" lengthAdjust="spacingAndGlyphs"' : '') + '>' + esc(signTxt) + '</text>';
 s += '<rect x="158" y="220" width="6" height="6" rx="0.6" fill="#7A4E3A"/><ellipse class="bh-leaf" cx="161" cy="216.5" rx="4" ry="5"/>';
 s += '<rect x="202" y="220" width="6" height="6" rx="0.6" fill="#7A4E3A"/><ellipse class="bh-leaf" cx="205" cy="216.5" rx="4" ry="5"/>';

 // Street
 if (!o.bare) {
 s += '<g class="bh-bg"><rect class="bh-side" x="0" y="226" width="366" height="' + (basements ? 5 : 7) + '"/>';
 if (!basements) {
   s += '<rect class="bh-street" x="0" y="233" width="366" height="23"/>';
   for (var lx = 14; lx < 366; lx += 48) s += '<rect class="bh-lane" x="' + lx + '" y="245" width="16" height="1.4"/>';
 }
 s += '</g>';
 }

 // Railings drawn over the windows
 if (rails) s += '<path class="bh-rail" d="' + rails + '" style="stroke-width:.6"/>';
 s += plants;
 // Ground-floor plinth: a wide light slab with a soft lip, like a podium
 if (basements) {
   s += '<rect class="bh-plinthLip" x="' + (bx - 48) + '" y="228" width="' + (bw + 96) + '" height="2.2" rx="1.1"/>';
   s += '<rect class="bh-plinth" x="' + (bx - 52) + '" y="223.5" width="' + (bw + 104) + '" height="5" rx=".6"/>';
   s += '<rect class="bh-plinthHi" x="' + (bx - 52) + '" y="223.5" width="' + (bw + 104) + '" height=".8"/>';
 }
 // Hedges along the pavement either side of the entrance
 [[bx - 46, bx - 6], [bx2 + 14, bx2 + 50]].forEach(function(seg, si) {
   if (!o.bare && !basements) return;
   for (var hx = seg[0]; hx < seg[1]; hx += 5.5) {
     var hr = 2.8 + ((hx * 7 + si * 3) % 5) * 0.35;
     s += '<circle class="' + (Math.round(hx) % 2 ? 'bh-leaf' : 'bh-leaf2') + '" cx="' + heroR(hx) + '" cy="' + heroR(226 - hr * 0.6) + '" r="' + heroR(hr) + '"/>';
   }
 });

 // Left side: supplier box (Moteur / Internet) or a tree
 var tx = bx - 22;
 if (o.supStream) {
 s += '<path class="bh-stream" d="M' + bx + ' 214 C ' + (bx - 10) + ' 214, ' + (bx - 12) + ' 210, ' + (bx - 18) + ' 210" style="stroke:#F59E0B"/>';
 s += '<g transform="translate(' + (bx - 58) + ' 196)"><g class="bh-pop"><rect width="40" height="30" rx="5" fill="#FFF3DC" style="stroke:#F59E0B;stroke-width:1.6"/><path d="M22 6 L14 16 H20 L18 24 L27 13 H21 Z" style="fill:none;stroke:#B45309;stroke-width:1.4;stroke-linejoin:round"/></g></g>';
 } else if (!o.bare) {
 s += '<g class="bh-bg">';
 s += '<path class="bh-trunk" d="M' + tx + ' 226 Q ' + (tx + 1) + ' 214 ' + (tx - 1) + ' 206"/>';
 s += '<circle class="bh-leaf" cx="' + tx + '" cy="200" r="11"/><circle class="bh-leaf" cx="' + (tx - 10) + '" cy="207" r="9"/><circle class="bh-leaf" cx="' + (tx + 10) + '" cy="208" r="9"/><circle class="bh-leaf2" cx="' + (tx + 5) + '" cy="196" r="4.5"/><circle class="bh-leaf2" cx="' + (tx - 7) + '" cy="203" r="3.5"/>';
 s += '</g>';
 }

 // Right side: the building safe, or the street lamp
 function safeLabel() {
   var u = Math.max(0, Math.round(o.safe.usd || 0)), l = Math.max(0, o.safe.lbp || 0);
   return '$' + u.toLocaleString('en-US');
 }
 // A little steel safe with its door ajar: green notes = dollars, blue = lira.
 function safeBox(w, h, scale) {
   var u = Math.min(1, (o.safe.usdH - 2) / 20), l = Math.min(1, (o.safe.lbpH - 2) / 20);
   var g = '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="2.2" class="bh-safeBody"/>';
   g += '<rect x="2" y="2" width="' + (w - 4) + '" height="' + (h - 4) + '" rx="1.2" class="bh-safeIn"/>';
   var sh = h - 6, nU = Math.max(1, Math.round(u * 5)), nL = Math.max(1, Math.round(l * 5));
   for (var i = 0; i < nU; i++) g += '<rect x="4" y="' + heroR(h - 3.5 - (i + 1) * sh / 6) + '" width="' + heroR(w * 0.3) + '" height="' + heroR(sh / 6 - 0.6) + '" rx=".5" fill="#22B07D"/>';
   for (var j = 0; j < nL; j++) g += '<rect x="' + heroR(5 + w * 0.3) + '" y="' + heroR(h - 3.5 - (j + 1) * sh / 6) + '" width="' + heroR(w * 0.22) + '" height="' + heroR(sh / 6 - 0.6) + '" rx=".5" fill="#3B9EFF"/>';
   // door swung open to the right
   g += '<path d="M' + w + ' 1 L' + heroR(w + w * 0.28) + ' 4 L' + heroR(w + w * 0.28) + ' ' + (h - 4) + ' L' + w + ' ' + (h - 1) + ' Z" class="bh-safeDoor"/>';
   g += '<circle cx="' + heroR(w + w * 0.14) + '" cy="' + heroR(h / 2) + '" r="' + heroR(Math.min(3, w * 0.08)) + '" class="bh-safeDial"/>';
   return g;
 }
 if (o.safe) {
   var tapA = o.safe.tap ? ' class="bh-safeTap" role="button" tabindex="0" onclick="' + o.safe.tap + '"' : '';
   var st = o.safe.style;
   if (st === 'lobby') {
     // A grey safe set into the lobby wall. Closed by default; tap opens it to show the cash, tap again for the books.
     var sw = 30, shh = 24, nx = Math.max(213, bx2 - sw - 9), ny = 200;
     var u = Math.min(1, (o.safe.usdH - 2) / 20), l = Math.min(1, (o.safe.lbpH - 2) / 20);
     var tapS = o.safe.tap ? ' role="button" tabindex="0" onclick="safeTap(this,event)" data-go="' + o.safe.tap + '"' : '';
     s += '<g class="bh-safe bh-safeTap' + (SAFE_OPEN ? ' open' : '') + '"' + tapS + '>';
     s += '<rect x="' + nx + '" y="' + ny + '" width="' + sw + '" height="' + shh + '" rx="3.4" class="bh-safeBody"/>';
     // inside (seen when open)
     s += '<g class="bh-safeOpenG" style="display:' + (SAFE_OPEN ? 'inline' : 'none') + '"><rect x="' + (nx + 2.5) + '" y="' + (ny + 2.5) + '" width="' + (sw - 5) + '" height="' + (shh - 5) + '" rx="1.4" class="bh-safeIn"/>';
     s += '<rect x="' + (nx + 2.5) + '" y="' + heroR(ny + shh / 2) + '" width="' + (sw - 5) + '" height=".9" class="bh-safeShelf"/>';
     function stacks(x0, yb, n, c1, c2) {
       var o2 = '';
       for (var i = 0; i < n; i++) o2 += '<rect x="' + heroR(x0 + (i % 2) * 0.6) + '" y="' + heroR(yb - (i + 1) * 1.5) + '" width="9" height="1.3" rx=".3" fill="' + (i % 2 ? c1 : c2) + '"/>';
       return o2;
     }
     var nU = Math.max(1, Math.round(u * 6)), nL = Math.max(1, Math.round(l * 6));
     // dollars only: up to 4 stacks per shelf, filling the bottom shelf first
     var piles = Math.max(1, Math.round(u * 4));
     for (var pi = 0; pi < piles; pi++) s += stacks(nx + 3.6 + pi * 5.6, ny + shh - 2.8, 2 + Math.round(u * 3) + (pi * 7 % 2), '#2BC48C', '#1E9E70').replace(/width="9"/g, 'width="4.8"');
     // door swung open to the right
     s += '<path d="M' + (nx + sw) + ' ' + (ny + 1) + ' L' + (nx + sw + 7) + ' ' + (ny - 1) + ' L' + (nx + sw + 7) + ' ' + (ny + shh + 1) + ' L' + (nx + sw) + ' ' + (ny + shh - 1) + ' Z" class="bh-safeDoor"/>';
     [0.3, 0.5, 0.7].forEach(function(f) { s += '<circle cx="' + (nx + sw + 3.6) + '" cy="' + heroR(ny + shh * f) + '" r=".8" class="bh-safeBolt"/>'; });
     // the amount, in a big speech bubble above the safe
     var bwB = 64, bhB = 30, bx0 = Math.min(bx2 + 4 - bwB, nx + sw / 2 - bwB / 2), by0 = ny - bhB - 8;
     var bub = '<g class="bh-safeBubble" style="display:' + (SAFE_OPEN ? 'inline' : 'none') + '" onclick="safeTap(document.querySelector(\'.bh-safe\'),event)">';
     bub += '<path d="M' + heroR(nx + sw / 2 - 4) + ' ' + (by0 + bhB - 1) + ' L' + heroR(nx + sw / 2) + ' ' + (ny - 2) + ' L' + heroR(nx + sw / 2 + 4) + ' ' + (by0 + bhB - 1) + ' Z" class="bh-bubble"/>';
     bub += '<rect x="' + heroR(bx0) + '" y="' + by0 + '" width="' + bwB + '" height="' + bhB + '" rx="7" class="bh-bubble"/>';
     bub += '<text x="' + heroR(bx0 + bwB / 2) + '" y="' + (by0 + 17) + '" class="bh-bubbleAmt">' + esc(safeLabel()) + '</text>';
     bub += '<text x="' + heroR(bx0 + bwB / 2) + '" y="' + (by0 + 25.5) + '" class="bh-bubbleSub">' + esc(o.safe.sub || 'in the safe') + '</text>';
     bub += '</g>'; SAFE_BUB = bub;
     s += '</g>';
     // closed door
     var cx = nx + sw * 0.6, cy = ny + shh / 2;
     s += '<g class="bh-safeClosedG" style="display:' + (SAFE_OPEN ? 'none' : 'inline') + '"><rect x="' + (nx + 2.5) + '" y="' + (ny + 2.5) + '" width="' + (sw - 5) + '" height="' + (shh - 5) + '" rx="1.6" class="bh-safeFace"/>';
     s += '<rect x="' + (nx + sw - 1.4) + '" y="' + (ny + 4.5) + '" width="1.4" height="3.4" rx=".4" class="bh-safeBolt"/><rect x="' + (nx + sw - 1.4) + '" y="' + (ny + shh - 8) + '" width="1.4" height="3.4" rx=".4" class="bh-safeBolt"/>';
     s += '<circle cx="' + heroR(nx + 6.5) + '" cy="' + heroR(cy - 2.5) + '" r="1.1" class="bh-safeKnob"/><rect x="' + heroR(nx + 6) + '" y="' + heroR(cy - 2.5) + '" width="1" height="5" rx=".5" class="bh-safeKnob"/>';
     s += '<circle cx="' + heroR(cx) + '" cy="' + heroR(cy) + '" r="5" class="bh-safeDialRing"/><circle cx="' + heroR(cx) + '" cy="' + heroR(cy) + '" r="3.2" class="bh-safeDial"/><circle cx="' + heroR(cx) + '" cy="' + heroR(cy) + '" r="1.2" class="bh-safeKnob"/>';
     for (var tk = 0; tk < 12; tk++) { var an = tk * Math.PI / 6; s += '<line x1="' + heroR(cx + Math.cos(an) * 4.1) + '" y1="' + heroR(cy + Math.sin(an) * 4.1) + '" x2="' + heroR(cx + Math.cos(an) * 4.8) + '" y2="' + heroR(cy + Math.sin(an) * 4.8) + '" class="bh-safeTick"/>'; }
     s += '</g></g>';
   } else if (st === 'plaque') {
     // A brass plaque by the door, like the building number, with two coin stacks
     var px = Math.min(bx2 - 40, 212);
     s += '<g' + tapA + '><rect x="' + px + '" y="203" width="36" height="14" rx="2" class="bh-brass"/>';
     s += '<circle cx="' + (px + 6) + '" cy="210" r="3.4" fill="#22B07D"/><circle cx="' + (px + 13) + '" cy="210" r="3.4" fill="#3B9EFF"/>';
     s += '<text x="' + (px + 27) + '" y="211.6" class="bh-brassTx">' + esc(safeLabel()) + '</text></g>';
   } else {
     // Free-standing safe on the pavement, with a tag showing the amount
     var sx = bx2 + 18;
     if (o.fixedStream) s += '<path class="bh-stream" d="M' + bx2 + ' 214 C ' + (bx2 + 8) + ' 214, ' + (bx2 + 10) + ' 212, ' + sx + ' 212" style="stroke:#A99DFF"/>';
     s += '<g' + tapA + '><g transform="translate(' + sx + ' 196)"><g class="bh-pop">';
     s += '<rect x="3" y="27" width="4" height="3" rx=".6" class="bh-safeFoot"/><rect x="21" y="27" width="4" height="3" rx=".6" class="bh-safeFoot"/>';
     s += safeBox(28, 27);
     s += '<rect x="-2" y="-11" width="38" height="8" rx="4" class="bh-tag"/><text x="17" y="-5.3" class="bh-tagTx">' + esc(safeLabel()) + '</text>';
     s += '</g></g></g>';
   }
  }
 if ((!o.safe || o.safe.style === 'lobby' || o.safe.style === 'plaque') && !o.bare) {
 s += '<g class="bh-bg">';
 var lpx = Math.min(346, bx2 + 44);
 s += '<path class="bh-lampglow" d="M' + (lpx - 13) + ' 166 L ' + (lpx - 32) + ' 226 L ' + (lpx + 14) + ' 226 L ' + (lpx - 7) + ' 166 Z" fill="url(#' + P + 'Cone)"/>';
 s += '<circle class="bh-lampglow" cx="' + (lpx - 10) + '" cy="163" r="6" fill="#FFE6A6" filter="url(#' + P + 'Blur)"/>';
 s += '<rect class="bh-pole" x="' + lpx + '" y="162" width="1.8" height="64"/>';
 s += '<path d="M' + (lpx + 1) + ' 164 Q ' + (lpx + 1) + ' 156 ' + (lpx - 9) + ' 156" style="fill:none;stroke:var(--pole);stroke-width:1.5"/>';
 s += '<path class="bh-pole" d="M' + (lpx - 14.5) + ' 156 L' + (lpx - 5.5) + ' 156 L' + (lpx - 7.5) + ' 159.4 L' + (lpx - 12.5) + ' 159.4 Z"/>';
 s += '<ellipse class="bh-bulb" cx="' + (lpx - 10) + '" cy="160" rx="2.4" ry="1.1"/>';
 if (lpx + 12 < 360) s += '<rect x="' + (lpx + 8) + '" y="218" width="6" height="8" rx="0.8" fill="#1C8A5E"/><rect x="' + (lpx + 7.5) + '" y="216.8" width="7" height="1.8" rx="0.5" fill="#2BB37C"/>';
 s += '</g>';
 }

 // Natour at the door
 if (o.natourFigure) {
 s += '<g transform="translate(214 0)">';
 if (o.natourAmt) {
 var bwid = 8 + o.natourAmt.length * 4.4;
 s += '<g class="bh-bob"><rect x="17" y="199" width="' + heroR(bwid) + '" height="10" rx="5" fill="#FFFFFF" style="stroke:#F59E0B;stroke-width:1"/>';
 s += '<text x="' + heroR(17 + bwid / 2) + '" y="206.3" style="font-size:6px;font-weight:800;fill:#7A4A00;text-anchor:middle">' + esc(o.natourAmt) + '</text></g>';
 }
 s += '<circle cx="9" cy="203" r="4" fill="#F1CBA6"/><path d="M4.8 202 Q 9 196.8 13.2 202 L 15 202.3 L 13.2 203 Z" fill="#F59E0B"/>';
 s += '<path d="M3.5 226 Q 3.5 208 9 208 Q 14.5 208 14.5 226 Z" fill="#F59E0B"/>';
 s += '</g>';
 }

 if (o.safe && SAFE_BUB) { s += SAFE_BUB; SAFE_BUB = ''; }
 s += '</svg>';

 var cls = 'bh ' + ph.key + (o.elevator ? ' lift' : o.coreGlow ? ' elev' : '') + (o.dropsOn ? ' drops' : '') + (o.extraCls ? ' ' + o.extraCls : '');
 return '<div class="' + cls + (tower ? ' tower' : '') + '"' + (tower && !o.bare ? ' style="aspect-ratio:366/' + vbH + '"' : '') + '>' + s + (o.chip ? '<button class="bh-chip" id="bh-time" onclick="heroChipTap()"><i style="background:' + (o.chip.dot || '#F5A524') + '"></i><span>' + esc(o.chip.tx || o.chip) + '</span></button>' : '') + '</div>';
}
/* Confetti shower used when setup finishes. */
function launchConfetti() {
 var layer = document.createElement('div');
 layer.className = 'cf-layer';
 var colors = ['#FFC857', '#5B4CF5', '#10B981', '#3B9EFF', '#F59E0B', '#FF6B8A', '#8B7BFF'];
 var html = '';
 for (var i = 0; i < 70; i++) {
 var left = Math.random() * 100, dur = 2.2 + Math.random() * 1.8, delay = Math.random() * 0.9;
 html += '<i style="left:' + left.toFixed(1) + '%;background:' + colors[i % colors.length] + ';animation-duration:' + dur.toFixed(2) + 's;animation-delay:' + delay.toFixed(2) + 's;transform:rotate(' + Math.round(Math.random() * 360) + 'deg)"></i>';
 }
 layer.innerHTML = html;
 document.body.appendChild(layer);
 setTimeout(function() { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 4800);
}

/* Scene taps: one tap plays (light, safe door, elevator), two quick taps navigate. */
var SAFE_BUB = '', SAFE_OPEN = false, WIN_FLIP = {}, LIFT = {}, LAST_TAP = { el: null, t: 0 };
function isDoubleTap(el) {
  var now = Date.now(), d = LAST_TAP.el === el && now - LAST_TAP.t < 350;
  LAST_TAP = d ? { el: null, t: 0 } : { el: el, t: now };
  return d;
}
function runGo(el) { var g = el.getAttribute('data-go'); if (g) (new Function(g))(); }
function safeShow(el, open) {
  el.classList.toggle('open', open);
  var o = el.querySelector('.bh-safeOpenG'), c = el.querySelector('.bh-safeClosedG');
  if (o) o.style.display = open ? 'inline' : 'none';
  if (c) c.style.display = open ? 'none' : 'inline';
  var b = el.ownerSVGElement && el.ownerSVGElement.querySelector('.bh-safeBubble');
  if (b) b.style.display = open ? 'inline' : 'none';
}
function safeTap(el, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  if (isDoubleTap(el)) { SAFE_OPEN = true; safeShow(el, true); return runGo(el); }
  SAFE_OPEN = !el.classList.contains('open');
  safeShow(el, SAFE_OPEN);
}
function winTap(el, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var k = el.getAttribute('data-k');
  if (isDoubleTap(el)) { el.classList.toggle('flip'); WIN_FLIP[k] = el.classList.contains('flip'); return runGo(el); }
  el.classList.toggle('flip'); WIN_FLIP[k] = el.classList.contains('flip');
}
/* Elevator: wanders on its own, and goes to the floor you tap. */
function liftTap(ev, el, key) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  var svg = el.ownerSVGElement, cab = svg && svg.querySelector('.bh-cabMove');
  if (!cab) return;
  var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  var y = pt.matrixTransform(svg.getScreenCTM().inverse()).y;
  var stops = liftStops(cab), best = stops[0], st = LIFT[key];
  stops.forEach(function(p) { if (Math.abs(p.y + 4 - y) < Math.abs(best.y + 4 - y)) best = p; });
  if (st && Math.abs(st.y - best.y) < 0.5 && !st.moving) { var others = stops.filter(function(p) { return p !== best; }); best = others[Math.floor(Math.random() * others.length)] || best; }
  liftGo(key, best.y, 1.2);
}
function liftStops(cab) { return cab.getAttribute('data-stops').split(',').map(function(p) { var a = p.split(':'); return { lv: +a[0], y: +a[1] }; }); }
function liftGo(key, y, wait) {
  var st = LIFT[key]; if (!st) return;
  var dist = Math.abs(y - st.y);
  st.from = st.y; st.to = y; st.t0 = performance.now(); st.dur = Math.max(400, dist * 45); st.moving = true; st.restUntil = 0; st.wait = wait;
}
function liftTick(now) {
  document.querySelectorAll('.bh-cabMove').forEach(function(cab) {
    var key = cab.getAttribute('data-key'), stops = liftStops(cab);
    var st = LIFT[key];
    if (!st) {
      var lobby = stops.filter(function(p) { return p.lv === 0; })[0] || stops[0];
      st = LIFT[key] = { y: lobby.y, moving: false, restUntil: now + 2500 + Math.random() * 3000 };
    }
    if (st.moving) {
      var p = Math.min(1, (now - st.t0) / st.dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      st.y = st.from + (st.to - st.from) * e;
      if (p >= 1) { st.moving = false; st.restUntil = now + (st.wait || (2 + Math.random() * 4)) * 1000 + (Math.random() < .3 ? 6000 : 0); }
    } else if (now > st.restUntil && stops.length > 1) {
      var choices = stops.filter(function(q) { return Math.abs(q.y - st.y) > 0.5; });
      var nx = choices[Math.floor(Math.random() * choices.length)];
      if (Math.random() < .35) nx = stops.filter(function(q) { return q.lv === 0; })[0] || nx;
      if (Math.abs(nx.y - st.y) < 0.5) nx = choices[0];
      liftGo(key, nx.y, 0);
    }
    cab.setAttribute('transform', 'translate(0 ' + st.y.toFixed(2) + ')');
    if (cab.getAttribute('data-mid')) {
      var ch = +cab.getAttribute('data-cabh'), c0 = st.y, c1 = st.y + ch;
      cab.parentNode.querySelectorAll('.bh-liftLight').forEach(function(r) {
        var y0 = +r.getAttribute('data-y0'), y1 = +r.getAttribute('data-y1'), a = Math.max(y0, c0), b = Math.min(y1, c1);
        if (b > a) { r.setAttribute('y', a.toFixed(2)); r.setAttribute('height', (b - a).toFixed(2)); } else r.setAttribute('height', '0');
      });
    }
  });
  requestAnimationFrame(liftTick);
}
if (typeof requestAnimationFrame !== 'undefined' && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) requestAnimationFrame(liftTick);
