const FLICKR_USER = "35469735@N03"; // dein User
const LIMIT = 30; // Anzahl Bilder

const url =
  "https://www.flickr.com/services/feeds/photos_public.gne" +
  "?format=json&nojsoncallback=1&id=" + FLICKR_USER;

fetch(url)
  .then(r => r.json())
  .then(data => {
    const grid = document.getElementById("photo-grid");
    grid.innerHTML = "";

    data.items.slice(0, LIMIT).forEach(item => {
      const a = document.createElement("a");
      a.href = item.link;
      a.target = "_blank";

      const img = document.createElement("img");
      img.src = item.media.m.replace("_m.", "_z."); // größere Bilder
      img.alt = item.title;

      a.appendChild(img);
      grid.appendChild(a);
    });
  })
  .catch(() => {
    document.getElementById("photo-grid").innerHTML =
      "<div class='muted'>Could not load photos.</div>";
  });