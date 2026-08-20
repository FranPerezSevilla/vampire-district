import { MODULE_KINDS } from "./BuildingPresentationCatalog.js";
import { ROOF_SURFACE_KINDS } from "./BuildingVisualProfileCatalog.js";
import {
  clearBuildingPresentationCache as clearDetailedBuildingPresentationCache,
  drawBuildingPresentation as drawDetailedBuildingPresentation,
  renderBuildingPresentation as renderDetailedBuildingPresentation
} from "./BuildingPresentationDetailRenderer.js";

function membraneSeamIndex(module) {
  const match = /:membrane:h:(\d+)$/.exec(String(module?.id || ""));
  if (match) return Number(match[1]);

  const values = [module?.x1, module?.y1, module?.x2, module?.y2]
    .map(value => Number(value) || 0);
  return Math.abs(Math.round(
    values[0] * 3 + values[1] * 5 + values[2] * 7 + values[3] * 11
  ));
}

function membraneSeamTreatment(module) {
  const phase = membraneSeamIndex(module) % 3;
  if (phase === 1) return { seamAlpha: 0.09, highlightAlpha: 0.022 };
  if (phase === 2) return { seamAlpha: 0.11, highlightAlpha: 0.03 };
  return { seamAlpha: 0.13, highlightAlpha: 0.038 };
}

function isMembraneSeam(module) {
  return module?.kind === MODULE_KINDS.ROOF_TEXTURE_LINE
    && module.variant === ROOF_SURFACE_KINDS.MEMBRANE;
}

function drawMembraneSeam(graphics, module, plan) {
  const treatment = membraneSeamTreatment(module);
  const horizontal = Math.abs(Number(module.x2) - Number(module.x1))
    >= Math.abs(Number(module.y2) - Number(module.y1));
  const highlightOffset = horizontal ? { x: 0, y: -1 } : { x: -1, y: 0 };

  // Keep the planner-owned seam exactly where it was authored. A faint offset
  // highlight and deterministic low-amplitude tone variation make the seam read
  // as a membrane fold rather than a uniform diagram line.
  graphics.lineStyle(1, plan.palette.roofTexture, treatment.seamAlpha);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);

  graphics.lineStyle(0.75, plan.palette.roofTextureHighlight, treatment.highlightAlpha);
  graphics.lineBetween(
    module.x1 + highlightOffset.x,
    module.y1 + highlightOffset.y,
    module.x2 + highlightOffset.x,
    module.y2 + highlightOffset.y
  );
}

function isCivicSurfaceJoint(module) {
  return module?.kind === MODULE_KINDS.ROOF_TEXTURE_LINE
    && module.variant === ROOF_SURFACE_KINDS.CIVIC;
}

function civicJointOrientation(module) {
  const horizontalLength = Math.abs(Number(module?.x2) - Number(module?.x1));
  const verticalLength = Math.abs(Number(module?.y2) - Number(module?.y1));
  return horizontalLength >= verticalLength ? "horizontal" : "vertical";
}

function drawCivicSurfaceJoint(graphics, module, plan) {
  const orientation = civicJointOrientation(module);

  if (orientation === "horizontal") {
    // Civic roofs use one primary ordering joint rather than a uniform grid.
    // The original planner coordinate remains the structural line; the tiny
    // north-side highlight only separates the joint from the roof material.
    graphics.lineStyle(1, plan.palette.roofTexture, 0.115);
    graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
    graphics.lineStyle(0.75, plan.palette.roofTextureHighlight, 0.028);
    graphics.lineBetween(module.x1, module.y1 - 1, module.x2, module.y2 - 1);
    return;
  }

  // The secondary cross-axis joint is deliberately quieter. Keeping it as a
  // single low-contrast line preserves civic order without decorative lattice.
  graphics.lineStyle(0.75, plan.palette.roofTexture, 0.06);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
}

function isPitchedRoofRidge(module) {
  return module?.kind === MODULE_KINDS.ROOF_RIDGE;
}

function pitchedRidgeOrientation(module) {
  const horizontalLength = Math.abs(Number(module?.x2) - Number(module?.x1));
  const verticalLength = Math.abs(Number(module?.y2) - Number(module?.y1));
  return horizontalLength >= verticalLength ? "horizontal" : "vertical";
}

