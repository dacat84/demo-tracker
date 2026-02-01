(async function () {
  const statusEl = document.getElementById("status");
  const metaEl = document.getElementById("meta");

  const trackUrl = new URL("./data/track.geojson", window.location.href).toString();
  const latestUrl = new URL("./data/latest.json", window.location.href).toString();

  // 🔥 DARK MAP – extrem guter Kontrast für Tracks
  const style = {
    version: 8,
    sources: {
      dark: {
        type: "raster",
        tiles: [
          "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        ],
        tileSize: 256,
        attribution: "© OpenMapTiles © OpenStreetMap contributors"
      }
    },
    layers: [
      { id: "dark", type: "raster", source: "dark" }
    ]
  };

  const map = new maplibregl.Map({
    container: "map",
    style,
    center: [9.18, 48.78],
    zoom: 12
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  function fmtTs(ts) {
    try { return new Date(ts).toLocaleString(); }
    catch { return String(ts); }
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  let marker;
  let blinkState = false;

  function startBlink(el) {
    setInterval(() => {
      blinkState = !blinkState;
      el.style.background = blinkState ? "#00E5FF" : "#FF2D95";
      el.style.boxShadow = blinkState
        ? "0 0 14px rgba(0,229,255,.9)"
        : "0 0 14px rgba(255,45,149,.9)";
    }, 700);
  }

  async function refresh() {
    try {
      statusEl.textContent = "aktualisiere…";

      const [track, latest] = await Promise.all([
        loadJson(trackUrl),
        loadJson(latestUrl)
      ]);

      // =========================
      // TRACKS
      // =========================
      if (!map.getSource("track")) {
        map.addSource("track", { type: "geojson", data: track });

        // 🔮 Glow Layer
        map.addLayer({
          id: "track-glow",
          type: "line",
          source: "track",
          paint: {
            "line-width": 9,
            "line-opacity": 0.35,
            "line-color": [
              "case",
              ["==", ["%", ["get", "i"], 2], 0],
              "#00E5FF",
              "#FF2D95"
            ]
          }
        });

        // 🎯 Sharp Line
        map.addLayer({
          id: "track-line",
          type: "line",
          source: "track",
          paint: {
            "line-width": 4,
            "line-opacity": 1,
            "line-color": [
              "case",
              ["==", ["%", ["get", "i"], 2], 0],
              "#9FF6FF",
              "#FF7AC8"
            ]
          }
        });

      } else {
        map.getSource("track").setData(track);
      }

      // =========================
      // MARKER (blinkend)
      // =========================
      const lngLat = [latest.lon, latest.lat];

      if (!marker) {
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "999px";
        el.style.border = "2px solid #000";
        el.style.background = "#00E5FF";
        el.style.boxShadow = "0 0 14px rgba(0,229,255,.9)";

        startBlink(el);

        marker = new maplibregl.Marker({ element: el })
          .setLngLat(lngLat)
          .addTo(map);
      } else {
        marker.setLngLat(lngLat);
      }

      metaEl.textContent =
        `Last updated: ${fmtTs(latest.ts)} · ` +
        `Lat/Lon: ${latest.lat.toFixed(5)}, ${latest.lon.toFixed(5)}`;

      // =========================
      // ZOOM AUF TRACK
      // =========================
      const bbox = geojsonBbox(track);
      if (bbox) {
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
          padding: 40,
          duration: 800
        });
      }

      statusEl.textContent = "online";
    } catch (e) {
      statusEl.textContent = "Fehler (keine Daten)";
      metaEl.textContent = "track.geojson / latest.json fehlt";
    }
  }

  // 🧠 Minimal bbox helper
  function geojsonBbox(geojson) {
    try {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const f of geojson.features || []) {
        for (const [x, y] of f.geometry.coordinates) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      return minX === Infinity ? null : [minX, minY, maxX, maxY];
    } catch {
      return null;
    }
  }

  map.on("load", () => {
    refresh();
    setInterval(refresh, 60_000); // 1 min
  });
})();
