import {
  FRONTAGE_KINDS,
  MODULE_KINDS
} from "./BuildingPresentationCatalog.js";
import { createBuildingPresentationPlan } from "./BuildingPresentationPlanner.js";

const BUILDING_PLAN_CACHE = new WeakMap();

function planningOptionsKey(options = {}) {
  return JSON.stringify({
    archetype: options.archetype || null,
    layoutId: options.layoutId || null,
    frontage: options.frontage || null,
    frontageEdge: options.frontageEdge || null,
    frontageOffset: options.frontageOffset ?? null,
    detailLevel: options.detailLevel || null,
    seed: options.seed ?? null,
    propKinds: Array.isArray(options.propKinds) ? options.propKinds : null
  });
}

function cachedBuildingPlan(building, options = {}) {
  if (!building || typeof building !== "object" || options.cache === false) {
    return createBuildingPresentationPlan(building, options);
  }
  const key = planningOptionsKey(options);
  let entries = BUILDING_PLAN_CACHE.get(building);
  if (!entries) {
    entries = new Map();
    BUILDING_PLAN_CACHE.set(building, entries);
  }
  if (!entries.has(key)) entries.set(key, createBuildingPresentationPlan(building, options));
  return entries.get(key);
}

export function clearBuildingPresentationCache(building) {
  if (building && typeof building === "object") BUILDING_PLAN_CACHE.delete(building);
}

function drawRect(graphics, bounds, color, alpha = 1) {
  graphics.fillStyle(color, alpha);
  graphics.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
}

function strokeRect(graphics, bounds, width, color, alpha = 1) {
  graphics.lineStyle(width, color, alpha);
  graphics.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
}

function centerOf(bounds) {
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

function drawFoundation(graphics, module, plan) {
  const { bounds } = module;
  const palette = plan.palette;
  drawRect(graphics, bounds, palette.foundation, 1);

  const drop = Math.max(2, Math.min(6, Math.floor(Math.min(bounds.w, bounds.h) * 0.035)));
  drawRect(graphics, {
    x: bounds.x,
    y: bounds.y + bounds.h - drop,
    w: bounds.w,
    h: drop
  }, palette.foundationShadow, 0.9);
  drawRect(graphics, {
    x: bounds.x + bounds.w - drop,
    y: bounds.y,
    w: drop,
    h: bounds.h
  }, palette.foundationShadow, 0.72);

  strokeRect(graphics, bounds, 2, palette.parapetDark, 0.95);
  const inner = {
    x: bounds.x + 3,
    y: bounds.y + 3,
    w: Math.max(1, bounds.w - 6),
    h: Math.max(1, bounds.h - 6)
  };
  strokeRect(graphics, inner, 1, palette.parapetLight, 0.28);
}

function drawRoofCell(graphics, module, plan) {
  const palette = plan.palette;
  const alternate = (module.row + module.column) % 2 === 0;
  drawRect(graphics, module.bounds, alternate ? palette.roof : palette.roofRaised, 1);
}

function drawParapetEdge(graphics, module, plan) {
  const lightFacing = module.orientation === "north" || module.orientation === "west";
  graphics.lineStyle(
    lightFacing ? 3 : 4,
    lightFacing ? plan.palette.parapetLight : plan.palette.parapetDark,
    lightFacing ? 0.92 : 0.96
  );
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);

  if (!lightFacing) {
    const offset = 2;
    const x1 = module.x1 - (module.orientation === "east" ? offset : 0);
    const x2 = module.x2 - (module.orientation === "east" ? offset : 0);
    const y1 = module.y1 - (module.orientation === "south" ? offset : 0);
    const y2 = module.y2 - (module.orientation === "south" ? offset : 0);
    graphics.lineStyle(1, plan.palette.seam, 0.32);
    graphics.lineBetween(x1, y1, x2, y2);
  }
}

