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
      <div class="qstat"><div class="n"><span id="heroPct">&mdash;</span><small>%</small></div><div class="l">of the trail done</div></div>
      <div class="qstat"><div class="n"><span id="heroAvg">&mdash;</span><small>km</small></div><div class="l">average day</div></div>
      <div class="qstat"><div class="n" id="heroDays">&mdash;</div><div class="l">days out</div></div>
    </div>
  </div>
  <div class="hero-map">
    <span class="mapbadge"><span class="beat" style="width:8px;height:8px"></span> LIVE TRACK</span>
    <div id="map" class="map"></div>
    <div class="mapcallout">
      <div class="place" id="mPlace">Locating&hellip;</div>
      <div class="meta" id="mMeta"></div>
    </div>
  </div>
</section>

<div id="elevation"></div>

<div class="card progress-card" style="margin-top:12px">
  <div class="ptop"><span>Campo &rarr; Manning Park</span><span><b id="pPct">&mdash;%</b> &middot; <span id="pRem">&mdash; km</span> to go</span></div>
  <div class="ptrack"><div class="pfill" id="pFill"></div></div>
</div>

<div class="tele-hidden" aria-hidden="true">
  <span id="status"></span>
  <div id="statusBadge"></div>
  <div id="meta"></div>
  <div id="status-extra"></div>
  <ul id="statsList"></ul>
  <ul id="insightsList"></ul>
</div>
