(async function () {
  const statusEl = document.getElementById("status");
  const metaEl = document.getElementById("meta");

  // URLs (funktioniert auch unter /demo-tracker/ auf GitHub Pages)
  const trackUrl = new URL("./data/track.geojson", window.location.href).toString();
  const latestUrl = new URL("./data/latest.json", window.location.href).toString();

  // --- Basemap (Carto Dark) ---
  const style = {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        attribution: "© OpenMapTiles © OpenStreetMap contributors"
      }
    },
    layers: [
      { id: "osm", type: "raster", source: "osm" }
    ]
  };

  const map = new maplibregl.Map({
    container: "map",
    style,
    center: [9.17, 48.78],
    zoom: 11
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

  function fmtTs(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return String(ts);
    }
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  // --- Pulsierender Marker (grün ↔ orange) ---
  let marker;
  function createPulsingMarkerEl() {
    const el = document.createElement("div");
    el.style.width = "16px";
    el.style.height = "16px";
    el.style.borderRadius = "999px";
    el.style.border = "2px solid rgba(232,238,245,.95)";
    el.style.boxShadow = "0 10px 26px rgba(0,0,0,.45)";
    el.style.background = "#2bff88"; // Startfarbe

    // Pulse-Ring via pseudo "inner div"
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
    el.style.position = "relative";
    el.appendChild(ring);

    // Keyframes einmal global injecten
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

    // Grün <-> Orange blinken
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

  // --- BBox helper ---
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
    } catch {
      return null;
    }
  }

  async function refresh() {
    try {
      statusEl.textContent = "aktualisiere…";

      const [track, latest] = await Promise.all([loadJson(trackUrl), loadJson(latestUrl)]);

      // Track Source/Layers einmalig anlegen
      if (!map.getSource("track")) {
        map.addSource("track", { type: "geojson", data: track });

        // ✅ Basemap heller machen (Sweet spot: 0.16)
        // NOTE: background-layer legt eine transparente weiße Fläche "oben drüber".
        map.addLayer({
          id: "brighten-overlay",
          type: "background",
          paint: {
            "background-color": "rgba(255,255,255,0.16)"
          }
        });

        // ✅ Raster etwas "cleaner": weniger Sättigung, mehr Kontrast
        // (wirkt so, als wäre die Karte heller und klarer)
        try {
          map.setPaintProperty("osm", "raster-saturation", -0.2);
          map.setPaintProperty("osm", "raster-contrast", 0.15);
          map.setPaintProperty("osm", "raster-brightness-min", 0.05);
          map.setPaintProperty("osm", "raster-brightness-max", 0.95);
        } catch (e) {
          // falls Browser/MapLibre-Version was nicht mag -> ignorieren
        }

        // --- Farben abwechselnd pro Aktivität (properties.i) ---
        // Du setzt "i" in strava_sync.py. Jede Aktivität bekommt i=0..n.
        // Farbpalette: Cyan + Magenta (knallt auf dark)
        const colorExpr = [
          "case",
          ["==", ["%", ["to-number", ["get", "i"]], 2], 0], "#46f3ff", // cyan
          "#ff4bd8" // magenta
        ];

        // 1) Glow "unter" der Linie (breit, weich)
        map.addLayer({
          id: "track-glow",
          type: "line",
          source: "track",
          paint: {
            "line-color": colorExpr,
            "line-width": 12,
            "line-opacity": 0.28,
            "line-blur": 6
          }
        });

        // 2) Hauptlinie (mittlere Breite)
        map.addLayer({
          id: "track-main",
          type: "line",
          source: "track",
          paint: {
            "line-color": colorExpr,
            "line-width": 5,
            "line-opacity": 0.92
          }
        });

        // 3) Highlight (dünn, hell)
        map.addLayer({
          id: "track-highlight",
          type: "line",
          source: "track",
          paint: {
            "line-color": "rgba(255,255,255,0.65)",
            "line-width": 1.6,
            "line-opacity": 0.55
          }
        });
      } else {
        map.getSource("track").setData(track);
      }

      // Marker / latest
      const lngLat = [latest.lon, latest.lat];
      if (!marker) {
        marker = new maplibregl.Marker({ element: createPulsingMarkerEl() })
          .setLngLat(lngLat)
          .addTo(map);
      } else {
        marker.setLngLat(lngLat);
      }

      metaEl.textContent =
        `Last updated: ${fmtTs(latest.ts)} · Lat/Lon: ${latest.lat.toFixed(5)}, ${latest.lon.toFixed(5)}`;

      // Fit Bounds
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
    refresh();
    setInterval(refresh, 60_000); // alle 60s
  });
})();
