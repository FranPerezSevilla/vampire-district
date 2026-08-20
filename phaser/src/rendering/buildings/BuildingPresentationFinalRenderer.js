import { MODULE_KINDS } from "./BuildingPresentationCatalog.js";
import { ROOF_SURFACE_KINDS } from "./BuildingVisualProfileCatalog.js";
import {
  clearBuildingPresentationCache as clearCompositionBuildingPresentationCache,
  drawBuildingPresentation as drawCompositionBuildingPresentation,
  renderBuildingPresentation as renderCompositionBuildingPresentation
} from "./BuildingPresentationCompositionRenderer.js";

const ROOFTOP_PROP_KINDS = new Set([
  MODULE_KINDS.SKYLIGHT,
  MODULE_KINDS.HVAC,
  MODULE_KINDS.VENT,
  MODULE_KINDS.HATCH,
  MODULE_KINDS.ANTENNA,
  MODULE_KINDS.SATELLITE_DISH
]);

function interpolateAtBoundary(start, end, axis, value) {
  const delta = Number(end?.[axis]) - Number(start?.[axis]);
  const ratio = Math.abs(delta) < 0.000001
    ? 0
    : (value - Number(start?.[axis])) / delta;
  return {
    x: Number(start?.x) + (Number(end?.x) - Number(start?.x)) * ratio,
    y: Number(start?.y) + (Number(end?.y) - Number(start?.y)) * ratio
  };
}

function clipPolygonAgainstBoundary(points, axis, value, keepGreater) {
  if (!Array.isArray(points) || points.length < 3) return [];
  const result = [];
  const inside = point => (
    keepGreater ? Number(point?.[axis]) >= value : Number(point?.[axis]) <= value
  );

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[(index + points.length - 1) % points.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);

    if (currentInside) {
      if (!previousInside) result.push(interpolateAtBoundary(previous, current, axis, value));
      result.push({ x: Number(current.x), y: Number(current.y) });
    } else if (previousInside) {
      result.push(interpolateAtBoundary(previous, current, axis, value));
    }
  }
  return result;
}

function clipPolygonToRect(points, rect) {
  let result = points.map(point => ({ x: Number(point.x), y: Number(point.y) }));
  result = clipPolygonAgainstBoundary(result, "x", rect.x, true);
  result = clipPolygonAgainstBoundary(result, "x", rect.x + rect.w, false);
  result = clipPolygonAgainstBoundary(result, "y", rect.y, true);
  result = clipPolygonAgainstBoundary(result, "y", rect.y + rect.h, false);
  return result.length >= 3 ? result : [];
}

function drawZone(graphics, points, color, alpha) {
  if (points.length < 3) return;
  graphics.fillStyle(color, alpha);
  graphics.fillPoints(points, true);
}

function isPitchedRoofMass(module) {
  return module?.kind === MODULE_KINDS.ROOF_MASS
    && module.surfaceKind === ROOF_SURFACE_KINDS.PITCHED
    && Array.isArray(module.points)
    && module.points.length >= 3
    && module.bounds;
}

function isNightRoofMass(module) {
  return module?.kind === MODULE_KINDS.ROOF_MASS
    && module.surfaceKind === ROOF_SURFACE_KINDS.NIGHT
    && Array.isArray(module.points)
    && module.points.length >= 3
    && module.bounds;
}

function ridgeCenters(plan, bounds) {
  const ridges = (plan.modules || []).filter(module => module.kind === MODULE_KINDS.ROOF_RIDGE);
  const vertical = ridges.find(module => (
    Math.abs(Number(module.y2) - Number(module.y1)) > Math.abs(Number(module.x2) - Number(module.x1))
  ));
  const horizontal = ridges.find(module => (
    Math.abs(Number(module.x2) - Number(module.x1)) >= Math.abs(Number(module.y2) - Number(module.y1))
  ));
  return {
    x: vertical ? (Number(vertical.x1) + Number(vertical.x2)) / 2 : bounds.x + bounds.w / 2,
    y: horizontal ? (Number(horizontal.y1) + Number(horizontal.y2)) / 2 : bounds.y + bounds.h / 2
  };
}

