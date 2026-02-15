---
layout: default
title: Gear
permalink: /gear/
---

<div class="card">
  <div class="card-title">Gear</div>
  <div class="card-sub">
    A complete overview of the gear carried on trail, created with lighterpack.com
  </div>
</div>

<div class="card lp-card">
  <div class="lp-shell">
    <div class="lp-frame">
      <!-- Lighterpack embed -->
      <script src="https://lighterpack.com/e/y1me1j"></script>
      <div id="y1me1j"></div>
    </div>
  </div>
</div>

<script>
  // Lighterpack rendert ein iframe nachträglich – wir warten kurz, bis es da ist,
  // und setzen dann Styling am iframe-Element selbst (nicht im Inhalt).
  (function () {
    let tries = 0;
    const timer = setInterval(() => {
      const iframe = document.querySelector('#y1me1j iframe');
      tries++;

      if (iframe) {
        iframe.setAttribute('title', 'Lighterpack gear list');
        iframe.style.background = '#ffffff';
        iframe.style.border = '0';
        clearInterval(timer);
      }

      if (tries > 80) clearInterval(timer); // ~8s Timeout
    }, 100);
  })();
</script>

<style>
  /* Breite etwas reduzieren + “Luft” */
  .lp-shell{
    max-width: 980px;          /* enger als full width, aber noch groß */
    margin: 0 auto;
    padding: 14px;             /* Luft zum Rand */
    background: rgba(255,255,255,0.03);
    border-radius: 16px;
  }

  /* Off-white “Paper” Fläche, damit es nicht so gequetscht wirkt */
  .lp-frame{
    background: #f6f3ea;       /* off-white / paper */
    border-radius: 14px;
    padding: 12px;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.10);
  }

  /* Das iframe selbst: Höhe + “helles” Aussehen erzwingen */
  #lm2int iframe{
    width: 100% !important;
    height: 72vh !important;
    max-height: 900px !important;
    border-radius: 12px !important;

    /* DER TRICK: macht dark -> light */
    filter: invert(1) hue-rotate(180deg);
    background: #fff;
    display: block;
  }

  /* Auf sehr kleinen Screens etwas mehr Höhe */
  @media (max-width: 520px){
    #lm2int iframe{ height: 78vh !important; }
    .lp-shell{ padding: 10px; }
    .lp-frame{ padding: 10px; }
  }
</style>
