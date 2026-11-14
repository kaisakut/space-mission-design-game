import type { Mission, Text } from '../types';
import { jupiterIcyMoon } from './jupiterIcyMoon';
import { lunarIceRover } from './lunarIceRover';
import { wildfireCubesat } from './wildfireCubesat';

/** All playable missions, in the order shown on the selection screen. */
export const MISSIONS: Mission[] = [wildfireCubesat, lunarIceRover, jupiterIcyMoon];

/** Missions being built: shown on the selection screen as "coming soon". */
export interface MissionPreview {
  id: string;
  name: Text;
  summary: Text;
  difficulty: Mission['difficulty'];
}

export const UPCOMING: MissionPreview[] = [];
