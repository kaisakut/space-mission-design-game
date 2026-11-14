/**
 * Orbit geometry for the mission view: the same model as scripts/orbit-contact.py, which produced the
 * contact minutes in the mission data (circular orbit, spherical Earth, 10° elevation mask).
 * Only for drawing: the game's numbers always come from the engine.
 */
export const RE_KM = 6378.137;
const MU = 398600.4418;
const DEG = Math.PI / 180;

/** Orbital period in seconds for a circular orbit at altitude h km. */
export const periodSec = (hKm: number) => 2 * Math.PI * Math.sqrt((RE_KM + hKm) ** 3 / MU);

/** Earth-central angle (radians) a station sees around itself, above the elevation mask. */
export function footprintAngle(hKm: number, maskDeg = 10): number {
  const el = maskDeg * DEG;
  return Math.acos((RE_KM / (RE_KM + hKm)) * Math.cos(el)) - el;
}

/** Highest latitude the ground track reaches (degrees). */
export const coverageLat = (incDeg: number) => Math.min(incDeg, 180 - incDeg);

export type Vec3 = [number, number, number];

/**
 * Unit vector for a latitude/longitude, matching three.js SphereGeometry texture mapping
 * (longitude −180° at u = 0), with Y as the polar axis.
 */
export function latLonToVec(latDeg: number, lonDeg: number): Vec3 {
  const lat = latDeg * DEG, phi = (lonDeg + 180) * DEG;
  return [-Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat)];
}

export function vecToLatLon([x, y, z]: Vec3): [number, number] {
  const r = Math.hypot(x, y, z) || 1;
  const lat = Math.asin(y / r) / DEG;
  let lon = Math.atan2(z, -x) / DEG - 180;
  if (lon < -180) lon += 360;
  return [lat, lon];
}

/** Position on a circular orbit of radius r: argument of latitude u, inclination i, node Ω (radians), Y up. */
export function orbitPos(r: number, u: number, incRad: number, node: number): Vec3 {
  const x0 = r * Math.cos(u), yIn = r * Math.sin(u);
  // In-plane coordinates, tilted about the line of nodes, then turned by the node angle around Y.
  const y = yIn * Math.sin(incRad), zp = yIn * Math.cos(incRad);
  return [x0 * Math.cos(node) + zp * Math.sin(node), y, -x0 * Math.sin(node) + zp * Math.cos(node)];
}

export const angleBetween = (a: Vec3, b: Vec3) => {
  const d = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / ((Math.hypot(...a) || 1) * (Math.hypot(...b) || 1));
  return Math.acos(Math.max(-1, Math.min(1, d)));
};
