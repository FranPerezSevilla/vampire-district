import { COLORS } from "../data/balance.js";
import { buildings, crosswalks, LAYERS, roads, sidewalks } from "../data/district.js";

const OPEN_GROUND_GRID = 64;
const OPEN_GROUND_MAJOR_EVERY = 4;
const SIDEWALK_JOINT_SPACING = 28;
const CROSSWALK_STRIPE = 5;
const CROSSWALK_GAP = 5;
const CROSSWALK_INSET = 3;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function right(rect) {
  return finite(rect?.x) + finite(rect?.w);
}

function bottom(rect) {
  return finite(rect?.y) + finite(rect?.h);
}

function clippedRect(area, bounds) {
  if (!area || !bounds) return null;
  const x = Math.max(finite(area.x), finite(bounds.x));
  const y = Math.max(finite(area.y), finite(bounds.y));
  const maxX = Math.min(right(area), right(bounds));
  const maxY = Math.min(bottom(area), bottom(bounds));
  return maxX > x && maxY > y ? { x, y, w: maxX - x, h: maxY - y } : null;
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function line(x1, y1, x2, y2, major = false) {
  return { x1, y1, x2, y2, major };
}

export function buildStreetGridLines(bounds, {
  spacing = OPEN_GROUND_GRID,
  majorEvery = OPEN_GROUND_MAJOR_EVERY
} = {}) {
  const safeSpacing = Math.max(16, finite(spacing, OPEN_GROUND_GRID));
  const safeMajorEvery = Math.max(1, Math.round(finite(majorEvery, OPEN_GROUND_MAJOR_EVERY)));
  const lines = [];
  const firstX = Math.ceil(finite(bounds.x) / safeSpacing) * safeSpacing;
  const firstY = Math.ceil(finite(bounds.y) / safeSpacing) * safeSpacing;
  for (let x = firstX; x <= right(bounds); x += safeSpacing) {
    const index = Math.round(x / safeSpacing);
    lines.push(line(x, bounds.y, x, bottom(bounds), index % safeMajorEvery === 0));
  }
  for (let y = firstY; y <= bottom(bounds); y += safeSpacing) {
    const index = Math.round(y / safeSpacing);
    lines.push(line(bounds.x, y, right(bounds), y, index % safeMajorEvery === 0));
  }
  return lines;
}

export function buildSidewalkJointSegments(walk, bounds, spacing = SIDEWALK_JOINT_SPACING) {
  if (!walk || walk.geometry === "polygon" || walk.role === "corner") return [];
  const fragment = clippedRect(walk, bounds);
  if (!fragment) return [];
  const safeSpacing = Math.max(12, finite(spacing, SIDEWALK_JOINT_SPACING));
  const horizontal = walk.orientation === "horizontal" || walk.w > walk.h * 1.35;
  const vertical = walk.orientation === "vertical" || walk.h > walk.w * 1.35;
  const segments = [];
  if (horizontal) {
    const first = Math.ceil(finite(walk.x) / safeSpacing) * safeSpacing;
    for (let x = first; x < right(walk) - 2; x += safeSpacing) {
      if (x < fragment.x || x > right(fragment)) continue;
      segments.push(line(x, Math.max(walk.y + 2, fragment.y), x, Math.min(bottom(walk) - 2, bottom(fragment))));
    }
  } else if (vertical) {
    const first = Math.ceil(finite(walk.y) / safeSpacing) * safeSpacing;
    for (let y = first; y < bottom(walk) - 2; y += safeSpacing) {
      if (y < fragment.y || y > bottom(fragment)) continue;
      segments.push(line(Math.max(walk.x + 2, fragment.x), y, Math.min(right(walk) - 2, right(fragment)), y));
    }
  }
  return segments;
}

export function buildCornerCutout(walk) {
  if (!walk || walk.role !== "corner" || !walk.corner) return null;
  const radius = Math.max(5, Math.min(11, finite(walk.w) * 0.48, finite(walk.h) * 0.48));
  if (walk.corner === "nw") return { x: right(walk), y: bottom(walk), radius, corner: walk.corner };
  if (walk.corner === "ne") return { x: finite(walk.x), y: bottom(walk), radius, corner: walk.corner };
  if (walk.corner === "se") return { x: finite(walk.x), y: finite(walk.y), radius, corner: walk.corner };
  if (walk.corner === "sw") return { x: right(walk), y: finite(walk.y), radius, corner: walk.corner };
  return null;
}

export function buildCornerArc(cutout, segments = 7) {
  if (!cutout) return [];
  const ranges = {
    nw: [Math.PI, Math.PI * 1.5],
    ne: [Math.PI * 1.5, Math.PI * 2],
    se: [0, Math.PI * 0.5],
    sw: [Math.PI * 0.5, Math.PI]
  };
  const range = ranges[cutout.corner];
  if (!range) return [];
  const points = [];
  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    const angle = range[0] + (range[1] - range[0]) * t;
    points.push({
      x: cutout.x + Math.cos(angle) * cutout.radius,
      y: cutout.y + Math.sin(angle) * cutout.radius
    });
  }
  return points;
}