function outerEdgeBand(module, thickness = 3) {
  const { bounds, edge } = module;
  if (edge === "north") return { x: bounds.x, y: bounds.y, w: bounds.w, h: thickness };
  if (edge === "east") return { x: bounds.x + bounds.w - thickness, y: bounds.y, w: thickness, h: bounds.h };
  if (edge === "west") return { x: bounds.x, y: bounds.y, w: thickness, h: bounds.h };
  return { x: bounds.x, y: bounds.y + bounds.h - thickness, w: bounds.w, h: thickness };
}

function innerEdgeBand(module, thickness = 3) {
  const { bounds, edge } = module;
  if (edge === "north") return { x: bounds.x, y: bounds.y + bounds.h - thickness, w: bounds.w, h: thickness };
  if (edge === "east") return { x: bounds.x, y: bounds.y, w: thickness, h: bounds.h };
  if (edge === "west") return { x: bounds.x + bounds.w - thickness, y: bounds.y, w: thickness, h: bounds.h };
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: thickness };
}

function drawGenericFrontage(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.propDark, 1);
  strokeRect(graphics, module.bounds, 2, plan.palette.parapetLight, 0.72);
  drawRect(graphics, outerEdgeBand(module, 3), plan.palette.foundationShadow, 1);
  drawRect(graphics, innerEdgeBand(module, 2), plan.palette.seam, 0.5);
}

function drawPoliceFrontage(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.prop, 1);
  strokeRect(graphics, module.bounds, 2, plan.palette.parapetLight, 0.95);
  drawRect(graphics, outerEdgeBand(module, 3), plan.palette.accent, 0.95);
  drawRect(graphics, innerEdgeBand(module, 2), plan.palette.accentSoft, 0.8);

  const center = centerOf(module.bounds);
  const radius = Math.max(3, Math.min(module.bounds.w, module.bounds.h) * 0.22);
  graphics.fillStyle(plan.palette.accentSoft, 1);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.lineStyle(1, plan.palette.label, 0.9);
  graphics.strokeCircle(center.x, center.y, radius);
  graphics.lineBetween(center.x - radius * 0.62, center.y, center.x + radius * 0.62, center.y);
  graphics.lineBetween(center.x, center.y - radius * 0.62, center.x, center.y + radius * 0.62);
}

function drawClubFrontage(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.foundationShadow, 1);
  strokeRect(graphics, module.bounds, 2, plan.palette.accent, 0.95);
  drawRect(graphics, outerEdgeBand(module, 3), plan.palette.accent, 0.92);

  const center = centerOf(module.bounds);
  const scale = Math.max(4, Math.min(module.bounds.w, module.bounds.h) * 0.3);
  graphics.lineStyle(2, plan.palette.label, 0.94);
  graphics.lineBetween(center.x - scale, center.y - scale * 0.45, center.x + scale, center.y - scale * 0.45);
  graphics.lineBetween(center.x - scale, center.y - scale * 0.45, center.x, center.y + scale * 0.08);
  graphics.lineBetween(center.x + scale, center.y - scale * 0.45, center.x, center.y + scale * 0.08);
  graphics.lineBetween(center.x, center.y + scale * 0.08, center.x, center.y + scale * 0.72);
  graphics.lineBetween(center.x - scale * 0.55, center.y + scale * 0.72, center.x + scale * 0.55, center.y + scale * 0.72);
}

function drawChurchFrontage(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.roofShade, 1);
  strokeRect(graphics, module.bounds, 2, plan.palette.parapetLight, 0.82);
  drawRect(graphics, outerEdgeBand(module, 3), plan.palette.foundationShadow, 1);

  const center = centerOf(module.bounds);
  const size = Math.max(5, Math.min(module.bounds.w, module.bounds.h) * 0.34);
  drawRect(graphics, {
    x: center.x - size * 0.12,
    y: center.y - size * 0.65,
    w: size * 0.24,
    h: size * 1.3
  }, plan.palette.accent, 0.95);
  drawRect(graphics, {
    x: center.x - size * 0.48,
    y: center.y - size * 0.18,
    w: size * 0.96,
    h: size * 0.24
  }, plan.palette.accent, 0.95);
}

