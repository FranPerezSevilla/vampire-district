import { COLORS } from "../data/balance.js";
import { buildings, crosswalks, LAYERS, roads, sidewalks } from "../data/district.js";

const OPEN_GROUND_GRID = 64;
const OPEN_GROUND_MAJOR_EVERY = 4;
const OPEN_GROUND_DETAIL_CELL = 176;
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

export function buildOpenGroundDetails(bounds, { cellSize = OPEN_GROUND_DETAIL_CELL } = {}) {
  const safeCell = Math.max(96, finite(cellSize, OPEN_GROUND_DETAIL_CELL));
  const panels = [];
  const scuffs = [];
  const startX = Math.floor(finite(bounds.x) / safeCell) * safeCell;
  const startY = Math.floor(finite(bounds.y) / safeCell) * safeCell;

  for (let cellY = startY; cellY < bottom(bounds); cellY += safeCell) {
    for (let cellX = startX; cellX < right(bounds); cellX += safeCell) {
      const seed = hashString(`${cellX}:${cellY}:open-ground`);
      if (seed % 5 <= 2) {
        const insetX = 14 + (seed % 19);
        const insetY = 12 + ((seed >>> 5) % 23);
        const width = safeCell * (0.48 + ((seed >>> 10) % 20) / 100);
        const height = safeCell * (0.30 + ((seed >>> 15) % 18) / 100);
        const panel = clippedRect({
          x: cellX + insetX,
          y: cellY + insetY,
          w: Math.min(width, safeCell - insetX - 10),
          h: Math.min(height, safeCell - insetY - 10)
        }, bounds);
        if (panel && panel.w > 18 && panel.h > 12) panels.push(panel);
      }

      const scuffCount = 1 + ((seed >>> 20) % 2);
      for (let index = 0; index < scuffCount; index++) {
        const detailSeed = hashString(`${cellX}:${cellY}:scuff:${index}`);
        const x = cellX + 18 + (detailSeed % Math.max(20, Math.floor(safeCell - 56)));
        const y = cellY + 18 + ((detailSeed >>> 7) % Math.max(20, Math.floor(safeCell - 56)));
        const length = 12 + ((detailSeed >>> 13) % 26);
        const horizontal = (detailSeed & 1) === 0;
        const segment = horizontal
          ? line(x, y, x + length, y)
          : line(x, y, x, y + length);
        const clipped = {
          x1: Math.max(bounds.x, Math.min(right(bounds), segment.x1)),
          y1: Math.max(bounds.y, Math.min(bottom(bounds), segment.y1)),
          x2: Math.max(bounds.x, Math.min(right(bounds), segment.x2)),
          y2: Math.max(bounds.y, Math.min(bottom(bounds), segment.y2))
        };
        if (Math.hypot(clipped.x2 - clipped.x1, clipped.y2 - clipped.y1) > 4) scuffs.push(clipped);
      }
    }
  }

  return { panels, scuffs };
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
  const radius = Math.max(5, Math.min(8, finite(walk.w) * 0.34, finite(walk.h) * 0.34));
  if (walk.corner === "nw") {
    return {
      x: right(walk) - radius,
      y: bottom(walk) - radius,
      vertexX: right(walk),
      vertexY: bottom(walk),
      radius,
      corner: walk.corner
    };
  }
  if (walk.corner === "ne") {
    return {
      x: finite(walk.x) + radius,
      y: bottom(walk) - radius,
      vertexX: finite(walk.x),
      vertexY: bottom(walk),
      radius,
      corner: walk.corner
    };
  }
  if (walk.corner === "se") {
    return {
      x: finite(walk.x) + radius,
      y: finite(walk.y) + radius,
      vertexX: finite(walk.x),
      vertexY: finite(walk.y),
      radius,
      corner: walk.corner
    };
  }
  if (walk.corner === "sw") {
    return {
      x: right(walk) - radius,
      y: finite(walk.y) + radius,
      vertexX: right(walk),
      vertexY: finite(walk.y),
      radius,
      corner: walk.corner
    };
  }
  return null;
}