function drawPitchedRoofRidge(graphics, module, plan) {
  const horizontal = pitchedRidgeOrientation(module) === "horizontal";
  const shadeOffset = horizontal ? { x: 0, y: 1.5 } : { x: 1.5, y: 0 };
  const lightOffset = horizontal ? { x: 0, y: -1 } : { x: -1, y: 0 };

  // Read the planner-owned ridge as the meeting of two roof planes rather than
  // a diagram stroke. South/east receives the broad low-contrast shade, while
  // north/west gets a much quieter material lift. The final fine line stays on
  // the exact ridge coordinate and acts only as the cap between those planes.
  graphics.lineStyle(4, plan.palette.roofShadow, 0.11);
  graphics.lineBetween(
    module.x1 + shadeOffset.x,
    module.y1 + shadeOffset.y,
    module.x2 + shadeOffset.x,
    module.y2 + shadeOffset.y
  );

  graphics.lineStyle(2, plan.palette.roofTextureHighlight, 0.032);
  graphics.lineBetween(
    module.x1 + lightOffset.x,
    module.y1 + lightOffset.y,
    module.x2 + lightOffset.x,
    module.y2 + lightOffset.y
  );

  graphics.lineStyle(0.75, plan.palette.roofTextureHighlight, 0.085);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
}

function isNightRoofMass(module) {
  return module?.kind === MODULE_KINDS.ROOF_MASS
    && module.surfaceKind === ROOF_SURFACE_KINDS.NIGHT
    && Array.isArray(module.points)
    && module.points.length >= 3
    && module.bounds;
}

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
      if (!previousInside) {
        result.push(interpolateAtBoundary(previous, current, axis, value));
      }
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

function drawNightRoofModulation(graphics, module, plan, options) {
  // First render the canonical roof mass and its established M1/M2 depth.
  renderDetailedBuildingPresentation(
    graphics,
    { ...plan, modules: [module] },
    options
  );

  const bounds = module.bounds;
  if (bounds.w < 32 || bounds.h < 24) return;

  // Two broad overlapping zones avoid a hard split and keep NIGHT roofs from
  // reading as one flat purple slab. The modulation is deliberately neutral:
  // nightclub identity remains local to frontage/accent modules rather than
  // turning the whole roof into a neon sign.
  const northLift = clipPolygonToRect(module.points, {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h * 0.62
  });
  const southShade = clipPolygonToRect(module.points, {
    x: bounds.x,
    y: bounds.y + bounds.h * 0.38,
    w: bounds.w,
    h: bounds.h * 0.62
  });

  if (northLift.length >= 3) {
    graphics.fillStyle(plan.palette.roofTextureHighlight, 0.025);
    graphics.fillPoints(northLift, true);
  }
  if (southShade.length >= 3) {
    graphics.fillStyle(plan.palette.roofShade, 0.055);
    graphics.fillPoints(southShade, true);
  }
}

function isMaterialTreatment(module) {
  return isMembraneSeam(module)
    || isCivicSurfaceJoint(module)
    || isPitchedRoofRidge(module)
    || isNightRoofMass(module);
}

function drawMaterialTreatment(graphics, module, plan, options) {
  if (isMembraneSeam(module)) drawMembraneSeam(graphics, module, plan);
  else if (isCivicSurfaceJoint(module)) drawCivicSurfaceJoint(graphics, module, plan);
  else if (isPitchedRoofRidge(module)) drawPitchedRoofRidge(graphics, module, plan);
  else if (isNightRoofMass(module)) drawNightRoofModulation(graphics, module, plan, options);
}

function drawDebugBounds(graphics, module) {
  if (!module?.bounds) return;
  graphics.lineStyle(1, 0xffd65c, 0.45);
  graphics.strokeRect(
    module.bounds.x,
    module.bounds.y,
    module.bounds.w,
    module.bounds.h
  );
}

function renderWithMaterialTreatments(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  const modules = plan.modules || [];
  if (!modules.some(isMaterialTreatment)) {
    return renderDetailedBuildingPresentation(graphics, plan, options);
  }

  // Preserve planner module order while replacing only M3 material painting.
  // Every other module continues through the established M1/M2 detail renderer.
  for (const module of modules) {
    if (isMaterialTreatment(module)) {
      drawMaterialTreatment(graphics, module, plan, options);
      if (options.showModuleBounds) drawDebugBounds(graphics, module);
      continue;
    }
    renderDetailedBuildingPresentation(
      graphics,
      { ...plan, modules: [module] },
      options
    );
  }
  return plan;
}

export function clearBuildingPresentationCache(building) {
  clearDetailedBuildingPresentationCache(building);
}

export function renderBuildingPresentation(graphics, plan, options = {}) {
  return renderWithMaterialTreatments(graphics, plan, options);
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = drawDetailedBuildingPresentation(null, building, options);
  if (graphics && plan) renderWithMaterialTreatments(graphics, plan, options);
  return plan;
}
