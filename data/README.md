# Data

Pre-processed datasets used by the game (for example NASA FIRMS fire detections and DONKI solar flare counts).

- Raw downloads are processed offline into small JSON files here, so the game runs in the browser with no API keys.
- Game data (missions, parts, launch vehicles, orbits, event cards) lives in [`src/data/`](../src/data/).
  Every number there records where it came from; the list of sources is [`src/data/sources.ts`](../src/data/sources.ts).
- `npm run check:data` checks that every value cites a known source (or is marked as a game rule)
  and that every text exists in English and Japanese. `--list` shows values still waiting for a source.
- API keys are never stored in this repository.
