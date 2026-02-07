---
layout: default
title: "Map"
nav: map
head_extra: |
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
body_extra: |
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <script src="/demo-tracker/assets/js/map.js"></script>
---

<div class="hero">
  <div class="card pct-status-card">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div class="card-title" style="margin:0;">Status</div>
      <!-- optional: du kannst später hier einen Badge einsetzen, falls du willst -->
    </div>

    <div id="status" class="status">loading…</div>

    <!-- NEW: status grid like the other cards -->
    <div class="pct-status-grid">
      <div class="pct-row"><span>Last updated</span><b id="lastUpdated">—</b></div>
      <div class="pct-row"><span>Lat/Lon</span><b id="latlon">—</b></div>
      <div class="pct-row"><span>Latest</span><b id="latestSummary">—</b></div>
    </div>

    <div id="status-extra" class="muted small" style="margin-top:10px;"></div>
  </div>
</div>

<div id="map" class="map"></div>

<div class="grid">
  <div class="card">
    <div class="card-title">Statistics</div>
    <ul id="statsList" class="list"></ul>
  </div>

  <div class="card">
    <div class="card-title">Insights</div>
    <ul id="insightsList" class="list"></ul>
  </div>
</div>
