import { FRONTAGE_KINDS, MODULE_KINDS } from "./BuildingPresentationCatalog.js";
import { drawRaisedRectVolume } from "./BuildingPresentationVolumePrimitives.js";
import {
  clearBuildingPresentationCache as clearMaterialBuildingPresentationCache,
  drawBuildingPresentation as drawMaterialBuildingPresentation,
  renderBuildingPresentation as renderMaterialBuildingPresentation
} from "./BuildingPresentationMaterialRenderer.js";

function physicalDepth(bounds, ratio, maximum) {
  return Math.max(1, Math.min(
    Number(maximum) || 3,
    Math.min(Number(bounds?.w) || 1, Number(bounds?.h) || 1) * ratio
  ));
}

function validEdge(edge) {
  return ["north", "east", "south", "west"].includes(edge) ? edge : "south";
}

function isChurchFrontage(module) {
  return module?.kind === MODULE_KINDS.FRONTAGE && module.variant === FRONTAGE_KINDS.CHURCH;
}

function isClubFrontage(module) {
  return module?.kind === MODULE_KINDS.FRONTAGE && module.variant === FRONTAGE_KINDS.CLUB;
}

function centeredThreshold(top, edge, widthRatio = 0.34) {
  const horizontal = edge === "north" || edge === "south";
  if (horizontal) {
    const width = Math.max(5, Math.min(14, top.w * widthRatio));
    const height = Math.max(1.5, Math.min(3, top.h * 0.28));
    return {
      x: top.x + (top.w - width) / 2,
      y: edge === "north" ? top.y : top.y + top.h - height,
      w: width,
      h: height
    };
  }
  const width = Math.max(1.5, Math.min(3, top.w * 0.28));
  const height = Math.max(5, Math.min(14, top.h * widthRatio));
  return {
    x: edge === "west" ? top.x : top.x + top.w - width,
    y: top.y + (top.h - height) / 2,
    w: width,
    h: height
  };
}

function edgeBand(bounds, edge, thickness) {
  const amount = Math.max(1, Math.min(
    Number(thickness) || 1,
    Math.min(bounds.w, bounds.h) * 0.3
  ));
  if (edge === "north") return { x: bounds.x, y: bounds.y, w: bounds.w, h: amount };
  if (edge === "east") return {
    x: bounds.x + bounds.w - amount,
    y: bounds.y,
    w: amount,
    h: bounds.h
  };
  if (edge === "west") return { x: bounds.x, y: bounds.y, w: amount, h: bounds.h };
  return {
    x: bounds.x,
    y: bounds.y + bounds.h - amount,
    w: bounds.w,
    h: amount
  };
}

function drawChurchFrontage(graphics, module, plan) {
  const geometry = drawRaisedRectVolume(graphics, module.bounds, {
    depth: physicalDepth(module.bounds, 0.16, 3.5),
    shadowColor: plan.palette.roofShadow,
    shadowAlpha: 0.44,
    topColor: plan.palette.annexRoof,
    topAlpha: 0.98,
    southColor: plan.palette.wall,
    southAlpha: 0.9,
    eastColor: plan.palette.parapetDark,
    eastAlpha: 0.88,
    highlightColor: plan.palette.parapetLight,
    highlightAlpha: 0.2,
    seamColor: plan.palette.roofShadow,
    seamAlpha: 0.3
  });

  const edge = validEdge(module.edge);
  const threshold = centeredThreshold(geometry.top, edge, 0.34);
  graphics.fillStyle(plan.palette.serviceDark, 0.9);
  graphics.fillRect(threshold.x, threshold.y, threshold.w, threshold.h);

  // Monumentality comes from the porch volume and the existing cross-shaped
  // massing/ridges, not another stamped religious symbol. Warmth is limited to
  // one lintel edge at the public threshold.
  graphics.lineStyle(1, plan.palette.accent, 0.24);
  if (edge === "north" || edge === "south") {
    graphics.lineBetween(
      threshold.x + 1,
      threshold.y,
      threshold.x + threshold.w - 1,
      threshold.y
    );
  } else {
    graphics.lineBetween(
      threshold.x,
      threshold.y + 1,
      threshold.x,
      threshold.y + threshold.h - 1
    );
  }

  return { geometry, threshold };
}

function drawClubFrontage(graphics, module, plan) {
  const geometry = drawRaisedRectVolume(graphics, module.bounds, {
    depth: physicalDepth(module.bounds, 0.14, 3),
    shadowColor: plan.palette.roofShadow,
    shadowAlpha: 0.42,
    topColor: plan.palette.serviceDark,
    topAlpha: 0.98,
    southColor: plan.palette.wall,
    southAlpha: 0.82,
    eastColor: plan.palette.parapetDark,
    eastAlpha: 0.86,
    highlightColor: plan.palette.parapetLight,
    highlightAlpha: 0.12,
    seamColor: plan.palette.roofShadow,
    seamAlpha: 0.28
  });

  const edge = validEdge(module.edge);
  const band = edgeBand(
    geometry.top,
    edge,
    Math.max(1.2, Math.min(2.4, Math.min(geometry.top.w, geometry.top.h) * 0.16))
  );
  graphics.fillStyle(plan.palette.accent, 0.7);
  graphics.fillRect(band.x, band.y, band.w, band.h);

  const threshold = centeredThreshold(geometry.top, edge, 0.3);
  graphics.fillStyle(plan.palette.propDark, 0.96);
  graphics.fillRect(threshold.x, threshold.y, threshold.w, threshold.h);

  // Nightlife identity is one local luminous edge against a dark physical
  // vestibule. The old cocktail-shaped line icon is deliberately absent.
  graphics.lineStyle(0.75, plan.palette.accentSoft, 0.28);
  if (edge === "north" || edge === "south") {
    graphics.lineBetween(threshold.x + 1, threshold.y, threshold.x + threshold.w - 1, threshold.y);
  } else {
    graphics.lineBetween(threshold.x, threshold.y + 1, threshold.x, threshold.y + threshold.h - 1);
  }

  return { geometry, band, threshold };
}

function drawDebugBounds(graphics, module) {
  if (!module?.bounds) return;
  graphics.lineStyle(1, 0xffd65c, 0.45);
  graphics.strokeRect(module.bounds.x, module.bounds.y, module.bounds.w, module.bounds.h);
}

function isFamilyReplacement(module) {
  return isChurchFrontage(module) || isClubFrontage(module);
}

function renderWithFamilyTreatments(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  const modules = plan.modules || [];
  if (!modules.some(isFamilyReplacement)) {
    return renderMaterialBuildingPresentation(graphics, plan, options);
  }

  for (const module of modules) {
    if (isChurchFrontage(module)) {
      drawChurchFrontage(graphics, module, plan);
      if (options.showModuleBounds) drawDebugBounds(graphics, module);
      continue;
    }
    if (isClubFrontage(module)) {
      drawClubFrontage(graphics, module, plan);
      if (options.showModuleBounds) drawDebugBounds(graphics, module);
      continue;
    }
    renderMaterialBuildingPresentation(
      graphics,
      { ...plan, modules: [module] },
      options
    );
  }
  return plan;
}

export function clearBuildingPresentationCache(building) {
  clearMaterialBuildingPresentationCache(building);
}

export function renderBuildingPresentation(graphics, plan, options = {}) {
  return renderWithFamilyTreatments(graphics, plan, options);
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = drawMaterialBuildingPresentation(null, building, options);
  if (graphics && plan) renderWithFamilyTreatments(graphics, plan, options);
  return plan;
}
