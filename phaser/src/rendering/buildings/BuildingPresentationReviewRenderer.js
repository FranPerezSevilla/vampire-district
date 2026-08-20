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

function isPoliceRoofMass(module) {
  return module?.kind === MODULE_KINDS.ROOF_MASS
    && module.profileId === "police"
    && module.bounds;
}

function industrialPlantTargets(plan) {
  return (plan.modules || []).filter(module => (
    module?.bounds
      && (module.kind === MODULE_KINDS.ROOF_ANNEX || module.kind === MODULE_KINDS.HVAC)
  ));
}

function policeCommunicationsTargets(plan) {
  return (plan.modules || []).filter(module => (
    module?.bounds
      && (module.kind === MODULE_KINDS.HVAC || module.kind === MODULE_KINDS.ANTENNA)
  ));
}

function targetCenter(module) {
  return {
    x: module.bounds.x + module.bounds.w / 2,
    y: module.bounds.y + module.bounds.h / 2
  };
}

function boundedCourtFromTargetCenters(roofBounds, targets, options = {}) {
  if (!roofBounds || targets.length === 0) return null;
  const centers = targets.map(targetCenter);
  const minimumX = Math.min(...centers.map(point => point.x));
  const minimumY = Math.min(...centers.map(point => point.y));
  const maximumX = Math.max(...centers.map(point => point.x));
  const maximumY = Math.max(...centers.map(point => point.y));
  const shortSide = Math.min(roofBounds.w, roofBounds.h);
  const paddingX = clamp(shortSide * (options.paddingXRatio || 0.09), options.minimumPaddingX || 12, options.maximumPaddingX || 20);
  const paddingY = clamp(shortSide * (options.paddingYRatio || 0.09), options.minimumPaddingY || 12, options.maximumPaddingY || 20);
  const inset = clamp(shortSide * (options.insetRatio || 0.045), options.minimumInset || 6, options.maximumInset || 10);
  const available = {
    x: roofBounds.x + inset,
    y: roofBounds.y + inset,
    w: Math.max(1, roofBounds.w - inset * 2),
    h: Math.max(1, roofBounds.h - inset * 2)
  };
  const desiredWidth = Math.max(options.minimumWidth || 70, maximumX - minimumX + paddingX * 2);
  const desiredHeight = Math.max(options.minimumHeight || 42, maximumY - minimumY + paddingY * 2);
  const width = Math.min(available.w, desiredWidth);
  const height = Math.min(available.h, desiredHeight);
  const centerX = (minimumX + maximumX) / 2;
  const centerY = (minimumY + maximumY) / 2;
  const maximumCourtX = available.x + available.w - width;
  const maximumCourtY = available.y + available.h - height;
  return {
    x: clamp(centerX - width / 2, available.x, maximumCourtX),
    y: clamp(centerY - height / 2, available.y, maximumCourtY),
    w: width,
    h: height
  };
}

function industrialPlantDeckBounds(roofBounds, targets) {
  // M6 review found that a percentage cap could leave the annex and hero HVAC
  // looking unrelated on wide industrial roofs. Size the material deck from the
  // actual planned object centres instead: every target centre remains inside
  // the deck while the deck itself remains inside the roof mass.
  return boundedCourtFromTargetCenters(roofBounds, targets, {
    minimumWidth: 70,
    minimumHeight: 42,
    paddingXRatio: 0.09,
    paddingYRatio: 0.09
  });
}

function policeCommunicationsCourtBounds(roofBounds, targets) {
  if (targets.length < 2) return null;
  return boundedCourtFromTargetCenters(roofBounds, targets, {
    minimumWidth: 116,
    minimumHeight: 58,
    minimumPaddingX: 18,
    maximumPaddingX: 28,
    minimumPaddingY: 14,
    maximumPaddingY: 22,
    paddingXRatio: 0.11,
    paddingYRatio: 0.08,
    insetRatio: 0.05
  });
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

function drawPoliceCommunicationsCourt(graphics, module, plan, options) {
  renderFinalBuildingPresentation(
    graphics,
    { ...plan, modules: [module] },
    options
  );

  const targets = policeCommunicationsTargets(plan);
  const court = policeCommunicationsCourtBounds(module.bounds, targets);
  if (!court) return null;

  // Police identity should come from civic order and physical communications
  // equipment, not a stamped badge. One broad ordered court groups the existing
  // HVAC and antenna while keeping the blue accent language local and sparse.
  graphics.fillStyle(plan.palette.roofShade, 0.13);
  graphics.fillRect(court.x, court.y, court.w, court.h);

  const edgeInset = Math.max(8, Math.min(18, court.w * 0.08));
  graphics.lineStyle(1, plan.palette.roofTextureHighlight, 0.15);
  graphics.lineBetween(
    court.x + edgeInset,
    court.y + 1,
    court.x + court.w - edgeInset,
    court.y + 1
  );

  const spineY = court.y + court.h * 0.58;
  graphics.lineStyle(0.75, plan.palette.serviceMid, 0.13);
  graphics.lineBetween(
    court.x + edgeInset,
    spineY,
    court.x + court.w * 0.58,
    spineY
  );
  return court;
}

function renderWithReviewTreatments(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  const supportedProfile = plan.profileId === "industrial" || plan.profileId === "police";
  if (!supportedProfile) {
    return renderFinalBuildingPresentation(graphics, plan, options);
  }

  for (const module of plan.modules || []) {
    if (isIndustrialRoofMass(module)) {
      drawIndustrialPlantDeck(graphics, module, plan, options);
      continue;
    }
    if (isPoliceRoofMass(module)) {
      drawPoliceCommunicationsCourt(graphics, module, plan, options);
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