export function buildCornerArc(cutout, segments = 8) {
  if (!cutout) return [];
  const ranges = {
    nw: [0, Math.PI * 0.5],
    ne: [Math.PI * 0.5, Math.PI],
    se: [Math.PI, Math.PI * 1.5],
    sw: [Math.PI * 1.5, Math.PI * 2]
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

export function buildCornerCutoutPolygon(cutout, segments = 8) {
  if (!cutout) return [];
  return [
    { x: cutout.vertexX, y: cutout.vertexY },
    ...buildCornerArc(cutout, segments)
  ];
}

export function buildCornerCurbSegments(walk, cutout = buildCornerCutout(walk)) {
  if (!walk || !cutout) return [];
  if (walk.corner === "nw") {
    return [
      line(walk.x, bottom(walk), cutout.x, bottom(walk)),
      line(right(walk), walk.y, right(walk), cutout.y)
    ];
  }
  if (walk.corner === "ne") {
    return [
      line(cutout.x, bottom(walk), right(walk), bottom(walk)),
      line(walk.x, walk.y, walk.x, cutout.y)
    ];
  }
  if (walk.corner === "se") {
    return [
      line(cutout.x, walk.y, right(walk), walk.y),
      line(walk.x, cutout.y, walk.x, bottom(walk))
    ];
  }
  if (walk.corner === "sw") {
    return [
      line(walk.x, walk.y, cutout.x, walk.y),
      line(right(walk), cutout.y, right(walk), bottom(walk))
    ];
  }
  return [];
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

export function buildMajorRoadCentreSegments(road, fragment, {
  approachInset = 12,
  minimumPaintLength = 146,
  paintVariance = 118,
  minimumWearGap = 2,
  wearGapVariance = 5,
  lineThickness = 2.25,
  lineSeparation = 1.25
} = {}) {
  if (!road || !fragment) return [];
  const horizontal = road.orientation === "horizontal" || road.w > road.h;
  const axisStart = horizontal ? finite(road.x) : finite(road.y);
  const axisEnd = horizontal ? right(road) : bottom(road);
  const fragmentStart = horizontal ? finite(fragment.x) : finite(fragment.y);
  const fragmentEnd = horizontal ? right(fragment) : bottom(fragment);
  if (axisEnd <= axisStart || fragmentEnd <= fragmentStart) return [];

  const centre = horizontal ? road.y + road.h / 2 : road.x + road.w / 2;
  const laneOffsets = [
    -(lineSeparation / 2 + lineThickness),
    lineSeparation / 2
  ];
  const segments = [];

  for (let laneIndex = 0; laneIndex < 2; laneIndex++) {
    const laneSeed = hashString(`${road.id}:major-paint:lane:${laneIndex}`);
    const roadStart = axisStart + approachInset + (laneSeed % 5);
    const roadEnd = axisEnd - approachInset - ((laneSeed >>> 4) % 8);
    if (roadEnd <= roadStart) continue;

    let cursor = roadStart + ((laneSeed >>> 8) % 6);
    let index = 0;
    while (cursor < roadEnd) {
      const seed = hashString(`${road.id}:major-paint:${laneIndex}:${index}`);
      const laneBias = laneIndex === 0 ? 18 : 0;
      const paintLength = minimumPaintLength + laneBias + (seed % Math.max(1, Math.round(paintVariance)));
      const wearGap = minimumWearGap + ((seed >>> 9) % Math.max(1, Math.round(wearGapVariance)));
      const paintEnd = Math.min(roadEnd, cursor + paintLength);
      const visibleStart = Math.max(cursor, fragmentStart);
      const visibleEnd = Math.min(paintEnd, fragmentEnd);
      if (visibleEnd > visibleStart) {
        const alpha = 0.62 + ((seed >>> 16) % 17) / 100;
        const offset = laneOffsets[laneIndex];
        segments.push(horizontal
          ? {
              x: visibleStart,
              y: centre + offset,
              w: visibleEnd - visibleStart,
              h: lineThickness,
              alpha,
              laneIndex
            }
          : {
              x: centre + offset,
              y: visibleStart,
              w: lineThickness,
              h: visibleEnd - visibleStart,
              alpha,
              laneIndex
            });
      }
      cursor = paintEnd + wearGap;
      index += 1;
    }
  }

  return segments;
}

export function buildLocalRoadDashSegments(road, fragment, {
  minimumDashLength = 12,
  dashVariance = 10,
  minimumGap = 17,
  gapVariance = 13,
  thickness = 2
} = {}) {
  if (!road || !fragment) return [];
  const horizontal = road.orientation === "horizontal" || road.w > road.h;
  const fragmentStart = horizontal ? finite(fragment.x) : finite(fragment.y);
  const fragmentEnd = horizontal ? right(fragment) : bottom(fragment);
  const roadStart = horizontal ? finite(road.x) : finite(road.y);
  const phaseSeed = hashString(`${road.id}:local-dashes`);
  const centre = horizontal ? road.y + Math.floor(road.h / 2) : road.x + Math.floor(road.w / 2);
  const segments = [];
  let cursor = roadStart + (phaseSeed % 19);
  let index = 0;

  while (cursor < fragmentEnd) {
    const seed = hashString(`${road.id}:local-dash:${index}`);
    const dashLength = minimumDashLength + (seed % Math.max(1, Math.round(dashVariance)));
    const gap = minimumGap + ((seed >>> 8) % Math.max(1, Math.round(gapVariance)));
    const dashEnd = cursor + dashLength;
    const visibleStart = Math.max(cursor, fragmentStart);
    const visibleEnd = Math.min(dashEnd, fragmentEnd);
    if (visibleEnd > visibleStart) {
      const alpha = 0.54 + ((seed >>> 15) % 15) / 100;
      segments.push(horizontal
        ? { x: visibleStart, y: centre - thickness / 2, w: visibleEnd - visibleStart, h: thickness, alpha }
        : { x: centre - thickness / 2, y: visibleStart, w: thickness, h: visibleEnd - visibleStart, alpha });
    }
    cursor = dashEnd + gap;
    index += 1;
  }

  return segments;
}

function drawLine(graphics, segment) {
  graphics.lineBetween(segment.x1, segment.y1, segment.x2, segment.y2);
}

function rectEdgeSegment(rect, edge) {
  if (edge === "north") return line(rect.x, rect.y, right(rect), rect.y);
  if (edge === "south") return line(rect.x, bottom(rect), right(rect), bottom(rect));
  if (edge === "west") return line(rect.x, rect.y, rect.x, bottom(rect));
  if (edge === "east") return line(right(rect), rect.y, right(rect), bottom(rect));
  return null;
}

function drawRectEdge(graphics, rect, edge) {
  const segment = rectEdgeSegment(rect, edge);
  if (segment) drawLine(graphics, segment);
}

function roadFacingEdge(walk) {
  if (walk.side === "north") return "south";
  if (walk.side === "south") return "north";
  if (walk.side === "west") return "east";
  if (walk.side === "east") return "west";
  return null;
}

function segmentKey(segment) {
  const first = `${segment.x1}:${segment.y1}`;
  const second = `${segment.x2}:${segment.y2}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

export function buildSidewalkCurbSegments(walk) {
  if (!walk) return [];
  if (walk.role === "corner") return buildCornerCurbSegments(walk);

  const candidates = [];
  const curbEdge = roadFacingEdge(walk);
  if (curbEdge) {
    const segment = rectEdgeSegment(walk, curbEdge);
    if (segment) candidates.push(segment);
  }

  for (const edge of walk.trimEdges || []) {
    const segment = rectEdgeSegment(walk, edge);
    if (segment) candidates.push(segment);
  }

  for (const segment of walk.trimSegments || []) {
    if (!Array.isArray(segment) || segment.length !== 2) continue;
    candidates.push(line(segment[0].x, segment[0].y, segment[1].x, segment[1].y));
  }

  const unique = new Map();
  for (const segment of candidates) unique.set(segmentKey(segment), segment);
  return [...unique.values()];
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
  for (const dash of buildLocalRoadDashSegments(road, fragment)) {
    graphics.fillStyle(COLORS.roadStripe, dash.alpha);
    graphics.fillRect(dash.x, dash.y, dash.w, dash.h);
  }
}

function drawMajorRoadCentre(graphics, road, fragment) {
  for (const paint of buildMajorRoadCentreSegments(road, fragment)) {
    graphics.fillStyle(COLORS.roadMajorStripe, paint.alpha);
    graphics.fillRect(paint.x, paint.y, paint.w, paint.h);
  }
}

export function installCitySurfacePresentationPolicy(GameSceneClass) {
  const prototype = GameSceneClass?.prototype;
  if (!prototype || prototype.__viceCitySurfacePresentationPolicy) return;
  prototype.__viceCitySurfacePresentationPolicy = true;

  prototype.drawOpenGroundWindow = function viceBloodDrawOpenGroundWindow(bounds) {
    const details = buildOpenGroundDetails(bounds);
    this.map.fillStyle(COLORS.streetGridMajor, 0.045);
    for (const panel of details.panels) this.map.fillRect(panel.x, panel.y, panel.w, panel.h);

    const lines = buildStreetGridLines(bounds);
    this.map.lineStyle(1, COLORS.streetGrid, 0.09);
    for (const segment of lines.filter(candidate => !candidate.major)) drawLine(this.map, segment);
    this.map.lineStyle(1, COLORS.streetGridMajor, 0.14);
    for (const segment of lines.filter(candidate => candidate.major)) drawLine(this.map, segment);

    this.map.lineStyle(1, COLORS.roadWear, 0.30);
    for (const segment of details.scuffs) drawLine(this.map, segment);
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
    this.map.fillStyle(COLORS.roadEdge, 0.24);
    if (horizontal) {
      this.map.fillRect(fragment.x, road.y, fragment.w, 2);
      this.map.fillRect(fragment.x, road.y + road.h - 2, fragment.w, 2);
    } else {
      this.map.fillRect(road.x, fragment.y, 2, fragment.h);
      this.map.fillRect(road.x + road.w - 2, fragment.y, 2, fragment.h);
    }

    if (inferredRoadClass(road) !== "alley") {
      this.map.fillStyle(COLORS.sidewalkCurb, 0.34);
      if (horizontal) {
        this.map.fillRect(fragment.x, road.y, fragment.w, 1);
        this.map.fillRect(fragment.x, road.y + road.h - 1, fragment.w, 1);
      } else {
        this.map.fillRect(road.x, fragment.y, 1, fragment.h);
        this.map.fillRect(road.x + road.w - 1, fragment.y, 1, fragment.h);
      }
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

    const cornerEntries = visible
      .filter(walk => walk.role === "corner")
      .map(walk => ({ walk, cutout: buildCornerCutout(walk) }))
      .filter(entry => entry.cutout);
    this.map.fillStyle(COLORS.road, 1);
    for (const { cutout } of cornerEntries) {
      const polygon = buildCornerCutoutPolygon(cutout);
      if (polygon.length >= 3) this.map.fillPoints(polygon, true);
    }

    this.map.lineStyle(1, COLORS.sidewalkJoint, 0.42);
    for (const walk of visible) {
      for (const segment of buildSidewalkJointSegments(walk, this.urbanRenderBounds)) drawLine(this.map, segment);
    }

    this.map.lineStyle(1, COLORS.sidewalkTrim, 0.38);
    for (const walk of visible) {
      if (walk.role === "corner") continue;
      if (walk.geometry === "polygon" && Array.isArray(walk.points)) drawPolygonOutline(this.map, walk.points);
      for (const edge of walk.trimEdges || []) drawRectEdge(this.map, walk, edge);
    }

    this.map.lineStyle(2, COLORS.sidewalkCurb, 0.76);
    for (const walk of visible) {
      if (walk.role === "corner") continue;
      for (const segment of buildSidewalkCurbSegments(walk)) drawLine(this.map, segment);
    }

    for (const { walk, cutout } of cornerEntries) {
      for (const segment of buildCornerCurbSegments(walk, cutout)) drawLine(this.map, segment);
      const points = buildCornerArc(cutout);
      for (let index = 0; index < points.length - 1; index++) {
        this.map.lineBetween(points[index].x, points[index].y, points[index + 1].x, points[index + 1].y);
      }
    }
  };

  prototype.drawCrosswalkNetwork = function viceBloodDrawCrosswalkNetwork() {
    const visible = this.chunkItems("crosswalks", this.urbanRenderBounds, crosswalks, { margin: 10 });

    this.map.fillStyle(COLORS.crosswalkShadow, 0.20);
    for (const crossing of visible) this.map.fillRect(crossing.x, crossing.y, crossing.w, crossing.h);

    for (const crossing of visible) {
      const markings = buildCrosswalkMarkings(crossing);
      this.map.fillStyle(COLORS.crosswalk, 0.72);
      for (const stripe of markings.stripes) this.map.fillRect(stripe.x, stripe.y, stripe.w, stripe.h);
      if (markings.stopLine) {
        this.map.fillStyle(COLORS.crosswalk, 0.30);
        this.map.fillRect(markings.stopLine.x, markings.stopLine.y, markings.stopLine.w, markings.stopLine.h);
      }
      this.map.fillStyle(COLORS.tactilePaving, 0.62);
      for (const pad of markings.tactilePads) this.map.fillRect(pad.x, pad.y, pad.w, pad.h);
    }
  };
}
