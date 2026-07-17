const EPSILON = 1e-8;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeVector(x, y, fallback = { x: 0, y: 0 }) {
  const length = Math.hypot(x, y);
  if (length <= EPSILON) return { x: fallback.x || 0, y: fallback.y || 0, length: 0 };
  return { x: x / length, y: y / length, length };
}

export function dot(a, b) {
  return (a?.x || 0) * (b?.x || 0) + (a?.y || 0) * (b?.y || 0);
}

export function distanceSquared(a, b) {
  const dx = (b?.x || 0) - (a?.x || 0);
  const dy = (b?.y || 0) - (a?.y || 0);
  return dx * dx + dy * dy;
}

export function angleBetween(a, b) {
  const na = normalizeVector(a?.x || 0, a?.y || 0);
  const nb = normalizeVector(b?.x || 0, b?.y || 0);
  if (!na.length || !nb.length) return 0;
  return Math.acos(clamp(dot(na, nb), -1, 1));
}

export function pointInsideCone(origin, facing, point, range, halfAngle) {
  if (!origin || !point || range <= 0 || halfAngle < 0) return false;
  const direction = normalizeVector(point.x - origin.x, point.y - origin.y);
  if (!direction.length || direction.length > range) return false;
  const normalizedFacing = normalizeVector(facing?.x || 0, facing?.y || 0, { x: 0, y: 1 });
  return dot(normalizedFacing, direction) >= Math.cos(halfAngle);
}

export function clientToGamePoint(client, rect, gameSize) {
  const width = Math.max(EPSILON, Number(rect?.width) || 0);
  const height = Math.max(EPSILON, Number(rect?.height) || 0);
  return {
    x: ((Number(client?.x) || 0) - (Number(rect?.left) || 0)) * ((Number(gameSize?.width) || width) / width),
    y: ((Number(client?.y) || 0) - (Number(rect?.top) || 0)) * ((Number(gameSize?.height) || height) / height)
  };
}

export function screenToWorldPoint(screen, camera) {
  const zoom = Math.max(EPSILON, Number(camera?.zoom) || 1);
  const worldViewX = Number(camera?.worldViewX ?? camera?.worldView?.x ?? camera?.scrollX) || 0;
  const worldViewY = Number(camera?.worldViewY ?? camera?.worldView?.y ?? camera?.scrollY) || 0;
  return {
    x: worldViewX + (Number(screen?.x) || 0) / zoom,
    y: worldViewY + (Number(screen?.y) || 0) / zoom
  };
}

export function scoreDirectionalCandidate(origin, aimDirection, candidate, {
  distanceWeight = 1,
  angleWeight = 32,
  priorityWeight = 1
} = {}) {
  const dx = (candidate?.x || 0) - (origin?.x || 0);
  const dy = (candidate?.y || 0) - (origin?.y || 0);
  const distance = Math.hypot(dx, dy);
  const direction = normalizeVector(dx, dy);
  const angle = direction.length ? angleBetween(aimDirection, direction) : 0;
  const priorityPenalty = Number(candidate?.priorityPenalty || 0);
  return distance * distanceWeight + angle * angleWeight + priorityPenalty * priorityWeight;
}
