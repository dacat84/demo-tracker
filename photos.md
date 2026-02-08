---
layout: default
title: "Photos"
nav: photos
---

<div class="card">
  <div class="photos-head">
    <div class="card-title">Photos</div>
    <div class="muted small">Auto-synced from Flickr album</div>
  </div>

  <div id="photoGrid" class="photo-grid"></div>

  <div id="photoError" class="muted small" style="display:none; margin-top:10px;">
    Could not load photos right now.
  </div>
</div>

<style>
  .photos-head { margin-bottom: 12px; }

  .photo-grid{
    display:grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  @media (max-width: 1100px){
    .photo-grid{ grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 700px){
    .photo-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 420px){
    .photo-grid{ grid-template-columns: 1fr; }
  }

  .photo-item{
    display:block;
    border-radius: 14px;
    overflow:hidden;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.04);
  }
  .photo-item img{
    width:100%;
    height: 240px;
    object-fit: cover;
    display:block;
  }
  @media (max-width: 700px){
    .photo-item img{ height: 200px; }
  }
</style>

<script>
(() => {
  // Flickr RSS feed for your album (scrollable grid)
  const FEED_URL =
    "https://www.flickr.com/services/feeds/photoset.gne?set=72177720331905792&nsid=35469735@N03&lang=en-us&format=rss_200";

  // Use a public RSS->JSON proxy to avoid CORS issues in GitHub Pages
  const PROXY_URL = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(FEED_URL);

  const grid = document.getElementById("photoGrid");
  const err = document.getElementById("photoError");

  function showError(){
    err.style.display = "block";
  }

  fetch(PROXY_URL, { cache: "no-store" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
    .then(data => {
      const items = (data && data.items) ? data.items : [];
      if (!items.length) return showError();

      // Build grid: link to Flickr page, show image
      grid.innerHTML = items.map(it => {
        const link = it.link || "#";
        const title = (it.title || "Photo").replace(/"/g, "&quot;");
        const img = it.thumbnail || (it.enclosure && it.enclosure.link) || "";
        if (!img) return "";

        // Try to upgrade thumbnail to larger image (often works with Flickr URL patterns)
        const big = img.replace("_s.", "_b.").replace("_t.", "_b.").replace("_m.", "_b.");
        const src = big;

        return `
          <a class="photo-item" href="${link}" target="_blank" rel="noopener">
            <img src="${src}" alt="${title}" loading="lazy" />
          </a>
        `;
      }).join("");

      if (!grid.innerHTML.trim()) showError();
    })
    .catch(() => showError());
})();
</script>