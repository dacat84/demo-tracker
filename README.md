# PCT Tracker

A lightweight personal trail tracker built with GitHub Pages.

Live map, stats, photos, and trail updates — synced automatically from Strava. Designed to be simple, robust, and editable from a phone while on trail.

---

## What this site does

- **Map**
  - Displays your recorded trail track (synced from Strava)
  - PCT full route shown as a thin background line for context
  - Live position marker with blinking dot

- **Statistics**
  - Total distance, elevation, time, average speed
  - Per-activity averages

- **Insights**
  - Last active day: km, time, elevation, number of segments
  - Recent days bar chart (up to 7 active days)
  - PCT progress bar with km/mi remaining
  - Timeline: first/last activity, active days, rest days
  - Longest and shortest day

- **Trail Updates**
  - Simple text-based updates written in Markdown
  - Fast to edit from a phone while on trail

- **Photos**
  - Auto-synced from a Flickr album
  - No local image management needed

- **Gear**
  - Embedded gear list from [grampacker.net](https://grampacker.net)
  - Always up to date without manual copying

---

## How it works

- Built with **GitHub Pages (Jekyll)** — no server, no database
- Activity data synced automatically via a **GitHub Actions workflow** (Strava API)
- A **keep-alive workflow** runs every 2 weeks to prevent GitHub from disabling the repo
- Strava token age is monitored — a warning appears in the logs after 150 days
- Track coordinates are **downsampled** to max 300 points per activity to keep the map fast
- The PCT centerline is loaded from `data/Full_PCT_Simplified.geojson` (official PCTA data)

---

## Folder structure

```
.
├── .github/
│   └── workflows/
│       ├── strava_sync.yml      # Auto-sync track from Strava (hourly)
│       └── keep-alive.yml       # Keeps repo active (runs 1st & 15th of month)
├── _layouts/                    # Jekyll page layouts
├── assets/
│   ├── css/style.css            # All styles
│   └── js/map.js                # Map, stats, insights logic
├── data/
│   ├── track.geojson            # Your recorded track (auto-updated)
│   ├── latest.json              # Latest position (auto-updated)
│   ├── strava_state.json        # Sync state & token info
│   └── Full_PCT_Simplified.geojson  # PCT centerline (PCTA, CC BY 4.0)
├── scripts/
│   └── strava_sync.py           # Python sync script
├── index.md                     # Map & statistics page
├── updates.md                   # Trail updates
├── photos.md                    # Flickr photo gallery
├── gear.md                      # Gear & Lighterpack
├── _config.yml                  # Jekyll config (title, baseurl)
└── README.md
```

---

## Why this exists

This project is meant to be:

- simple and fast to use from a phone
- automatic — no manual data entry while hiking
- independent of social platforms
- robust enough to run for 6 months unattended

It's a personal trail log, not a social feed.

---

## Data sources

- Activity tracks: [Strava API](https://developers.strava.com/)
- PCT centerline: [PCTA Open Data](https://www.pcta.org/discover-the-trail/maps/pct-data/) (CC BY 4.0)
- Photos: [Flickr](https://flickr.com)
- Gear list: [Grampacker](https://grampacker.net)

---

## License

Personal project. Feel free to take inspiration, but this is not intended as a drop-in product.
