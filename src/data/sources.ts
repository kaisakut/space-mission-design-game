import type { Source } from './types';

/**
 * Every source a value in the game may cite. Values refer to these by id.
 * Add an entry here before citing it; `npm run check:data` fails on unknown ids.
 */
export const SOURCES: Source[] = [
  {
    id: 'nasa-cubesat101',
    title: 'CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers',
    publisher: 'NASA CubeSat Launch Initiative',
    url: 'https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf',
    nasa: true,
    accessed: '2026-11-14',
    challengeResource: true,
  },
  {
    id: 'nasa-science-missions',
    title: 'Design and Develop Science Missions',
    publisher: 'NASA',
    url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf',
    nasa: true,
    accessed: '2026-11-14',
    challengeResource: true,
  },
  {
    id: 'jpl-cml',
    title: 'Concept Maturity Levels',
    publisher: 'NASA Jet Propulsion Laboratory',
    url: 'https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299',
    nasa: true,
    accessed: '2026-11-14',
    challengeResource: true,
  },
  {
    id: 'nasa-gmat',
    title: 'General Mission Analysis Tool (GMAT)',
    publisher: 'NASA Goddard Space Flight Center',
    url: 'https://software.nasa.gov/software/GSC-19468-1',
    nasa: true,
    accessed: '2026-11-14',
    challengeResource: true,
  },
  {
    id: 'nasa-firms',
    title: 'Fire Information for Resource Management System (FIRMS): MODIS and VIIRS active fire archive',
    publisher: 'NASA LANCE / Earthdata',
    url: 'https://firms.modaps.eosdis.nasa.gov/download/',
    nasa: true,
    accessed: '2026-11-14',
  },
  {
    id: 'nasa-donki',
    title: 'Space Weather Database Of Notifications, Knowledge, Information (DONKI)',
    publisher: 'NASA Community Coordinated Modeling Center',
    url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    nasa: true,
    accessed: '2026-11-14',
  },
];

export const SOURCE_BY_ID: ReadonlyMap<string, Source> = new Map(SOURCES.map((s) => [s.id, s]));
