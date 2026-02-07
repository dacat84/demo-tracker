(async function () {
  const statusEl = document.getElementById("status");
  const metaEl = document.getElementById("meta");
  const statusExtraEl = document.getElementById("status-extra");

  const statsListEl = document.getElementById("statsList");
  const insightsListEl = document.getElementById("insightsList");

  const trackUrl = new URL("./data/track.geojson", window.location.href).toString();
  const latestUrl = new URL("./data/latest.json", window.location.href).toString();

  // ---------- helpers ----------
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
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  }

  // 1 Day 10 h 29 min
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
    const candidates = [
      props.elevation_m,
      props.elev_m,
      props.elev_gain_m,
      props.total_elevation_gain,
      props.total_elevation_gain_m,
      props.elevation_gain_m
    ];
    for (const v of candidates) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  }

  function activityTypeLabel(props) {
    const t = (props.type || "").toString().trim();
    return t || "Activity";
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  function geojsonBbox(geojson) {
    try {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const feats = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
      for (const f of feats) {
        const g = f.type === "Feature" ? f.geometry : f;
        const coords =
          g.type === "LineString" ? g.coordinates :
          g.type === "MultiLineString" ? g.coordinates.flat() :
          g.type === "Point" ? [g.coordinates] :
          [];
        for (const c of coords) {
          const [x, y] = c;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (minX === Infinity) return null;
      return [minX, minY, maxX, maxY];
    } catch { return null; }
  }

  function ensurePulseKeyframes() {
    if (document.getElementById("pctPulseStyle")) return;
    const s = document.createElement("style");
    s.id = "pctPulseStyle";
    s.textContent = `
      @keyframes pctPulse {
        0%   { transform: scale(0.55); opacity: 0.85; }
        70%  { transform: scale(1.15); opacity: 0.20; }
        100% { transform: scale(1.25); opacity: 0.00; }
      }
    `;
    document.head.appendChild(s);
  }

  // ---------- UI CSS ----------
  function injectUICSSOnce() {
    if (document.getElementById("pctUICSS")) return;
    const s = document.createElement("style");
    s.id = "pctUICSS";
    s.textContent = `
      #statsList, #insightsList { list-style: none; padding-left: 0; margin: 0; }
      #statsList li, #insightsList li { margin: 0; }

      .pct-stats-wrap{ display: grid; gap: 10px; }

      .pct-stat-hero{
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 16px;
        padding: 14px 14px;
      }
      .pct-stat-hero .label{
        font-size: 12px;
        letter-spacing: .2px;
        color: rgba(245,248,255,.65);
        margin-bottom: 6px;
      }
      .pct-stat-hero .big{
        display:flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 10px;
      }
      .pct-stat-hero .big .primary{
        font-size: 26px;
        font-weight: 900;
        color: rgba(245,248,255,.95);
        line-height: 1.05;
      }
      .pct-stat-hero .big .secondary{
        font-size: 14px;
        color: rgba(245,248,255,.72);
        font-weight: 700;
      }

      .pct-chip-grid{
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 680px){
        .pct-chip-grid{ grid-template-columns: 1fr; }
      }
      .pct-chip{
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 16px;
        padding: 12px 12px;
      }
      .pct-chip .label{
        font-size: 12px;
        color: rgba(245,248,255,.62);
        margin-bottom: 6px;
        display:flex;
        align-items:center;
        gap:8px;
      }
      .pct-chip .value{
        font-size: 16px;
        font-weight: 900;
        color: rgba(245,248,255,.92);
        line-height: 1.1;
      }
      .pct-chip .sub{
        margin-top: 4px;
        font-size: 13px;
        color: rgba(245,248,255,.70);
        font-weight: 700;
      }

      /* INSIGHTS */
      .pct-sections{ display: grid; gap: 10px; }
      .pct-section{
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 16px;
        padding: 10px 12px;
      }
      .pct-section-title{
        font-weight: 900;
        font-size: 13px;
        letter-spacing: .2px;
        color: rgba(245,248,255,.90);
        margin-bottom: 8px;
      }
      .pct-rows{ display: grid; gap: 6px; }
      .pct-row{
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        font-size: 13px;
        color: rgba(245,248,255,.76);
      }
      .pct-row b{
        color: rgba(245,248,255,.92);
        font-weight: 800;
      }

      /* progress bar */
      .pct-progressbar{
        height: 8px;
        border-radius: 999px;
        background: rgba(255,255,255,.10);
        border: 1px solid rgba(255,255,255,.12);
        overflow: hidden;
        margin-top: 8px;
      }
      .pct-progressfill{
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, rgba(70,243,255,.95), rgba(255,75,216,.95));
      }

      /* Popup */
      .maplibregl-popup-content{
        background: rgba(15,18,24,.88) !important;
        color: rgba(245,248,255,.92) !important;
        border: 1px solid rgba(255,255,255,.14) !important;
        border-radius: 14px !important;
        box-shadow: 0 16px 40px rgba(0,0,0,.45) !important;
        backdrop-filter: blur(10px);
        padding: 12px 14px !important;
        min-width: 240px;
      }
      .maplibregl-popup-close-button{
        color: rgba(255,255,255,.8) !important;
        font-size: 18px !important;
        padding: 6px 10px !important;
      }
      .pct-popup-title{
        font-weight: 900;
        font-size: 16px;
        margin-bottom: 8px;
        letter-spacing: .2px;
      }
      .pct-popup-grid{
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 14px;
        font-size: 14px;
        line-height: 1.25;
      }
      .pct-popup-grid .k{ color: rgba(245,248,255,.70); }
      .pct-popup-grid .v{ color: rgba(245,248,255,.92); font-weight: 800; }

      /* Toggle button */
      .pct-toggle-btn{
        width: 36px; height: 36px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.22);
        background: rgba(10,12,16,.65);
        backdrop-filter: blur(8px);
        color: white;
        cursor: pointer;
        box-shadow: 0 10px 26px rgba(0,0,0,.35);
        display: grid;
        place-items: center;
        font-size: 18px;
      }
    `;
    document.head.appendChild(s);
  }

  // ---------- basemap style ----------
  const style = {
    version: 8,
    sources: {
      sat: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256,
        attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
      },
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors"
      }
    },
    layers: [
      { id: "sat-layer", type: "raster", source: "sat", layout: { visibility: "visible" } },
      { id: "osm-layer", type: "raster", source: "osm", layout: { visibility: "none" } }
    ]
  };

  const map = new maplibregl.Map({
    container: "map",
    style,
    center: [9.17, 48.78],
    zoom: 11
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

  // ---------- basemap toggle control ----------
  class BasemapToggle {
    onAdd(map) {
      this._map = map;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pct-toggle-btn";
      btn.title = "Toggle basemap (Satellite / OSM)";
      btn.setAttribute("aria-label", "Toggle basemap");

      const setIcon = () => {
        const satVis = map.getLayoutProperty("sat-layer", "visibility") !== "none";
        btn.textContent = satVis ? "🗺️" : "🛰️";
      };

      btn.addEventListener("click", () => {
        const satVis = map.getLayoutProperty("sat-layer", "visibility") !== "none";
        map.setLayoutProperty("sat-layer", "visibility", satVis ? "none" : "visible");
        map.setLayoutProperty("osm-layer", "visibility", satVis ? "visible" : "none");
        setIcon();
      });

      const wrap = document.createElement("div");
      wrap.className = "maplibregl-ctrl maplibregl-ctrl-group";
      wrap.style.marginTop = "6px";
      wrap.style.overflow = "hidden";
      wrap.appendChild(btn);

      map.on("idle", setIcon);
      this._container = wrap;
      setIcon();
      return this._container;
    }
    onRemove() {
      this._container?.parentNode?.removeChild(this._container);
      this._map = undefined;
    }
  }

  // ---------- marker (blinking) ----------
  let marker;
  function createBlinkMarkerEl() {
    ensurePulseKeyframes();
    const el = document.createElement("div");
    el.style.width = "16px";
    el.style.height = "16px";
    el.style.borderRadius = "999px";
    el.style.border = "2px solid rgba(232,238,245,.95)";
    el.style.boxShadow = "0 10px 26px rgba(0,0,0,.45)";
    el.style.background = "#2bff88";
    el.style.position = "relative";

    const ring = document.createElement("div");
    ring.style.position = "absolute";
    ring.style.left = "-10px";
    ring.style.top = "-10px";
    ring.style.width = "36px";
    ring.style.height = "36px";
    ring.style.borderRadius = "999px";
    ring.style.border = "2px solid rgba(43,255,136,.55)";
    ring.style.boxShadow = "0 0 22px rgba(43,255,136,.40)";
    ring.style.animation = "pctPulse 1.6s ease-out infinite";
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

  // ---------- layers / interactivity ----------
  let didFitOnce = false;
  let popup;
  let hoveredId = null;

  function setHover(id) {
    hoveredId = id;
    if (!map.getLayer("track-hover")) return;
    if (id == null) {
      map.setFilter("track-hover", ["==", ["get", "strava_id"], -1]);
      return;
    }
    map.setFilter("track-hover", ["==", ["to-number", ["get", "strava_id"]], Number(id)]);
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
    const elevStr = elevM == null
      ? "—"
      : `${fmtInt(elevM)} m / ${fmtInt(toFt(elevM))} ft`;

    const distStr = (km == null || mi == null)
      ? "—"
      : `${fmtNumber(km, 1)} km / ${fmtNumber(mi, 1)} mi`;

    return `
      <div class="pct-popup">
        <div class="pct-popup-title">${type}</div>
        <div class="pct-popup-grid">
          <div class="k">Date</div><div class="v">${start}</div>
          <div class="k">Distance</div><div class="v">${distStr}</div>
          <div class="k">Time</div><div class="v">${time}</div>
          <div class="k">Elevation</div><div class="v">${elevStr}</div>
        </div>
      </div>
    `;
  }

  // latest "live progress" line
  let liveAnim = { raf: null, t0: 0, coords: null, durationMs: 2200 };
  function stopLiveAnim() {
    if (liveAnim.raf) cancelAnimationFrame(liveAnim.raf);
    liveAnim.raf = null;
    liveAnim.coords = null;
  }
  function startLiveAnim(coords) {
    stopLiveAnim();
    if (!coords || coords.length < 2) return;

    liveAnim.coords = coords;
    liveAnim.t0 = performance.now();

    const step = (now) => {
      if (!map.getSource("latest-progress")) return;
      const elapsed = now - liveAnim.t0;
      const p = Math.min(1, elapsed / liveAnim.durationMs);
      const n = Math.max(2, Math.floor(p * coords.length));
      map.getSource("latest-progress").setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords.slice(0, n) }
      });

      if (p < 1) {
        liveAnim.raf = requestAnimationFrame(step);
      } else {
        liveAnim.t0 = performance.now() + 600;
        liveAnim.raf = requestAnimationFrame(step);
      }
    };
    liveAnim.raf = requestAnimationFrame(step);
  }

  function computeStats(track) {
    const feats = (track && track.features) ? track.features : [];
    let distM = 0, timeS = 0, elevM = 0, elevCount = 0;
    const days = new Set();
    let firstTs = null, lastTs = null;

    for (const f of feats) {
      const p = f.properties || {};
      const d = Number(p.distance_m);
      if (Number.isFinite(d)) distM += d;

      const t = Number(p.moving_time_s);
      if (Number.isFinite(t)) timeS += t;

      const e = pickElevationMeters(p);
      if (e != null) { elevM += e; elevCount++; }

      const sd = p.start_date ? String(p.start_date) : "";
      if (sd) {
        days.add(sd.slice(0, 10));
        const ts = Date.parse(sd);
        if (Number.isFinite(ts)) {
          if (firstTs == null || ts < firstTs) firstTs = ts;
          if (lastTs == null || ts > lastTs) lastTs = ts;
        }
      }
    }

    const activeDays = days.size;
    let restDays = null;
    if (firstTs != null && lastTs != null) {
      const span = Math.floor((lastTs - firstTs) / 86400000) + 1;
      restDays = Math.max(0, span - activeDays);
    }

    const totalKm = toKm(distM);
    const totalMi = toMi(distM);

    const hours = timeS / 3600;
    const avgMph = (hours > 0) ? (totalMi / hours) : null;
    const avgKmh = (hours > 0) ? (totalKm / hours) : null;

    const pctCompleted = (totalMi / PCT_TOTAL_MI) * 100;
    const remainingMi = Math.max(0, PCT_TOTAL_MI - totalMi);
    const remainingKm = remainingMi * 1.609344;

    const avgDistPerActMi = feats.length ? (totalMi / feats.length) : null;
    const avgDistPerActKm = feats.length ? (totalKm / feats.length) : null;

    return {
      featsCount: feats.length,
      distM, timeS, elevM, elevCount,
      totalKm, totalMi,
      firstTs, lastTs, activeDays, restDays,
      pctCompleted, remainingMi, remainingKm,
      avgDistPerActMi, avgDistPerActKm,
      avgMph, avgKmh
    };
  }

  function setStatsUI(s) {
    const elevMain = s.elevCount ? `${fmtInt(s.elevM)} m` : "—";
    const elevSub = s.elevCount ? `${fmtInt(toFt(s.elevM))} ft` : "";

    const avgDistMain = s.featsCount ? `${fmtNumber(s.avgDistPerActKm, 1)} km` : "—";
    const avgDistSub = s.featsCount ? `${fmtNumber(s.avgDistPerActMi, 1)} mi` : "";

    const avgSpeedMain = s.avgKmh ? `${fmtNumber(s.avgKmh, 1)} km/h` : "—";
    const avgSpeedSub = s.avgMph ? `${fmtNumber(s.avgMph, 1)} mi/h` : "";

    statsListEl.innerHTML = `
      <div class="pct-stats-wrap">
        <div class="pct-stat-hero">
          <div class="label">Total Distance</div>
          <div class="big">
            <div class="primary">${fmtNumber(s.totalKm, 1)} km</div>
            <div class="secondary">${fmtNumber(s.totalMi, 1)} mi</div>
          </div>
        </div>

        <div class="pct-chip-grid">
          <div class="pct-chip">
            <div class="label">Total Elevation</div>
            <div class="value">${elevMain}</div>
            <div class="sub">${elevSub}</div>
          </div>

          <div class="pct-chip">
            <div class="label">Total Time</div>
            <div class="value">${fmtDuration(s.timeS)}</div>
            <div class="sub">${s.featsCount ? `${s.featsCount} activities` : ""}</div>
          </div>

          <div class="pct-chip">
            <div class="label">Avg Distance / Activity</div>
            <div class="value">${avgDistMain}</div>
            <div class="sub">${avgDistSub}</div>
          </div>

          <div class="pct-chip">
            <div class="label">Avg Speed</div>
            <div class="value">${avgSpeedMain}</div>
            <div class="sub">${avgSpeedSub}</div>
          </div>
        </div>
      </div>
    `;
  }

  function setInsightsUI(s) {
    const pctLine =
      `${fmtNumber(s.totalKm, 1)} km / ${fmtNumber(s.totalMi, 1)} mi of ` +
      `${fmtInt(PCT_TOTAL_KM)} km / ${fmtInt(PCT_TOTAL_MI)} mi (${fmtNumber(s.pctCompleted, 1)}%)`;

    const remainingLine = `${fmtNumber(s.remainingKm, 1)} km / ${fmtNumber(s.remainingMi, 1)} mi`;

    const firstLine = s.firstTs ? new Date(s.firstTs).toLocaleDateString() : "—";
    const lastLine = s.lastTs ? new Date(s.lastTs).toLocaleDateString() : "—";
    const daysLine = `${s.activeDays || 0} active days${s.restDays != null ? ` · ${s.restDays} rest days` : ""}`;

    const pctWidth = Math.max(0, Math.min(100, Number.isFinite(s.pctCompleted) ? s.pctCompleted : 0));

    insightsListEl.innerHTML = `
      <div class="pct-sections">
        <div class="pct-section">
          <div class="pct-section-title">Progress</div>
          <div class="pct-rows">
            <div class="pct-row"><span>PCT completed</span><b>${pctLine}</b></div>
            <div class="pct-progressbar" aria-label="PCT progress">
              <div class="pct-progressfill" style="width:${pctWidth}%;"></div>
            </div>
            <div class="pct-row" style="margin-top:6px;"><span>Remaining</span><b>${remainingLine}</b></div>
          </div>
        </div>

        <div class="pct-section">
          <div class="pct-section-title">Timeline</div>
          <div class="pct-rows">
            <div class="pct-row"><span>First activity</span><b>${firstLine}</b></div>
            <div class="pct-row"><span>Last activity</span><b>${lastLine}</b></div>
            <div class="pct-row"><span>Days</span><b>${daysLine}</b></div>
          </div>
        </div>
      </div>
    `;
  }

  function findLatestFeature(track) {
    const feats = (track && track.features) ? track.features : [];
    let best = null, bestTs = -Infinity;
    for (const f of feats) {
      const p = f.properties || {};
      const ts = p.start_date ? Date.parse(p.start_date) : NaN;
      if (Number.isFinite(ts) && ts > bestTs) {
        bestTs = ts;
        best = f;
      }
    }
    return best;
  }

  async function refresh() {
    try {
      statusEl.textContent = "updating…";

      const [track, latest] = await Promise.all([loadJson(trackUrl), loadJson(latestUrl)]);

      if (!map.getSource("track")) {
        injectUICSSOnce();
        map.addControl(new BasemapToggle(), "top-right");

        map.addSource("track", { type: "geojson", data: track });

        const colorExpr = [
          "case",
          ["==", ["%", ["to-number", ["get", "i"]], 2], 0], "#46f3ff",
          "#ff4bd8"
        ];

        map.addLayer({
          id: "track-glow",
          type: "line",
          source: "track",
          paint: { "line-color": colorExpr, "line-width": 12, "line-opacity": 0.28, "line-blur": 6 }
        });

        map.addLayer({
          id: "track-main",
          type: "line",
          source: "track",
          paint: { "line-color": colorExpr, "line-width": 5, "line-opacity": 0.92 }
        });

        map.addLayer({
          id: "track-highlight",
          type: "line",
          source: "track",
          paint: { "line-color": "rgba(255,255,255,0.65)", "line-width": 1.6, "line-opacity": 0.55 }
        });

        map.addLayer({
          id: "track-hover",
          type: "line",
          source: "track",
          paint: { "line-color": "rgba(255,255,255,0.92)", "line-width": 7, "line-opacity": 0.75, "line-blur": 0.6 },
          filter: ["==", ["get", "strava_id"], -1]
        });

        map.addSource("latest-progress", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } }
        });

        map.addLayer({
          id: "latest-progress-glow",
          type: "line",
          source: "latest-progress",
          paint: { "line-color": "rgba(255,255,255,0.40)", "line-width": 18, "line-opacity": 0.22, "line-blur": 10 }
        });

        map.addLayer({
          id: "latest-progress",
          type: "line",
          source: "latest-progress",
          paint: { "line-color": "rgba(255,255,255,0.95)", "line-width": 3, "line-opacity": 0.85 }
        });

        map.on("mousemove", "track-main", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const f = e.features && e.features[0];
          if (!f) return;
          const id = (f.properties && f.properties.strava_id) ? f.properties.strava_id : null;
          if (id !== hoveredId) setHover(id);
        });
        map.on("mouseleave", "track-main", () => {
          map.getCanvas().style.cursor = "";
          setHover(null);
        });

        map.on("click", "track-main", (e) => {
          const f = e.features && e.features[0];
          if (!f) return;

          const p = f.properties || {};
          const html = buildPopupHTML(p);

          popup?.remove();
          popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "320px" })
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(map);
        });
      } else {
        map.getSource("track").setData(track);
      }

      // marker
      const lngLat = [latest.lon, latest.lat];
      if (!marker) {
        marker = new maplibregl.Marker({ element: createBlinkMarkerEl() })
          .setLngLat(lngLat)
          .addTo(map);
      } else {
        marker.setLngLat(lngLat);
      }

      const s = computeStats(track);
      setStatsUI(s);
      setInsightsUI(s);

      statusEl.textContent = "online";

      // status extra line (latest activity summary)
      const latestFeat = findLatestFeature(track);
      let lastActLine = "";
      if (latestFeat?.properties) {
        const p = latestFeat.properties;
        const type = activityTypeLabel(p);

        const distM = Number(p.distance_m);
        const km = Number.isFinite(distM) ? toKm(distM) : null;
        const mi = Number.isFinite(distM) ? toMi(distM) : null;

        const tSec = Number(p.moving_time_s);
        const time = Number.isFinite(tSec) ? fmtDuration(tSec) : "—";

        const distStr = (km == null || mi == null) ? "—" : `${fmtNumber(km, 1)} km / ${fmtNumber(mi, 1)} mi`;
        lastActLine = `<br>${type}: ${distStr} · ${time}`;
      }

      metaEl.innerHTML =
        `Last updated: ${fmtDate(latest.ts)} · Lat/Lon: ${latest.lat.toFixed(5)}, ${latest.lon.toFixed(5)}${lastActLine}`;

      statusExtraEl.textContent = latestFeat
        ? "Tap a track to see details. Hover highlights on desktop."
        : "Waiting for activities…";

      if (!didFitOnce) {
        const bbox = geojsonBbox(track);
        if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
        else map.easeTo({ center: lngLat, zoom: 13, duration: 800 });
        didFitOnce = true;
      }

      if (latestFeat?.geometry?.type === "LineString") startLiveAnim(latestFeat.geometry.coordinates);
      else {
        if (map.getSource("latest-progress")) {
          map.getSource("latest-progress").setData({
            type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] }
          });
        }
        stopLiveAnim();
      }

    } catch (e) {
      statusEl.textContent = "error";
      metaEl.textContent = "Missing data/track.geojson or data/latest.json";
      if (statusExtraEl) statusExtraEl.textContent = "";
    }
  }

  map.on("load", () => {
    injectUICSSOnce();
    refresh();
    setInterval(refresh, 60_000);
  });
})();