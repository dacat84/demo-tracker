/* PCT elevation profile + self-configuring home hero (DE/EN, metric/imperial).
   Data: data/pct_profile.json (km + m + lat/lon), data/latest.json (live GPS),
   data/track.geojson (tracked activities). Language from localStorage 'pctLang'.
   Only the actually-tracked segments are drawn solid (projected from the GPS
   activities); everything else stays faded, so skipped/closed sections show as
   gaps. avg/day = tracked distance / active days (not position / days). */
(function () {
  "use strict";
  var BASE = "/pct-tracker/";
  var NOMINAL = 4265;

  var LANG = localStorage.getItem("pctLang");
  if (LANG !== "de" && LANG !== "en") LANG = ((navigator.language || "en").slice(0, 2) === "de") ? "de" : "en";
  var DE = LANG === "de";
  var LOC = DE ? "de-DE" : "en-US";
  var DARR = "\u2192";
  var EARR = "\u25B2";

  var STR = DE ? {
    liveDay: "Tag", inThe: "Ich bin gerade in ", rightNow: ".",
    fromCampo: " ab Campo", nearestWp: " \u00B7 n\u00e4chster Wegpunkt ", stillPre: "noch ", toEnd: " bis zum Northern Terminus.",
    climb: "H\u00f6henprofil <b>P</b>acific <b>C</b>rest <b>T</b>rail", nowAt: "Aktuell ",
    here: "Standort", legPass: "Pass / Gipfel", legSide: "Abstecher", legTown: "Versorgungsort",
    legState: "Voll = getrackt \u00B7 blass = noch nicht", near: "Nahe ",
    distWord: "Distanz", altWord: "H\u00f6he", resupply: "Versorgungsort", zoomHint: "Sektion antippen zum Zoomen"
  } : {
    liveDay: "Day", inThe: "I'm in the ", rightNow: " right now.",
    fromCampo: " from Campo", nearestWp: " \u00B7 next waypoint ", stillPre: "", toEnd: " still to the Northern Terminus.",
    climb: "<b>P</b>acific <b>C</b>rest <b>T</b>rail elevation profile", nowAt: "Now at ",
    here: "You are here", legPass: "Pass / peak", legSide: "Side trip", legTown: "Resupply town",
    legState: "Solid = tracked \u00B7 faded = not yet", near: "Near ",
    distWord: "distance", altWord: "elevation", resupply: "Resupply", zoomHint: "Tap a section to zoom"
  };
  var REG_DE = {
    "Southern California": "S\u00fcdkalifornien", "Southern Sierra": "S\u00fcdliche Sierra",
    "Northern Sierra": "N\u00f6rdliche Sierra", "NorCal / C. Oregon": "NorCal / Zentral-Oregon",
    "Central Cascades": "Zentrale Cascades", "North Cascades": "N\u00f6rdliche Cascades"
  };

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
    { km: 393, n: "San Gorgonio", ly: 40, anc: "middle", dx: 0 },
    { km: 610, n: "Mt. Baden-Powell", side: true, ly: 26, anc: "middle", dx: 0 },
    { km: 1235, n: "Mt. Whitney", side: true, ly: 50, anc: "middle", lox: -46, el: 4421 },
    { km: 1300, n: "Forester Pass", ly: 40, anc: "middle", dx: 0, el: 4009 },
    { km: 1430, n: "Muir Pass", ly: 12, anc: "middle", dx: 0, el: 3637 },
    { km: 1490, n: "Half Dome", side: true, ly: 26, anc: "start", dx: 5 },
    { km: 1620, n: "Leavitt Peak", ly: 68, anc: "middle", dx: 0 },
    { km: 1700, n: "Sonora Pass", ly: 40, anc: "middle", dx: 0, el: 2933 },
    { km: 1885, n: "Tahoe Rim", side: true, ly: 54, anc: "middle", dx: 0 }
  ];
  var TOWNS = [[68,"Mt Laguna"],[124,"Julian"],[175,"Warner Springs"],[290,"Idyllwild"],[435,"Big Bear"],[605,"Wrightwood"],[730,"Agua Dulce"],[832,"Hikertown"],[915,"Tehachapi"],[1050,"Lake Isabella"],[1128,"Kennedy Mdws","Kennedy Meadows"],[1230,"Lone Pine"],[1290,"Bishop"],[1400,"VVR","Vermilion Valley Resort"],[1450,"Mammoth"],[1510,"Tuolumne"],[1690,"Bridgeport"],[1885,"S Lake Tahoe","South Lake Tahoe"],[2020,"Sierra City"],[2130,"Belden"],[2200,"Chester"],[2330,"Burney"],[2510,"Mt Shasta"],[2670,"Etna"],[2760,"Seiad Valley"],[2870,"Ashland"],[2985,"Mazama"],[3230,"Sisters"],[3430,"Timberline"],[3540,"Cascade Locks"],[3620,"Trout Lake"],[3760,"White Pass"],[3870,"Snoqualmie"],[3990,"Stevens Pass"],[4165,"Stehekin"]];
  var LAND = [
    { km: 290, n: "San Jacinto", t: "mark" },
    { km: 870, n: "Mojave Desert", t: "desert" },
    { km: 1130, n: "Kennedy Meadows", t: "mark" },
    { km: 1240, n: "Sequoia NP", t: "park" },
    { km: 1360, n: "Kings Canyon NP", t: "park" },
    { km: 1500, n: "Yosemite NP", t: "park" },
    { km: 1950, n: "Lake Tahoe", t: "mark" },
    { km: 2350, n: "Lassen Volcanic NP", t: "park" },
    { km: 2900, n: "Crater Lake NP", t: "park" },
    { km: 3450, n: "Mt. Hood", t: "mark" },
    { km: 4050, n: "North Cascades NP", t: "park" }
  ];
  var WAY = TOWNS.concat([[0, "Campo"], [1300, "Forester Pass"], [1700, "Sonora Pass"], [4265, "Northern Terminus"]]);

  function haversine(la1, lo1, la2, lo2) {
    var R = 6371.0088, p1 = la1 * Math.PI / 180, p2 = la2 * Math.PI / 180;
    var dp = (la2 - la1) * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function nfmt(n, dec) {
    return n.toLocaleString(LOC, dec != null ? { minimumFractionDigits: dec, maximumFractionDigits: dec } : { maximumFractionDigits: 0 });
  }
  function toDist(km) { return DE ? km : km * 0.621371; }
  function toElev(m) { return DE ? m : m * 3.28084; }
  function distStr(km, dec) { return nfmt(toDist(km), dec) + (DE ? " km" : " mi"); }
  function elevStr(m) { return nfmt(toElev(m), 0) + (DE ? " m" : " ft"); }
  function regName(r) { return DE ? (REG_DE[r.name] || r.name) : r.name; }
  function setHTML(id, html) { var e = document.getElementById(id); if (e) e.innerHTML = html; }
  function setText(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }

  function injectCSS() {
    if (document.getElementById("elCSS")) return;
    var s = document.createElement("style");
    s.id = "elCSS";
    s.textContent =
      ".el-card{background:#fff;border:1px solid #e8e6da;border-radius:22px;padding:20px 20px 12px;box-shadow:0 1px 2px rgba(20,32,28,.04),0 14px 40px rgba(20,32,28,.06);color:#1e241c}" +
      ".el-head{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:4px}" +
      ".el-head h2{margin:0;font:600 21px/1.1 'Fraunces',Georgia,serif;letter-spacing:-.01em}.el-head h2 b{font-weight:800}" +
      ".el-now{font-size:13px;color:#6c7365}.el-now b{color:#1e241c}" +
      ".el-prof{position:relative}.el-prof svg{display:block;width:100%;height:auto;overflow:visible}" +
      ".el-town{pointer-events:none}.el-townhit{fill:transparent;cursor:pointer}" +
      ".el-chip{position:absolute;transform:translate(-50%,-100%);background:rgba(30,36,28,.52);color:#fff;border-radius:10px;padding:6px 10px;font:12px/1.3 Inter,system-ui,sans-serif;white-space:nowrap;backdrop-filter:blur(3px);box-shadow:0 6px 18px rgba(0,0,0,.18);pointer-events:none}" +
      ".el-chip b{font-weight:700}.el-chip .k{color:#f0b48a}" +
      ".el-chip::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:rgba(30,36,28,.52)}" +
      ".el-townpop{position:absolute;transform:translate(-50%,-100%);background:#1e241c;color:#fff;border-radius:9px;padding:6px 11px;font:600 12.5px/1.2 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 10px 26px rgba(0,0,0,.28);pointer-events:none;opacity:0;transition:opacity .12s ease;z-index:4}" +
      ".el-townpop small{display:block;font-weight:500;font-size:10.5px;color:#9fe0ae;margin-top:1px}" +
      ".el-townpop.show{opacity:1}" +
      ".el-townpop::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#1e241c}" +
      ".el-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font:11.5px Inter,system-ui,sans-serif;color:#6c7365}" +
      ".el-legend span{display:inline-flex;align-items:center;gap:6px}" +
      ".el-band{cursor:pointer;transition:filter .1s ease}.el-band:hover{filter:brightness(1.07)}" +
      ".el-back{position:absolute;top:8px;left:8px;z-index:5;background:#fff;border:1px solid #e2e0d4;border-radius:8px;padding:4px 10px;font:600 11.5px Inter,system-ui,sans-serif;color:#3e6b46;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08)}.el-back:hover{background:#f4f2ea}";
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
  function nextWaypoint(km, F) {
    var best = "Northern Terminus", bd = 1e18;
    for (var i = 0; i < WAY.length; i++) {
      var d = WAY[i][0] * F - km;
      if (d > 0 && d < bd) { bd = d; best = WAY[i][1]; }
    }
    return best;
  }

  function walkedRangesFrom(track, pts) {
    if (!track || !track.features) return [];
    function nearKm(lat, lon) {
      var best = 0, bd = 1e18;
      for (var i = 0; i < pts.length; i++) {
        var d = haversine(lat, lon, pts[i].lat, pts[i].lon);
        if (d < bd) { bd = d; best = pts[i].km; }
      }
      return best;
    }
    var ranges = [];
    track.features.forEach(function (f) {
      if (!f.geometry || f.geometry.type !== "LineString") return;
      var c = f.geometry.coordinates, N = c.length;
      if (!N) return;
      var lo = 1e18, hi = -1e18;
      for (var k = 0; k < 12; k++) {
        var j = Math.round(k * (N - 1) / 11);
        var km = nearKm(c[j][1], c[j][0]);
        if (km < lo) lo = km; if (km > hi) hi = km;
      }
      ranges.push([lo, hi]);
    });
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    ranges.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r[0] <= last[1] + 20) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    });
    return merged;
  }

  function activityStats(track) {
    var dist = 0, dates = {};
    if (track && track.features) {
      track.features.forEach(function (f) {
        var p = f.properties || {};
        if (typeof p.distance_m === "number") dist += p.distance_m;
        if (p.start_date) dates[String(p.start_date).slice(0, 10)] = 1;
      });
    }
    return { km: dist / 1000, days: Object.keys(dates).length };
  }

  function fillHero(reg, F) {
    if (!CUR) return;
    var scale = NOMINAL / TOTAL_KM;
    var pos = CUR.km * scale;
    var toGo = Math.max(0, NOMINAL - pos);
    var pct = Math.round((pos / NOMINAL) * 100);
    var near = nearestWaypoint(CUR.km, F);
    var nextWp = nextWaypoint(CUR.km, F);
    setHTML("heroTitle", STR.inThe + "<em>" + regName(reg) + "</em>" + STR.rightNow);
    setHTML("heroSub", "<b>" + distStr(pos) + "</b>" + STR.fromCampo + STR.nearestWp + "<b>" + nextWp +
      "</b> \u00B7 " + STR.stillPre + "<b>" + distStr(toGo) + "</b>" + STR.toEnd);
    setText("heroPct", pct);
    setText("pPct", pct + "%");
    setText("pRem", distStr(toGo));
    setText("pDone", distStr(pos));
    setText("pTotal", distStr(NOMINAL));
    var pf = document.getElementById("pFill"); if (pf) pf.style.width = pct + "%";
    setHTML("mPlace", regName(reg) + ", " + reg.st);
    setHTML("mMeta", STR.near + near + " \u00B7 " + DARR + " <b>" + distStr(pos) + "</b> \u00B7 " + EARR + " <b>" + elevStr(CUR.m) + "</b>");
  }

  function fillActivity(st) {
    if (st.days > 0) {
      setText("heroDays", st.days);
      setText("heroDay", STR.liveDay + " " + st.days);
      setText("heroAvg", nfmt(toDist(st.km / st.days), 1));
      setText("heroAvgU", DE ? "km" : "mi");
    }
  }

  function wireExpand() {
    var he = document.querySelector(".hero-map");
    var btn = document.getElementById("mapExpand");
    var back = document.getElementById("mapBackdrop");
    if (!he || !btn) return;
    function set(exp) {
      he.classList.toggle("expanded", exp);
      document.body.classList.toggle("map-expanded", exp);
      btn.innerHTML = exp ? "\u2715" : "\u2921";
      btn.setAttribute("aria-label", exp ? (DE ? "Karte schlie\u00dfen" : "Close map") : (DE ? "Karte vergr\u00f6\u00dfern" : "Enlarge map"));
      setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 70);
    }
    btn.addEventListener("click", function () { set(!he.classList.contains("expanded")); });
    if (back) back.addEventListener("click", function () { set(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && he.classList.contains("expanded")) set(false); });
    btn.setAttribute("aria-label", DE ? "Karte vergr\u00f6\u00dfern" : "Enlarge map");
  }

  function render(container, data, latest, track) {
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

    var walked = walkedRangesFrom(track, pts);
    if (!walked.length) walked = [[0, cur.km]];
    function inWalked(km) {
      for (var i = 0; i < walked.length; i++) { if (km >= walked[i][0] && km <= walked[i][1]) return true; }
      return false;
    }

    fillHero(reg, F);
    fillActivity(activityStats(track));

    if (!container) return;

    var W = 1000, H = 320, PADL = 46, PADR = 10, PADT = 56, baseY = 200, maxM = 4200;
    PASSES.forEach(function (p) {
      if (p.el == null) return;
      var target = p.km * F, bi = 0, bd = 1e18;
      for (var i = 0; i < S.length; i++) { var d = Math.abs(S[i][0] - target); if (d < bd) { bd = d; bi = i; } }
      S[bi][1] = Math.max(S[bi][1], Math.min(p.el, maxM));
    });
    function y(m) { return PADT + (1 - m / maxM) * (baseY - PADT); }
    var GRID = DE ? [[1000, "1k"], [2000, "2k"], [3000, "3k"], [4000, "4k"]]
                  : [[914, "3k"], [1829, "6k"], [2743, "9k"], [3658, "12k"]];
    var bY = baseY + 8, bH = 22, lY = bY + bH + 18;

    var viewA = 0, viewB = TOTAL;

    function draw() {
      var full = viewA <= 0.5 && viewB >= TOTAL - 0.5;
      var fs = full ? 1 : 1.45;
      function x(km) { return PADL + ((km - viewA) / (viewB - viewA)) * (W - PADL - PADR); }
      var markX = x(cur.km), markY = y(cur.m), markerInView = cur.km >= viewA && cur.km <= viewB;

      var line = "M " + x(S[0][0]).toFixed(1) + " " + y(S[0][1]).toFixed(1);
      S.forEach(function (pt) { line += " L " + x(pt[0]).toFixed(1) + " " + y(pt[1]).toFixed(1); });
      var area = line + " L " + x(TOTAL) + " " + baseY + " L " + x(0) + " " + baseY + " Z";

      var walkedClip = "";
      walked.forEach(function (r) { walkedClip += '<rect x="' + x(r[0]) + '" y="0" width="' + (x(r[1]) - x(r[0])) + '" height="' + baseY + '"/>'; });

      var grid = '<line x1="' + PADL + '" y1="' + baseY + '" x2="' + (W - PADR) + '" y2="' + baseY + '" stroke="#00000010"/>';
      GRID.forEach(function (g) {
        var gy = y(g[0]);
        grid += '<line x1="' + PADL + '" y1="' + gy + '" x2="' + (W - PADR) + '" y2="' + gy + '" stroke="#00000010"/>' +
                '<text x="' + (PADL - 6) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="10" fill="#9aa08f" font-family="Inter">' + g[1] + '</text>';
      });

      var bands = "";
      REGIONS.forEach(function (r, ri) {
        var rx = x(r.a * F), rw = x(r.b * F) - x(r.a * F), ahead = r.a * F >= cur.km;
        bands += '<rect class="el-band" data-r="' + ri + '" x="' + (rx + 1) + '" y="' + bY + '" width="' + (rw - 2) + '" height="' + bH + '" rx="5" fill="' + r.c + '" opacity="' + (ahead ? 0.34 : 0.9) + '"/>';
        if (rw > 74) bands += '<text x="' + (rx + rw / 2) + '" y="' + (bY + bH / 2 + 3.5) + '" text-anchor="middle" font-size="' + (10 * fs).toFixed(1) + '" font-family="Inter" font-weight="600" fill="#2c3327" opacity="' + (ahead ? 0.5 : 0.92) + '" pointer-events="none">' + regName(r) + '</text>';
      });

      var land = "";
      LAND.forEach(function (m) {
        var lx = x(m.km * F), done = inWalked(m.km * F);
        var col = m.t === "park" ? "#3e9a51" : m.t === "desert" ? "#d19a3a" : "#9aa08f";
        var tcol = m.t === "park" ? "#2f7a3e" : m.t === "desert" ? "#b5842e" : "#6b7280";
        var dash = m.t === "desert" ? 'stroke-dasharray="2 2"' : "";
        land += '<line x1="' + lx + '" y1="' + (bY + bH + 2) + '" x2="' + lx + '" y2="' + (lY - 3) + '" stroke="' + col + '" stroke-width="1.3" ' + dash + ' opacity="' + (done ? 0.8 : 0.4) + '"/>';
        land += m.t === "park"
          ? '<circle cx="' + lx + '" cy="' + lY + '" r="2.6" fill="' + col + '" opacity="' + (done ? 1 : 0.45) + '"/>'
          : '<rect x="' + (lx - 2) + '" y="' + (lY - 2) + '" width="4" height="4" fill="' + col + '" opacity="' + (done ? 1 : 0.45) + '" transform="rotate(45 ' + lx + ' ' + lY + ')"/>';
        var edge = lx > W - 95;
        land += '<text x="' + (edge ? lx : (lx + 4)) + '" y="' + (edge ? (lY + 13) : (lY + 5)) + '" text-anchor="' + (edge ? 'middle' : 'start') + '"' + (edge ? '' : ' transform="rotate(26 ' + lx + ' ' + lY + ')"') + ' font-size="' + (10.5 * fs).toFixed(1) + '" font-weight="600" font-family="Inter" fill="' + tcol + '" opacity="' + (done ? 1 : 0.72) + '">' + m.n + '</text>';
      });

      var townData = [];
      var towns = "";
      TOWNS.forEach(function (t, i) {
        var km = t[0] * F, tx = x(km), done = inWalked(km), dot = done ? "#2c7a3d" : "#9aa08f", txt = done ? "#20301c" : "#7f8472";
        townData.push({ tx: tx, name: t[2] || t[1], km: t[0] * F });
        towns += '<circle cx="' + tx + '" cy="' + baseY + '" r="1.9" fill="' + dot + '"/>';
        towns += '<text class="el-town" x="' + (tx + 3) + '" y="' + (baseY - 5) + '" transform="rotate(-90 ' + (tx + 3) + ' ' + (baseY - 5) + ')" text-anchor="start" font-size="' + (7.6 * fs).toFixed(1) + '" font-family="Inter" font-weight="500" paint-order="stroke" stroke="#ffffff" stroke-width="2.1" stroke-linejoin="round" fill="' + txt + '">' + t[1] + '</text>';
        towns += '<rect class="el-townhit" data-i="' + i + '" x="' + (tx - 6) + '" y="' + (baseY - 48) + '" width="12" height="54"/>';
      });

      var passes = "";
      PASSES.forEach(function (p) {
        var pk = localMax(S, p.km * F, 45), px = x(pk.km), py = y(pk.m);
        var col = p.side ? "#cf7440" : "#2c7a3d", dash = p.side ? 'stroke-dasharray="3 2"' : "";
        var labelX;
        if (p.lox != null) {
          var lx2 = px + p.lox;
          passes += '<line x1="' + lx2 + '" y1="' + (p.ly + 4) + '" x2="' + px + '" y2="' + (p.ly + 4) + '" stroke="' + col + '" stroke-width="1" ' + dash + ' opacity=".55"/>';
          passes += '<line x1="' + px + '" y1="' + (p.ly + 4) + '" x2="' + px + '" y2="' + py + '" stroke="' + col + '" stroke-width="1" ' + dash + ' opacity=".55"/>';
          labelX = lx2;
        } else {
          passes += '<line x1="' + px + '" y1="' + (p.ly + 3) + '" x2="' + px + '" y2="' + py + '" stroke="' + col + '" stroke-width="1" ' + dash + ' opacity=".55"/>';
          labelX = px + (p.dx || 0);
        }
        passes += '<circle cx="' + px + '" cy="' + py + '" r="2.6" fill="none" stroke="' + col + '" stroke-width="1.4"/>';
        passes += '<text x="' + labelX + '" y="' + p.ly + '" text-anchor="' + p.anc + '" font-size="' + (9.5 * fs).toFixed(1) + '" font-weight="600" font-family="Inter" fill="' + col + '">' + (p.side ? "\u25B2 " : "") + p.n + '</text>';
      });

      var marker = markerInView
        ? ('<line x1="' + markX + '" y1="' + markY + '" x2="' + markX + '" y2="' + (bY + bH) + '" stroke="#cf7440" stroke-width="1.6" stroke-dasharray="4 3"/>' +
           '<circle cx="' + markX + '" cy="' + markY + '" r="10" fill="none" stroke="#cf7440" stroke-width="1.6" opacity=".4"/>' +
           '<circle cx="' + markX + '" cy="' + markY + '" r="6.5" fill="#cf7440"/><circle cx="' + markX + '" cy="' + markY + '" r="2.4" fill="#fff"/>')
        : "";

      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="PCT elevation profile">' +
        '<defs><clipPath id="elWalked">' + walkedClip + '</clipPath>' +
        '<clipPath id="plotClip"><rect x="' + PADL + '" y="0" width="' + (W - PADL - PADR) + '" height="' + H + '"/></clipPath>' +
        '<linearGradient id="elG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fae62" stop-opacity=".9"/><stop offset="1" stop-color="#4fae62" stop-opacity=".35"/></linearGradient></defs>' +
        grid +
        '<g clip-path="url(#plotClip)">' +
        '<path d="' + area + '" fill="#9db8a4" opacity=".26"/>' +
        '<path d="' + area + '" clip-path="url(#elWalked)" fill="url(#elG)"/>' +
        '<path d="' + line + '" fill="none" stroke="#2f7a3e" stroke-width="1.4" opacity=".7"/>' +
        passes + towns + bands + land + marker +
        '</g>' +
        '</svg>';

      container.innerHTML =
        '<div class="el-card"><div class="el-head"><h2>' + STR.climb + '</h2>' +
        '<div class="el-now">' + STR.nowAt + EARR + ' <b>' + elevStr(cur.m) + '</b> \u00B7 ' + regName(reg) + '</div></div>' +
        '<div class="el-prof" id="elProf">' +
        (full ? '' : '<button class="el-back" type="button">\u2039 ' + (DE ? "\u00dcbersicht" : "Overview") + '</button>') +
        svg + '</div>' +
        '<div class="el-legend">' +
        '<span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#cf7440"/></svg> ' + STR.here + '</span>' +
        '<span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#2c7a3d" stroke-width="1.6"/></svg> ' + STR.legPass + '</span>' +
        '<span><svg width="12" height="12"><path d="M6 1 L11 11 L1 11 Z" fill="#cf7440"/></svg> ' + STR.legSide + '</span>' +
        '<span><svg width="12" height="12"><circle cx="6" cy="6" r="3" fill="#3e9a51"/></svg> ' + STR.legTown + '</span>' +
        '<span>' + DARR + " " + STR.distWord + " \u00B7 " + EARR + " " + STR.altWord + '</span>' +
        '<span>' + STR.legState + '</span>' +
        '<span>\u2921 ' + STR.zoomHint + '</span>' +
        '</div></div>';

      var prof = container.querySelector("#elProf");
      if (markerInView) {
        var chip = document.createElement("div");
        chip.className = "el-chip";
        chip.innerHTML = DARR + ' <span class="k">' + distStr(cur.km * (NOMINAL / TOTAL)) + '</span> \u00B7 ' + EARR + ' <span class="k">' + elevStr(cur.m) + '</span>';
        prof.appendChild(chip);
        var placeChip = function () { var s2 = prof.querySelector("svg"); if (!s2) return; var r = s2.getBoundingClientRect(); chip.style.left = (markX * r.width / W) + "px"; chip.style.top = (markY * r.height / H - 26) + "px"; };
        placeChip();
        prof._placeChip = placeChip;
      } else { prof._placeChip = null; }

      var pop = document.createElement("div");
      pop.className = "el-townpop";
      prof.appendChild(pop);
      function svgRect() { var s2 = prof.querySelector("svg"); return s2 ? s2.getBoundingClientRect() : null; }
      prof.addEventListener("mouseover", function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains("el-townhit")) {
          var d = townData[+t.getAttribute("data-i")]; if (!d) return;
          var r = svgRect(); if (!r) return;
          pop.innerHTML = d.name + "<small>" + STR.resupply + " \u00B7 " + distStr(d.km * (NOMINAL / TOTAL)) + "</small>";
          pop.style.left = (d.tx * r.width / W) + "px";
          pop.style.top = ((baseY - 12) * r.height / H) + "px";
          pop.classList.add("show");
        }
      });
      prof.addEventListener("mouseout", function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains("el-townhit")) pop.classList.remove("show");
      });
      [].slice.call(prof.querySelectorAll(".el-band")).forEach(function (b) {
        b.addEventListener("click", function () {
          var r = REGIONS[+b.getAttribute("data-r")];
          var ov = (r.b - r.a) * F * 0.05;
          viewA = Math.max(0, r.a * F - ov); viewB = Math.min(TOTAL, r.b * F + ov);
          draw();
        });
      });
      var back = prof.querySelector(".el-back");
      if (back) back.addEventListener("click", function () { viewA = 0; viewB = TOTAL; draw(); });
    }

    draw();
    window.addEventListener("resize", function () {
      var prof = container.querySelector("#elProf");
      if (prof && prof._placeChip) prof._placeChip();
    });
  }

  function init() {
    wireExpand();
    var container = document.getElementById("elevation");
    var hero = document.getElementById("heroTitle");
    if (!container && !hero) return;
    injectCSS();
    function J(u) { return fetch(BASE + u, { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return null; }); }
    Promise.all([J("data/pct_profile.json"), J("data/latest.json"), J("data/track.geojson")]).then(function (res) {
      if (!res[0]) throw new Error("no profile");
      render(container, res[0], res[1], res[2]);
    }).catch(function (e) {
      if (container) container.innerHTML = '<div class="el-card">Could not load elevation profile.</div>';
      console.error(e);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