export function buildCrosswalkMarkings(crossing, {
  stripe = CROSSWALK_STRIPE,
  gap = CROSSWALK_GAP,
  inset = CROSSWALK_INSET
} = {}) {
  if (!crossing) return { stripes: [], tactilePads: [], stopLine: null };
  const stripes = [];
  const tactilePads = [];
  const stripeSize = Math.max(2, finite(stripe, CROSSWALK_STRIPE));
  const step = stripeSize + Math.max(2, finite(gap, CROSSWALK_GAP));
  const safeInset = Math.max(0, finite(inset, CROSSWALK_INSET));
  const horizontal = crossing.orientation === "horizontal" || crossing.w > crossing.h;

  if (horizontal) {
    for (let x = crossing.x + safeInset; x < right(crossing) - 2; x += step) {
      stripes.push({ x, y: crossing.y, w: Math.min(stripeSize, right(crossing) - x), h: crossing.h });
    }
    const padHeight = Math.max(7, crossing.h - 4);
    tactilePads.push(
      { x: crossing.x - 8, y: crossing.y + 2, w: 7, h: padHeight },
      { x: right(crossing) + 1, y: crossing.y + 2, w: 7, h: padHeight }
    );
  } else {
    for (let y = crossing.y + safeInset; y < bottom(crossing) - 2; y += step) {
      stripes.push({ x: crossing.x, y, w: crossing.w, h: Math.min(stripeSize, bottom(crossing) - y) });
    }
    const padWidth = Math.max(7, crossing.w - 4);
    tactilePads.push(
      { x: crossing.x + 2, y: crossing.y - 8, w: padWidth, h: 7 },
      { x: crossing.x + 2, y: bottom(crossing) + 1, w: padWidth, h: 7 }
    );
  }

  let stopLine = null;
  if (crossing.leg === "south") stopLine = { x: crossing.x, y: crossing.y - 7, w: crossing.w, h: 2 };
  else if (crossing.leg === "north") stopLine = { x: crossing.x, y: bottom(crossing) + 5, w: crossing.w, h: 2 };
  else if (crossing.leg === "east") stopLine = { x: crossing.x - 7, y: crossing.y, w: 2, h: crossing.h };
  else if (crossing.leg === "west") stopLine = { x: right(crossing) + 5, y: crossing.y, w: 2, h: crossing.h };

  return { stripes, tactilePads, stopLine };
}

function drawLine(graphics, segment) {
  graphics.lineBetween(segment.x1, segment.y1, segment.x2, segment.y2);
}

function drawRectEdge(graphics, rect, edge) {
  if (edge === "north") graphics.lineBetween(rect.x, rect.y, right(rect), rect.y);
  else if (edge === "south") graphics.lineBetween(rect.x, bottom(rect), right(rect), bottom(rect));
  else if (edge === "west") graphics.lineBetween(rect.x, rect.y, rect.x, bottom(rect));
  else if (edge === "east") graphics.lineBetween(right(rect), rect.y, right(rect), bottom(rect));
}

function roadFacingEdge(walk) {
  if (walk.side === "north") return "south";
  if (walk.side === "south") return "north";
  if (walk.side === "west") return "east";
  if (walk.side === "east") return "west";
  return null;
}

function drawPolygonOutline(graphics, points) {
  if (!Array.isArray(points) || points.length < 2) return;
  for (let index = 0; index < points.length; index++) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    graphics.lineBetween(from.x, from.y, to.x, to.y);
  }
}

