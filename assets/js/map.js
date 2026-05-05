(async function () {
  // --- REMOVE STATUS BOX ABOVE MAP (hero/status card) ---
  const heroEl = document.querySelector(".hero");
  if (heroEl) heroEl.remove();

  const statusEl = document.getElementById("status");
  const metaEl = document.getElementById("meta");
  const statusExtraEl = document.getElementById("status-extra");
  const statsListEl = document.getElementById("statsList");
  const insightsListEl = document.getElementById("insightsList");

  const trackUrl = new URL("./data/track.geojson", window.location.href).toString();
  const latestUrl = new URL("./data/latest.json", window.location.href).toString();

  const KM_PER_M = 0.001;
  const MI_PER_M = 0.000621371;
  const FT_PER_M = 3.28084;
  const PCT_TOTAL_MI = 2650;
  const PCT_TOTAL_KM = PCT_TOTAL_MI * 1.609344;

  function fmtNumber(n, digits = 1) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }
  function fmtInt(n) {
    if (!Number.isFinite(n)) return "—";
    return Math.round(n).toLocaleString();
  }
  function fmtDate(ts) { try { return new Date(ts).toLocaleString(); } catch { return String(ts); } }
  function fmtDateShort(ts) {
    try {
      return new Date(ts).toLocaleDateString('en-GB', { year: "numeric", month: "short", day: "numeric" });
    } catch { return "—"; }
  }
  function fmtDuration(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "—";
    const sec = Math.floor(totalSeconds);
    const days = Math.floor(sec / 86400);
    const hrs = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days} Day${days === 1 ? "" : "s"}`);
    if (hrs > 0) parts.push(`${hrs} h`);
    parts.push(`${mins} min`);
    return parts.join(" ");
  }
  function toKm(m) { return m * KM_PER_M; }
  function toMi(m) { return m * MI_PER_M; }
  function toFt(m) { return m * FT_PER_M; }

  function pickElevationMeters(props) {
    const candidates = [props.elevation_m, props.elev_m, props.elev_gain_m, props.total_elevation_gain, props.total_elevation_gain_m, props.elevation_gain_m];
    for (const v of candidates) { const n = Number(v); if (Number.isFinite(n) && n >= 0) return n; }
    return null;
  }
  function activityTypeLabel(props) { return (props.type || "").toString().trim() || "Activity"; }

  function showError(message, detail) {
    if (!document.getElementById("mapErrorStyle")) {
      const s = document.createElement("style");
      s.id = "mapErrorStyle";
      s.textContent = `.map-error-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(11,14,17,.85);backdrop-filter:blur(6px);z-index:100;border-radius:var(--radius,16px);padding:24px;text-align:center;gap:10px}.map-error-icon{font-size:32px}.map-error-title{font-size:16px;font-weight:800;color:rgba(232,238,245,.95)}.map-error-detail{font-size:13px;color:rgba(232,238,245,.60);max-width:320px;line-height:1.45}.map-error-retry{margin-top:8px;padding:8px 16px;border-radius:999px;border:1px solid rgba(126,231,135,.35);background:rgba(126,231,135,.10);color:rgba(232,238,245,.90);font-size:13px;cursor:pointer}`;
      document.head.appendChild(s);
    }
    const mapEl = document.getElementById("map");
    if (!mapEl) return;
    mapEl.style.position = "relative";
    const existing = mapEl.querySelector(".map-error-overlay");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.className = "map-error-overlay";
    overlay.innerHTML = `<div class="map-error-icon">⚠️</div><div class="map-error-title">${message}</div>${detail ? `<div class="map-error-detail">${detail}</div>` : ""}<button class="map-error-retry" onclick="location.reload()">Retry</button>`;
    mapEl.appendChild(overlay);
    if (statsListEl) statsListEl.innerHTML = `<div class="muted small" style="padding:8px 0">No data available</div>`;
    if (insightsListEl) insightsListEl.innerHTML = `<div class="muted small" style="padding:8px 0">No data available</div>`;
  }

  function showLoading() {
    if (statsListEl) statsListEl.innerHTML = `<div class="muted small" style="padding:8px 0">Loading…</div>`;
    if (insightsListEl) insightsListEl.innerHTML = `<div class="muted small" style="padding:8px 0">Loading…</div>`;
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return await res.json();
  }

  function geojsonBbox(geojson) {
    try {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const feats = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
      for (const f of feats) {
        const g = f.type === "Feature" ? f.geometry : f;
        const coords = g.type === "LineString" ? g.coordinates : g.type === "MultiLineString" ? g.coordinates.flat() : g.type === "Point" ? [g.coordinates] : [];
        for (const c of coords) { const [x, y] = c; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
      }
      if (minX === Infinity) return null;
      return [minX, minY, maxX, maxY];
    } catch { return null; }
  }

  function ensurePulseKeyframes() {
    if (document.getElementById("pctPulseStyle")) return;
    const s = document.createElement("style");
    s.id = "pctPulseStyle";
    s.textContent = `@keyframes pctPulse{0%{transform:scale(.55);opacity:.85}70%{transform:scale(1.15);opacity:.20}100%{transform:scale(1.25);opacity:0}}`;
    document.head.appendChild(s);
  }

  function injectUICSSOnce() {
    if (document.getElementById("pctUICSS")) return;
    const s = document.createElement("style");
    s.id = "pctUICSS";
    s.textContent = `#statsList,#insightsList{list-style:none;padding-left:0;margin:0}.pct-stats-wrap{display:grid;gap:10px}.pct-stat-hero{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:14px}.pct-stat-hero .label{font-size:12px;color:rgba(245,248,255,.65);margin-bottom:6px}.pct-stat-hero .big{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px}.pct-stat-hero .big .primary{font-size:26px;font-weight:900;color:rgba(245,248,255,.95);line-height:1.05}.pct-stat-hero .big .secondary{font-size:14px;color:rgba(245,248,255,.72);font-weight:700}.pct-chip-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:680px){.pct-chip-grid{grid-template-columns:1fr}}.pct-chip{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:12px}.pct-chip .label{font-size:12px;color:rgba(245,248,255,.62);margin-bottom:6px;display:flex;align-items:center;gap:8px}.pct-chip .value{font-size:16px;font-weight:900;color:rgba(245,248,255,.92);line-height:1.1}.pct-chip .sub{margin-top:4px;font-size:13px;color:rgba(245,248,255,.70);font-weight:700}.pct-sections{display:grid;gap:10px}.pct-section{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:10px 12px}.pct-section-title{font-weight:900;font-size:13px;color:rgba(245,248,255,.90);margin-bottom:8px}.pct-rows{display:grid;gap:6px}.pct-row{display:grid;grid-template-columns:1fr auto;gap:10px;font-size:13px;color:rgba(245,248,255,.76)}.pct-row b{color:rgba(245,248,255,.92);font-weight:800}.pct-progressbar{height:8px;border-radius:999px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12);overflow:hidden;margin-top:8px}.pct-progressfill{height:100%;width:0%;background:linear-gradient(90deg,rgba(70,243,255,.95),rgba(255,75,216,.95))}.pct-daychips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}@media(max-width:680px){.pct-daychips{grid-template-columns:1fr}}.pct-day-km{font-size:16px;font-weight:900;color:rgba(245,248,255,.92);line-height:1.1}.pct-day-meta{margin-top:6px;font-size:12px;color:rgba(245,248,255,.68);font-weight:700}.pct-day-date{margin-top:6px;font-size:12px;color:rgba(245,248,255,.55);font-weight:600}.maplibregl-popup-content{background:rgba(15,18,24,.88)!important;color:rgba(245,248,255,.92)!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:14px!important;box-shadow:0 16px 40px rgba(0,0,0,.45)!important;backdrop-filter:blur(10px);padding:12px 14px!important;min-width:240px}.maplibregl-popup-close-button{color:rgba(255,255,255,.8)!important;font-size:18px!important;padding:6px 10px!important}.pct-popup-title{font-weight:900;font-size:16px;margin-bottom:8px}.pct-popup-grid{display:grid;grid-template-columns:1fr auto;gap:4px 14px;font-size:14px;line-height:1.25}.pct-popup-grid .k{color:rgba(245,248,255,.70)}.pct-popup-grid .v{color:rgba(245,248,255,.92);font-weight:800}.pct-toggle-btn{width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(10,12,16,.65);backdrop-filter:blur(8px);color:white;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.35);display:grid;place-items:center;font-size:18px}`;
    document.head.appendChild(s);
  }

  const style = {
    version: 8,
    sources: {
      sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Tiles © Esri" },
      topo: { type: "raster", tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png", "https://b.tile.opentopomap.org/{z}/{x}/{y}.png", "https://c.tile.opentopomap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenTopoMap (CC-BY-SA)" }
    },
    layers: [
      { id: "sat-layer", type: "raster", source: "sat", layout: { visibility: "visible" } },
      { id: "topo-layer", type: "raster", source: "topo", layout: { visibility: "none" } }
    ]
  };

  const map = new maplibregl.Map({ container: "map", style, center: [9.17, 48.78], zoom: 11 });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

  class BasemapToggle {
    onAdd(map) {
      this._map = map;
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "pct-toggle-btn";
      btn.title = "Toggle basemap"; btn.setAttribute("aria-label", "Toggle basemap");
      const setIcon = () => { btn.textContent = map.getLayoutProperty("sat-layer", "visibility") !== "none" ? "🗺️" : "🛰️"; };
      btn.addEventListener("click", () => {
        const satVis = map.getLayoutProperty("sat-layer", "visibility") !== "none";
        map.setLayoutProperty("sat-layer", "visibility", satVis ? "none" : "visible");
        map.setLayoutProperty("topo-layer", "visibility", satVis ? "visible" : "none");
        setIcon();
      });
      const wrap = document.createElement("div");
      wrap.className = "maplibregl-ctrl maplibregl-ctrl-group";
      wrap.style.marginTop = "6px"; wrap.style.overflow = "hidden";
      wrap.appendChild(btn);
      map.on("idle", setIcon); this._container = wrap; setIcon(); return this._container;
    }
    onRemove() { this._container?.parentNode?.removeChild(this._container); this._map = undefined; }
  }

  let marker;
  function createBlinkMarkerEl() {
    ensurePulseKeyframes();
    const el = document.createElement("div");
    el.style.cssText = "width:16px;height:16px;border-radius:999px;border:2px solid rgba(232,238,245,.95);box-shadow:0 10px 26px rgba(0,0,0,.45);background:#2bff88;position:relative";
    const ring = document.createElement("div");
    ring.style.cssText = "position:absolute;left:-10px;top:-10px;width:36px;height:36px;border-radius:999px;border:2px solid rgba(43,255,136,.55);box-shadow:0 0 22px rgba(43,255,136,.40);animation:pctPulse 1.6s ease-out infinite";
    el.appendChild(ring);
    let on = false;
    setInterval(() => {
      on = !on;
      const c = on ? "#ff7a18" : "#2bff88";
      el.style.background = c;
      ring.style.borderColor = on ? "rgba(255,122,24,.55)" : "rgba(43,255,136,.55)";
      ring.style.boxShadow = on ? "0 0 22px rgba(255,122,24,.40)" : "0 0 22px rgba(43,255,136,.40)";
    }, 700);
    return el;
  }

  let didFitOnce = false, popup, hoveredId = null;

  function setHover(id) {
    hoveredId = id;
    if (!map.getLayer("track-hover")) return;
    map.setFilter("track-hover", id == null ? ["==", ["get", "strava_id"], -1] : ["==", ["to-number", ["get", "strava_id"]], Number(id)]);
  }

  function buildPopupHTML(props) {
    const type = activityTypeLabel(props);
    const start = props.start_date ? fmtDate(props.start_date) : "—";
    const distM = Number(props.distance_m);
    const km = Number.isFinite(distM) ? toKm(distM) : null;
    const mi = Number.isFinite(distM) ? toMi(distM) : null;
    const tSec = Number(props.moving_time_s);
    const time = Number.isFinite(tSec) ? fmtDuration(tSec) : "—";
    const elevM = pickElevationMeters(props);
    const elevStr = elevM == null ? "—" : `${fmtInt(elevM)} m / ${fmtInt(toFt(elevM))} ft`;
    const distStr = (km == null || mi == null) ? "—" : `${fmtNumber(km, 1)} km / ${fmtNumber(mi, 1)} mi`;
    return `<div class="pct-popup"><div class="pct-popup-title">${type}</div><div class="pct-popup-grid"><div class="k">Date</div><div class="v">${start}</div><div class="k">Distance</div><div class="v">${distStr}</div><div class="k">Time</div><div class="v">${time}</div><div class="k">Elevation</div><div class="v">${elevStr}</div></div></div>`;
  }

  const LIVE_DRAW_MS = 7500, LIVE_PAUSE_MS = 3500;
  let liveAnim = { raf: null, t0: 0, coords: null, timer: null };

  function stopLiveAnim() {
    if (liveAnim.raf) cancelAnimationFrame(liveAnim.raf);
    if (liveAnim.timer) clearTimeout(liveAnim.timer);
    liveAnim.raf = null; liveAnim.timer = null; liveAnim.coords = null;
  }

  function clearLiveLine() {
    if (map.getSource("latest-progress")) map.getSource("latest-progress").setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } });
  }

  function startLiveAnim(coords) {
    stopLiveAnim();
    if (!coords || coords.length < 2) return;
    liveAnim.coords = coords;
    const runOnce = () => {
      liveAnim.t0 = performance.now();
      const step = (now) => {
        if (!map.getSource("latest-progress")) return;
        const p = Math.min(1, (now - liveAnim.t0) / LIVE_DRAW_MS);
        const n = Math.max(2, Math.floor(p * coords.length));
        map.getSource("latest-progress").setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords.slice(0, n) } });
        if (p < 1) { liveAnim.raf = requestAnimationFrame(step); }
        else { liveAnim.raf = null; liveAnim.timer = setTimeout(() => { clearLiveLine(); runOnce(); }, LIVE_PAUSE_MS); }
      };
      liveAnim.raf = requestAnimationFrame(step);
    };
    runOnce();
  }

  function computeStats(track) {
  const feats = (track && track.features) ? track.features : [];
  let distM = 0, timeS = 0, elevM = 0, elevCount = 0;
  const days = new Set();
  let firstTs = null, lastTs = null, longest = null, shortest = null;
  const byDay = {};
  for (const f of feats) {
    const p = f.properties || {};
    const d = Number(p.distance_m), t = Number(p.moving_time_s), sd = p.start_date ? String(p.start_date) : "";
    if (Number.isFinite(d)) distM += d;
    if (Number.isFinite(t)) timeS += t;
    const e = pickElevationMeters(p);
    if (e != null) { elevM += e; elevCount++; }
    if (sd) {
      const dayKey = sd.slice(0, 10);
      days.add(dayKey);
      const ts = Date.parse(sd);
      if (Number.isFinite(ts)) {
        if (firstTs == null || ts < firstTs) firstTs = ts;
        if (lastTs == null || ts > lastTs) lastTs = ts;
      }
      if (!byDay[dayKey]) byDay[dayKey] = { distM: 0, timeS: 0, elevM: 0, acts: 0 };
      if (Number.isFinite(d)) byDay[dayKey].distM += d;
      if (Number.isFinite(t)) byDay[dayKey].timeS += t;
      if (e != null) byDay[dayKey].elevM += e;
      byDay[dayKey].acts++;
    }
    if (Number.isFinite(d) && d > 0) {
      const item = { distM: d, timeS: Number.isFinite(t) ? t : null, dateLabel: sd ? fmtDateShort(sd) : "—" };
      if (!longest || d > longest.distM) longest = item;
      if (!shortest || d < shortest.distM) shortest = item;
    }
  }
  const activeDays = days.size;
  let restDays = null;
  if (firstTs != null && lastTs != null) restDays = Math.max(0, Math.floor((lastTs - firstTs) / 86400000) + 1 - activeDays);
  const totalKm = toKm(distM), totalMi = toMi(distM), hours = timeS / 3600;
  const sortedDays = Object.keys(byDay).sort();
  const lastDay = sortedDays[sortedDays.length - 1] || null;
  const todayData = lastDay ? byDay[lastDay] : null;
  const last7 = sortedDays.slice(-7).map(k => ({ date: k, ...byDay[k] }));
  return { featsCount: feats.length, distM, timeS, elevM, elevCount, totalKm, totalMi, firstTs, lastTs, activeDays, restDays, pctCompleted: (totalMi / PCT_TOTAL_MI) * 100, remainingMi: Math.max(0, PCT_TOTAL_MI - totalMi), remainingKm: Math.max(0, PCT_TOTAL_MI - totalMi) * 1.609344, avgDistPerActKm: feats.length ? totalKm / feats.length : null, avgDistPerActMi: feats.length ? totalMi / feats.length : null, avgKmh: hours > 0 ? totalKm / hours : null, avgMph: hours > 0 ? totalMi / hours : null, longest, shortest, lastDay, todayData, last7 };
}
function setStatsUI(s) {
    statsListEl.innerHTML = `<div class="pct-stats-wrap"><div class="pct-stat-hero"><div class="label">Total Distance</div><div class="big"><div class="primary">${fmtNumber(s.totalKm, 1)} km</div><div class="secondary">${fmtNumber(s.totalMi, 1)} mi</div></div></div><div class="pct-chip-grid"><div class="pct-chip"><div class="label">Total Elevation</div><div class="value">${s.elevCount ? fmtInt(s.elevM) + " m" : "—"}</div><div class="sub">${s.elevCount ? fmtInt(toFt(s.elevM)) + " ft" : ""}</div></div><div class="pct-chip"><div class="label">Total Time</div><div class="value">${fmtDuration(s.timeS)}</div><div class="sub">${s.featsCount ? s.featsCount + " activities" : ""}</div></div><div class="pct-chip"><div class="label">Avg Distance / Activity</div><div class="value">${s.featsCount ? fmtNumber(s.avgDistPerActKm, 1) + " km" : "—"}</div><div class="sub">${s.featsCount ? fmtNumber(s.avgDistPerActMi, 1) + " mi" : ""}</div></div><div class="pct-chip"><div class="label">Avg Speed</div><div class="value">${s.avgKmh ? fmtNumber(s.avgKmh, 1) + " km/h" : "—"}</div><div class="sub">${s.avgMph ? fmtNumber(s.avgMph, 1) + " mi/h" : ""}</div></div></div></div>`;
  }

  function setInsightsUI(s) {
  const pctTxt = Number.isFinite(s.pctCompleted) ? fmtNumber(s.pctCompleted, 1) + "%" : "—%";
  const pctLine = pctTxt + " · " + fmtNumber(s.totalKm, 1) + " km of " + fmtInt(PCT_TOTAL_KM) + " km · " + fmtNumber(s.totalMi, 1) + " mi of " + fmtInt(PCT_TOTAL_MI) + " mi";
  const pctWidth = Math.max(0, Math.min(100, s.pctCompleted || 0));
  const daysLine = (s.activeDays || 0) + " active days" + (s.restDays != null && s.restDays > 0 ? " · " + s.restDays + " rest days" : "");
  function chip(label, item) {
    if (!item) return '<div class="pct-chip"><div class="label">' + label + '</div><div class="pct-day-km">—</div></div>';
    return '<div class="pct-chip"><div class="label">' + label + '</div><div class="pct-day-km">' + fmtNumber(toKm(item.distM), 1) + ' km</div><div class="pct-day-meta">' + fmtNumber(toMi(item.distM), 1) + ' mi · ' + (item.timeS != null ? fmtDuration(item.timeS) : "—") + '</div><div class="pct-day-date">' + item.dateLabel + '</div></div>';
  }
  let todaySection = "";
  if (s.todayData && s.lastDay) {
    const td = s.todayData;
    const dateStr = new Date(s.lastDay + "T12:00:00").toLocaleDateString('en-US', { weekday: "short", month: "short", day: "numeric" });
    const elevStr = td.elevM > 0 ? fmtInt(td.elevM) + " m ↑" : "";
    const actsStr = td.acts > 1 ? td.acts + " segments" : "1 segment";
    todaySection = '<div class="pct-section" style="margin-top:10px"><div class="pct-section-title">Last Active Day <span style="font-weight:500;opacity:.65;font-size:12px">' + dateStr + '</span></div><div class="pct-stat-hero" style="margin-bottom:0"><div class="big"><div class="primary">' + fmtNumber(toKm(td.distM), 1) + ' km</div><div class="secondary">' + fmtNumber(toMi(td.distM), 1) + ' mi</div></div><div style="margin-top:6px;font-size:13px;color:rgba(245,248,255,.68);display:flex;gap:14px;flex-wrap:wrap">' + (td.timeS > 0 ? '<span>Time: ' + fmtDuration(td.timeS) + '</span>' : '') + (elevStr ? '<span>Elev: ' + elevStr + '</span>' : '') + '<span>' + actsStr + '</span></div></div></div>';
  }
  let last7Section = "";
  if (s.last7 && s.last7.length > 1) {
    const maxDist = Math.max(...s.last7.map(d => d.distM));
    const bars = s.last7.map(d => {
      const minDist = Math.min(...s.last7.map(x => x.distM));
      const range = maxDist - minDist;
      const pct = maxDist > 0 ? (range > maxDist * 0.15 ? Math.max(15, ((d.distM - minDist) / range) * 80 + 15) : Math.max(30, (d.distM / maxDist) * 100)) : 30;
      const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString('en-US', { weekday: "short" });
      const km = fmtNumber(toKm(d.distM), 0) + ' km';
      const isLast = d.date === s.lastDay;
      return '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px">'
        + '<div style="font-size:10px;color:rgba(245,248,255,.55);font-weight:700;white-space:nowrap;text-align:center">' + km + '</div>'
        + '<div style="width:100%;flex:1;display:flex;align-items:flex-end">'
        + '<div style="width:100%;height:' + pct + '%;min-height:4px;border-radius:3px 3px 2px 2px;background:' + (isLast ? 'linear-gradient(180deg,rgba(70,243,255,.9),rgba(70,243,255,.5))' : 'rgba(255,255,255,.18)') + '"></div>'
        + '</div>'
        + '<div style="font-size:10px;color:rgba(245,248,255,' + (isLast ? '.85' : '.45') + ');font-weight:' + (isLast ? '800' : '600') + ';text-align:center">' + dayLabel + '</div>'
        + '</div>';
    }).join("");
    last7Section = '<div class="pct-section" style="margin-top:10px"><div class="pct-section-title">Recent Days</div>'
      + '<div style="display:flex;flex-direction:row;gap:6px;align-items:stretch;height:90px;padding:4px 0;overflow:hidden">' + bars + '</div></div>';
  }
  insightsListEl.innerHTML = '<div class="pct-sections">' + todaySection + last7Section + '<div class="pct-section" style="margin-top:10px"><div class="pct-section-title">PCT Progress</div><div class="pct-rows"><div style="margin-bottom:4px"><div style="font-size:12px;color:rgba(245,248,255,.62);margin-bottom:3px;display:none">PCT completed</div><div style="font-size:12px;font-weight:800;color:rgba(245,248,255,.9);line-height:1.5">' + pctLine + '</div></div><div class="pct-progressbar"><div class="pct-progressfill" style="width:' + pctWidth + '%"></div></div><div class="pct-row" style="margin-top:6px"><span>Remaining</span><b>' + fmtNumber(s.remainingKm, 1) + ' km / ' + fmtNumber(s.remainingMi, 1) + ' mi</b></div></div></div><div class="pct-section" style="margin-top:10px"><div class="pct-section-title">Timeline</div><div class="pct-rows"><div class="pct-row"><span>First activity</span><b>' + (s.firstTs ? new Date(s.firstTs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : "—") + '</b></div><div class="pct-row"><span>Last activity</span><b>' + (s.lastTs ? new Date(s.lastTs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : "—") + '</b></div><div class="pct-row"><span>Days</span><b>' + daysLine + '</b></div></div></div><div class="pct-daychips" style="margin-top:10px">' + chip("Longest Day", s.longest) + chip("Shortest Day", s.shortest) + '</div></div>';
}
function findLatestFeature(track) {
    const feats = (track && track.features) ? track.features : [];
    let best = null, bestTs = -Infinity;
    for (const f of feats) { const ts = f.properties?.start_date ? Date.parse(f.properties.start_date) : NaN; if (Number.isFinite(ts) && ts > bestTs) { bestTs = ts; best = f; } }
    return best;
  }

  async function refresh() {
    try {
      if (statusEl) statusEl.textContent = "";
      if (metaEl) metaEl.textContent = "";
      if (statusExtraEl) statusExtraEl.textContent = "";
      showLoading();
      const [track, latest] = await Promise.all([loadJson(trackUrl), loadJson(latestUrl)]);
      if (!track || !track.features || track.features.length === 0) {
        showError("No track data available", "The sync has run but no GPS activities were found. Check Strava privacy settings or trigger a manual sync.");
        return;
      }
      if (!map.getSource("track")) {
        injectUICSSOnce();
        map.addControl(new BasemapToggle(), "top-right");
        map.addSource("track", { type: "geojson", data: track });
        const colorExpr = ["case", ["==", ["%", ["to-number", ["get", "i"]], 2], 0], "#46f3ff", "#ff4bd8"];
        map.addLayer({ id: "track-glow", type: "line", source: "track", paint: { "line-color": colorExpr, "line-width": 12, "line-opacity": 0.28, "line-blur": 6 } });
        map.addLayer({ id: "track-main", type: "line", source: "track", paint: { "line-color": colorExpr, "line-width": 5, "line-opacity": 0.92 } });
        map.addLayer({ id: "track-highlight", type: "line", source: "track", paint: { "line-color": "rgba(255,255,255,0.65)", "line-width": 1.6, "line-opacity": 0.55 } });
        map.addLayer({ id: "track-hover", type: "line", source: "track", paint: { "line-color": "rgba(255,255,255,0.92)", "line-width": 7, "line-opacity": 0.75, "line-blur": 0.6 }, filter: ["==", ["get", "strava_id"], -1] });
        map.addSource("latest-progress", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
        map.addLayer({ id: "latest-progress-glow", type: "line", source: "latest-progress", paint: { "line-color": "rgba(255,255,255,0.40)", "line-width": 18, "line-opacity": 0.22, "line-blur": 10 } });
        map.addLayer({ id: "latest-progress", type: "line", source: "latest-progress", paint: { "line-color": "rgba(255,255,255,0.95)", "line-width": 3, "line-opacity": 0.85 } });
        map.on("mousemove", "track-main", (e) => { map.getCanvas().style.cursor = "pointer"; const f = e.features?.[0]; if (f) { const id = f.properties?.strava_id ?? null; if (id !== hoveredId) setHover(id); } });
        map.on("mouseleave", "track-main", () => { map.getCanvas().style.cursor = ""; setHover(null); });
        map.on("click", "track-main", (e) => { const f = e.features?.[0]; if (!f) return; popup?.remove(); popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "320px" }).setLngLat(e.lngLat).setHTML(buildPopupHTML(f.properties || {})).addTo(map); });
      } else {
        map.getSource("track").setData(track);
      }
      const lngLat = [latest.lon, latest.lat];
      if (!marker) { marker = new maplibregl.Marker({ element: createBlinkMarkerEl() }).setLngLat(lngLat).addTo(map); }
      else { marker.setLngLat(lngLat); }
      const s = computeStats(track);
      setStatsUI(s);
      setInsightsUI(s);
      if (!didFitOnce) {
        const bbox = geojsonBbox(track);
        if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
        else map.easeTo({ center: lngLat, zoom: 13, duration: 800 });
        didFitOnce = true;
      }
      const latestFeat = findLatestFeature(track);
      if (latestFeat?.geometry?.type === "LineString") startLiveAnim(latestFeat.geometry.coordinates);
      else { clearLiveLine(); stopLiveAnim(); }
    } catch (e) {
      stopLiveAnim(); clearLiveLine();
      console.error("Track load error:", e);
      const isNetworkError = e.message && (e.message.includes("HTTP 404") || e.message.includes("HTTP 5") || e.message.includes("Failed to fetch") || e.message.includes("NetworkError"));
      showError(isNetworkError ? "Could not load track data" : "Something went wrong", isNetworkError ? "The data files could not be reached. This usually means the Strava sync has not run yet, or GitHub Pages is still deploying." : `An unexpected error occurred. (${e.message})`);
    }
  }

  map.on("load", () => { injectUICSSOnce(); refresh(); setInterval(refresh, 60_000); loadPCTRoute(); });

  // PCT Background Route (official PCTA centerline)
  async function loadPCTRoute() {
    try {
      const url = new URL('./data/Full_PCT_Simplified.geojson', window.location.href).toString();
      const resp = await fetch(url);
      if (!resp.ok) return;
      const geojson = await resp.json();
      if (map.getSource('pct-bg')) return;
      map.addSource('pct-bg', { type: 'geojson', data: geojson });
      // Soft outer glow
      map.addLayer({
        id: 'pct-bg-glow', type: 'line', source: 'pct-bg',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#e8eef5', 'line-width': 6, 'line-opacity': 0.04 }
      }, 'track');
      // Thin dashed centerline
      map.addLayer({
        id: 'pct-bg-line', type: 'line', source: 'pct-bg',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#e8eef5', 'line-width': 1, 'line-opacity': 0.18, 'line-dasharray': [5, 4] }
      }, 'track');
    } catch(e) { console.log('PCT bg:', e.message); }
  }

})();
