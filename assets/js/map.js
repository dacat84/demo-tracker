(async function () {
  // ====== DOM ======
  const statusEl = document.getElementById("status");
  const metaEl = document.getElementById("meta");

  // The left box currently has a static "Features" list in index.md layout.
  // We’ll replace its inner HTML at runtime with “Statistics” + totals.
  const featuresBox =
    Array.from(document.querySelectorAll(".card")).find((c) =>
      (c.textContent || "").includes("Features")
    ) || document.querySelector(".card"); // fallback

  // ====== URLs (works under GitHub Pages subpaths) ======
  const trackUrl = new URL("./data/track.geojson", window.location.href).toString();
  const latestUrl = new URL("./data/latest.json", window.location.href).toString();

  // ====== Units (US) ======
  const M_TO_MI = 0.000621371;
  const M_TO_FT = 3.28084;

  function fmtMilesFromMeters(m) {
    const mi = (Number(m) || 0) * M_TO_MI;
    return `${mi.toFixed(mi < 10 ? 2 : 1)} mi`;
  }
  function fmtFeetFromMeters(m) {
    const ft = (Number(m) || 0) * M_TO_FT;
    return `${Math.round(ft).toLocaleString()} ft`;
  }
  function fmtDuration(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    const days = Math.floor(sec / 86400);
    sec %= 86400;
    const h = Math.floor(sec / 3600);
    sec %= 3600;
    const m = Math.floor(sec / 60);
    const s = sec % 60;

    if (days > 0) {
      return `${days} Day${days === 1 ? "" : "s"} ${h} h ${m} min`;
    }
    if (h > 0) return `${h} h ${m} min`;
    return `${m} min ${s} s`;
  }
  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleString(undefined, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return String(ts);
    }
  }

  // ====== Basemaps (Satellite default, OSM toggle) ======
  // Satellite (Esri) – you already use it
  const SAT_TILES =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const SAT_ATTR =
    "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

  // OSM Standard
  const OSM_TILES = [
    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
  ];
  const OSM_ATTR = "© OpenStreetMap contributors";

  function makeRasterStyle(tiles, attribution) {
    return {
      version: 8,
      sources: {
        base: {
          type: "raster",
          tiles: Array.isArray(tiles) ? tiles : [tiles],
          tileSize: 256,
          attribution,
        },
      },
      layers: [{ id: "base", type: "raster", source: "base" }],
    };
  }

  const styleSatellite = makeRasterStyle(SAT_TILES, SAT_ATTR);
  const styleOSM = makeRasterStyle(OSM_TILES, OSM_ATTR);

  const map = new maplibregl.Map({
    container: "map",
    style: styleSatellite,
    center: [9.17, 48.78],
    zoom: 11,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

  // ====== Data helpers ======
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
          g.type === "LineString"
            ? g.coordinates
            : g.type === "MultiLineString"
              ? g.coordinates.flat()
              : g.type === "Point"
                ? [g.coordinates]
                : [];
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
    } catch {
      return null;
    }
  }

  function lastCoordOfFeature(f) {
    try {
      const coords = f?.geometry?.coordinates;
      if (!coords || !coords.length) return null;
      return coords[coords.length - 1]; // [lon,lat]
    } catch {
      return null;
    }
  }

  function pickLatestFeature(track) {
    const feats = (track && track.features) || [];
    if (!feats.length) return null;

    // Prefer newest start_date; fallback: highest strava_id
    return feats
      .slice()
      .sort((a, b) => {
        const da = a?.properties?.start_date || "";
        const db = b?.properties?.start_date || "";
        if (da < db) return -1;
        if (da > db) return 1;
        return (a?.properties?.strava_id || 0) - (b?.properties?.strava_id || 0);
      })
      .at(-1);
  }

  function computeTotals(track) {
    const feats = (track && track.features) || [];
    let distM = 0;
    let timeS = 0;
    let elevM = 0;
    let elevKnown = false;

    for (const f of feats) {
      distM += Number(f?.properties?.distance_m || 0);
      timeS += Number(f?.properties?.moving_time_s || 0);

      // Optional: if you added "elev_gain_m" in the sync script, we’ll show it
      const eg = f?.properties?.elev_gain_m;
      if (eg !== undefined && eg !== null && eg !== "") {
        elevM += Number(eg) || 0;
        elevKnown = true;
      }
    }

    return { distM, timeS, elevM, elevKnown };
  }

  // ====== Marker (pulsing green ↔ orange) ======
  let marker;
  function createPulsingMarkerEl() {
    const el = document.createElement("div");
    el.style.width = "16px";
    el.style.height = "16px";
    el.style.borderRadius = "999px";
    el.style.border = "2px solid rgba(232,238,245,.95)";
    el.style.boxShadow = "0 10px 26px rgba(0,0,0,.45)";
    el.style.background = "#2bff88"; // start green
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

    if (!document.getElementById("pctPulseStyle")) {
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

  // ====== Popup styling (dark card) ======
  function ensurePopupCSS() {
    if (document.getElementById("pctPopupCSS")) return;
    const s = document.createElement("style");
    s.id = "pctPopupCSS";
    s.textContent = `
      .pct-popup .maplibregl-popup-content{
        background: rgba(18,22,28,.92);
        color: rgba(232,238,245,.95);
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 14px;
        box-shadow: 0 18px 50px rgba(0,0,0,.55);
        padding: 12px 12px 10px 12px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        min-width: 220px;
      }
      .pct-popup .maplibregl-popup-tip{
        border-top-color: rgba(18,22,28,.92) !important;
      }
      .pct-popup .maplibregl-popup-close-button{
        color: rgba(120,180,255,.95);
        font-size: 18px;
        padding: 6px 10px;
      }
      .pct-popup h3{
        margin: 0 0 6px 0;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: .2px;
      }
      .pct-popup .row{
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 14px;
        line-height: 1.35;
        margin: 3px 0;
      }
      .pct-popup .k{ opacity: .75; }
      .pct-popup .v{ font-weight: 700; }
    `;
    document.head.appendChild(s);
  }

  // ====== Track layers (re-added after style switch) ======
  const TRACK_SOURCE_ID = "track";
  const LAYER_GLOW = "track-glow";
  const LAYER_MAIN = "track-main";
  const LAYER_HILITE = "track-highlight";
  const LAYER_HOVER = "track-hover";

  const colorExpr = [
    "case",
    ["==", ["%", ["to-number", ["get", "i"]], 2], 0],
    "#46f3ff", // cyan
    "#ff4bd8", // magenta
  ];

  let lastTrackData = null;
  let lastLatest = null;

  function addOrUpdateTrack(track) {
    // Source
    if (!map.getSource(TRACK_SOURCE_ID)) {
      map.addSource(TRACK_SOURCE_ID, { type: "geojson", data: track });
    } else {
      map.getSource(TRACK_SOURCE_ID).setData(track);
    }

    // Layers (ensure correct order)
    if (!map.getLayer(LAYER_GLOW)) {
      map.addLayer({
        id: LAYER_GLOW,
        type: "line",
        source: TRACK_SOURCE_ID,
        paint: {
          "line-color": colorExpr,
          "line-width": 12,
          "line-opacity": 0.28,
          "line-blur": 6,
        },
      });
    }
    if (!map.getLayer(LAYER_MAIN)) {
      map.addLayer({
        id: LAYER_MAIN,
        type: "line",
        source: TRACK_SOURCE_ID,
        paint: {
          "line-color": colorExpr,
          "line-width": 5,
          "line-opacity": 0.92,
        },
      });
    }
    if (!map.getLayer(LAYER_HILITE)) {
      map.addLayer({
        id: LAYER_HILITE,
        type: "line",
        source: TRACK_SOURCE_ID,
        paint: {
          "line-color": "rgba(255,255,255,0.65)",
          "line-width": 1.6,
          "line-opacity": 0.55,
        },
      });
    }

    // Hover highlight (brighter/stronger on hover)
    if (!map.getLayer(LAYER_HOVER)) {
      map.addLayer({
        id: LAYER_HOVER,
        type: "line",
        source: TRACK_SOURCE_ID,
        paint: {
          "line-color": "#ffffff",
          "line-width": 7,
          "line-opacity": 0.0,
          "line-blur": 0,
        },
      });
    }
  }

  // ====== Hover + Click popup ======
  let hoveredId = null;

  function enableHoverAndClick() {
    ensurePopupCSS();

    // MapLibre: promoteId helps feature-state if you have a stable id; if not, we use index.
    // We’ll just use feature-state on hover layer opacity.
    map.on("mousemove", LAYER_MAIN, (e) => {
      map.getCanvas().style.cursor = "pointer";
      if (!e.features || !e.features.length) return;

      const f = e.features[0];
      const fid =
        f.id ??
        f.properties?.strava_id ??
        f.properties?.i ??
        null;

      if (hoveredId !== null && hoveredId !== fid) {
        // reset old
        // We simulate hover by filtering hover-layer to this feature
        map.setFilter(LAYER_HOVER, ["==", ["get", "strava_id"], -1]);
      }

      hoveredId = fid;
      // Filter hover layer to this feature by strava_id if present; else by i
      if (f.properties?.strava_id != null) {
        map.setFilter(LAYER_HOVER, ["==", ["get", "strava_id"], Number(f.properties.strava_id)]);
      } else if (f.properties?.i != null) {
        map.setFilter(LAYER_HOVER, ["==", ["get", "i"], Number(f.properties.i)]);
      } else {
        map.setFilter(LAYER_HOVER, ["==", ["get", "name"], f.properties?.name || ""]);
      }
      map.setPaintProperty(LAYER_HOVER, "line-opacity", 0.35);
    });

    map.on("mouseleave", LAYER_MAIN, () => {
      map.getCanvas().style.cursor = "";
      hoveredId = null;
      if (map.getLayer(LAYER_HOVER)) {
        map.setPaintProperty(LAYER_HOVER, "line-opacity", 0.0);
        map.setFilter(LAYER_HOVER, ["==", ["get", "strava_id"], -1]);
      }
    });

    let popup = null;

    map.on("click", LAYER_MAIN, (e) => {
      if (!e.features || !e.features.length) return;
      const f = e.features[0];

      const start = f.properties?.start_date || "";
      const distM = Number(f.properties?.distance_m || 0);
      const timeS = Number(f.properties?.moving_time_s || 0);
      const elevM = f.properties?.elev_gain_m;

      const when = start ? fmtDate(start) : "—";
      const dist = fmtMilesFromMeters(distM);
      const dur = fmtDuration(timeS);

      // Activity type in English (fallback)
      const typeRaw = (f.properties?.type || "").toString();
      const actType = typeRaw ? typeRaw : "Activity";

      const elev = (elevM !== undefined && elevM !== null && elevM !== "")
        ? fmtFeetFromMeters(Number(elevM) || 0)
        : "—";

      // Remove “Nachtwanderung …” title: use just activity type as header
      const html = `
        <div class="pct-popup">
          <h3>${escapeHtml(actType)}</h3>
          <div class="row"><div class="k">Date</div><div class="v">${escapeHtml(when)}</div></div>
          <div class="row"><div class="k">Distance</div><div class="v">${escapeHtml(dist)}</div></div>
          <div class="row"><div class="k">Time</div><div class="v">${escapeHtml(dur)}</div></div>
          <div class="row"><div class="k">Elevation</div><div class="v">${escapeHtml(elev)}</div></div>
        </div>
      `;

      const ll = e.lngLat;

      if (popup) popup.remove();
      popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 14, className: "pct-popup" })
        .setLngLat(ll)
        .setHTML(html)
        .addTo(map);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ====== Base map toggle button (placed UNDER zoom control) ======
  let isSatellite = true;

  function addBasemapToggleControl() {
    // custom control to place exactly under the navigation control (top-right)
    class BasemapControl {
      onAdd(mapInstance) {
        this._map = mapInstance;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = "Toggle basemap";
        btn.setAttribute("aria-label", "Toggle basemap");
        btn.style.width = "36px";
        btn.style.height = "36px";
        btn.style.borderRadius = "10px";
        btn.style.border = "1px solid rgba(255,255,255,.20)";
        btn.style.background = "rgba(18,22,28,.75)";
        btn.style.backdropFilter = "blur(8px)";
        btn.style.webkitBackdropFilter = "blur(8px)";
        btn.style.boxShadow = "0 10px 26px rgba(0,0,0,.45)";
        btn.style.display = "grid";
        btn.style.placeItems = "center";
        btn.style.cursor = "pointer";
        btn.style.marginTop = "8px";

        // icon: satellite (🛰️) vs map (🗺️) — emoji is simplest and looks good on iOS
        const icon = document.createElement("div");
        icon.style.fontSize = "18px";
        icon.textContent = "🗺️"; // since satellite is default, button shows “switch to map”
        btn.appendChild(icon);

        btn.addEventListener("click", async () => {
          // Keep current view
          const center = this._map.getCenter();
          const zoom = this._map.getZoom();
          const bearing = this._map.getBearing();
          const pitch = this._map.getPitch();

          isSatellite = !isSatellite;
          icon.textContent = isSatellite ? "🗺️" : "🛰️";

          // Switch style
          this._map.setStyle(isSatellite ? styleSatellite : styleOSM);

          // After style load, re-add track + marker from cached data
          this._map.once("style.load", () => {
            if (lastTrackData) addOrUpdateTrack(lastTrackData);
            if (lastLatest) placeMarkerFromLatest(lastLatest, lastTrackData);

            // restore view
            this._map.jumpTo({ center, zoom, bearing, pitch });

            // re-enable interactions (layers are new)
            enableHoverAndClick();
          });
        });

        this._container = document.createElement("div");
        this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
        // make it look like a single button group
        this._container.style.background = "transparent";
        this._container.style.boxShadow = "none";
        this._container.style.border = "none";
        this._container.appendChild(btn);
        return this._container;
      }
      onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
      }
    }

    // Add AFTER nav control so it appears beneath it
    map.addControl(new BasemapControl(), "top-right");
  }

  // ====== Marker placement ======
  function placeMarkerFromLatest(latest, track) {
    // If latest.json exists, use it; else use latest feature last coord.
    let lngLat = null;
    if (latest && latest.lon != null && latest.lat != null) {
      lngLat = [Number(latest.lon), Number(latest.lat)];
    } else {
      const lf = pickLatestFeature(track);
      const c = lf ? lastCoordOfFeature(lf) : null;
      if (c) lngLat = [c[0], c[1]];
    }
    if (!lngLat) return;

    if (!marker) {
      marker = new maplibregl.Marker({ element: createPulsingMarkerEl() }).setLngLat(lngLat).addTo(map);
    } else {
      marker.setLngLat(lngLat);
    }
  }

  // ====== Status + Statistics UI ======
  function setStatisticsUI(track, latestFeature) {
    if (!featuresBox) return;

    const totals = computeTotals(track);
    const totalDist = fmtMilesFromMeters(totals.distM);
    const totalTime = fmtDuration(totals.timeS);
    const totalElev = totals.elevKnown ? fmtFeetFromMeters(totals.elevM) : "—";

    // Replace title and list in the box
    // Keep the same "card" styling; just update contents.
    const html = `
      <h3 style="margin:0 0 10px 0;">Statistics</h3>
      <ul style="margin:0; padding-left: 18px; line-height:1.55;">
        <li>Total: ${escapeHtml(totalDist)}</li>
        <li>Time: ${escapeHtml(totalTime)}</li>
        <li>Elevation: ${escapeHtml(totalElev)}</li>
      </ul>
    `;
    featuresBox.innerHTML = html;

    // Status tip line: show latest activity summary (instead of “Tipp: …”)
    if (latestFeature) {
      const dist = fmtMilesFromMeters(Number(latestFeature.properties?.distance_m || 0));
      const dur = fmtDuration(Number(latestFeature.properties?.moving_time_s || 0));
      const type = (latestFeature.properties?.type || "Activity").toString();
      // Keep "Last updated" line in metaEl as you have; show activity summary beneath
      // We’ll put it in statusEl's parent as meta second line
      // Here: write into metaEl additional text line
      const summary = `${escapeHtml(type)}: ${escapeHtml(dist)} · ${escapeHtml(dur)}`;
      // metaEl already shows Last updated…; we add newline-like separator
      metaEl.textContent = metaEl.textContent.split(" · Lat/Lon:")[0] + ` · ${summary}`;
    }
  }

  // ====== Refresh loop ======
  let firstFitDone = false;

  async function refresh() {
    try {
      statusEl.textContent = "updating…";

      const [track, latest] = await Promise.all([loadJson(trackUrl), loadJson(latestUrl).catch(() => null)]);

      lastTrackData = track;
      lastLatest = latest;

      // Ensure track layers exist (also after any future style changes)
      addOrUpdateTrack(track);

      // Hover/click handlers need layers present
      enableHoverAndClick();

      // Latest feature
      const latestFeature = pickLatestFeature(track);

      // Marker
      placeMarkerFromLatest(latest, track);

      // Status line
      const ts = latest?.ts || latestFeature?.properties?.start_date || "";
      const lng = latest?.lon;
      const lat = latest?.lat;
      if (ts) {
        if (lat != null && lng != null) {
          metaEl.textContent = `Last updated: ${fmtDate(ts)} · Lat/Lon: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
        } else {
          metaEl.textContent = `Last updated: ${fmtDate(ts)}`;
        }
      }

      // Statistics box + replace “tip” text
      setStatisticsUI(track, latestFeature);

      // Fit bounds once (don’t keep jumping on mobile)
      if (!firstFitDone) {
        const bbox = geojsonBbox(track);
        if (bbox) {
          map.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]],
            ],
            { padding: 40, duration: 800 }
          );
        }
        firstFitDone = true;
      }

      statusEl.textContent = "online";
    } catch (e) {
      statusEl.textContent = "error";
      metaEl.textContent = "Missing data/track.geojson or data/latest.json";
    }
  }

  // ====== Init ======
  map.on("load", () => {
    // satellite is default style already
    addBasemapToggleControl();

    // make hover layer inactive initially
    if (map.getLayer(LAYER_HOVER)) {
      map.setPaintProperty(LAYER_HOVER, "line-opacity", 0.0);
      map.setFilter(LAYER_HOVER, ["==", ["get", "strava_id"], -1]);
    }

    refresh();
    setInterval(refresh, 60_000);
  });
})();