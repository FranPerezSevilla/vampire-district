const EPSILON = 1e-6;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalized(direction = {}) {
  const x = finite(direction.x);
  const y = finite(direction.y);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export const DEFAULT_BALLISTIC_SPEED = 1050;

export function createBallisticProjectile({
  id,
  attackId = 0,
  config = {},
  layer = null,
  origin = {},
  direction = {},
  range = 0,
  speed = DEFAULT_BALLISTIC_SPEED
} = {}) {
  const aim = normalized(direction);
  const x = finite(origin.x);
  const y = finite(origin.y);
  return {
    id: String(id || `projectile-${attackId}`),
    attackId: Math.max(0, Math.floor(finite(attackId))),
    config,
    layer,
    x,
    y,
    previousX: x,
    previousY: y,
    direction: aim,
    remainingRange: Math.max(0, finite(range)),
    speed: Math.max(1, finite(speed, DEFAULT_BALLISTIC_SPEED)),
    alive: true
  };
}

export function advanceBallisticProjectile(projectile, dt = 0) {
  if (!projectile?.alive) {
    return {
      from: { x: finite(projectile?.x), y: finite(projectile?.y) },
      to: { x: finite(projectile?.x), y: finite(projectile?.y) },
      distance: 0,
      expiresAtEnd: true
    };
  }
  const seconds = Math.max(0, finite(dt));
  const distance = Math.min(
    Math.max(0, finite(projectile.remainingRange)),
    Math.max(1, finite(projectile.speed, DEFAULT_BALLISTIC_SPEED)) * seconds
  );
  const from = { x: finite(projectile.x), y: finite(projectile.y) };
  return {
    from,
    to: {
      x: from.x + finite(projectile.direction?.x) * distance,
      y: from.y + finite(projectile.direction?.y) * distance
    },
    distance,
    expiresAtEnd: distance >= Math.max(0, finite(projectile.remainingRange)) - EPSILON
  };
}

export function commitBallisticAdvance(projectile, movement) {
  if (!projectile || !movement) return projectile;
  projectile.previousX = finite(movement.from?.x, projectile.x);
  projectile.previousY = finite(movement.from?.y, projectile.y);
  projectile.x = finite(movement.to?.x, projectile.x);
  projectile.y = finite(movement.to?.y, projectile.y);
  projectile.remainingRange = Math.max(
    0,
    finite(projectile.remainingRange) - Math.max(0, finite(movement.distance))
  );
  if (movement.expiresAtEnd || projectile.remainingRange <= EPSILON) projectile.alive = false;
  return projectile;
}
