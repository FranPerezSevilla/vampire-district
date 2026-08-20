import { MODULE_KINDS } from "./BuildingPresentationCatalog.js";
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
  const renderedPlan = renderPolishedBuildingPresentation(graphics, plan, options);
  if (graphics && renderedPlan) drawPhysicalDetailOverlays(graphics, renderedPlan);
  return renderedPlan;
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = drawPolishedBuildingPresentation(graphics, building, options);
  if (graphics && plan) drawPhysicalDetailOverlays(graphics, plan);
  return plan;
}
