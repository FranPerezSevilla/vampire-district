import { MODULE_KINDS } from "./BuildingPresentationCatalog.js";
import {
  clearBuildingPresentationCache as clearFinalBuildingPresentationCache,
  drawBuildingPresentation as drawFinalBuildingPresentation,
  renderBuildingPresentation as renderFinalBuildingPresentation
} from "./BuildingPresentationFinalRenderer.js";

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || minimum));
}

function isIndustrialRoofMass(module) {
  return module?.kind === MODULE_KINDS.ROOF_MASS
    && module.profileId === "industrial"
    && module.bounds;
}

function industrialPlantTargets(plan) {
  return (plan.modules || []).filter(module => (
    module?.bounds
      && (module.kind === MODULE_KINDS.ROOF_ANNEX || module.kind === MODULE_KINDS.HVAC)
  ));
}

function industrialPlantDeckBounds(roofBounds, targets) {
  if (!roofBounds || targets.length === 0) return null;
  const minimumX = Math.min(...targets.map(module => module.bounds.x));
  const minimumY = Math.min(...targets.map(module => module.bounds.y));
  const maximumX = Math.max(...targets.map(module => module.bounds.x + module.bounds.w));
  const maximumY = Math.max(...targets.map(module => module.bounds.y + module.bounds.h));
  const padding = Math.max(8, Math.min(14, Math.min(roofBounds.w, roofBounds.h) * 0.07));
  const inset = Math.max(6, Math.min(10, Math.min(roofBounds.w, roofBounds.h) * 0.045));
  const available = {
    x: roofBounds.x + inset,
    y: roofBounds.y + inset,
    w: Math.max(1, roofBounds.w - inset * 2),
    h: Math.max(1, roofBounds.h - inset * 2)
  };
  const desiredWidth = Math.max(70, maximumX - minimumX + padding * 2);
  const desiredHeight = Math.max(42, maximumY - minimumY + padding * 2);
  const width = Math.min(available.w, roofBounds.w * 0.72, desiredWidth);
  const height = Math.min(available.h, roofBounds.h * 0.5, desiredHeight);
  const centerX = (minimumX + maximumX) / 2;
  const centerY = (minimumY + maximumY) / 2;
  const maximumDeckX = available.x + available.w - width;
  const maximumDeckY = available.y + available.h - height;
  return {
    x: clamp(centerX - width / 2, available.x, maximumDeckX),
    y: clamp(centerY - height / 2, available.y, maximumDeckY),
    w: width,
    h: height
  };
}

function drawIndustrialPlantDeck(graphics, module, plan, options) {
  renderFinalBuildingPresentation(
    graphics,
    { ...plan, modules: [module] },
    options
  );

  const targets = industrialPlantTargets(plan);
  const deck = industrialPlantDeckBounds(module.bounds, targets);
  if (!deck) return null;

  // Group the already-planned mechanical objects into one readable plant area.
  // This is a low-frequency roof material treatment only: no gameplay module,
  // collision, topology or extra rooftop prop is introduced here.
  graphics.fillStyle(plan.palette.serviceDark, 0.12);
  graphics.fillRect(deck.x, deck.y, deck.w, deck.h);

  const edgeInset = Math.max(6, Math.min(14, deck.w * 0.06));
  graphics.lineStyle(1, plan.palette.roofTextureHighlight, 0.14);
  graphics.lineBetween(
    deck.x + edgeInset,
    deck.y + 1,
    deck.x + deck.w - edgeInset,
    deck.y + 1
  );

  graphics.lineStyle(0.75, plan.palette.serviceMid, 0.12);
  graphics.lineBetween(
    deck.x + edgeInset,
    deck.y + deck.h - 2,
    deck.x + deck.w * 0.42,
    deck.y + deck.h - 2
  );
  return deck;
}

function renderWithReviewTreatments(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  if (plan.profileId !== "industrial") {
    return renderFinalBuildingPresentation(graphics, plan, options);
  }

  for (const module of plan.modules || []) {
    if (isIndustrialRoofMass(module)) {
      drawIndustrialPlantDeck(graphics, module, plan, options);
      continue;
    }
    renderFinalBuildingPresentation(
      graphics,
      { ...plan, modules: [module] },
      options
    );
  }
  return plan;
}

export function clearBuildingPresentationCache(building) {
  clearFinalBuildingPresentationCache(building);
}

export function renderBuildingPresentation(graphics, plan, options = {}) {
  return renderWithReviewTreatments(graphics, plan, options);
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = drawFinalBuildingPresentation(null, building, options);
  if (graphics && plan) renderWithReviewTreatments(graphics, plan, options);
  return plan;
}
