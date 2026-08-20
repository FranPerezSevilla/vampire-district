import { FRONTAGE_KINDS, MODULE_KINDS } from "./BuildingPresentationCatalog.js";
import { createOrthogonalMarkerGeometry } from "./BuildingPresentationMarkerGeometry.js";
import {
  createCylindricalVolumeGeometry,
  createRaisedRectVolumeGeometry,
  drawRaisedRectVolume
} from "./BuildingPresentationVolumePrimitives.js";
import {
  clearBuildingPresentationCache as clearPolishedBuildingPresentationCache,
  drawBuildingPresentation as drawPolishedBuildingPresentation,
  renderBuildingPresentation as renderPolishedBuildingPresentation
} from "./BuildingPresentationPolishRenderer.js";

function physicalDepth(bounds, ratio, maximum) {
  return Math.max(1, Math.min(
    Number(maximum) || 3,
    Math.min(Number(bounds?.w) || 1, Number(bounds?.h) || 1) * ratio
  ));
}

function hatchTopGeometry(module) {
  return createRaisedRectVolumeGeometry(module.bounds, {
    depth: physicalDepth(module.bounds, 0.18, 3)
  }).top;
}

function ventTopGeometry(module) {
  return createCylindricalVolumeGeometry(module.bounds, {
    depth: physicalDepth(module.bounds, 0.15, 2.5)
  });
}

function isRaisedAnnex(module) {
  return module?.kind === MODULE_KINDS.ROOF_ANNEX && module.variant === "raised";
}

function isArchitecturalChurchMarker(module) {
  return module?.kind === MODULE_KINDS.CROSS_MARKER && module.variant === "church";
}

function isPhysicalPoliceFrontage(module) {
  return module?.kind === MODULE_KINDS.FRONTAGE && module.variant === FRONTAGE_KINDS.POLICE;
}

function drawAnnexServiceGrille(graphics, geometry, plan) {
  const top = geometry.top;
  if (top.w < 22 || top.h < 16) return null;

  const margin = Math.max(2, Math.min(4, Math.min(top.w, top.h) * 0.1));
  const width = Math.max(8, Math.min(15, top.w * 0.24));
  const height = Math.max(4, Math.min(7, top.h * 0.17));
  const bounds = {
    x: top.x + top.w - margin - width,
    y: top.y + margin,
    w: width,
    h: height
  };

  // One low-contrast recessed grille gives the annex a service-room purpose
  // without turning the roof into an equipment icon or changing planned bounds.
  graphics.fillStyle(plan.palette.propDark, 0.72);
  graphics.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);

  graphics.lineStyle(0.75, plan.palette.serviceMid, 0.52);
  for (const ratio of [0.34, 0.68]) {
    const y = bounds.y + bounds.h * ratio;
    graphics.lineBetween(bounds.x + 1, y, bounds.x + bounds.w - 1, y);
  }

  return bounds;
}

function drawPhysicalAnnex(graphics, module, plan) {
  const geometry = drawRaisedRectVolume(graphics, module.bounds, {
    depth: physicalDepth(module.bounds, 0.16, 5),
    shadowColor: plan.palette.roofShadow,
    shadowAlpha: 0.46,
    topColor: plan.palette.annexRoof,
    southColor: plan.palette.wall,
    eastColor: plan.palette.serviceDark,
    highlightColor: plan.palette.parapetLight,
    highlightAlpha: 0.22,
    seamColor: plan.palette.parapetMid,
    seamAlpha: 0.34
  });
  drawAnnexServiceGrille(graphics, geometry, plan);
  return geometry;
}

