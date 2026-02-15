import os, json, math, urllib.request, urllib.parse

CLIENT_ID = os.environ["202394"]
CLIENT_SECRET = os.environ["bb21c475532c626b283b9d35c99362d2460df925"]
REFRESH_TOKEN = os.environ["91c1c8afe36a61dcddfc48688481b8a4ccfe184f"]

TRACK_PATH = "data/track.geojson"
LATEST_PATH = "data/latest.json"
STATE_PATH = "data/strava_state.json"

# Wie viele Punkte fürs Höhenprofil maximal gespeichert werden (Dateigröße!)
PROFILE_MAX_POINTS = 220


def post_form(url, data):
    encoded = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=encoded, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))


def get_json(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))


def refresh_access_token():
    tok = post_form("https://www.strava.com/oauth/token", {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": REFRESH_TOKEN,
    })
    return tok["access_token"]


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)


def get_recent_activities(access_token):
    acts = []
    for page in range(1, 6):
        url = f"https://www.strava.com/api/v3/athlete/activities?per_page=50&page={page}"
        acts.extend(get_json(url, headers={"Authorization": f"Bearer {access_token}"}))
    return acts


def get_stream(access_token, activity_id):
    # Wichtig: altitude dazu!
    url = (
        f"https://www.strava.com/api/v3/activities/{activity_id}/streams"
        f"?keys=latlng,time,altitude&key_by_type=true"
    )
    return get_json(url, headers={"Authorization": f"Bearer {access_token}"})


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def downsample_series(xs, ys, max_points):
    """gleichmäßig ausdünnen (ohne Libs), xs/ys gleiche Länge"""
    n = min(len(xs), len(ys))
    if n <= max_points:
        return xs[:n], ys[:n]
    step = (n - 1) / (max_points - 1)
    out_x, out_y = [], []
    for i in range(max_points):
        idx = int(round(i * step))
        idx = max(0, min(n - 1, idx))
        out_x.append(xs[idx])
        out_y.append(ys[idx])
    return out_x, out_y


def main():
    access = refresh_access_token()

    activities = get_recent_activities(access)
    activities.sort(key=lambda a: a.get("start_date", ""))  # älteste -> neueste

    track = {"type": "FeatureCollection", "features": []}
    latest = None
    kept_ids = []

    for a in activities:
        act_id = int(a["id"])

        streams = get_stream(access, act_id)

        latlng = streams.get("latlng", {}).get("data", [])
        if not latlng or len(latlng) < 2:
            continue

        altitude = streams.get("altitude", {}).get("data", [])
        # altitude kann fehlen/leer sein -> dann kein Profil
        has_alt = bool(altitude) and len(altitude) == len(latlng)

        # GeoJSON coords [lon, lat]
        coords = [[p[1], p[0]] for p in latlng]

        # Profil: cumulative distance (m) + altitude (m)
        dist_m = [0.0]
        elev_m = [float(altitude[0])] if has_alt else []
        total_up = 0.0

        if has_alt:
            prev_lat, prev_lon = latlng[0][0], latlng[0][1]
            prev_e = float(altitude[0])
            cum = 0.0

            for i in range(1, len(latlng)):
                lat, lon = latlng[i][0], latlng[i][1]
                d = haversine_m(prev_lat, prev_lon, lat, lon)
                cum += d
                dist_m.append(cum)

                e = float(altitude[i])
                elev_m.append(e)

                delta = e - prev_e
                if delta > 0:
                    total_up += delta

                prev_lat, prev_lon = lat, lon
                prev_e = e

            # ausdünnen für Datei
            dist_m_ds, elev_m_ds = downsample_series(dist_m, elev_m, PROFILE_MAX_POINTS)
        else:
            dist_m_ds, elev_m_ds = [], []
            total_up = float(a.get("total_elevation_gain", 0) or 0)

        feature = {
            "type": "Feature",
            "properties": {
                # i für alternierende Farben
                "strava_id": act_id,
                "name": a.get("name", ""),
                "start_date": a.get("start_date", ""),
                "distance_m": float(a.get("distance", 0) or 0),
                "moving_time_s": int(a.get("moving_time", 0) or 0),
                "type": a.get("type", ""),
                "elevation_gain_m": float(total_up),
                # Profil-Daten (für Popup-Chart)
                "profile_dist_m": dist_m_ds,    # x
                "profile_elev_m": elev_m_ds,    # y
            },
            "geometry": {"type": "LineString", "coordinates": coords}
        }

        track["features"].append(feature)
        kept_ids.append(act_id)

        # latest: letzte Koordinate der neuesten Aktivität mit GPS
        last = latlng[-1]
        latest = {"lat": last[0], "lon": last[1], "ts": a.get("start_date", "")}

    # Re-index stable: nach start_date sortieren und i setzen
    track["features"].sort(key=lambda f: f.get("properties", {}).get("start_date", ""))
    for idx, f in enumerate(track["features"]):
        f.setdefault("properties", {})
        f["properties"]["i"] = idx

    save_json(TRACK_PATH, track)
    if latest:
        save_json(LATEST_PATH, latest)

    save_json(STATE_PATH, {"seen_ids": sorted(kept_ids)})

    print(f"Wrote {len(track['features'])} activities to {TRACK_PATH}.")
    if not latest:
        print("No GPS streams found (check Strava privacy/scope).")


if __name__ == "__main__":
    main()
