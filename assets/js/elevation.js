/* PCT elevation profile + self-configuring home hero
   Reads data/pct_profile.json (km + m + lat/lon) and data/latest.json (live GPS).
   Renders the end-to-end climb (regions, passes, side trips, resupply towns,
   national parks, live marker) and — when the matching elements exist — fills the
   home hero (headline, sub, quick stats), the map callout and the progress bar.
   Resupply-town labels enlarge on hover. Curated annotations are keyed to a
   nominal 4265 km trail and scaled onto the real measured length; passes snap to
   the local peak so they sit on summits. avg/day and days-out are read from the
   stats map.js renders (no map.js changes needed). */
(function () {
  "use strict";
  var BASE = "/pct-tracker/";
  var NOMINAL = 4265;

  var REGIONS = [
    { name: "Southern California", a: 0, b: 1100, c: "#e0a06a", st: "CA" },
    { name: "Southern Sierra", a: 1100, b: 1800, c: "#9dbf78", st: "CA" },
    { name: "Northern Sierra", a: 1800, b: 2150, c: "#7fb08a", st: "CA" },
    { name: "NorCal / C. Oregon", a: 2150, b: 2850, c: "#6fae9e", st: "OR" },
    { name: "Central Cascades", a: 2850, b: 3600, c: "#8aa4c0", st: "OR" },
    { name: "North Cascades", a: 3600, b: 4265, c: "#b39ac8", st: "WA" }
  ];
  var PASSES = [
    { km: 290, n: "San Jacinto", ly: 12, anc: "middle", dx: 0 },
    { km: 610, n: "Mt. Baden-Powell", side: true, ly: 26, anc: "middle", dx: 0 },
    { km: 1235, n: "Mt. Whitney", side: true, ly: 12, anc: "end", dx: -5 },
    { km: 1300, n: "Forester Pass", sub: "4,009 m", ly: 40, anc: "end", dx: -5 },
    { km: 1430, n: "Muir Pass", ly: 12, anc: "start", dx: 5 },
    { km: 1490, n: "Half Dome", side: true, ly: 26, anc: "start", dx: 5 },
    { km: 1700, n: "Sonora Pass", ly: 40, anc: "middle", dx: 0 }
  ];
  var TOWNS = [[68,"Mt Laguna"],[175,"Warner Springs"],[290,"Idyllwild"],[435,"Big Bear"],[605,"Wrightwood"],[730,"Agua Dulce"],[915,"Tehachapi"],[1128,"Kennedy Mdws"],[1230,"Lone Pine"],[1290,"Bishop"],[1400,"VVR"],[1450,"Mammoth"],[1510,"Tuolumne"],[1690,"Bridgeport"],[1885,"S Lake Tahoe"],[2020,"Sierra City"],[2130,"Belden"],[2200,"Chester"],[2330,"Burney"],[2510,"Mt Shasta"],[2670,"Etna"],[2760,"Seiad Valley"],[2870,"Ashland"],[2985,"Mazama"],[3230,"Sisters"],[3430,"Timberline"],[3540,"Cascade Locks"],[3620,"Trout Lake"],[3760,"White Pass"],[3870,"Snoqualmie"],[3990,"Stevens Pass"],[4165,"Stehekin"]];
  var LAND = [
    { km: 290, n: "San Jacinto", t: "mark" },
    { km: 870, n: "Mojave Desert", t: "desert" },
    { km: 1130, n: "Kennedy Meadows", t: "mark" },
    { km: 1500, n: "Yosemite NP", t: "park" },
    { km: 1950, n: "Lake Tahoe", t: "mark" },
    { km: 2350, n: "Lassen Volcanic NP", t: "park" },
    { km: 2900, n: "Crater Lake NP", t: "park" },
    { km: 3450, n: "Mt. Hood", t: "mark" },
    { km: 4050, n: "North Cascades NP", t: "park" }
  ];
  var WAY = TOWNS.concat([[0, "Campo"], [1300, "Forester Pass"], [1700, "Sonora Pass"], [4265, "Manning Park"]]);

  function haversine(la1, lo1, la2, lo2) {
    var R = 6371.0088, p1 = la1 * Math.PI / 180, p2 = la2 * Math.PI / 180;
    var dp = (la2 - la1) * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
  function setHTML(id, html) { var e = document.getElementById(id); if (e) e.innerHTML = html; }
  function setText(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }

  function injectCSS() {
    if (document.getElementById("elCSS")) return;
    var s = document.createElement("style");
    s.id = "elCSS";
    s.textContent =
      ".el-card{background:#fff;border:1px solid #e8e6da;border-radius:22px;padding:20px 20px 12px;box-shadow:0 1px 2px rgba(20,32,28,.04),0 14px 40px rgba(20,32,28,.06);color:#1e241c}" +
      ".el-head{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:4px}" +
      ".el-head h2{margin:0;font:600 21px/1.1 'Fraunces',Georgia,serif;letter-spacing:-.01em}" +
      ".el-now{font-size:13px;color:#6c7365}.el-now b{color:#1e241c}" +
      ".el-prof{position:relative}.el-prof svg{display:block;width:100%;height:auto;overflow:visible}" +
      ".el-town{transition:font-size .1s ease,fill .1s ease}" +
      ".el-town:hover{font-size:11.5px;font-weight:700;fill:#1e241c}" +
      ".el-chip{position:absolute;transform:translate(-50%,-100%);background:#1e241c;color:#fff;border-radius:10px;padding:7px 11px;font:12px/1.35 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.22);pointer-events:none}" +
      ".el-chip b{font-weight:700}.el-chip .k{color:#f0b48a}" +
      ".el-chip::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#1e241c}" +
      ".el-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font:11.5px Inter,system-ui,sans-serif;color:#6c7365}" +
      ".el-legend span{display:inline-flex;align-items:center;gap:6px}";
    document.head.appendChild(s);
  }

  function localMax(S, center, win) {
    var bk = center, bm = -1e9;
    for (var i = 0; i < S.length; i++) {
      if (Math.abs(S[i][0] - center) <= win && S[i][1] > bm) { bm = S[i][1]; bk = S[i][0]; }
    }
    return { km: bk, m: bm };
  }

  var CUR = null, TOTAL_KM = NOMINAL;

  function nearestWaypoint(km, F) {
    var best = "the trail", bd = 1e18;
    for (var i = 0; i < WAY.length; i++) {
      var d = Math.abs(WAY[i][0] * F - km);
      if (d < bd) { bd = d; best = WAY[i][1]; }
    }
    return best;
  }

  function fillHero(reg, F) {
    if (!CUR) return;
    var toGo = Math.max(0, TOTAL_KM - CUR.km);
    var pct = Math.round((CUR.km / TOTAL_KM) * 100);
    var near = nearestWaypoint(CUR.km, F);
    setHTML("heroTitle", "I'm in the <em>" + reg.name + "</em> right now.");
    setHTML("heroSub", "<b>" + fmt(CUR.km) + " km</b> from Campo &middot; nearest waypoint <b>" + near +
      "</b> &middot; <b>" + fmt(toGo) + " km</b> still to Canada.");
    setText("heroPct", pct);
    setText("pPct", pct + "%");
    setText("pRem", fmt(toGo) + " km");
    var pf = document.getElementById("pFill"); if (pf) pf.style.width = pct + "%";
    setHTML("mPlace", reg.name + ", " + reg.st);
    setHTML("mMeta", "Near " + near + " &middot; <b>" + fmt(CUR.km) + " km</b> &middot; " + fmt(CUR.m) + " m");
  }

  function grabStats() {
    var ins = document.getElementById("insightsList");
    if (!ins || !CUR) return false;
    var m = ins.textContent.match(/(\d+)\s*active days/);
    if (!m) return false;
    var days = parseInt(m[1], 10);
    setText("heroDays", days);
    setText("heroDay", "Day " + days);
    if (days > 0) setText("heroAvg", (CUR.km / days).toFixed(1));
    return true;
  }

  function watchStats() {
    if (!document.getElementById("heroDays")) return;
    if (grabStats()) return;
    var ins = document.getElementById("insightsList");
    if (!ins) return;
    var obs = new MutationObserver(function () { if (grabStats()) obs.disconnect(); });
    obs.observe(ins, { childList: true, subtree: true, characterData: true });
    setTimeout(function () { if (grabStats()) obs.disconnect(); }, 4000);
  }

  function render(container, data, latest) {
    var TOTAL = data.total_km;
    TOTAL_KM = TOTAL;
    var pts = data.points;
    var S = pts.map(function (p) { return [p.km, p.m]; });
    var F = TOTAL / NOMINAL;

    var cur = { km: 0, m: S[0][1] };
    if (latest && typeof latest.lat === "number") {
      var best = null, bd = 1e18;
      for (var i = 0; i < pts.length; i++) {
        var d = haversine(latest.lat, latest.lon, pts[i].lat, pts[i].lon);
        if (d < bd) { bd = d; best = pts[i]; }
      }
      if (best) cur = { km: best.km, m: best.m };
    }
    CUR = cur;
    var reg = REGIONS.find(function (r) { return cur.km >= r.a * F && cur.km < r.b * F; }) || REGIONS[REGIONS.length - 1];

    fillHero(reg, F);
    watchStats();

    if (!container) return;

    var W = 1000, H = 310, PADL = 42, PADR = 10, PADT = 56, baseY = 200, maxM = 3900;
    function x(km) { return PADL + (km / TOTAL) * (W - PADL - PADR); }
    function y(m) { return PADT + (1 - m / maxM) * (baseY - PADT); }
    var markX = x(cur.km), markY = y(cur.m);

    var line = "M " + x(S[0][0]).toFixed(1) + " " + y(S[0][1]).toFixed(1);
    S.forEach(function (pt) { line += " L " + x(pt[0]).toFixed(1) + " " + y(pt[1]).toFixed(1); });
    var area = line + " L " + x(TOTAL) + " " + baseY + " L " + x(0) + " " + baseY + " Z";

    var grid = "";
    [0, 1500, 3000].forEach(function (m) {
      var gy = y(m);
      grid += '<line x1="' + PADL + '" y1="' + gy + '" x2="' + (W - PADR) + '" y2="' + gy + '" stroke="#00000010"/>' +
              '<text x="' + (PADL - 6) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="10" fill="#9aa08f" font-family="Inter">' + (m === 0 ? "0" : m / 1000 + "k") + '</text>';
    });

    var bY = baseY + 8, bH = 22, bands = "";
    REGIONS.forEach(function (r) {
      var rx = x(r.a * F), rw = x(r.b * F) - x(r.a * F), ahead = r.a * F >= cur.km;
      bands += '<rect x="' + (rx + 1) + '" y="' + bY + '" width="' + (rw - 2) + '" height="' + bH + '" rx="5" fill="' + r.c + '" opacity="' + (ahead ? 0.34 : 0.9) + '"/>';
      if (rw > 70) bands += '<text x="' + (rx + rw / 2) + '" y="' + (bY + bH / 2 + 3.5) + '" text-anchor="middle" font-size="10.5" font-family="Inter" font-weight="600" fill="#2c3327" opacity="' + (ahead ? 0.5 : 0.92) + '">' + r.name + '</text>';
    });

    var lY = bY + bH + 18, land = "";
    LAND.forEach(function (m) {
      var lx = x(m.km * F), done = m.km * F <= cur.km;
      var col = m.t === "park" ? "#3e9a51" : m.t === "desert" ? "#d19a3a" : "#9aa08f";
      var dash = m.t === "desert" ? 'stroke-dasharray="2 2"' : "";
      land += '<line x1="' + lx + '" y1="' + (bY + bH + 2) + '" x2="' + lx + '" y2="' + (lY - 3) + '" stroke="' + col + '" stroke-width="1.3" ' + dash + ' opacity="' + (done ? 0.8 : 0.4) + '"/>';
      land += m.t === "park"
        ? '<circle cx="' + lx + '" cy="' + lY + '" r="2.6" fill="' + col + '" opacity="' + (done ? 1 : 0.45) + '"/>'
        : '<rect x="' + (lx - 2) + '" y="' + (lY - 2) + '" width="4" height="4" fill="' + col + '" opacity="' + (done ? 1 : 0.45) + '" transform="rotate(45 ' + lx + ' ' + lY + ')"/>';
      land += '<text x="' + (lx + 4) + '" y="' + (lY + 5) + '" transform="rotate(26 ' + lx + ' ' + lY + ')" font-size="9.5" font-family="Inter" fill="#78806c" opacity="' + (done ? 0.95 : 0.5) + '">' + m.n + '</text>';
    });

    var towns = "";
    TOWNS.forEach(function (t) {
      var km = t[0] * F, tx = x(km), done = km <= cur.km, dot = done ? "#2c7a3d" : "#9aa08f", txt = done ? "#20301c" : "#7f8472";
      towns += '<circle cx="' + tx + '" cy="' + baseY + '" r="1.9" fill="' + dot + '"/>';
      towns += '<text class="el-town" x="' + (tx + 3) + '" y="' + (baseY - 5) + '" transform="rotate(-90 ' + (tx + 3) + ' ' + (baseY - 5) + ')" text-anchor="start" font-size="7.6" font-family="Inter" font-weight="500" paint-order="stroke" stroke="#ffffff" stroke-width="2.1" stroke-linejoin="round" fill="' + txt + '">' + t[1] + '</text>';
    });

    var passes = "";
    PASSES.forEach(function (p) {
      var pk = localMax(S, p.km * F, 45), px = x(pk.km), py = y(pk.m);
      var col = p.side ? "#cf7440" : "#2c7a3d", dash = p.side ? 'stroke-dasharray="3 2"' : "";
      passes += '<line x1="' + px + '" y1="' + (p.ly + (p.sub ? 13 : 3)) + '" x2="' + px + '" y2="' + py + '" stroke="' + col + '" stroke-width="1" ' + dash + ' opacity=".55"/><circle cx="' + px + '" cy="' + py + '" r="2.6" fill="none" stroke="' + col + '" stroke-width="1.4"/>';
      passes += '<text x="' + (px + p.dx) + '" y="' + p.ly + '" text-anchor="' + p.anc + '" font-size="9.5" font-weight="600" font-family="Inter" fill="' + col + '">' + (p.side ? "▲ " : "") + p.n + '</text>';
      if (p.sub) passes += '<text x="' + (px + p.dx) + '" y="' + (p.ly + 10) + '" text-anchor="' + p.anc + '" font-size="8" font-family="Inter" fill="' + col + '" opacity=".72">' + p.sub + '</text>';
    });

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="PCT elevation profile with current position">' +
      '<defs><clipPath id="elDone"><rect x="0" y="0" width="' + markX + '" height="' + baseY + '"/></clipPath>' +
      '<clipPath id="elRem"><rect x="' + markX + '" y="0" width="' + (W - markX) + '" height="' + baseY + '"/></clipPath>' +
      '<linearGradient id="elG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fae62" stop-opacity=".9"/><stop offset="1" stop-color="#4fae62" stop-opacity=".35"/></linearGradient></defs>' +
      grid +
      '<path d="' + area + '" clip-path="url(#elRem)" fill="#9db8a4" opacity=".26"/>' +
      '<path d="' + area + '" clip-path="url(#elDone)" fill="url(#elG)"/>' +
      '<path d="' + line + '" fill="none" stroke="#2f7a3e" stroke-width="1.4" opacity=".7"/>' +
      passes + towns + bands + land +
      '<line x1="' + markX + '" y1="' + markY + '" x2="' + markX + '" y2="' + (bY + bH) + '" stroke="#cf7440" stroke-width="1.6" stroke-dasharray="4 3"/>' +
      '<circle cx="' + markX + '" cy="' + markY + '" r="10" fill="none" stroke="#cf7440" stroke-width="1.6" opacity=".4"/>' +
      '<circle cx="' + markX + '" cy="' + markY + '" r="6.5" fill="#cf7440"/><circle cx="' + markX + '" cy="' + markY + '" r="2.4" fill="#fff"/>' +
      '</svg>';

    container.innerHTML =
      '<div class="el-card"><div class="el-head"><h2>The climb, end to end</h2>' +
      '<div class="el-now">Now at <b>' + fmt(cur.m) + ' m</b> \u00B7 ' + reg.name + '</div></div>' +
      '<div class="el-prof" id="elProf">' + svg + '</div>' +
      '<div class="el-legend">' +
      '<span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#cf7440"/></svg> You are here</span>' +
      '<span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#2c7a3d" stroke-width="1.6"/></svg> Pass / peak</span>' +
      '<span><svg width="12" height="12"><path d="M6 1 L11 11 L1 11 Z" fill="#cf7440"/></svg> Side trip</span>' +
      '<span><svg width="12" height="12"><circle cx="6" cy="6" r="3" fill="#3e9a51"/></svg> Resupply town</span>' +
      '<span>Solid = walked \u00B7 faded = ahead</span>' +
      '</div></div>';

    var prof = container.querySelector("#elProf");
    var chip = document.createElement("div");
    chip.className = "el-chip";
    chip.innerHTML = '<b>You are here</b><br><span class="k">' + fmt(cur.km) + ' km \u00B7 ' + fmt(cur.m) + ' m</span>';
    prof.appendChild(chip);
    function place() {
      var svgEl = prof.querySelector("svg");
      if (!svgEl) return;
      var r = svgEl.getBoundingClientRect();
      chip.style.left = (markX * r.width / W) + "px";
      chip.style.top = (markY * r.height / H - 12) + "px";
    }
    place();
    window.addEventListener("resize", place);
  }

  function init() {
    var container = document.getElementById("elevation");
    var hero = document.getElementById("heroTitle");
    if (!container && !hero) return;
    injectCSS();
    Promise.all([
      fetch(BASE + "data/pct_profile.json", { cache: "no-store" }).then(function (r) { return r.json(); }),
      fetch(BASE + "data/latest.json", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      render(container, res[0], res[1]);
    }).catch(function (e) {
      if (container) container.innerHTML = '<div class="el-card">Could not load elevation profile.</div>';
      console.error(e);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