function drawFrontage(graphics, module, plan) {
  if (module.variant === FRONTAGE_KINDS.POLICE) drawPoliceFrontage(graphics, module, plan);
  else if (module.variant === FRONTAGE_KINDS.CLUB) drawClubFrontage(graphics, module, plan);
  else if (module.variant === FRONTAGE_KINDS.CHURCH) drawChurchFrontage(graphics, module, plan);
  else drawGenericFrontage(graphics, module, plan);
}

function drawSkylight(graphics, module, plan) {
  const { bounds } = module;
  drawRect(graphics, bounds, plan.palette.glass, 1);
  strokeRect(graphics, bounds, 2, plan.palette.propDark, 0.95);
  const columns = bounds.w >= 28 ? 3 : 2;
  const rows = bounds.h >= 18 ? 2 : 1;
  graphics.lineStyle(1, plan.palette.glassHighlight, 0.52);
  for (let column = 1; column < columns; column += 1) {
    const x = bounds.x + bounds.w * column / columns;
    graphics.lineBetween(x, bounds.y + 2, x, bounds.y + bounds.h - 2);
  }
  for (let row = 1; row < rows; row += 1) {
    const y = bounds.y + bounds.h * row / rows;
    graphics.lineBetween(bounds.x + 2, y, bounds.x + bounds.w - 2, y);
  }
}

function drawHvac(graphics, module, plan) {
  const { bounds } = module;
  drawRect(graphics, bounds, plan.palette.prop, 1);
  strokeRect(graphics, bounds, 1, plan.palette.propDark, 1);
  const fanCount = bounds.w >= bounds.h * 1.45 ? 2 : 1;
  const radius = Math.max(2, Math.min(bounds.h * 0.28, bounds.w / (fanCount * 2.8)));
  for (let index = 0; index < fanCount; index += 1) {
    const x = bounds.x + bounds.w * (index + 1) / (fanCount + 1);
    const y = bounds.y + bounds.h / 2;
    graphics.fillStyle(plan.palette.propDark, 0.9);
    graphics.fillCircle(x, y, radius);
    graphics.lineStyle(1, plan.palette.parapetLight, 0.45);
    graphics.strokeCircle(x, y, radius);
  }
}

function drawVent(graphics, module, plan) {
  const center = centerOf(module.bounds);
  const radius = Math.max(2, Math.min(module.bounds.w, module.bounds.h) / 2);
  graphics.fillStyle(plan.palette.propDark, 1);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.fillStyle(plan.palette.prop, 0.92);
  graphics.fillCircle(center.x - radius * 0.16, center.y - radius * 0.16, radius * 0.55);
}

function drawHatch(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.propDark, 1);
  strokeRect(graphics, module.bounds, 1, plan.palette.prop, 0.92);
  const inner = {
    x: module.bounds.x + 2,
    y: module.bounds.y + 2,
    w: Math.max(1, module.bounds.w - 4),
    h: Math.max(1, module.bounds.h - 4)
  };
  strokeRect(graphics, inner, 1, plan.palette.seam, 0.54);
}

function drawAntenna(graphics, module, plan) {
  const center = centerOf(module.bounds);
  const radius = Math.max(2, Math.min(module.bounds.w, module.bounds.h) * 0.24);
  graphics.fillStyle(plan.palette.propDark, 1);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.lineStyle(1, plan.palette.prop, 0.9);
  graphics.lineBetween(center.x, center.y - radius, center.x, module.bounds.y);
  graphics.lineBetween(center.x, center.y, module.bounds.x, module.bounds.y + module.bounds.h);
  graphics.lineBetween(center.x, center.y, module.bounds.x + module.bounds.w, module.bounds.y + module.bounds.h);
}

