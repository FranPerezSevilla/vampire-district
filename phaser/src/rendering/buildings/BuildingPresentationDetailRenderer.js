import { MODULE_KINDS } from "./BuildingPresentationCatalog.js";
import { createRaisedRectVolumeGeometry } from "./BuildingPresentationVolumePrimitives.js";
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
  graphics.lineBetween(
    leftHingeX,
    hingeY,
    leftHingeX + hingeWidth,
    hingeY
  );
  graphics.lineBetween(
    rightHingeX,
    hingeY,
    rightHingeX + hingeWidth,
    hingeY
  );

  const handleHalfWidth = Math.max(1.75, Math.min(4.5, top.w * 0.15));
  const handleHeight = Math.max(1.5, Math.min(3.5, top.h * 0.16));
  const handleCenterX = top.x + top.w * 0.5;
  const handleBaseY = Math.min(
    top.y + top.h - margin,
    top.y + top.h * 0.62
  );
  const handleTopY = Math.max(top.y + margin, handleBaseY - handleHeight);

  graphics.lineStyle(1.25, plan.palette.parapetLight, 0.68);
  graphics.lineBetween(
    handleCenterX - handleHalfWidth,
    handleBaseY,
    handleCenterX - handleHalfWidth,
    handleTopY
  );
  graphics.lineBetween(
    handleCenterX + handleHalfWidth,
    handleBaseY,
    handleCenterX + handleHalfWidth,
    handleTopY
  );
  graphics.lineBetween(
    handleCenterX - handleHalfWidth,
    handleTopY,
    handleCenterX + handleHalfWidth,
    handleTopY
  );
}

function drawPhysicalDetailOverlays(graphics, plan) {
  for (const module of plan?.modules || []) {
    if (module.kind === MODULE_KINDS.HATCH) drawHatchHardware(graphics, module, plan);
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
