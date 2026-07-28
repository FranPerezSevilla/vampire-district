const DEFAULT_CLEARANCE = 4;
const DEFAULT_FALLBACK_INSET = 6;
const DEFAULT_MIN_WIDTH = 80;
const DEFAULT_MIN_HEIGHT = 56;

export const BUILDING_SIDEWALK_CLEARANCE_POLICY_ID = "neon-sidewalk-clearance-v1";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function identity(value) {
  return String(value || "").trim().toLowerCase();
}

export function isNeonBuilding(building) {
  if (!building) return false;
  if (identity(building.sign) === "neon") return true;
  const id = identity(building.id);
  return id === "club" || id === "nightclub" || id.endsWith(":club") || id.includes("neon-club");
}

export function surfaceBounds(surface) {
  const points = Array.isArray(surface?.points) ? surface.points : [];
  if (points.length >= 3) {
    const xs = points.map(point => finite(point?.x));
    const ys = points.map(point => finite(point?.y));
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x,
      y,
      w: Math.max(0, Math.max(...xs) - x),
      h: Math.max(0, Math.max(...ys) - y)
    };
  }
  return {
    x: finite(surface?.x),
    y: finite(surface?.y),
    w: Math.max(0, finite(surface?.w)),
    h: Math.max(0, finite(surface?.h))
  };
}

export function rectsOverlapWithMargin(a, b, margin = 0) {
  const padding = Math.max(0, finite(margin));
  return finite(a?.x) < finite(b?.x) + finite(b?.w) + padding
    && finite(a?.x) + finite(a?.w) > finite(b?.x) - padding
    && finite(a?.y) < finite(b?.y) + finite(b?.h) + padding
    && finite(a?.y) + finite(a?.h) > finite(b?.y) - padding;
}

function fallbackFootprint(building, inset) {
  const amount = Math.max(0, finite(inset, DEFAULT_FALLBACK_INSET));
  return {
    x: finite(building.x),
    y: finite(building.y),
    w: Math.max(DEFAULT_MIN_WIDTH, finite(building.w) - amount),
    h: Math.max(DEFAULT_MIN_HEIGHT, finite(building.h) - amount)
  };
}

export function fitBuildingToSidewalks(building, surfaces = [], options = {}) {
  if (!isNeonBuilding(building)) return building;

  const clearance = Math.max(0, finite(options.clearance, DEFAULT_CLEARANCE));
  const fallbackInset = Math.max(clearance, finite(options.fallbackInset, DEFAULT_FALLBACK_INSET));
  const minWidth = Math.max(1, finite(options.minWidth, DEFAULT_MIN_WIDTH));
  const minHeight = Math.max(1, finite(options.minHeight, DEFAULT_MIN_HEIGHT));
  const original = {
    x: finite(building.x),
    y: finite(building.y),
    w: Math.max(1, finite(building.w, minWidth)),
    h: Math.max(1, finite(building.h, minHeight))
  };
  const originalRight = original.x + original.w;
  const originalBottom = original.y + original.h;
  const centerX = original.x + original.w / 2;
  const centerY = original.y + original.h / 2;
  let left = original.x;
  let top = original.y;
  let right = originalRight;
  let bottom = originalBottom;
  let matchedSurface = false;

  for (const surface of Array.isArray(surfaces) ? surfaces : []) {
    const bounds = surfaceBounds(surface);
    if (bounds.w <= 0 || bounds.h <= 0 || !rectsOverlapWithMargin(original, bounds, clearance)) continue;
    matchedSurface = true;
    const surfaceCenterX = bounds.x + bounds.w / 2;
    const surfaceCenterY = bounds.y + bounds.h / 2;

    if (bounds.w >= bounds.h) {
      if (surfaceCenterY <= centerY) top = Math.max(top, bounds.y + bounds.h + clearance);
      else bottom = Math.min(bottom, bounds.y - clearance);
    } else if (surfaceCenterX <= centerX) {
      left = Math.max(left, bounds.x + bounds.w + clearance);
    } else {
      right = Math.min(right, bounds.x - clearance);
    }
  }

  let next = { x: left, y: top, w: right - left, h: bottom - top };
  if (!matchedSurface || next.w < minWidth || next.h < minHeight) {
    next = fallbackFootprint(building, fallbackInset);
  }

  const changed = next.x !== original.x || next.y !== original.y || next.w !== original.w || next.h !== original.h;
  return changed ? {
    ...building,
    ...next,
    clearancePolicy: BUILDING_SIDEWALK_CLEARANCE_POLICY_ID
  } : building;
}
