import type { MissionViewConfig, Option } from '../data/types';

/**
 * A small drawing (40×40) for a destination option: the orbit around Earth, the landing site at the lunar
 * south pole, or the route around Jupiter. Drawn from the option's data and the mission's view settings, the
 * same values the mission view uses. Line style follows the icons.
 */
export function MiniDiagram({ option, view, size = 40 }: { option: Option; view: MissionViewConfig; size?: number | string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} style={{ flex: 'none' }} fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {body(option, view)}
    </svg>
  );
}

function body(o: Option, v: MissionViewConfig) {
  if (v.kind === 'earthOrbit' && o.kind === 'orbit') {
    const inc = o.inclinationDeg?.value ?? 98;
    const alt = o.altitudeKm?.value ?? 500;
    // Tilt from the equator: ISS (51.6°) lies flatter, sun-synchronous (~97°) stands nearly upright. Exaggerated.
    const eff = inc > 90 ? 180 - inc : inc;
    const tilt = -Math.min(80, Math.max(20, 30 + (eff - 51.6) * 1.6));
    // The ring stays clear of the Earth (its short radius is at least 1.6 Earth radii), so it reads as an orbit,
    // not as a planet's rings. Its size follows the altitude, exaggerated so 400, 500 and 600 km differ.
    const R = 6;
    const rx = 15 + Math.max(0, Math.min(1, (alt - 380) / 240)) * 4;
    const ry = Math.max(R * 1.6, rx * 0.55);
    const a = (tilt * Math.PI) / 180, t0 = 0.7;
    const sx = 20 + rx * Math.cos(t0) * Math.cos(a) - ry * Math.sin(t0) * Math.sin(a);
    const sy = 20 + rx * Math.cos(t0) * Math.sin(a) + ry * Math.sin(t0) * Math.cos(a);
    return <>
      <circle cx={20} cy={20} r={R} />
      {/* The equator, faint, so the ring's tilt can be read against it. */}
      <path d={`M${20 - R - 3} 20h${2 * R + 6}`} strokeWidth={0.8} opacity={0.45} strokeDasharray="1.5 1.5" />
      <ellipse cx={20} cy={20} rx={rx} ry={ry} transform={`rotate(${tilt} 20 20)`} />
      <circle cx={sx} cy={sy} r={2.2} fill="currentColor" />
    </>;
  }
  if (v.kind === 'lunarPole') {
    const s = v.sites[o.id];
    const R = 16;
    return <>
      <circle cx={20} cy={20} r={R} />
      <circle cx={20 + v.crater.x * R} cy={20 + v.crater.y * R} r={Math.max(3, v.crater.r * R * 1.6)} fill="currentColor" fillOpacity={0.35} stroke="none" />
      <path d="M17.5 20h5M20 17.5v5" strokeWidth={1} opacity={0.6} />
      {s && <circle cx={20 + s.x * R} cy={20 + s.y * R} r={2.6} fill="currentColor" />}
    </>;
  }
  if (v.kind === 'jupiterSystem') {
    const p = v.paths[o.id] ?? 'flybys';
    return <>
      <circle cx={14} cy={20} r={5} />
      <ellipse cx={14} cy={20} rx={13} ry={4.5} strokeDasharray="2 2.5" opacity={0.7} />
      {p === 'flybys' && <ellipse cx={22} cy={20} rx={15} ry={6} transform="rotate(-12 22 20)" />}
      {p === 'europaOrbit' && <><circle cx={25} cy={20} r={3.2} /><circle cx={25} cy={20} r={1} fill="currentColor" /></>}
      {p === 'ganymede' && <><circle cx={33} cy={20} r={4} /><circle cx={33} cy={20} r={1.3} fill="currentColor" /></>}
    </>;
  }
  return null;
}

/** Whether a destination option has a small drawing for this mission. */
export const hasDiagram = (o: Option, v: MissionViewConfig | undefined): v is MissionViewConfig =>
  !!v && o.kind === 'orbit' && (v.kind === 'earthOrbit' || (v.kind === 'lunarPole' && !!v.sites[o.id]) || (v.kind === 'jupiterSystem' && !!v.paths[o.id]));
