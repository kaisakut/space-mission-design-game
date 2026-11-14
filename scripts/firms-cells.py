"""
Fire map for the mission view: where the real 2024 fires were, by 1-degree cell.

Input : NASA FIRMS MODIS 2024 country yearly summary (data/raw/modis_2024_all_countries.zip, not committed),
        the same file scripts/firms-coverage.py uses.
Output: data/firms-cells-2024.json

Method:
- Every MODIS active-fire detection of 2024 with type 0 (presumed vegetation fire), as in firms-coverage.py.
- Grouped by 1-degree latitude/longitude cell (the cell's south-west corner, as integers), split by the
  detection's day/night flag (FIRMS "daynight": D or N).
- Counts are stored as a level 0-9: ceil(log2(count + 1)), capped at 9, to keep the file small.
  Cells with fewer than 3 detections in the year are left out.
- Only for drawing: the game's fire counts per orbit come from data/firms-coverage-2024.json.

Run: python scripts/firms-cells.py data/raw/modis_2024_all_countries.zip data/firms-cells-2024.json
"""
import csv
import io
import json
import math
import sys
import zipfile
from collections import defaultdict


def main(src, out):
    day = defaultdict(int)
    night = defaultdict(int)
    total = 0
    with zipfile.ZipFile(src) as z:
        for name in z.namelist():
            if not name.endswith('.csv'):
                continue
            with z.open(name) as f:
                for row in csv.DictReader(io.TextIOWrapper(f, encoding='utf-8')):
                    if row.get('type') != '0':
                        continue
                    total += 1
                    cell = (math.floor(float(row['latitude'])), math.floor(float(row['longitude'])))
                    (night if row.get('daynight') == 'N' else day)[cell] += 1
    level = lambda n: min(9, math.ceil(math.log2(n + 1))) if n else 0
    cells = []
    for c in sorted(set(day) | set(night)):
        d, n = day.get(c, 0), night.get(c, 0)
        if d + n < 3:
            continue
        cells.append([c[0], c[1], level(d), level(n)])
    doc = {
        'source': 'NASA FIRMS, MODIS Collection 6.1 active fire detections, 2024 country yearly summary (modis_2024_all_countries.zip)',
        'retrieved': '2026-11-14',
        'method': 'Type-0 (presumed vegetation fire) detections of 2024 grouped by 1-degree cell (south-west corner) and the day/night flag. '
                  'Each count is stored as a level ceil(log2(count + 1)) capped at 9. Cells with fewer than 3 detections are left out. '
                  'For drawing only; the game\'s counts per orbit are in firms-coverage-2024.json.',
        'detections': total,
        'columns': ['lat', 'lon', 'dayLevel', 'nightLevel'],
        'cells': cells,
    }
    with open(out, 'w') as f:
        json.dump(doc, f, separators=(',', ':'))
        f.write('\n')
    print(f'{total} detections, {len(cells)} cells')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