function drawRoadWear(graphics, road, fragment) {
  if (!fragment || road.pieceKind !== "segment") return;
  const phase = hashString(road.id) % 96;
  const horizontal = road.orientation === "horizontal" || road.w > road.h;
  graphics.fillStyle(COLORS.roadWear, 0.34);
  if (horizontal) {
    const start = Math.floor((fragment.x - phase) / 96) * 96 + phase;
    const y = road.y + road.h * (0.24 + (hashString(`${road.id}:wear`) % 20) / 100);
    for (let x = start; x < right(fragment); x += 96) {
      const wearX = Math.max(x, fragment.x);
      const width = Math.min(18, right(fragment) - wearX);
      if (width > 3) graphics.fillRect(wearX, y, width, 2);
    }
  } else {
    const start = Math.floor((fragment.y - phase) / 96) * 96 + phase;
    const x = road.x + road.w * (0.24 + (hashString(`${road.id}:wear`) % 20) / 100);
    for (let y = start; y < bottom(fragment); y += 96) {
      const wearY = Math.max(y, fragment.y);
      const height = Math.min(18, bottom(fragment) - wearY);
      if (height > 3) graphics.fillRect(x, wearY, 2, height);
    }
  }
}

function inferredRoadClass(road) {
  if (road.roadClass) return road.roadClass;
  if (road.kind === "alley") return "alley";
  return Math.min(finite(road.w), finite(road.h)) >= 96 ? "major" : "local";
}

function drawLocalRoadDashes(graphics, road, fragment) {
  const horizontal = road.orientation === "horizontal" || road.w > road.h;
  graphics.fillStyle(COLORS.roadStripe, 0.72);
  if (horizontal) {
    const y = road.y + Math.floor(road.h / 2) - 1;
    const start = Math.floor(fragment.x / 40) * 40;
    for (let x = start; x < right(fragment); x += 40) {
      const dashX = Math.max(x, fragment.x);
      const width = Math.min(15, right(fragment) - dashX);
      if (width > 0) graphics.fillRect(dashX, y, width, 2);
    }
  } else {
    const x = road.x + Math.floor(road.w / 2) - 1;
    const start = Math.floor(fragment.y / 40) * 40;
    for (let y = start; y < bottom(fragment); y += 40) {
      const dashY = Math.max(y, fragment.y);
      const height = Math.min(15, bottom(fragment) - dashY);
      if (height > 0) graphics.fillRect(x, dashY, 2, height);
    }
  }
}

function drawMajorRoadCentre(graphics, road, fragment) {
  const horizontal = road.orientation === "horizontal" || road.w > road.h;
  graphics.fillStyle(COLORS.roadMajorStripe, 0.78);
  if (horizontal) {
    const y = road.y + road.h / 2;
    graphics.fillRect(fragment.x, y - 3, fragment.w, 1);
    graphics.fillRect(fragment.x, y + 2, fragment.w, 1);
  } else {
    const x = road.x + road.w / 2;
    graphics.fillRect(x - 3, fragment.y, 1, fragment.h);
    graphics.fillRect(x + 2, fragment.y, 1, fragment.h);
  }
}

