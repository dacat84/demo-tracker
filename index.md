---
layout: default
title: "Map"
nav: map
head_extra: |
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
body_extra: |
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <script src="/pct-tracker/assets/js/map.js"></script>
  <script src="/pct-tracker/assets/js/elevation.js"></script>
---

<section class="home-hero">
  <div>
    <span class="livepill"><span class="beat"></span> Live &middot; <span id="heroDay">Day &mdash;</span></span>
    <h1 id="heroTitle">Locating my position&hellip;</h1>
    <p class="sub" id="heroSub">Reading the latest GPS fix from the trail.</p>
    <div class="qstats">
      <div class="qstat"><div class="n"><span id="heroPct">&mdash;</span><small>%</small></div><div class="l" data-en="of the trail done" data-de="des Trails geschafft">of the trail done</div></div>
      <div class="qstat"><div class="n"><span id="heroAvg">&mdash;</span><small id="heroAvgU">km</small></div><div class="l" data-en="average day" data-de="Ø pro Tag">average day</div></div>
      <div class="qstat"><div class="n" id="heroDays">&mdash;</div><div class="l" data-en="days out" data-de="Tage unterwegs">days out</div></div>
    </div>
  </div>
  <div class="hero-map">
    <button class="mapexpand" id="mapExpand" type="button" aria-label="Enlarge map">&#x2921;</button>
    <div id="map" class="map"></div>
    <div class="mapcallout">
      <div class="place" id="mPlace">Locating&hellip;</div>
      <div class="meta" id="mMeta"></div>
    </div>
  </div>
</section>

<div id="elevation"></div>

<div class="card progress-card" style="margin-top:12px">
  <div class="ptop"><span data-en="Progress" data-de="Fortschritt">Progress</span><span><b id="pPct">&mdash;%</b> &middot; <b id="pDone">&mdash; km</b> <span data-en="of" data-de="von">of</span> <span id="pTotal">&mdash; km</span></span></div>
  <div class="ptrack"><div class="pfill" id="pFill"></div></div>
  <div class="pends" style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:9px;font-size:12px;color:#6c7365"><span data-en="Mexico (Campo)" data-de="Mexiko (Campo)">Mexico (Campo)</span><span style="font-weight:600;color:#2c7a3d"><span id="pRem">&mdash; km</span> <span data-en="to go" data-de="verbleibend">to go</span></span><span style="text-align:right" data-en="Canada (Northern Terminus)" data-de="Kanada (Northern Terminus)">Canada (Northern Terminus)</span></div>
</div>

<div class="mapbackdrop" id="mapBackdrop"></div>

<div class="tele-hidden" aria-hidden="true">
  <span id="status"></span>
  <div id="statusBadge"></div>
  <div id="meta"></div>
  <div id="status-extra"></div>
  <ul id="statsList"></ul>
  <ul id="insightsList"></ul>
</div>
