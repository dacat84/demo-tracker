import os, json, math, urllib.request, urllib.parse, datetime, sys

CLIENT_ID = os.environ["STRAVA_CLIENT_ID"]
CLIENT_SECRET = os.environ["STRAVA_CLIENT_SECRET"]
REFRESH_TOKEN = os.environ["STRAVA_REFRESH_TOKEN"]

TRACK_PATH = "data/track.geojson"
LATEST_PATH = "data/latest.json"
STATE_PATH = "data/strava_state.json"

PROFILE_MAX_POINTS = 220
COORDS_MAX_POINTS = 300
TOKEN_WARN_DAYS = 150


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


def downsample_coords(coords, max_points):
    n = len(coords)
    if n <= max_points:
        return coords
    step = (n - 1) / (max_points - 1)
    result = []
    for i in range(max_points):
        idx = int(round(i * step))
        idx = max(0, min(n - 1, idx))
        result.append(coords[idx])
    return result


def check_token_age():
    if not os.path.exists(STATE_PATH):
        return
    try:
        with open(STATE_PATH) as f:
            state = json.load(f)
        last_sync_str = state.get("last_sync_utc")
        if not last_sync_str:
            return
        last_sync = datetime.datetime.fromisoformat(last_sync_str)
        days_ago = (datetime.datetime.utcnow() - last_sync).days
        if days_ago >= TOKEN_WARN_DAYS:
            print(
                f"::warning::Strava refresh token has not been used for {days_ago} days. "
                f"Tokens expire after ~6 months of inactivity. "
                f"Re-authorize at https://www.strava.com/settings/apps if sync starts failing.",
                file=sys.stderr
            )
        else:
            print(f"Token last used {days_ago} days ago - OK.")
    except Exception as e:
        print(f"Could not check token age: {e}")


def main():
    check_token_age()
    access = refresh_access_token()
    print("Access token refreshed successfully.")

    activities = get_recent_activities(access)
    activities.sort(key=lambda a: a.get("start_date", ""))

    track = {"type": "FeatureCollection", "features": []}
    latest = None
    kept_ids = []
    total_coords_before = 0
    total_coords_after = 0

    for a in activities:
        act_id = int(a["id"])
        streams = get_stream(access, act_id)
        latlng = streams.get("latlng", {}).get("data", [])
        if not latlng or len(latlng) < 2:
            continue

        altitude = streams.get("altitude", {}).get("data", [])
        has_alt = bool(altitude) and len(altitude) == len(latlng)

        total_coords_before += len(latlng)
        latlng_ds = downsample_coords(latlng, COORDS_MAX_POINTS)
        total_coords_after += len(latlng_ds)

        coords = [[p[1], p[0]] for p in latlng_ds]

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
            dist_m_ds, elev_m_ds = downsample_series(dist_m, elev_m, PROFILE_MAX_POINTS)
        else:
            dist_m_ds, elev_m_ds = [], []
            total_up = float(a.get("total_elevation_gain", 0) or 0)

        feature = {
            "type": "Feature",
            "properties": {
                "strava_id": act_id,
                "name": a.get("name", ""),
                "start_date": a.get("start_date", ""),
                "distance_m": float(a.get("distance", 0) or 0),
                "moving_time_s": int(a.get("moving_time", 0) or 0),
                "type": a.get("type", ""),
                "elevation_gain_m": float(total_up),
                "profile_dist_m": dist_m_ds,
                "profile_elev_m": elev_m_ds,
            },
            "geometry": {"type": "LineString", "coordinates": coords}
        }

        track["features"].append(feature)
        kept_ids.append(act_id)
        last = latlng[-1]
        latest = {"lat": last[0], "lon": last[1], "ts": a.get("start_date", "")}

    track["features"].sort(key=lambda f: f.get("properties", {}).get("start_date", ""))
    for idx, f in enumerate(track["features"]):
        f.setdefault("properties", {})
        f["properties"]["i"] = idx

    save_json(TRACK_PATH, track)
    if latest:
        save_json(LATEST_PATH, latest)

    save_json(STATE_PATH, {
        "seen_ids": sorted(kept_ids),
        "last_sync_utc": datetime.datetime.utcnow().isoformat(),
    })

    reduction = (
        round((1 - total_coords_after / total_coords_before) * 100)
        if total_coords_before > 0 else 0
    )
    print(f"Wrote {len(track['features'])} activities to {TRACK_PATH}.")
    print(f"Coordinate downsampling: {total_coords_before} -> {total_coords_after} points ({reduction}% reduction).")
    if not latest:
        print("No GPS streams found (check Strava privacy/scope).")


if __name__ == "__main__":
    main()