function drawPitchedRoofPlanes(graphics, module, plan, options) {
  renderCompositionBuildingPresentation(
    graphics,
    { ...plan, modules: [module] },
    options
  );

  const bounds = module.bounds;
  if (bounds.w < 48 || bounds.h < 48) return;
  const center = ridgeCenters(plan, bounds);
  const west = clipPolygonToRect(module.points, {
    x: bounds.x,
    y: bounds.y,
    w: Math.max(1, center.x - bounds.x),
    h: bounds.h
  });
  const east = clipPolygonToRect(module.points, {
    x: center.x,
    y: bounds.y,
    w: Math.max(1, bounds.x + bounds.w - center.x),
    h: bounds.h
  });
  const north = clipPolygonToRect(module.points, {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: Math.max(1, center.y - bounds.y)
  });
  const south = clipPolygonToRect(module.points, {
    x: bounds.x,
    y: center.y,
    w: bounds.w,
    h: Math.max(1, bounds.y + bounds.h - center.y)
  });

  drawZone(graphics, west, plan.palette.roofTextureHighlight, 0.04);
  drawZone(graphics, east, plan.palette.roofShade, 0.06);
  drawZone(graphics, north, plan.palette.roofTextureHighlight, 0.018);
  drawZone(graphics, south, plan.palette.roofShade, 0.03);
}

function largestRooftopProp(plan) {
  return (plan.modules || [])
    .filter(module => ROOFTOP_PROP_KINDS.has(module.kind) && module.bounds)
    .sort((a, b) => (
      Number(b.bounds.w) * Number(b.bounds.h) - Number(a.bounds.w) * Number(a.bounds.h)
    ))[0] || null;
}

function drawNightlifeRoofDeck(graphics, module, plan, options) {
  renderCompositionBuildingPresentation(
    graphics,
    { ...plan, modules: [module] },
    options
  );

  const bounds = module.bounds;
  if (bounds.w < 80 || bounds.h < 56) return;
  const hero = largestRooftopProp(plan);
  const roofCenterX = bounds.x + bounds.w / 2;
  const heroCenterX = hero?.bounds ? hero.bounds.x + hero.bounds.w / 2 : bounds.x;
  const placeEast = !hero?.bounds || heroCenterX <= roofCenterX;
  const margin = Math.max(6, Math.min(10, Math.min(bounds.w, bounds.h) * 0.08));
  const width = Math.max(24, Math.min(58, bounds.w * 0.24));
  const height = Math.max(24, Math.min(62, bounds.h * 0.54));
  const rect = {
    x: placeEast ? bounds.x + bounds.w - width - margin : bounds.x + margin,
    y: bounds.y + Math.max(margin, (bounds.h - height) * 0.44),
    w: width,
    h: height
  };
  const deck = clipPolygonToRect(module.points, rect);
  if (deck.length < 3) return;

  // The dark service deck balances the hero rooflight and creates one deliberate
  // asymmetry. It is material hierarchy, not a new gameplay module or neon box.
  drawZone(graphics, deck, plan.palette.serviceDark, 0.28);

  const lineY = rect.y + Math.min(rect.h - 2, 3);
  const lineInset = Math.max(3, rect.w * 0.18);
  graphics.lineStyle(1, plan.palette.accentSoft, 0.22);
  graphics.lineBetween(
    rect.x + lineInset,
    lineY,
    rect.x + rect.w - lineInset,
    lineY
  );
}

function isFinalTreatment(module) {
  return isPitchedRoofMass(module) || isNightRoofMass(module);
}

function renderWithFinalTreatments(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  const modules = plan.modules || [];
  if (!modules.some(isFinalTreatment)) {
    return renderCompositionBuildingPresentation(graphics, plan, options);
  }

  for (const module of modules) {
    if (isPitchedRoofMass(module)) {
      drawPitchedRoofPlanes(graphics, module, plan, options);
      continue;
    }
    if (isNightRoofMass(module)) {
      drawNightlifeRoofDeck(graphics, module, plan, options);
      continue;
    }
    renderCompositionBuildingPresentation(
      graphics,
      { ...plan, modules: [module] },
      options
    );
  }
  return plan;
}

export function clearBuildingPresentationCache(building) {
  clearCompositionBuildingPresentationCache(building);
}

export function renderBuildingPresentation(graphics, plan, options = {}) {
  return renderWithFinalTreatments(graphics, plan, options);
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = drawCompositionBuildingPresentation(null, building, options);
  if (graphics && plan) renderWithFinalTreatments(graphics, plan, options);
  return plan;
}
