---
layout: default
title: "Map"
nav: map
head_extra: |
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    /* --- Status card: match Statistics/Insights look --- */
    .status-card {
      position: relative;
      overflow: hidden;
    }

    .status-card .status-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    .status-card .card-title {
      margin: 0;
    }

    /* Online badge (pill) */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 650;
      letter-spacing: 0.2px;
      color: rgba(240,255,245,.95);
      background: rgba(20, 120, 70, 0.22);
      border: 1px solid rgba(120, 255, 190, 0.22);
      box-shadow: 0 10px 22px rgba(0,0,0,.25);
      user-select: none;
      white-space: nowrap;
    }

    .status-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: rgba(60, 255, 170, .95);
      box-shadow: 0 0 0 0 rgba(60, 255, 170, .55);
      animation: statusPulse 1.8s ease-out infinite;
    }

    @keyframes statusPulse {
      0%   { box-shadow: 0 0 0 0 rgba(60, 255, 170, .55); }
      70%  { box-shadow: 0 0 0 10px rgba(60, 255, 170, 0); }
      100% { box-shadow: 0 0 0 0 rgba(60, 255, 170, 0); }
    }

    /* Compact typography like the other cards */
    .status-card .status-main {
      font-size: 18px;
      font-weight: 750;
      line-height: 1.15;
      margin: 0 0 6px 0;
    }

    .status-card .status-sub {
      font-size: 13px;
      opacity: 0.9;
      margin: 0;
      line-height: 1.35;
      white-space: pre-line; /* allows \n from map.js */
    }

    .status-card .status-extra {
      margin-top: 8px;
      font-size: 12px;
      opacity: 0.75;
      line-height: 1.35;
    }

    /* Make hero align with grid spacing */
    .hero {
      margin-bottom: 14px;
    }
  </style>
body_extra: |
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <script src="/demo-tracker/assets/js/map.js"></script>
---

<div class="hero">
  <div class="card status-card">
    <div class="status-header">
      <div class="card-title">Status</div>
      <div class="status-badge" id="statusBadge" aria-label="Online status">
        <span class="status-dot"></span>
        <span id="status">loading…</span>
      </div>
    </div>

    <div id="meta" class="status-sub muted"></div>

    <div id="status-extra" class="status-extra muted small">
      Tap a track to see details. Hover highlights on desktop.
    </div>
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
