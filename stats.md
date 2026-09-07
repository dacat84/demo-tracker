---
layout: default
title: "Stats"
nav: stats
permalink: /stats.html
head_extra: |
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
body_extra: |
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <script src="/pct-tracker/assets/js/map.js"></script>
---

<div class="hero">
  <div class="card status-card" style="width:100%">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">
      <div class="card-title" style="margin:0" data-en="Status" data-de="Status">Status</div>
      <div class="status-badge" id="statusBadge">
        <span class="status-dot"></span>
        <span id="status">loading&hellip;</span>
      </div>
    </div>
    <div id="meta" class="muted"></div>
    <div id="status-extra" class="muted small" style="margin-top:8px" data-en="Live position and last sync." data-de="Live-Position und letzte Synchronisierung.">Live position and last sync.</div>
  </div>
</div>

<div id="map" class="map map-compute" aria-hidden="true"></div>

<div class="grid">
  <div class="card">
    <div class="card-title" data-en="Statistics" data-de="Statistik">Statistics</div>
    <ul id="statsList" class="list"></ul>
  </div>

  <div class="card">
    <div class="card-title" data-en="Insights" data-de="Einblicke">Insights</div>
    <ul id="insightsList" class="list"></ul>
  </div>
</div>
