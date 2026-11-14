import { tx } from '../helpers';
import type { Mission, Text } from '../types';
import { lunarIceRover } from './lunarIceRover';
import { wildfireCubesat } from './wildfireCubesat';

/** All playable missions, in the order shown on the selection screen. */
export const MISSIONS: Mission[] = [wildfireCubesat, lunarIceRover];

/** Missions being built: shown on the selection screen as "coming soon". */
export interface MissionPreview {
  id: string;
  name: Text;
  summary: Text;
  difficulty: Mission['difficulty'];
}

export const UPCOMING: MissionPreview[] = [
  {
    id: 'jupiter-icy-moon-flyby',
    name: tx('Icy Moon Flyby at Jupiter', '木星の氷衛星フライバイ'),
    summary: tx('Look for signs of an ocean under the ice: weak sunlight, strong radiation, years of cruise and long signal delays.', '氷の下の海の手がかりを探す。日射は弱く放射線は強く、何年もの航行と通信の遅れがある。'),
    difficulty: 'advanced',
  },
];
