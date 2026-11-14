import type { CSSProperties } from 'react';

/**
 * Line icons for option cards and slot headings, drawn in code (no icon library).
 * Every icon sits on a 24×24 grid: strokes only, width 1.75, round caps and joins, colour from `currentColor`.
 * Designed by Claude for this game; not copied from an icon set.
 *
 * A shape is a path (`d` string), a circle ['c', cx, cy, r], an ellipse ['e', cx, cy, rx, ry, rotation?]
 * or a rounded rectangle ['r', x, y, width, height, cornerRadius].
 */
type Shape = string | ['c', number, number, number] | ['e', number, number, number, number, number?] | ['r', number, number, number, number, number];

const ICONS = {
  // nothing chosen
  none: [["c", 12, 12, 8.5], "M6 6l12 12"],
  // fallback when an option has no icon of its own
  dot: [["c", 12, 12, 3.5]],
  // daytime
  sun: [["c", 12, 12, 4], "M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"],
  // night
  moon: ["M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5z"],
  // fast; power
  bolt: ["M13 3 5 13.5h6l-1 7.5 8-10.5h-6z"],
  // long life
  hourglass: ["M6 3h12M6 21h12", "M7.5 3v3.5c0 2.7 4.5 3.5 4.5 5.5s-4.5 2.8-4.5 5.5V21", "M16.5 3v3.5c0 2.7-4.5 3.5-4.5 5.5s4.5 2.8 4.5 5.5V21"],
  // budget and reserve
  coins: [["e", 12, 7, 7, 3], "M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7", "M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"],
  // visible camera; observing
  eye: ["M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z", ["c", 12, 12, 3]],
  // fire seen in short-wave infrared
  flame: ["M12 3c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2 1-3.5 2-4.5.3 1.5 1 2.3 2 2.5C10 8.5 10.5 5.5 12 3z"],
  // thermal infrared; heat
  thermo: ["M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z", "M12 10v7.5"],
  // body-mounted solar panels
  panel: [["r", 4, 4, 16, 16, 1.5], "M12 4v16M4 12h16"],
  // deployable solar arrays
  wings: [["r", 9.5, 8.5, 5, 7, 1], ["r", 1.5, 9.5, 6, 5, 0.6], ["r", 16.5, 9.5, 6, 5, 0.6], "M7.5 12h2M14.5 12h2M4.5 9.5v5M19.5 9.5v5"],
  // radio
  antenna: ["M12 21V11M9 21h6", ["c", 12, 9, 1.6], "M8.6 12.4a4.8 4.8 0 0 1 0-6.8M15.4 5.6a4.8 4.8 0 0 1 0 6.8", "M6 15a8.5 8.5 0 0 1 0-12M18 3a8.5 8.5 0 0 1 0 12"],
  // ground station; high-gain antenna
  dish: ["M4 8l12 12A8.5 8.5 0 0 1 4 8z", "M10 14l4.6-4.6", ["c", 15.8, 8.2, 1.6], "M15 3a6 6 0 0 1 6 6"],
  // radiation protection
  shield: ["M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"],
  // spare reaction wheel (a spinning wheel)
  wheel: [["c", 12, 12, 4.2], ["c", 12, 12, 1.2], "M4.6 7A9 9 0 0 1 20.8 10.2", "M21 5.6v4.8h-4.8", "M19.4 17A9 9 0 0 1 3.2 13.8", "M3 18.4v-4.8h4.8"],
  // deploy from the ISS
  station: [["c", 12, 12, 2.6], "M4.75 12h4.65M14.6 12h4.65", ["r", 2.5, 4.5, 4.5, 6, 0.6], ["r", 2.5, 13.5, 4.5, 6, 0.6], ["r", 17, 4.5, 4.5, 6, 0.6], ["r", 17, 13.5, 4.5, 6, 0.6], "M4.75 10.5v3M19.25 10.5v3"],
  // launch
  rocket: ["M12 2.5c3 2.5 4.5 6 4.5 10v3.5h-9v-3.5c0-4 1.5-7.5 4.5-10z", "M7.5 12.5l-3 3.5v2.5l3-1.5M16.5 12.5l3 3.5v2.5l-3-1.5", ["c", 12, 9.5, 1.6], "M12 18.5v3"],
  // launch window or flight
  calendar: [["r", 3.5, 5, 17, 15.5, 2], "M3.5 10h17M8 3v4M16 3v4"],
  // station network; Earth
  globe: [["c", 12, 12, 9], ["e", 12, 12, 4, 9], "M3 12h18"],
  // test campaign
  clipboard: [["r", 5, 4.5, 14, 16.5, 2], ["r", 9, 2.5, 6, 4, 1], "M9 13.5l2.2 2.2 4-4.4"],
  // operations rehearsal
  headset: ["M5 14v-2a7 7 0 0 1 14 0v2", ["r", 3, 13, 4, 6, 1.5], ["r", 17, 13, 4, 6, 1.5], "M19 19v.5a2 2 0 0 1-2 2h-3.5"],
  // one unit
  box: ["M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z", "M12 12l8-4.6M12 12L4 7.4M12 12v9.2"],
  // spare unit or parts
  boxes: ["M8 9.5l4.3 2.5v5L8 19.5 3.7 17v-5z", "M8 14.5l4.3-2.5M8 14.5L3.7 12M8 14.5v5", "M16.5 3.5L20.5 5.8v4.4l-4 2.3-4-2.3V5.8z", "M16.5 8l4-2.2M16.5 8l-4-2.2M16.5 8v4.5"],
  // objective; landing site
  target: [["c", 12, 12, 9], ["c", 12, 12, 5], ["c", 12, 12, 1.2]],
  // rover
  rover: [["r", 4, 9.5, 13.5, 5, 1], ["c", 6, 17.8, 2.2], ["c", 11.5, 17.8, 2.2], ["c", 17, 17.8, 2.2], "M14.5 9.5V6", ["r", 12.5, 3, 5.5, 3, 0.6]],
  // drill
  drill: [["r", 8, 3, 8, 5, 1], "M10 8v10l2 3 2-3V8", "M10 10.8l4 1.5M10 13.8l4 1.5M10 16.8l4 1.2"],
  // isotopes; nuclear power or heat
  atom: [["c", 12, 12, 1.5], ["e", 12, 12, 9.5, 4, 45], ["e", 12, 12, 9.5, 4, -45]],
  // vault thickness
  layers: ["M12 3l9 4.5-9 4.5-9-4.5z", "M3 12l9 4.5 9-4.5", "M3 16.5L12 21l9-4.5"],
  // ice-penetrating radar
  radar: [["c", 12, 4, 1.4], "M8.5 8.5a5 5 0 0 0 7 0", "M6 12a8.5 8.5 0 0 0 12 0", "M3.5 15.5a12 12 0 0 0 17 0"],
  // lunar lander
  lander: ["M12 7V4", "M8 7h8l2 6H6z", "M7.5 13l-3 6.5M16.5 13l3 6.5M3 19.5h3M18 19.5h3", "M10.5 13l-1 3h5l-1-3"],
  // tour or driving plan
  route: [["c", 5.5, 18.5, 2], ["c", 18.5, 5.5, 2], "M7.5 18.5H14a3.25 3.25 0 0 0 0-6.5h-4a3.25 3.25 0 0 1 0-6.5h6.5"],
  // mass spectrometer; sampling
  flask: ["M9.5 3h5", "M10 3v6.5L4.8 18.3A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.7L14 9.5V3", "M7.5 15h9"],
  // magnetometer
  magnet: ["M5 4h4.5v8a2.5 2.5 0 0 0 5 0V4H19v8a7 7 0 0 1-14 0z", "M5 8h4.5M14.5 8H19"],
  // dust analyser
  dust: [["c", 7, 8, 2.2], ["c", 15.5, 5.5, 1.2], ["c", 17, 13.5, 2.6], ["c", 8.5, 16.5, 1.5], ["c", 13, 20, 1]],
  // orbit
  orbit: [["c", 12, 12, 2.6], ["e", 12, 12, 10, 5.6, -30], ["c", 17.2, 5.6, 1.3]],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
export const isIconName = (x: string): x is IconName => x in ICONS;

function shape(s: Shape, k: number) {
  if (typeof s === 'string') return <path key={k} d={s} />;
  switch (s[0]) {
    case 'c': return <circle key={k} cx={s[1]} cy={s[2]} r={s[3]} />;
    case 'e': return <ellipse key={k} cx={s[1]} cy={s[2]} rx={s[3]} ry={s[4]} transform={s[5] ? `rotate(${s[5]} ${s[1]} ${s[2]})` : undefined} />;
    case 'r': return <rect key={k} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />;
  }
}

/**
 * One icon. `size` is in CSS pixels, or any CSS length such as '1.5em' so it follows the text size.
 * Decorative by default (hidden from screen readers); pass `label` when the icon carries meaning on its own.
 */
export function Icon({ name, size = '1.5em', label, className, style }: {
  name: IconName; size?: number | string; label?: string; className?: string; style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} className={className} style={{ flex: 'none', ...style }}
      fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    >
      {(ICONS[name] as Shape[]).map(shape)}
    </svg>
  );
}
