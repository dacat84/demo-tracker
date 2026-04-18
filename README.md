# PCT Tracker

A lightweight personal trail tracker built with GitHub Pages.

This site combines live-ish activity data, maps, photos, and short updates into a single, mobile-friendly page that can be edited directly from a phone.

---

## What this site does

- **Map & Progress**
  - Displays the current trail track
  - Shows distance, elevation, time, averages, and progress
  - Data is generated from activity tracking (e.g. Strava export / sync workflow)

- **Trail Updates**
  - Simple text-based updates written in Markdown
  - Designed to be fast to edit from a phone while on trail

- **Photos**
  - Auto-synced from a Flickr album
  - No local image management needed

- **Gear**
  - Embedded gear list created with [lighterpack.com](https://lighterpack.com)
  - Always up to date without manual copying

---

## How it works

- The site is built with **GitHub Pages (Jekyll)**
- Styling and layout are optimized for **mobile editing**
- Activity data and tracks live in `/data/`
- Pages are simple Markdown files:
  - `index.md` – map & stats
  - `updates.md` – trail updates
  - `photos.md` – photo gallery
  - `gear.md` – gear overview

No CMS, no database, no backend server.

---

## Folder structure (simplified)

.
├── _layouts/ # Page layouts
├── assets/ # CSS and frontend assets
├── scripts/ # Map, stats, and data logic
├── data/ # Track and activity data
├── index.md # Map & statistics
├── updates.md # Trail updates
├── photos.md # Flickr photos
├── gear.md # Gear & Lighterpack
├── _config.yml # GitHub Pages config
└── README.md


---

## Why this exists

This project is meant to be:
- simple
- robust
- editable from a phone
- independent of social platforms

It’s a personal trail log, not a social feed.

---

## License

Personal project.  
Feel free to take inspiration, but this is not intended as a drop-in product.