function drawSatelliteDish(graphics, module, plan) {
  const center = centerOf(module.bounds);
  const radius = Math.max(3, Math.min(module.bounds.w, module.bounds.h) * 0.42);
  graphics.fillStyle(plan.palette.prop, 0.95);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.fillStyle(plan.palette.roofShade, 1);
  graphics.fillCircle(center.x + radius * 0.34, center.y - radius * 0.18, radius * 0.72);
  graphics.lineStyle(1, plan.palette.propDark, 0.9);
  graphics.lineBetween(center.x, center.y, module.bounds.x + module.bounds.w, module.bounds.y + module.bounds.h);
}

function drawAccentStrip(graphics, module, plan) {
  graphics.lineStyle(module.variant === "club" ? 3 : 2, plan.palette.accent, module.variant === "club" ? 0.9 : 0.82);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
}

function drawRoofRidge(graphics, module, plan) {
  graphics.lineStyle(2, plan.palette.parapetLight, 0.42);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
  graphics.lineStyle(1, plan.palette.roofShade, 0.85);
  graphics.lineBetween(module.x1 + 1, module.y1 + 1, module.x2 + 1, module.y2 + 1);
}

function drawCrossMarker(graphics, module, plan) {
  const { bounds } = module;
  const center = centerOf(bounds);
  const thickness = Math.max(2, Math.floor(Math.min(bounds.w, bounds.h) * 0.18));
  drawRect(graphics, {
    x: center.x - thickness / 2,
    y: bounds.y,
    w: thickness,
    h: bounds.h
  }, plan.palette.accent, 0.95);
  drawRect(graphics, {
    x: bounds.x,
    y: center.y - thickness / 2,
    w: bounds.w,
    h: thickness
  }, plan.palette.accent, 0.95);
}

function drawYard(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.yard, 1);
  strokeRect(graphics, module.bounds, 1, plan.palette.fence, 0.8);
}

function drawFence(graphics, module, plan) {
  if (Number.isFinite(module.x1) && Number.isFinite(module.y1)
    && Number.isFinite(module.x2) && Number.isFinite(module.y2)) {
    graphics.lineStyle(2, plan.palette.fence, 0.9);
    graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
  } else if (module.bounds) {
    strokeRect(graphics, module.bounds, 2, plan.palette.fence, 0.9);
  }
}

const MODULE_RENDERERS = {
  [MODULE_KINDS.FOUNDATION]: drawFoundation,
  [MODULE_KINDS.ROOF_CELL]: drawRoofCell,
  [MODULE_KINDS.PARAPET_EDGE]: drawParapetEdge,
  [MODULE_KINDS.FRONTAGE]: drawFrontage,
  [MODULE_KINDS.SKYLIGHT]: drawSkylight,
  [MODULE_KINDS.HVAC]: drawHvac,
  [MODULE_KINDS.VENT]: drawVent,
  [MODULE_KINDS.HATCH]: drawHatch,
  [MODULE_KINDS.ANTENNA]: drawAntenna,
  [MODULE_KINDS.SATELLITE_DISH]: drawSatelliteDish,
  [MODULE_KINDS.ACCENT_STRIP]: drawAccentStrip,
  [MODULE_KINDS.ROOF_RIDGE]: drawRoofRidge,
  [MODULE_KINDS.CROSS_MARKER]: drawCrossMarker,
  [MODULE_KINDS.YARD]: drawYard,
  [MODULE_KINDS.FENCE]: drawFence
};

function drawDebugBounds(graphics, module) {
  if (!module.bounds) return;
  graphics.lineStyle(1, 0xffd65c, 0.45);
  graphics.strokeRect(module.bounds.x, module.bounds.y, module.bounds.w, module.bounds.h);
}

export function renderBuildingPresentation(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  for (const module of plan.modules || []) {
    const renderer = MODULE_RENDERERS[module.kind];
    if (renderer) renderer(graphics, module, plan, options);
    if (options.showModuleBounds) drawDebugBounds(graphics, module);
  }
  return plan;
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = cachedBuildingPlan(building, options);
  return renderBuildingPresentation(graphics, plan, options);
}
