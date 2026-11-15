# Trade Space: A Mission Design Game

A turn-based space mission design wargame built for the **NASA Space Apps Challenge 2026**
(challenge: *Space Mission Design Game*).

> Status: under development during the hackathon (November 14–15, 2026).

## Play

- Live version: _coming soon_
- Language: English (default) / Japanese — switch with the button in the top-right corner.

## What it is

_The full description is being written._

Play solo or together:

- **Solo:** you against three rule-based AI agencies.
- **Together (2–4 players):** players take turns on one screen, competing as rival agencies. There are always four seats; seats without a player are taken by the AI. Nobody sees what the others chose until everyone has decided for the phase.

## NASA data and resources used

_To be written. Every value used in the game records its source; the list of sources is [`src/data/sources.ts`](src/data/sources.ts)._

- Sources marked as NASA are written or produced by NASA, wherever they are hosted; the list says where each copy is.
- Space weather: the game's solar-storm chances count events in the Space Weather Database Of Notifications, Knowledge, Information ([DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/)), provided by NASA's Community Coordinated Modeling Center (CCMC) and the Moon to Mars Space Weather Analysis Office. DONKI's information is prototype-quality and intended for research.
- Read for the game's design (no values taken from them): Design and Develop Science Missions, JPL Concept Maturity Levels, the General Mission Analysis Tool (GMAT), and “The VIPER Mission, a Resource-Mapping Mission on Another Celestial Body” (NASA Ames, 2022).

## Run locally

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## References

_Being written: all libraries, data, code and images used in this project._

- [React](https://react.dev/) (MIT) — user interface.
- [three.js](https://threejs.org/) (MIT) — the 3D mission view. Earth uses the NASA Blue Marble image below; Jupiter's bands, the radiation belts and the lunar south-pole disc are drawn in code (no outside images), as explanatory pictures that are not to scale.
- Sound effects are synthesised in code with the Web Audio API; the game uses no audio files.
- NASA Visible Earth, [Blue Marble: Land Surface, Shallow Water, and Shaded Topography](https://web.archive.org/web/20260128022646/https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography) (Internet Archive copy; the NASA page now redirects) (NASA Goddard Space Flight Center, Reto Stöckli; public domain) — Earth texture, `public/textures/earth_day_2048.jpg` (taken from the Wikimedia Commons copy of the NASA file and resized to 2048 × 1024).

## AI usage

_Being written: where and how AI tools were used in this project._

- No AI-generated images, video or audio are used. Pictures are drawn in code or are NASA images with credit; sound effects are synthesised in code.

## License

[Apache License 2.0](LICENSE)
