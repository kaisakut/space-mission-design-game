"""
Science value data for the Wildfire Watch CubeSat: how many real 2024 fires each orbit could have seen.

Input : NASA FIRMS MODIS 2024 country yearly summary (data/raw/modis_2024_all_countries.zip, not committed).
Output: data/firms-coverage-2024.json

Method (kept simple on purpose, and stated in the output file):
- Fires: every MODIS active-fire detection of 2024 with type 0 (presumed vegetation fire),
  grouped by 1-degree latitude/longitude cell and calendar day (UTC).
- Satellite: circular orbit with J2 drift of the orbit plane, sampled every 20 s over the year
  (the same model as scripts/orbit-contact.py). A cell counts as observed on a day when the
  ground track passes through it that day; one 1-degree cell is about the width of a CubeSat
  camera swath (about 80-100 km).
- Day or night: local solar time from longitude; 06:00-18:00 is day. Visible and short-wave
  infrared cameras only count daytime passes; a thermal infrared camera counts both.
- Sun-synchronous orbits cross the equator southbound at 10:30 local time (as Terra does).

Run: python scripts/firms-coverage.py data/raw/modis_2024_all_countries.zip data/firms-coverage-2024.json
"""
import csv
import io
import json
import math
import sys
import zipfile

import numpy as np

MU = 398600.4418
RE = 6378.137
J2 = 1.08263e-3
WE = 7.2921159e-5
YEAR_DAYS = 366  # 2024
DT = 20.0


def sso_inc(h):
    a = RE + h
    n = math.sqrt(MU / a**3)
    need = 2 * math.pi / (365.2422 * 86400)
    return math.degrees(math.acos(-need / (1.5 * n * J2 * (RE / a) ** 2)))


def load_fires(path):
    days, cells, night = [], [], []
    total = 0
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if not name.endswith('.csv'):
                continue
            with z.open(name) as f:
                for row in csv.DictReader(io.TextIOWrapper(f, encoding='utf-8')):
                    if row['type'] != '0':
                        continue
                    total += 1
                    lat = float(row['latitude'])
                    lon = float(row['longitude'])
                    d = row['acq_date']
                    doy = (np.datetime64(d) - np.datetime64('2024-01-01')).astype(int)
                    days.append(doy)
                    cells.append(cell_id(lat, lon))
                    night.append(row['daynight'] == 'N')
    return np.array(days, dtype=np.int32), np.array(cells, dtype=np.int32), np.array(night), total


def cell_id(lat, lon):
    i = min(int(math.floor(lat + 90)), 179)
    j = min(int(math.floor(lon + 180)), 359)
    return i * 360 + j


def track(h, inc_deg, raan0_deg):
    a = RE + h
    n = math.sqrt(MU / a**3)
    i = math.radians(inc_deg)
    raan_dot = -1.5 * n * J2 * (RE / a) ** 2 * math.cos(i)
    t = np.arange(0, YEAR_DAYS * 86400, DT)
    u = n * t
    O = math.radians(raan0_deg) + raan_dot * t
    x = a * (np.cos(O) * np.cos(u) - np.sin(O) * np.sin(u) * math.cos(i))
    y = a * (np.sin(O) * np.cos(u) + np.cos(O) * np.sin(u) * math.cos(i))
    z = a * np.sin(u) * math.sin(i)
    # Earth-fixed frame; Greenwich at t = 0 is taken as the inertial x axis (2024-01-01 00:00 UTC, approximate).
    th = WE * t
    xe = np.cos(th) * x + np.sin(th) * y
    ye = -np.sin(th) * x + np.cos(th) * y
    lat = np.degrees(np.arcsin(z / a))
    lon = np.degrees(np.arctan2(ye, xe))
    day = (t // 86400).astype(np.int32)
    lst = ((t % 86400) / 3600 + lon / 15) % 24
    is_day = (lst >= 6) & (lst < 18)
    ci = np.minimum(np.floor(lat + 90), 179).astype(np.int32) * 360 + np.minimum(np.floor(lon + 180), 359).astype(np.int32)
    return day, ci, is_day


def sso_raan0(h, inc):
    # Choose the starting node so the southbound equator crossing is at 10:30 local solar time.
    # At t = 0 the Sun is at roughly -x (midnight at Greenwich). Ascending node local time = 22:30.
    # Local time of a direction with right ascension A at t = 0 is 12 + (A - sun_RA)/15 with sun_RA = 180 deg.
    return (22.5 - 12) * 15 + 180 - 360


def coverage(h, inc, raan0, fire_day, fire_cell, fire_night):
    day, ci, is_day = track(h, inc, raan0)
    key_any = np.unique(day.astype(np.int64) * 64800 + ci)
    key_day = np.unique(day[is_day].astype(np.int64) * 64800 + ci[is_day])
    fk = fire_day.astype(np.int64) * 64800 + fire_cell
    seen_any = np.isin(fk, key_any)
    seen_daypass = np.isin(fk, key_day)
    return {
        'detectionsUnderTrackAnyPass': int(seen_any.sum()),
        'detectionsUnderTrackDayPass': int(seen_daypass.sum()),
        'nightDetectionsUnderTrackAnyPass': int((seen_any & fire_night).sum()),
        'cellDaysObserved': int(len(key_any)),
    }


def main(src, out):
    fire_day, fire_cell, fire_night, total = load_fires(src)
    orbits = {
        'orbit-iss': (410, 51.6, 0.0),
        'orbit-sso-500': (500, sso_inc(500), None),
        'orbit-sso-600': (600, sso_inc(600), None),
    }
    result = {}
    for oid, (h, inc, raan0) in orbits.items():
        r0 = sso_raan0(h, inc) if raan0 is None else raan0
        c = coverage(h, inc, r0, fire_day, fire_cell, fire_night)
        c['visibleSwirShare'] = round(c['detectionsUnderTrackDayPass'] / total, 4)
        c['thermalShare'] = round(c['detectionsUnderTrackAnyPass'] / total, 4)
        result[oid] = c
        print(oid, c)
    doc = {
        'source': 'NASA FIRMS, MODIS Collection 6.1 standard processing, country yearly summary 2024 (https://firms.modaps.eosdis.nasa.gov/country/)',
        'retrieved': '2026-11-14',
        'method': __doc__.strip().split('Run:')[0].strip(),
        'firesTotal': total,
        'nightFiresTotal': int(fire_night.sum()),
        'orbits': result,
    }
    with open(out, 'w') as f:
        json.dump(doc, f, indent=1)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
