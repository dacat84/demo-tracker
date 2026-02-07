(async function () {
  const statusEl = document.getElementById("status");
  const metaEl = document.getElementById("meta");

  const trackUrl = new URL("./data/track.geojson", window.location.href).toString();
  const latestUrl = new URL("./data/latest.json", window.location.href).toString();

  // ---------- Basemaps (Satellite default + OSM toggle) ----------
  const style = {
    version: 8,
    sources: {
      sat: {
        type: "raster",
        tiles: [
          // Esri World Imagery (works well on GitHub Pages)
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256,
        attribution:
          "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
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
      { id: "basemap-sat", type: "raster", source: "sat" },              // visible by default
      { id: "basemap-osm", type: "raster", source: "osm", layout: { visibility: "none" } } // hidden
    ]
  };

  const map = new maplibregl.Map({
    container: "map",
    style,
    center: [9.17, 48.78],
    zoom: 11
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

  function fmtDate(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return String(ts);
    }
  }

  function mToFt(m) {
    return m * 3.28084;
  }
  function kmToMi(km) {
    return km * 0.621371;
  }

  function fmtDistanceBoth(meters) {
    const km = (meters || 0) / 1000;
    const mi = kmToMi(km);
    return `${km.toFixed(1)} km / ${mi.toFixed(1)} mi`;
  }

  function fmtElevationBoth(meters) {
    if (meters == null || !isFinite(meters)) return "—";
    const ft = mToFt(meters);
    // use thousands separator like "15,736"
    const ftStr = Math.round(ft).toLocaleString();
    return `${Math.round(meters).toLocaleString()} m / ${ftStr} ft`;
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Number(sec || 0));
    const days = Math.floor(sec / 86400);
    sec -= days * 86400;
    const hours = Math.floor(sec / 3600);
    sec -= hours * 3600;
    const mins = Math.floor(sec / 60);

    if (days > 0) return `${days} Day ${hours} h ${mins} min`;
    if (hours > 0) return `${hours} h ${mins} min`;
    return `${mins} min`;
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  // ---------- Pulsing marker (green <-> orange) ----------
  let marker;
  function createPulsingMarkerEl() {
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

  // ---------- Basemap toggle (no setStyle -> tracks stay!) ----------
  function addBasemapToggle() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Toggle basemap";
    btn.setAttribute("aria-label", "Toggle basemap");
    btn.style.width = "34px";
    btn.style.height = "34px";
    btn.style.borderRadius = "8px";
    btn.style.border = "1px solid rgba(255,255,255,.18)";
    btn.style.background = "rgba(20,24,30,.55)";
    btn.style.backdropFilter = "blur(10px)";
    btn.style.color = "white";
    btn.style.cursor = "pointer";
    btn.style.display = "grid";
    btn.style.placeItems = "center";
    btn.style.boxShadow = "0 10px 22px rgba(0,0,0,.35)";
    btn.style.fontSize = "18px";
    btn.textContent = "🗺️"; // OSM icon when currently satellite

    let showingSat = true;

    btn.addEventListener("click", () => {
      showingSat = !showingSat;
      map.setLayoutProperty("basemap-sat", "visibility", showingSat ? "visible" : "none");
      map.setLayoutProperty("basemap-osm", "visibility", showingSat ? "none" : "visible");
      // switch icon to indicate what you will get if you tap
      btn.textContent = showingSat ? "🗺️" : "🛰️";
    });

    const ctrl = {
      onAdd() {
        const container = document.createElement("div");
        container.className = "maplibregl-ctrl maplibregl-ctrl-group";
        container.style.marginTop = "8px"; // below zoom control
        container.appendChild(btn);
        return container;
      },
      onRemove() { /* noop */ }
    };

    map.addControl(ctrl, "top-right");
  }

  // ---------- GeoJSON bbox helper ----------
  function geojsonBbox(geojson) {
    try {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const feats = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
      for (const f of feats) {
        const g = f.type === "Feature" ? f.geometry : f;
        const coords =
          g.type === "LineString" ? g.coordinates :
          g.type === "MultiLineString" ? g.coordinates.flat() :
          g.type === "Point" ? [g.coordinates] : [];
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

  // ---------- Elevation chart (no libs) ----------
  function buildElevationChart(dist_m, elev_m) {
    if (!Array.isArray(dist_m) || !Array.isArray(elev_m)) return null;
    const n = Math.min(dist_m.length, elev_m.length);
    if (n < 3) return null;

    const W = 260;
    const H = 70;
    const padX = 6;
    const padY = 6;

    let minE = Infinity, maxE = -Infinity;
    for (let i = 0; i < n; i++) {
      const e = Number(elev_m[i]);
      if (!isFinite(e)) continue;
      minE = Math.min(minE, e);
      maxE = Math.max(maxE, e);
    }
    if (!isFinite(minE) || !isFinite(maxE) || maxE - minE < 1e-6) return null;

    const minD = Number(dist_m[0]) || 0;
    const maxD = Number(dist_m[n - 1]) || 1;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.style.borderRadius = "10px";
    canvas.style.display = "block";
    canvas.style.marginTop = "10px";
    canvas.style.background = "rgba(255,255,255,.06)";
    canvas.style.border = "1px solid rgba(255,255,255,.10)";

    const ctx = canvas.getContext("2d");

    const xOf = (d) => {
      const t = (d - minD) / (maxD - minD);
      return padX + t * (W - padX * 2);
    };
    const yOf = (e) => {
      const t = (e - minE) / (maxE - minE);
      return (H - padY) - t * (H - padY * 2);
    };

    // path
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xOf(Number(dist_m[i]) || 0);
      const y = yOf(Number(elev_m[i]) || minE);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // area fill
    ctx.save();
    ctx.lineTo(xOf(maxD), H - padY);
    ctx.lineTo(xOf(minD), H - padY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, padY, 0, H - padY);
    grad.addColorStop(0, "rgba(70,243,255,.24)");
    grad.addColorStop(1, "rgba(255,75,216,.10)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // stroke
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xOf(Number(dist_m[i]) || 0);
      const y = yOf(Number(elev_m[i]) || minE);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = 1.6;
    ctx.shadowColor = "rgba(70,243,255,.35)";
    ctx.shadowBlur = 10;
    ctx.stroke();

    // tiny min/max labels
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const minLabel = `${Math.round(minE)} m`;
    const maxLabel = `${Math.round(maxE)} m`;
    ctx.fillText(maxLabel, 8, 14);
    ctx.fillText(minLabel, 8, H - 8);

    return canvas;
  }

  // ---------- Track layers + hover highlight ----------
  let hoveredId = null;
  let popup;

  function ensureTrackIds(track) {
    if (!track || !Array.isArray(track.features)) return track;
    for (const f of track.features) {
      if (f && f.type === "Feature") {
        const sid = f.properties?.strava_id;
        if (sid != null) f.id = sid; // important for feature-state hover
      }
    }
    return track;
  }

  function addTrackLayers(track) {
    map.addSource("track", { type: "geojson", data: track });

    // alternating color per activity via properties.i
    const colorExpr = [
      "case",
      ["==", ["%", ["to-number", ["get", "i"]], 2], 0],
      "#46f3ff",
      "#ff4bd8"
    ];

    // hover highlight via feature-state
    const hoverBoost = ["case", ["boolean", ["feature-state", "hover"], false], 1, 0];

    map.addLayer({
      id: "track-glow",
      type: "line",
      source: "track",
      paint: {
        "line-color": colorExpr,
        "line-width": ["+", 12, ["*", 4, hoverBoost]],
        "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.42, 0.26],
        "line-blur": ["+", 6, ["*", 2, hoverBoost]]
      }
    });

    map.addLayer({
      id: "track-main",
      type: "line",
      source: "track",
      paint: {
        "line-color": colorExpr,
        "line-width": ["+", 5, ["*", 2.2, hoverBoost]],
        "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1.0, 0.92]
      }
    });

    map.addLayer({
      id: "track-highlight",
      type: "line",
      source: "track",
      paint: {
        "line-color": "rgba(255,255,255,0.65)",
        "line-width": ["+", 1.6, ["*", 0.9, hoverBoost]],
        "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.75, 0.55]
      }
    });

    // hover on desktop
    map.on("mousemove", "track-main", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f || f.id == null) return;

      if (hoveredId !== null && hoveredId !== f.id) {
        map.setFeatureState({ source: "track", id: hoveredId }, { hover: false });
      }
      hoveredId = f.id;
      map.setFeatureState({ source: "track", id: hoveredId }, { hover: true });
    });

    map.on("mouseleave", "track-main", () => {
      map.getCanvas().style.cursor = "";
      if (hoveredId !== null) {
        map.setFeatureState({ source: "track", id: hoveredId }, { hover: false });
      }
      hoveredId = null;
    });

    // click -> popup with elevation chart
    map.on("click", "track-main", (e) => {
      const f = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const type = (p.type || "Activity").toString(); // keep "Hike"/"Run"/etc from Strava type

      const dateStr = fmtDate(p.start_date);
      const distStr = fmtDistanceBoth(Number(p.distance_m || 0));
      const timeStr = fmtDuration(Number(p.moving_time_s || 0));

      const elevGain = Number(p.elevation_gain_m);
      const elevStr = fmtElevationBoth(isFinite(elevGain) ? elevGain : null);

      const container = document.createElement("div");
      container.style.minWidth = "280px";

      // Header (no activity name)
      const h = document.createElement("div");
      h.style.fontWeight = "700";
      h.style.fontSize = "16px";
      h.style.marginBottom = "6px";
      h.textContent = type;
      container.appendChild(h);

      const rows = document.createElement("div");
      rows.style.display = "grid";
      rows.style.gridTemplateColumns = "90px 1fr";
      rows.style.rowGap = "4px";
      rows.style.columnGap = "10px";
      rows.style.fontSize = "13px";

      const addRow = (k, v) => {
        const a = document.createElement("div");
        a.style.opacity = "0.85";
        a.textContent = k;
        const b = document.createElement("div");
        b.style.textAlign = "right";
        b.style.fontWeight = "600";
        b.textContent = v;
        rows.appendChild(a);
        rows.appendChild(b);
      };

      addRow("Date", dateStr);
      addRow("Distance", distStr);
      addRow("Time", timeStr);
      addRow("Elevation", elevStr);

      container.appendChild(rows);

      // chart
      const distArr = p.profile_dist_m ? JSON.parse(p.profile_dist_m) : null;
      const elevArr = p.profile_elev_m ? JSON.parse(p.profile_elev_m) : null;
      const chart = buildElevationChart(distArr, elevArr);
      if (chart) container.appendChild(chart);

      // popup
      if (popup) popup.remove();
      popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: "360px",
        className: "pct-popup"
      })
        .setLngLat(e.lngLat)
        .setDOMContent(container)
        .addTo(map);

      // styling once
      if (!document.getElementById("pctPopupStyle")) {
        const s = document.createElement("style");
        s.id = "pctPopupStyle";
        s.textContent = `
          .pct-popup .maplibregl-popup-content{
            background: rgba(18,22,28,.85);
            backdrop-filter: blur(14px);
            border: 1px solid rgba(255,255,255,.14);
            border-radius: 14px;
            color: rgba(245,248,255,.95);
            box-shadow: 0 20px 50px rgba(0,0,0,.45);
            padding: 12px 14px 12px 14px;
          }
          .pct-popup .maplibregl-popup-close-button{
            color: rgba(200,210,225,.9);
            font-size: 18px;
            padding: 6px 8px;
          }
          .pct-popup .maplibregl-popup-tip{
            border-top-color: rgba(18,22,28,.85) !important;
          }
        `;
        document.head.appendChild(s);
      }
    });
  }

  async function refresh() {
    try {
      statusEl.textContent = "aktualisiere…";

      const [trackRaw, latest] = await Promise.all([loadJson(trackUrl), loadJson(latestUrl)]);
      const track = ensureTrackIds(trackRaw);

      // Add or update track
      if (!map.getSource("track")) {
        addTrackLayers(track);
      } else {
        map.getSource("track").setData(track);
      }

      // marker
      const lngLat = [latest.lon, latest.lat];
      if (!marker) {
        marker = new maplibregl.Marker({ element: createPulsingMarkerEl() })
          .setLngLat(lngLat)
          .addTo(map);
      } else {
        marker.setLngLat(lngLat);
      }

      // Find newest activity feature for status text (by start_date)
      let newest = null;
      if (track && Array.isArray(track.features) && track.features.length) {
        for (const f of track.features) {
          const sd = f?.properties?.start_date || "";
          if (!newest || sd > (newest.properties?.start_date || "")) newest = f;
        }
      }

      const lat = Number(latest.lat);
      const lon = Number(latest.lon);

      const lastUpdated = `Last updated: ${fmtDate(latest.ts)} · Lat/Lon: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;

      let hikeLine = "";
      if (newest && newest.properties) {
        const p = newest.properties;
        const type = (p.type || "Activity").toString();
        hikeLine = `\n${type}: ${fmtDistanceBoth(Number(p.distance_m || 0))} · ${fmtDuration(Number(p.moving_time_s || 0))}`;
      }

      metaEl.textContent = lastUpdated + (hikeLine ? " " + hikeLine : "");

      // Fit bounds
      const bbox = geojsonBbox(track);
      if (bbox) {
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 800 });
      } else {
        map.easeTo({ center: lngLat, zoom: 13, duration: 800 });
      }

      statusEl.textContent = "online";
    } catch (e) {
      statusEl.textContent = "Fehler (Daten fehlen?)";
      metaEl.textContent = "Lege data/track.geojson und data/latest.json an.";
    }
  }

  map.on("load", () => {
    addBasemapToggle();
    refresh();
    setInterval(refresh, 60_000);
  });
})();