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
      <script src="https://lighterpack.com/e/bv8lr0"></script>
      <div id="bv8lr0"></div>
    </div>
  </div>
</div>
<script>
  (function () {
    let tries = 0;
    const timer = setInterval(() => {
      const iframe = document.querySelector('#bv8lr0 iframe');
      tries++;
      if (iframe) {
        iframe.setAttribute('title', 'Lighterpack gear list');
        iframe.style.background = '#ffffff';
        iframe.style.border = '0';
        clearInterval(timer);
      }
      if (tries > 80) clearInterval(timer);
    }, 100);
  })();
</script>
<style>
  .lp-shell{ max-width:980px; margin:0 auto; padding:14px; background:rgba(255,255,255,0.03); border-radius:16px; }
  .lp-frame{ background:#f6f3ea; border-radius:14px; padding:12px; overflow:hidden; border:1px solid rgba(0,0,0,0.10); }
  #bv8lr0 iframe{ width:100% !important; height:72vh !important; max-height:900px !important; border-radius:12px !important; display:block; }
  @media (max-width:520px){ #bv8lr0 iframe{ height:78vh !important; } .lp-shell{ padding:10px; } .lp-frame{ padding:10px; } }
</style>
