import { MODULE_KINDS } from "./BuildingPresentationCatalog.js";
import {
  clearBuildingPresentationCache as clearFamilyBuildingPresentationCache,
  drawBuildingPresentation as drawFamilyBuildingPresentation,
  renderBuildingPresentation as renderFamilyBuildingPresentation
} from "./BuildingPresentationFamilyRenderer.js";

function stableHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isServiceStrip(module) {
  return module?.kind === MODULE_KINDS.SERVICE_STRIP && module.bounds;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || minimum));
}

function serviceSlots(module) {
  const bounds = module.bounds;
  const count = Math.max(1, Math.floor(Number(module.slots) || 1));
  const gap = bounds.w / (count + 1);
  const baseWidth = Math.max(3, Math.min(10, gap * 0.42));
  const height = Math.max(2, Math.min(4, bounds.h * 0.42));
  const result = [];
  let previousRight = bounds.x + 1;

  for (let index = 0; index < count; index += 1) {
    const hash = stableHash(`${module.id}:${index}`);
    const jitterUnit = ((hash % 7) - 3) / 3;
    const widthUnit = ((hash >>> 3) % 5) / 4;
    const width = baseWidth * (0.84 + widthUnit * 0.22);
    const idealCenter = bounds.x + gap * (index + 1) + jitterUnit * Math.min(3, gap * 0.09);
    const minimumX = previousRight + Math.max(1.5, gap * 0.08);
    const maximumX = bounds.x + bounds.w - width - 1;
    const x = clamp(idealCenter - width / 2, minimumX, maximumX);
    const y = bounds.y + bounds.h * 0.44;
    result.push({ x, y, w: width, h: height });
    previousRight = x + width;
  }
  return result;
}

function drawServiceStrip(graphics, module, plan) {
  const bounds = module.bounds;
  graphics.fillStyle(plan.palette.serviceDark, 0.98);
  graphics.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  graphics.lineStyle(1, plan.palette.serviceMid, 0.52);
  graphics.lineBetween(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y);

  const slots = serviceSlots(module);
  for (const slot of slots) {
    graphics.fillStyle(plan.palette.serviceWindow, 0.88);
    graphics.fillRect(slot.x, slot.y, slot.w, slot.h);
    graphics.lineStyle(1, plan.palette.serviceMid, 0.34);
    graphics.strokeRect(slot.x, slot.y, slot.w, slot.h);
  }
  return slots;
}

function drawDebugBounds(graphics, module) {
  if (!module?.bounds) return;
  graphics.lineStyle(1, 0xffd65c, 0.45);
  graphics.strokeRect(module.bounds.x, module.bounds.y, module.bounds.w, module.bounds.h);
}

function renderWithCompositionTreatments(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  const modules = plan.modules || [];
  if (!modules.some(isServiceStrip)) {
    return renderFamilyBuildingPresentation(graphics, plan, options);
  }

  for (const module of modules) {
    if (isServiceStrip(module)) {
      drawServiceStrip(graphics, module, plan);
      if (options.showModuleBounds) drawDebugBounds(graphics, module);
      continue;
    }
    renderFamilyBuildingPresentation(
      graphics,
      { ...plan, modules: [module] },
      options
    );
  }
  return plan;
}

export function clearBuildingPresentationCache(building) {
  clearFamilyBuildingPresentationCache(building);
}

export function renderBuildingPresentation(graphics, plan, options = {}) {
  return renderWithCompositionTreatments(graphics, plan, options);
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = drawFamilyBuildingPresentation(null, building, options);
  if (graphics && plan) renderWithCompositionTreatments(graphics, plan, options);
  return plan;
}
