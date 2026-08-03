const POLICE_TOTALS_BY_LEVEL = Object.freeze({
  0: 2,
  1: 4,
  2: 8,
  3: 12
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clampWantedLevel(level) {
  return Math.max(0, Math.min(3, Math.floor(finite(level))));
}

export function desiredPoliceTotal(level) {
  return POLICE_TOTALS_BY_LEVEL[clampWantedLevel(level)];
}

export function desiredFootPolice(level, reservedOfficers = 0) {
  const reserved = Math.max(0, Math.floor(finite(reservedOfficers)));
  return Math.max(POLICE_TOTALS_BY_LEVEL[0], desiredPoliceTotal(level) - reserved);
}

function normalizedCandidate(point, focus) {
  if (!point) return null;
  const x = finite(point.x, Number.NaN);
  const y = finite(point.y, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const dx = x - finite(focus?.x);
  const dy = y - finite(focus?.y);
  return {
    ...point,
    x,
    y,
    distance: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx)
  };
}

function uniqueCandidates(points, focus) {
  const seen = new Set();
  return (Array.isArray(points) ? points : [])
    .map(point => normalizedCandidate(point, focus))
    .filter(point => {
      if (!point) return false;
      const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function chooseFootResponsePoint(points, focus, ordinal = 0, {
  minDistance = 260,
  targetDistance = 480,
  maxDistance = 900,
  sectorCount = 8
} = {}) {
  const candidates = uniqueCandidates(points, focus);
  if (!candidates.length) return null;

  const minimum = Math.max(0, finite(minDistance, 260));
  const maximum = Math.max(minimum, finite(maxDistance, 900));
  const target = Math.max(minimum, Math.min(maximum, finite(targetDistance, 480)));
  const sectors = Math.max(1, Math.floor(finite(sectorCount, 8)));
  const withinBand = candidates.filter(point => point.distance >= minimum && point.distance <= maximum);
  const outsideImmediateView = candidates.filter(point => point.distance >= minimum);
  const pool = withinBand.length
    ? withinBand
    : outsideImmediateView.length
      ? outsideImmediateView
      : candidates;

  pool.sort((left, right) => (
    Math.abs(left.distance - target) - Math.abs(right.distance - target)
    || left.distance - right.distance
    || left.x - right.x
    || left.y - right.y
  ));

  const approachesBySector = new Map();
  for (const point of pool) {
    const normalizedAngle = (point.angle + Math.PI * 2) % (Math.PI * 2);
    const sector = Math.floor((normalizedAngle / (Math.PI * 2)) * sectors) % sectors;
    if (!approachesBySector.has(sector)) approachesBySector.set(sector, point);
  }
  const approaches = [...approachesBySector.values()];
  const index = Math.abs(Math.floor(finite(ordinal))) % approaches.length;
  const selected = approaches[index];
  const { distance, angle, ...point } = selected;
  return point;
}