function frontageEdgeBand(bounds, edge, thickness) {
  const amount = Math.max(1, Math.min(
    Number(thickness) || 1,
    Math.min(bounds.w, bounds.h) * 0.34
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

function policeEntryRecess(bounds, edge) {
  const horizontal = edge === "north" || edge === "south";
  if (horizontal) {
    const width = Math.max(5, Math.min(14, bounds.w * 0.28));
    const height = Math.max(1.5, Math.min(3, bounds.h * 0.3));
    return {
      x: bounds.x + (bounds.w - width) / 2,
      y: edge === "north" ? bounds.y : bounds.y + bounds.h - height,
      w: width,
      h: height
    };
  }
  const width = Math.max(1.5, Math.min(3, bounds.w * 0.3));
  const height = Math.max(5, Math.min(14, bounds.h * 0.28));
  return {
    x: edge === "west" ? bounds.x : bounds.x + bounds.w - width,
    y: bounds.y + (bounds.h - height) / 2,
    w: width,
    h: height
  };
}

function drawPhysicalPoliceFrontage(graphics, module, plan) {
  const geometry = drawRaisedRectVolume(graphics, module.bounds, {
    depth: physicalDepth(module.bounds, 0.13, 3),
    shadowColor: plan.palette.roofShadow,
    shadowAlpha: 0.4,
    topColor: plan.palette.canopy,
    topAlpha: 0.98,
    southColor: plan.palette.wall,
    southAlpha: 0.84,
    eastColor: plan.palette.serviceDark,
    eastAlpha: 0.88,
    highlightColor: plan.palette.parapetLight,
    highlightAlpha: 0.2,
    seamColor: plan.palette.parapetMid,
    seamAlpha: 0.3
  });

  const top = geometry.top;
  const edge = ["north", "east", "south", "west"].includes(module.edge)
    ? module.edge
    : "south";
  const accentBand = frontageEdgeBand(
    top,
    edge,
    Math.max(1.25, Math.min(2.5, Math.min(top.w, top.h) * 0.18))
  );
  graphics.fillStyle(plan.palette.accent, 0.68);
  graphics.fillRect(accentBand.x, accentBand.y, accentBand.w, accentBand.h);

  const recess = policeEntryRecess(top, edge);
  graphics.fillStyle(plan.palette.serviceDark, 0.9);
  graphics.fillRect(recess.x, recess.y, recess.w, recess.h);

  // A single restrained threshold highlight reads as a controlled public entry.
  // Police identity stays local to this frontage instead of becoming a glowing
  // perimeter or a stamped badge/cross on the roof.
  graphics.lineStyle(0.75, plan.palette.accentSoft, 0.34);
  if (edge === "north" || edge === "south") {
    graphics.lineBetween(recess.x + 1, recess.y, recess.x + recess.w - 1, recess.y);
  } else {
    graphics.lineBetween(recess.x, recess.y + 1, recess.x, recess.y + recess.h - 1);
  }

  return { geometry, accentBand, recess };
}

function drawArchitecturalChurchMarker(graphics, module, plan) {
  const segments = createOrthogonalMarkerGeometry(module.bounds, {
    junctionRatio: 0.38,
    stemWidthRatio: 0.28,
    armHeightRatio: 0.24,
    armSpanRatio: 0.76,
    maximumStemWidth: 4.5,
    maximumArmHeight: 4,
    maximumArmSpan: 11
  });
  if (!segments) return null;

  // The planner already anchors this marker on the nave centreline. The shared
  // geometry is family-neutral; church identity comes from placement,
  // proportions and the restrained warm material highlight supplied here.
  const depth = physicalDepth(module.bounds, 0.1, 1.5);
  const style = {
    depth,
    shadowColor: plan.palette.roofShadow,
    topColor: plan.palette.parapetMid,
    topAlpha: 0.96,
    southColor: plan.palette.wall,
    southAlpha: 0.82,
    eastColor: plan.palette.parapetDark,
    eastAlpha: 0.86,
    highlightColor: plan.palette.accent,
    highlightAlpha: 0.3,
    seamColor: plan.palette.roofShadow,
    seamAlpha: 0.28
  };
  const stem = drawRaisedRectVolume(graphics, segments.stem, {
    ...style,
    shadowAlpha: 0.32
  });
  const arm = drawRaisedRectVolume(graphics, segments.arm, {
    ...style,
    shadowAlpha: 0.26
  });
  return { stem, arm };
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

function isPhysicalReplacement(module) {
  return isRaisedAnnex(module)
    || isArchitecturalChurchMarker(module)
    || isPhysicalPoliceFrontage(module);
}

function renderPolishedWithPhysicalReplacements(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  const modules = plan.modules || [];
  if (!modules.some(isPhysicalReplacement)) {
    return renderPolishedBuildingPresentation(graphics, plan, options);
  }

  // Preserve module ordering while replacing only legacy painters that now have
  // a physical architectural treatment. The planner remains authoritative for
  // bounds and layer order.
  for (const module of modules) {
    if (isRaisedAnnex(module)) {
      drawPhysicalAnnex(graphics, module, plan);
      if (options.showModuleBounds) drawDebugBounds(graphics, module);
      continue;
    }
    if (isArchitecturalChurchMarker(module)) {
      drawArchitecturalChurchMarker(graphics, module, plan);
      if (options.showModuleBounds) drawDebugBounds(graphics, module);
      continue;
    }
    if (isPhysicalPoliceFrontage(module)) {
      drawPhysicalPoliceFrontage(graphics, module, plan);
      if (options.showModuleBounds) drawDebugBounds(graphics, module);
      continue;
    }
    renderPolishedBuildingPresentation(
      graphics,
      { ...plan, modules: [module] },
      options
    );
  }
  return plan;
}

function drawHatchHardware(graphics, module, plan) {
  const top = hatchTopGeometry(module);
  const shortSide = Math.max(1, Math.min(top.w, top.h));
  const margin = Math.max(1.25, Math.min(3, shortSide * 0.16));
  const hingeWidth = Math.max(1.5, Math.min(4, top.w * 0.18));
  const hingeHeight = Math.max(1, Math.min(2, top.h * 0.11));
  const hingeY = top.y + margin * 0.58;
  const leftHingeX = top.x + margin;
  const rightHingeX = Math.max(leftHingeX, top.x + top.w - margin - hingeWidth);

  graphics.fillStyle(plan.palette.serviceMid, 0.82);
  graphics.fillRect(leftHingeX, hingeY, hingeWidth, hingeHeight);
  graphics.fillRect(rightHingeX, hingeY, hingeWidth, hingeHeight);

  graphics.lineStyle(1, plan.palette.parapetLight, 0.58);
  graphics.lineBetween(leftHingeX, hingeY, leftHingeX + hingeWidth, hingeY);
  graphics.lineBetween(rightHingeX, hingeY, rightHingeX + hingeWidth, hingeY);

  const handleHalfWidth = Math.max(1.75, Math.min(4.5, top.w * 0.15));
  const handleHeight = Math.max(1.5, Math.min(3.5, top.h * 0.16));
  const handleCenterX = top.x + top.w * 0.5;
  const handleBaseY = Math.min(top.y + top.h - margin, top.y + top.h * 0.62);
  const handleTopY = Math.max(top.y + margin, handleBaseY - handleHeight);

  graphics.lineStyle(1.25, plan.palette.parapetLight, 0.68);
  graphics.lineBetween(handleCenterX - handleHalfWidth, handleBaseY, handleCenterX - handleHalfWidth, handleTopY);
  graphics.lineBetween(handleCenterX + handleHalfWidth, handleBaseY, handleCenterX + handleHalfWidth, handleTopY);
  graphics.lineBetween(handleCenterX - handleHalfWidth, handleTopY, handleCenterX + handleHalfWidth, handleTopY);
}

function drawVentOpening(graphics, module, plan) {
  const geometry = ventTopGeometry(module);
  const radius = Math.max(1, geometry.radius * 0.48);
  const innerRadius = Math.max(0.75, radius * 0.72);

  graphics.fillStyle(plan.palette.propDark, 0.9);
  graphics.fillCircle(geometry.center.x, geometry.center.y, radius * 1.12);
  graphics.fillStyle(plan.palette.serviceDark, 0.96);
  graphics.fillCircle(geometry.center.x, geometry.center.y, radius);
  graphics.fillStyle(plan.palette.roofShadow, 0.32);
  graphics.fillCircle(
    geometry.center.x + innerRadius * 0.1,
    geometry.center.y + innerRadius * 0.14,
    innerRadius
  );

  graphics.lineStyle(1, plan.palette.serviceMid, 0.68);
  graphics.strokeCircle(geometry.center.x, geometry.center.y, radius * 1.08);
  graphics.lineStyle(0.75, plan.palette.parapetLight, 0.36);
  graphics.lineBetween(
    geometry.center.x - radius * 0.68,
    geometry.center.y - radius * 0.46,
    geometry.center.x + radius * 0.28,
    geometry.center.y - radius * 0.46
  );
}

function drawAntennaSupport(graphics, module, plan) {
  const bounds = module.bounds;
  const shortSide = Math.max(1, Math.min(bounds.w, bounds.h));
  const baseSize = Math.max(5, Math.min(shortSide * 0.46, 12));
  const baseBounds = {
    x: bounds.x + (bounds.w - baseSize) / 2,
    y: bounds.y + bounds.h * 0.58,
    w: baseSize,
    h: Math.max(4, baseSize * 0.62)
  };
  const base = drawRaisedRectVolume(graphics, baseBounds, {
    depth: Math.max(1, Math.min(2.5, baseBounds.h * 0.24)),
    shadowColor: plan.palette.roofShadow,
    shadowAlpha: 0.42,
    topColor: plan.palette.propDark,
    southColor: plan.palette.serviceDark,
    eastColor: plan.palette.wall,
    highlightColor: plan.palette.parapetLight,
    highlightAlpha: 0.22,
    seamColor: plan.palette.serviceMid,
    seamAlpha: 0.34
  });

  const mastX = base.top.x + base.top.w / 2;
  const mastBottomY = base.top.y + base.top.h * 0.45;
  const mastTopY = Math.max(bounds.y + Math.max(2, bounds.h * 0.12), mastBottomY - bounds.h * 0.48);
  const braceY = mastBottomY - Math.max(2, (mastBottomY - mastTopY) * 0.32);

  graphics.lineStyle(2, plan.palette.parapetLight, 0.78);
  graphics.lineBetween(mastX, mastBottomY, mastX, mastTopY);

  graphics.lineStyle(1, plan.palette.serviceMid, 0.42);
  graphics.lineBetween(base.top.x + 1, base.top.y + 1, mastX, braceY);
  graphics.lineBetween(base.top.x + base.top.w - 1, base.top.y + 1, mastX, braceY);

  const armHalf = Math.max(2, Math.min(bounds.w * 0.2, 6));
  const armY = mastTopY + Math.max(2, (mastBottomY - mastTopY) * 0.18);
  graphics.lineStyle(1.25, plan.palette.prop, 0.54);
  graphics.lineBetween(mastX - armHalf, armY, mastX + armHalf, armY);

  graphics.fillStyle(plan.palette.serviceMid, 0.88);
  graphics.fillCircle(mastX, mastTopY, Math.max(1, Math.min(1.8, shortSide * 0.06)));
}

function drawPhysicalDetailOverlays(graphics, plan) {
  for (const module of plan?.modules || []) {
    if (module.kind === MODULE_KINDS.HATCH) drawHatchHardware(graphics, module, plan);
    else if (module.kind === MODULE_KINDS.VENT) drawVentOpening(graphics, module, plan);
    else if (module.kind === MODULE_KINDS.ANTENNA) drawAntennaSupport(graphics, module, plan);
  }
}

export function clearBuildingPresentationCache(building) {
  clearPolishedBuildingPresentationCache(building);
}

export function renderBuildingPresentation(graphics, plan, options = {}) {
  const renderedPlan = renderPolishedWithPhysicalReplacements(graphics, plan, options);
  if (graphics && renderedPlan) drawPhysicalDetailOverlays(graphics, renderedPlan);
  return renderedPlan;
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = drawPolishedBuildingPresentation(null, building, options);
  if (graphics && plan) {
    renderPolishedWithPhysicalReplacements(graphics, plan, options);
    drawPhysicalDetailOverlays(graphics, plan);
  }
  return plan;
}
