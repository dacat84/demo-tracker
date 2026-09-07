#!/usr/bin/env python3
"""
Build a downsampled elevation profile for the PCT.

The stored centerline (data/Full_PCT_Simplified.geojson) is a 2D LineString
collection (lon/lat only, no elevation). This script walks the trail, samples
elevations from a public DEM (OpenTopoData / SRTM 30 m) at evenly spaced points,
and writes data/pct_profile.json:

    { "total_km": 4265.0, "points": [ {"km": 0.0, "m": 883, "lat": 32.6, "lon": -116.5}, ... ] }

The site loads that JSON directly, so the profile is static and fast. lat/lon per
point let the frontend map the live GPS position to a km on the trail. Curated
passes / towns / parks live in the frontend, keyed by km — they do not come here.
"""
import json, time, math, urllib.request, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC  = ROOT / "data" / "Full_PCT_Simplified.geojson"
OUT  = ROOT / "data" / "pct_profile.json"

TARGET_POINTS = 500                         # resolution of the final profile
DEM_URL = "https://api.opentopodata.org/v1/srtm30m"
BATCH   = 100                               # OpenTopoData max locations / request
PAUSE   = 1.1                               # be polite to the free endpoint


def haversine(a, b):
    R = 6371.0088
    (lon1, lat1), (lon2, lat2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def load_coords(path):
    gj = json.loads(path.read_text())
    coords = []
    for f in gj["features"]:
        g = f["geometry"]
        if g["type"] == "LineString":
            coords += g["coordinates"]
        elif g["type"] == "MultiLineString":
            for line in g["coordinates"]:
                coords += line
    return [(c[0], c[1]) for c in coords]


def cumulative_km(coords):
    d = [0.0]
    for i in range(1, len(coords)):
        d.append(d[-1] + haversine(coords[i - 1], coords[i]))
    return d


def resample(coords, dist, n):
    total = dist[-1]
    step = total / (n - 1)
    out, j = [], 0
    for i in range(n):
        target = i * step
        while j < len(dist) - 1 and dist[j + 1] < target:
            j += 1
        if j >= len(dist) - 1:
            out.append((coords[-1], total))
            continue
        seg = dist[j + 1] - dist[j]
        t = 0 if seg == 0 else (target - dist[j]) / seg
        lon = coords[j][0] + (coords[j + 1][0] - coords[j][0]) * t
        lat = coords[j][1] + (coords[j + 1][1] - coords[j][1]) * t
        out.append(((lon, lat), target))
    return out


def fetch_elevations(points):
    elevs = []
    for i in range(0, len(points), BATCH):
        chunk = points[i:i + BATCH]
        locs = "|".join(f"{lat:.6f},{lon:.6f}" for (lon, lat), _ in chunk)
        url = f"{DEM_URL}?locations={locs}"
        req = urllib.request.Request(url, headers={"User-Agent": "pct-tracker-build"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
        elevs += [res["elevation"] for res in data["results"]]
        print(f"  {min(i + BATCH, len(points))}/{len(points)} points")
        time.sleep(PAUSE)
    return elevs


def main():
    print("Loading centerline ...")
    coords = load_coords(SRC)
    dist = cumulative_km(coords)
    print(f"  {len(coords)} vertices, {dist[-1]:.1f} km total")

    sampled = resample(coords, dist, TARGET_POINTS)
    print(f"Fetching {len(sampled)} elevations from OpenTopoData ...")
    elevs = fetch_elevations(sampled)

    points = [{"km": round(km, 2), "m": None if e is None else round(e),
               "lat": round(lat, 5), "lon": round(lon, 5)}
              for ((lon, lat), km), e in zip(sampled, elevs)]

    # forward-fill any nulls the DEM couldn't resolve
    last = 0
    for p in points:
        if p["m"] is None:
            p["m"] = last
        last = p["m"]

    OUT.write_text(json.dumps({"total_km": round(dist[-1], 1), "points": points}))
    print(f"Wrote {OUT} ({len(points)} points)")


if __name__ == "__main__":
    main()