export function installCitySurfacePresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceCitySurfacePresentationPolicy) return;
  prototype.__viceCitySurfacePresentationPolicy = true;

  prototype.drawOpenGroundWindow = function viceBloodDrawOpenGroundWindow(bounds) {
    const lines = buildStreetGridLines(bounds);
    this.map.lineStyle(1, COLORS.streetGrid, 0.10);
    for (const segment of lines.filter(candidate => !candidate.major)) drawLine(this.map, segment);
    this.map.lineStyle(1, COLORS.streetGridMajor, 0.16);
    for (const segment of lines.filter(candidate => candidate.major)) drawLine(this.map, segment);
  };

  prototype.drawDistrictStreet = function viceBloodDrawDistrictStreet() {
    const bounds = this.urbanRenderBounds || this.prepareUrbanRenderWindow();
    this.map.fillStyle(COLORS.streetBase, 1).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    this.drawOpenGroundWindow(bounds);
    for (const road of this.chunkItems("roads", bounds, roads, { margin: 12 })) this.drawRoadWindow(road);
    this.drawSidewalkNetwork();
    this.drawCrosswalkNetwork();
    this.drawSewerManholes();
    for (const item of this.chunkItems("buildings", bounds, buildings, { margin: 80 })) this.drawBuilding(item);
    if (this.currentLayer > LAYERS.STREET) {
      this.map.fillStyle(0x000000, 0.46).fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
  };

  prototype.drawRoadWindow = function viceBloodDrawRoadWindow(road) {
    if (road.geometry === "polygon" && Array.isArray(road.points)) {
      this.map.fillStyle(COLORS.road, 1).fillPoints(road.points, true);
      this.map.lineStyle(1, COLORS.roadEdge, 0.20);
      drawPolygonOutline(this.map, road.points);
      return;
    }

    const fragment = clippedRect(road, this.urbanRenderBounds);
    if (!fragment) return;
    this.map.fillStyle(COLORS.road, 1).fillRect(fragment.x, fragment.y, fragment.w, fragment.h);
    if (road.pieceKind !== "segment") return;

    const horizontal = road.orientation === "horizontal" || road.w > road.h;
    this.map.fillStyle(COLORS.roadEdge, 0.28);
    if (horizontal) {
      this.map.fillRect(fragment.x, road.y, fragment.w, 2);
      this.map.fillRect(fragment.x, road.y + road.h - 2, fragment.w, 2);
    } else {
      this.map.fillRect(road.x, fragment.y, 2, fragment.h);
      this.map.fillRect(road.x + road.w - 2, fragment.y, 2, fragment.h);
    }

    drawRoadWear(this.map, road, fragment);
    const roadClass = inferredRoadClass(road);
    if (roadClass === "major") drawMajorRoadCentre(this.map, road, fragment);
    else if (roadClass !== "alley") drawLocalRoadDashes(this.map, road, fragment);
  };

  prototype.drawSidewalkNetwork = function viceBloodDrawSidewalkNetwork() {
    const visible = this.chunkItems("sidewalks", this.urbanRenderBounds, sidewalks, { margin: 8 });

    this.map.fillStyle(COLORS.sidewalk, 1);
    for (const walk of visible) {
      if (walk.geometry === "polygon" && Array.isArray(walk.points)) {
        this.map.fillPoints(walk.points, true);
        continue;
      }
      const fragment = clippedRect(walk, this.urbanRenderBounds);
      if (fragment) this.map.fillRect(fragment.x, fragment.y, fragment.w, fragment.h);
    }

    const cutouts = visible.map(buildCornerCutout).filter(Boolean);
    this.map.fillStyle(COLORS.road, 1);
    for (const cutout of cutouts) this.map.fillCircle(cutout.x, cutout.y, cutout.radius);

    this.map.lineStyle(1, COLORS.sidewalkJoint, 0.42);
    for (const walk of visible) {
      for (const segment of buildSidewalkJointSegments(walk, this.urbanRenderBounds)) drawLine(this.map, segment);
    }

    this.map.lineStyle(1, COLORS.sidewalkTrim, 0.46);
    for (const walk of visible) {
      if (walk.geometry === "polygon" && Array.isArray(walk.points)) drawPolygonOutline(this.map, walk.points);
      for (const edge of walk.trimEdges || []) drawRectEdge(this.map, walk, edge);
    }

    this.map.lineStyle(2, COLORS.sidewalkCurb, 0.68);
    for (const walk of visible) {
      const curbEdge = roadFacingEdge(walk);
      if (curbEdge) drawRectEdge(this.map, walk, curbEdge);
      for (const segment of walk.trimSegments || []) {
        if (!Array.isArray(segment) || segment.length !== 2) continue;
        this.map.lineBetween(segment[0].x, segment[0].y, segment[1].x, segment[1].y);
      }
    }

    this.map.lineStyle(2, COLORS.sidewalkCurb, 0.72);
    for (const cutout of cutouts) {
      const points = buildCornerArc(cutout);
      for (let index = 0; index < points.length - 1; index++) {
        this.map.lineBetween(points[index].x, points[index].y, points[index + 1].x, points[index + 1].y);
      }
    }
  };

  prototype.drawCrosswalkNetwork = function viceBloodDrawCrosswalkNetwork() {
    const visible = this.chunkItems("crosswalks", this.urbanRenderBounds, crosswalks, { margin: 10 });

    this.map.fillStyle(COLORS.crosswalkShadow, 0.22);
    for (const crossing of visible) this.map.fillRect(crossing.x, crossing.y, crossing.w, crossing.h);

    for (const crossing of visible) {
      const markings = buildCrosswalkMarkings(crossing);
      this.map.fillStyle(COLORS.crosswalk, 0.76);
      for (const stripe of markings.stripes) this.map.fillRect(stripe.x, stripe.y, stripe.w, stripe.h);
      if (markings.stopLine) {
        this.map.fillStyle(COLORS.crosswalk, 0.34);
        this.map.fillRect(markings.stopLine.x, markings.stopLine.y, markings.stopLine.w, markings.stopLine.h);
      }
      this.map.fillStyle(COLORS.tactilePaving, 0.74);
      for (const pad of markings.tactilePads) this.map.fillRect(pad.x, pad.y, pad.w, pad.h);
    }
  };
}
