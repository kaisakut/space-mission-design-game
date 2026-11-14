# Data

Pre-processed datasets used by the game (for example NASA FIRMS fire detections and DONKI solar flare counts).

- Raw downloads are processed offline into small JSON files here, so the game runs in the browser with no API keys.
- Game data (missions, parts, launch vehicles, orbits, event cards) lives in [`src/data/`](../src/data/).
  Every number there records where it came from; the list of sources is [`src/data/sources.ts`](../src/data/sources.ts).
- `npm run check:data` checks that every value cites a known source (or is marked as a game rule)
  and that every text exists in English and Japanese. `--list` shows values still waiting for a source.
- API keys are never stored in this repository.

## Files

| File | Made by | What it is |
| --- | --- | --- |
| `firms-coverage-2024.json` | `scripts/firms-coverage.py` | 2024 FIRMS fire detections each orbit choice can see, day and night. The game's science counts come from here. |
| `firms-cells-2024.json` | `scripts/firms-cells.py` | The same 2024 FIRMS archive (type 0, presumed vegetation fires) grouped by 1-degree cell and day/night, stored as a level `ceil(log2(count + 1))` capped at 9; cells with fewer than 3 detections are left out. Used only to draw the fire dots in the mission view; it does not change any game number. |
| `donki-sep-2014-2025.json` | DONKI API (see the file's `method`) | Solar energetic particle events 2014–2025, all instruments and near-Earth (GOES, SOHO) only. The solar storm card odds come from the near-Earth count. |
