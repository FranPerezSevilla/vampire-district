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

function isMaterialTreatment(module) {
  return isMembraneSeam(module) || isCivicSurfaceJoint(module);
}

function drawMaterialTreatment(graphics, module, plan) {
  if (isMembraneSeam(module)) drawMembraneSeam(graphics, module, plan);
  else if (isCivicSurfaceJoint(module)) drawCivicSurfaceJoint(graphics, module, plan);
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
      drawMaterialTreatment(graphics, module, plan);
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
