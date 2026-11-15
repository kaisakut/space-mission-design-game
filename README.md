# Trade Space: A Mission Design Game

A turn-based space mission design wargame built for the **NASA Space Apps Challenge 2026**
(challenge: *Space Mission Design Game*).

## Play

- Live version: https://kaisakut.github.io/space-mission-design-game/
- Demo slides: [`docs/Trade_Space_demo.pdf`](docs/Trade_Space_demo.pdf)
- Language: English (default) / Japanese — switch with the button in the top-right corner.

## What it is

Trade Space is a game for students and anyone curious about spaceflight. The player runs a space agency and takes a whole mission from concept to operations, the way real missions are run: every choice trades mass, power, data, budget and schedule against the risk of failure.

- **What it does.** In five phases (concept, spacecraft, launch booking, testing, operations) the player chooses orbits, instruments, rockets and tests. Before confirming each phase, the player can fly the design 100 times in a forecast and see the chance of success and its weak points. Then event cards, many based on real cases such as Kepler's reaction wheel or a lunar lander on its side, hit the player and three rival agencies alike; who is hurt depends on what each one chose. A final scene flies all four missions, and the results explain why the player ranked where they did.
- **How it answers the challenge.** The challenge asks for a game in which players design a mission and face its trade-offs, alone or as a team. Trade Space makes those trade-offs visible at every step, and it can be played solo or by 2–4 players on one screen.
- **Why it matters.** Students rarely see a mission from start to finish. Here a full mission takes about 15 minutes, failure is cheap, and every failure has a reason the player can read and act on. The lesson is that margin, testing and protection cost something, and that their value only shows when something goes wrong.

What is in it:

- Three missions: Wildfire Watch CubeSat (beginner), Lunar South Pole Ice Rover (intermediate), Icy Moon Explorer at Jupiter (advanced).
- 47 event cards. Cards with a year are based on a real case, with the source linked.
- A guide for first-time players, optional hints, a practice mode with unlimited forecasts, a library of all event cards and a glossary.
- English and Japanese.

Play solo or together:

- **Solo:** you against three rule-based AI agencies (cautious, balanced, bold).
- **Together (2–4 players):** players take turns on one screen, competing as rival agencies. There are always four seats; seats without a player are taken by the AI. Nobody sees what the others chose until everyone has decided for the phase.

How it is built:

- React, TypeScript and Vite; the 3D views use three.js; sound effects are synthesised with the Web Audio API.
- It runs entirely in the browser: no server, no account, and no AI model at run time. The rival agencies follow fixed rules.
- The simulation is seeded, so the same seed gives the same events for everyone and forecasts can be compared fairly.
- Every value in the game data records its source. `npm run check:data` fails if a value cites an unknown source or if its basis does not match its sources.

## NASA data and resources used

Every value used in the game records its source; the full list is [`src/data/sources.ts`](src/data/sources.ts) (52 NASA sources and 20 others), and each option and event card links to its sources in the game.

- Sources marked as NASA are written or produced by NASA, wherever they are hosted; the list says where each copy is.
- **Fires:** the fire dots on the globe and the wildfire mission's science counts come from real 2024 detections in NASA's Fire Information for Resource Management System ([FIRMS](https://firms.modaps.eosdis.nasa.gov/)), MODIS Collection 6.1. See [`data/README.md`](data/README.md).
  We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Earth Science Data and Information System (ESDIS). FIRMS disclaimer: https://www.earthdata.nasa.gov/data/projects/lance/disclaimer
- **Space weather:** the game's solar-storm chances count events in the Space Weather Database Of Notifications, Knowledge, Information ([DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/)), provided by NASA's Community Coordinated Modeling Center (CCMC) and the Moon to Mars Space Weather Analysis Office. DONKI's information is prototype-quality and intended for research.
- **Earth image:** NASA Visible Earth, Blue Marble (see References).
- **Spacecraft parts and limits:** NASA's [State-of-the-Art of Small Spacecraft Technology](https://www.nasa.gov/smallsat-institute/sst-soa/) report (2026 edition; power, avionics, guidance and control, communications, and launch chapters) and [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf).
- **Lunar mission:** NASA's public VIPER documents (mission overview, hardware, instruments) and CLPS reports.
- **Jupiter mission:** Europa Clipper press kit, instrument summary and launch reports (NASA/JPL), Juno and Galileo reports, and NASA Office of Inspector General audits.
- **Real cases on the event cards:** NASA and JPL reports on Kepler, Spirit, Galileo, Juno, InSight, Psyche, Lunar Trailblazer, ICESat-2 and others.
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

Checks:

```bash
npm run typecheck
npm run check:data     # every value has a known source; every text is in English and Japanese
npm run check:engine   # the simulation and the forecasts behave as designed
```

## References

All libraries, data, code and images used in this project.

- **Data and documents:** NASA sources as above. Other sources (20): news reports, company documents, papers, the US Government Accountability Office, the Congressional Research Service and Wikipedia; all are listed with links in [`src/data/sources.ts`](src/data/sources.ts).
- **Libraries** (licence texts in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)):
  - [React](https://react.dev/) and react-dom (MIT) — user interface.
  - [three.js](https://threejs.org/) (MIT) — the 3D mission view. Earth uses the NASA Blue Marble image below; Jupiter's bands, the radiation belts and the lunar south-pole disc are drawn in code (no outside images), as explanatory pictures that are not to scale.
  - Build tools: [Vite](https://vite.dev/) (MIT), [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) (MIT), [TypeScript](https://www.typescriptlang.org/) (Apache-2.0), and the @types packages (MIT).
- **Image:** NASA Visible Earth, [Blue Marble: Land Surface, Shallow Water, and Shaded Topography](https://web.archive.org/web/20260128022646/https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography) (Internet Archive copy; the NASA page now redirects) (NASA Goddard Space Flight Center, Reto Stöckli; public domain) — Earth texture, `public/textures/earth_day_2048.jpg` (taken from the Wikimedia Commons copy of the NASA file and resized to 2048 × 1024). This is the only image file in the game.
- **Sound:** synthesised in code with the Web Audio API; the game uses no audio files.
- **Icons and diagrams:** drawn in code for this game (`src/components/icons.tsx`, `MiniDiagram.tsx`); the favicon is an original drawing.
- **Earlier code by the author:** the forecast branch map and the seeded random-number generator (`src/components/BranchMap.tsx`, `src/engine/branchTree.ts`, `src/engine/rng.ts`; about 460 lines) were ported from the author's own earlier, unpublished simulator (TACTICA DSS). The random-number algorithm is the public xoshiro128**.

## AI usage

- The code, the game text and its Japanese translation, the icons (drawn as code) and the research for the game data were produced with an AI coding assistant ([Claude](https://www.anthropic.com/claude), by Anthropic) under the team's direction. Commits made this way carry a `Co-Authored-By: Claude` line.
- The team decided what the game should teach and how it plays, made the design decisions at each step, and reviewed the results by playing the game. Sources were opened and compared with the values in the game, and the balance was tuned by measured simulations.
- The game itself calls no AI model; the rival agencies follow fixed rules.
- No AI-generated images, video or audio are used. Pictures are drawn in code or are NASA images with credit; sound effects are synthesised in code.

## License

[Apache License 2.0](LICENSE)

- The Apache License covers this project's own code and text. NASA images and data used here are NASA material and are not covered by it.
- Third-party libraries keep their own licences; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
- Company and product names are the property of their owners and are used only to describe real events. This project is not affiliated with or endorsed by NASA or any company named.
