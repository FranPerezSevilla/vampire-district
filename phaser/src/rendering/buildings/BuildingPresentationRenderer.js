import {
  FRONTAGE_KINDS,
  MODULE_KINDS
} from "./BuildingPresentationCatalog.js";
import {
  ROOF_SURFACE_KINDS
} from "./BuildingVisualProfileCatalog.js";
import { createBuildingPresentationPlan } from "./BuildingPresentationPlanner.js";

const BUILDING_PLAN_CACHE = new WeakMap();

function planningOptionsKey(options = {}) {
  return JSON.stringify({
    archetype: options.archetype || null,
    profileId: options.profileId || options.profile || null,
    surfaceKind: options.surfaceKind || options.roofSurface || null,
    layoutId: options.layoutId || null,
    frontage: options.frontage || null,
    frontageEdge: options.frontageEdge || null,
    frontageOffset: options.frontageOffset ?? null,
    detailLevel: options.detailLevel || null,
    showLabel: options.showLabel ?? null,
    seed: options.seed ?? null,
    propKinds: Array.isArray(options.propKinds) ? options.propKinds : null
  });
}

function cachedBuildingPlan(building, options = {}) {
  if (!building || typeof building !== "object" || options.cache === false) {
    return createBuildingPresentationPlan(building, options);
  }
  const key = planningOptionsKey(options);
  let entries = BUILDING_PLAN_CACHE.get(building);
  if (!entries) {
    entries = new Map();
    BUILDING_PLAN_CACHE.set(building, entries);
  }
  if (!entries.has(key)) entries.set(key, createBuildingPresentationPlan(building, options));
  return entries.get(key);
}

export function clearBuildingPresentationCache(building) {
  if (building && typeof building === "object") BUILDING_PLAN_CACHE.delete(building);
}

function drawRect(graphics, bounds, color, alpha = 1) {
  graphics.fillStyle(color, alpha);
  graphics.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
}

function strokeRect(graphics, bounds, width, color, alpha = 1) {
  graphics.lineStyle(width, color, alpha);
  graphics.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
}

function centerOf(bounds) {
  return {
    x: bounds.x + bounds.w / 2,
    y: bounds.y + bounds.h / 2
  };
}

function offsetPoints(points, x, y) {
  return points.map(point => ({
    x: point.x + x,
    y: point.y + y
  }));
}

function drawWorldShadow(graphics, bounds, plan) {
  const depth = Math.max(2, Number(plan.effects?.shadowDepth) || 8);
  const diagonal = depth * 0.36;

  drawRect(graphics, {
    x: bounds.x + diagonal,
    y: bounds.y + bounds.h,
    w: Math.max(1, bounds.w - diagonal),
    h: depth
  }, plan.palette.worldShadow, 0.52);
  drawRect(graphics, {
    x: bounds.x + bounds.w,
    y: bounds.y + diagonal,
    w: depth,
    h: Math.max(1, bounds.h - diagonal)
  }, plan.palette.worldShadow, 0.46);
  drawRect(graphics, {
    x: bounds.x + bounds.w,
    y: bounds.y + bounds.h,
    w: depth,
    h: depth
  }, plan.palette.worldShadow, 0.34);
}

function drawFoundation(graphics, module, plan) {
  const { bounds } = module;
  const palette = plan.palette;
  const wallDepth = Math.max(2, Math.min(
    Number(plan.effects?.wallDepth) || 5,
    Math.min(bounds.w, bounds.h) / 3
  ));

  drawWorldShadow(graphics, bounds, plan);
  drawRect(graphics, bounds, palette.foundation, 1);

  drawRect(graphics, {
    x: bounds.x,
    y: bounds.y + bounds.h - wallDepth,
    w: bounds.w,
    h: wallDepth
  }, palette.wall, 0.94);
  drawRect(graphics, {
    x: bounds.x + bounds.w - wallDepth,
    y: bounds.y,
    w: wallDepth,
    h: bounds.h
  }, palette.wall, 0.88);

  graphics.lineStyle(2, palette.parapetLight, 0.5);
  graphics.lineBetween(bounds.x + 1, bounds.y + 1, bounds.x + bounds.w - 1, bounds.y + 1);
  graphics.lineBetween(bounds.x + 1, bounds.y + 1, bounds.x + 1, bounds.y + bounds.h - 1);

  graphics.lineStyle(2, palette.wallHighlight, 0.24);
  graphics.lineBetween(
    bounds.x + 2,
    bounds.y + bounds.h - wallDepth,
    bounds.x + bounds.w - wallDepth,
    bounds.y + bounds.h - wallDepth
  );
  graphics.lineBetween(
    bounds.x + bounds.w - wallDepth,
    bounds.y + 2,
    bounds.x + bounds.w - wallDepth,
    bounds.y + bounds.h - wallDepth
  );

  strokeRect(graphics, bounds, 2, palette.parapetDark, 0.96);
}

function drawRoofMass(graphics, module, plan) {
  const points = module.points || [];
  if (points.length < 3) return;

  const wallDepth = Math.max(3, Number(plan.effects?.wallDepth) || 5);
  graphics.fillStyle(plan.palette.roofShadow, 0.58);
  graphics.fillPoints(offsetPoints(points, wallDepth * 0.55, wallDepth * 0.72), true);
  graphics.fillStyle(plan.palette.roofShade, 0.24);
  graphics.fillPoints(offsetPoints(points, wallDepth * 0.22, wallDepth * 0.32), true);
  graphics.fillStyle(plan.palette.roof, 1);
  graphics.fillPoints(points, true);
}

function corrugatedRibTreatment(module) {
  const match = /:corrugated:v:(\d+)$/.exec(String(module?.id || ""));
  const index = match ? Number(match[1]) : 0;
  const phase = Number.isFinite(index) ? index % 4 : 0;
  if (phase === 3) return null;

  const anchor = phase === 0;
  return {
    shadowWidth: anchor ? 1.25 : 1,
    shadowAlpha: anchor ? 0.13 : 0.075,
    highlightWidth: 0.75,
    highlightAlpha: anchor ? 0.09 : 0.055
  };
}

function drawRoofTextureLine(graphics, module, plan) {
  const variant = module.variant;
  if (variant === ROOF_SURFACE_KINDS.CORRUGATED) {
    const treatment = corrugatedRibTreatment(module);
    if (!treatment) return;

    // Keep the planner's regular rib geometry intact, but visually collect it
    // into three-rib groups with a quiet fourth lane. Lower contrast prevents
    // the material from reading as repeated UI linework at gameplay zoom.
    graphics.lineStyle(
      treatment.shadowWidth,
      plan.palette.roofShadow,
      treatment.shadowAlpha
    );
    graphics.lineBetween(module.x1 + 1, module.y1, module.x2 + 1, module.y2);
    graphics.lineStyle(
      treatment.highlightWidth,
      plan.palette.roofTextureHighlight,
      treatment.highlightAlpha
    );
    graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
    return;
  }
  if (variant === ROOF_SURFACE_KINDS.CIVIC) {
    graphics.lineStyle(1, plan.palette.roofTextureHighlight, 0.2);
    graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
    return;
  }
  graphics.lineStyle(1, plan.palette.roofTexture, 0.22);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
}

function innerEdgeOffset(module, amount = 2) {
  if (module.orientation === "north") return { x: 0, y: amount };
  if (module.orientation === "east") return { x: -amount, y: 0 };
  if (module.orientation === "south") return { x: 0, y: -amount };
  return { x: amount, y: 0 };
}

function drawParapetEdge(graphics, module, plan) {
  const palette = plan.palette;
  const lightFacing = module.orientation === "north" || module.orientation === "west";

  graphics.lineStyle(6, palette.parapetDark, 0.96);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);

  graphics.lineStyle(
    lightFacing ? 3 : 4,
    lightFacing ? palette.parapetLight : palette.parapetMid,
    lightFacing ? 0.98 : 0.9
  );
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);

  const offset = innerEdgeOffset(module, lightFacing ? 3 : 2);
  graphics.lineStyle(
    1,
    lightFacing ? palette.roofTextureHighlight : palette.roofShadow,
    lightFacing ? 0.3 : 0.48
  );
  graphics.lineBetween(
    module.x1 + offset.x,
    module.y1 + offset.y,
    module.x2 + offset.x,
    module.y2 + offset.y
  );
}

function drawRoofAnnex(graphics, module, plan) {
  const { bounds } = module;
  const wallDepth = Math.max(3, Math.min(
    Number(plan.effects?.wallDepth) || 5,
    Math.min(bounds.w, bounds.h) * 0.18
  ));

  drawRect(graphics, {
    x: bounds.x + wallDepth * 0.7,
    y: bounds.y + wallDepth * 0.8,
    w: bounds.w,
    h: bounds.h
  }, plan.palette.roofShadow, 0.54);
  drawRect(graphics, bounds, plan.palette.annexRoof, 1);

  drawRect(graphics, {
    x: bounds.x,
    y: bounds.y + bounds.h - wallDepth,
    w: bounds.w,
    h: wallDepth
  }, plan.palette.wall, 0.94);
  drawRect(graphics, {
    x: bounds.x + bounds.w - wallDepth,
    y: bounds.y,
    w: wallDepth,
    h: bounds.h
  }, plan.palette.wall, 0.88);

  graphics.lineStyle(2, plan.palette.parapetLight, 0.62);
  graphics.lineBetween(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y);
  graphics.lineBetween(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h);
  strokeRect(graphics, bounds, 2, plan.palette.parapetDark, 0.96);

  if (bounds.w >= 28 && bounds.h >= 24) {
    const center = {
      x: bounds.x + bounds.w * 0.62,
      y: bounds.y + bounds.h * 0.42
    };
    const radius = Math.max(2, Math.min(bounds.w, bounds.h) * 0.1);
    graphics.fillStyle(plan.palette.propDark, 0.96);
    graphics.fillCircle(center.x, center.y, radius);
    graphics.lineStyle(1, plan.palette.prop, 0.42);
    graphics.strokeCircle(center.x, center.y, radius);
  }
}

function bandThickness(bounds, desired) {
  return Math.max(1, Math.min(desired, Math.min(bounds.w, bounds.h)));
}

function outerEdgeBand(module, desired = 3) {
  const { bounds, edge } = module;
  const thickness = bandThickness(bounds, desired);
  if (edge === "north") return { x: bounds.x, y: bounds.y, w: bounds.w, h: thickness };
  if (edge === "east") {
    return {
      x: bounds.x + bounds.w - thickness,
      y: bounds.y,
      w: thickness,
      h: bounds.h
    };
  }
  if (edge === "west") return { x: bounds.x, y: bounds.y, w: thickness, h: bounds.h };
  return {
    x: bounds.x,
    y: bounds.y + bounds.h - thickness,
    w: bounds.w,
    h: thickness
  };
}

function innerEdgeBand(module, desired = 2) {
  const { bounds, edge } = module;
  const thickness = bandThickness(bounds, desired);
  if (edge === "north") {
    return {
      x: bounds.x,
      y: bounds.y + bounds.h - thickness,
      w: bounds.w,
      h: thickness
    };
  }
  if (edge === "east") return { x: bounds.x, y: bounds.y, w: thickness, h: bounds.h };
  if (edge === "west") {
    return {
      x: bounds.x + bounds.w - thickness,
      y: bounds.y,
      w: thickness,
      h: bounds.h
    };
  }
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: thickness };
}

function drawGenericFrontage(graphics, module, plan) {
  drawRect(graphics, {
    x: module.bounds.x + 2,
    y: module.bounds.y + 3,
    w: module.bounds.w,
    h: module.bounds.h
  }, plan.palette.roofShadow, 0.42);
  drawRect(graphics, module.bounds, plan.palette.canopy, 1);
  strokeRect(graphics, module.bounds, 2, plan.palette.parapetDark, 0.92);
  drawRect(graphics, outerEdgeBand(module, 3), plan.palette.wall, 0.92);
}

function drawPoliceFrontage(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.canopy, 1);
  strokeRect(graphics, module.bounds, 2, plan.palette.parapetLight, 0.92);
  drawRect(graphics, outerEdgeBand(module, 4), plan.palette.accent, 0.95);
  drawRect(graphics, innerEdgeBand(module, 2), plan.palette.accentSoft, 0.78);

  const center = centerOf(module.bounds);
  const radius = Math.max(2, Math.min(module.bounds.w, module.bounds.h) * 0.2);
  graphics.fillStyle(plan.palette.accentSoft, 1);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.lineStyle(1, plan.palette.label, 0.9);
  graphics.strokeCircle(center.x, center.y, radius);
  graphics.lineBetween(center.x - radius * 0.55, center.y, center.x + radius * 0.55, center.y);
  graphics.lineBetween(center.x, center.y - radius * 0.55, center.x, center.y + radius * 0.55);
}

function drawClubFrontage(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.serviceDark, 1);
  strokeRect(graphics, module.bounds, 2, plan.palette.accentSoft, 0.9);
  drawRect(graphics, outerEdgeBand(module, 4), plan.palette.accent, 0.96);

  const center = centerOf(module.bounds);
  const scale = Math.max(3, Math.min(module.bounds.w, module.bounds.h) * 0.27);
  graphics.lineStyle(2, plan.palette.label, 0.9);
  graphics.lineBetween(center.x - scale, center.y - scale * 0.4, center.x + scale, center.y - scale * 0.4);
  graphics.lineBetween(center.x - scale, center.y - scale * 0.4, center.x, center.y + scale * 0.08);
  graphics.lineBetween(center.x + scale, center.y - scale * 0.4, center.x, center.y + scale * 0.08);
  graphics.lineBetween(center.x, center.y + scale * 0.08, center.x, center.y + scale * 0.68);
}

function drawChurchFrontage(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.canopy, 1);
  strokeRect(graphics, module.bounds, 2, plan.palette.parapetMid, 0.9);
  drawRect(graphics, outerEdgeBand(module, 3), plan.palette.wall, 0.92);

  const center = centerOf(module.bounds);
  const size = Math.max(4, Math.min(module.bounds.w, module.bounds.h) * 0.3);
  drawRect(graphics, {
    x: center.x - size * 0.11,
    y: center.y - size * 0.62,
    w: size * 0.22,
    h: size * 1.24
  }, plan.palette.accent, 0.94);
  drawRect(graphics, {
    x: center.x - size * 0.44,
    y: center.y - size * 0.16,
    w: size * 0.88,
    h: size * 0.22
  }, plan.palette.accent, 0.94);
}

function drawFrontage(graphics, module, plan) {
  if (module.variant === FRONTAGE_KINDS.POLICE) drawPoliceFrontage(graphics, module, plan);
  else if (module.variant === FRONTAGE_KINDS.CLUB) drawClubFrontage(graphics, module, plan);
  else if (module.variant === FRONTAGE_KINDS.CHURCH) drawChurchFrontage(graphics, module, plan);
  else drawGenericFrontage(graphics, module, plan);
}

function drawServiceStrip(graphics, module, plan) {
  const { bounds } = module;
  drawRect(graphics, bounds, plan.palette.serviceDark, 0.98);
  graphics.lineStyle(1, plan.palette.serviceMid, 0.52);
  graphics.lineBetween(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y);

  const slotCount = Math.max(1, Math.floor(Number(module.slots) || 1));
  const gap = bounds.w / (slotCount + 1);
  const slotWidth = Math.max(3, Math.min(10, gap * 0.46));
  const slotHeight = Math.max(2, Math.min(4, bounds.h * 0.42));
  for (let index = 0; index < slotCount; index += 1) {
    const x = bounds.x + gap * (index + 1) - slotWidth / 2;
    const y = bounds.y + bounds.h * 0.44;
    drawRect(graphics, {
      x,
      y,
      w: slotWidth,
      h: slotHeight
    }, plan.palette.serviceWindow, 0.88);
    graphics.lineStyle(1, plan.palette.serviceMid, 0.34);
    graphics.strokeRect(x, y, slotWidth, slotHeight);
  }
}

function drawServiceLight(graphics, module, plan) {
  const center = centerOf(module.bounds);
  const radius = Math.max(2, Math.min(module.bounds.w, module.bounds.h) / 2);
  graphics.fillStyle(plan.palette.serviceLight, 0.08);
  graphics.fillCircle(center.x, center.y, radius * 2.7);
  graphics.fillStyle(plan.palette.serviceLight, 0.18);
  graphics.fillCircle(center.x, center.y, radius * 1.65);
  graphics.fillStyle(plan.palette.serviceLight, 0.92);
  graphics.fillCircle(center.x, center.y, Math.max(1.5, radius * 0.38));
}

function drawSkylight(graphics, module, plan) {
  const { bounds } = module;
  drawRect(graphics, {
    x: bounds.x + 3,
    y: bounds.y + 4,
    w: bounds.w,
    h: bounds.h
  }, plan.palette.roofShadow, 0.58);
  drawRect(graphics, bounds, plan.palette.propDark, 1);
  const frame = Math.max(2, Math.min(4, Math.min(bounds.w, bounds.h) * 0.13));
  drawRect(graphics, {
    x: bounds.x + frame,
    y: bounds.y + frame,
    w: Math.max(1, bounds.w - frame * 2),
    h: Math.max(1, bounds.h - frame * 2)
  }, plan.palette.glass, 1);
  strokeRect(graphics, bounds, 2, plan.palette.parapetLight, 0.82);

  const dividerX = bounds.x + bounds.w / 2;
  graphics.lineStyle(1, plan.palette.glassHighlight, 0.62);
  graphics.lineBetween(
    dividerX,
    bounds.y + frame + 1,
    dividerX,
    bounds.y + bounds.h - frame - 1
  );
  if (bounds.h >= 22) {
    const dividerY = bounds.y + bounds.h / 2;
    graphics.lineBetween(
      bounds.x + frame + 1,
      dividerY,
      bounds.x + bounds.w - frame - 1,
      dividerY
    );
  }
}

function drawHvac(graphics, module, plan) {
  const { bounds } = module;
  drawRect(graphics, {
    x: bounds.x + 3,
    y: bounds.y + 3,
    w: bounds.w,
    h: bounds.h
  }, plan.palette.roofShadow, 0.52);
  drawRect(graphics, bounds, plan.palette.prop, 1);
  strokeRect(graphics, bounds, 2, plan.palette.propDark, 0.96);

  const fanCount = bounds.w >= bounds.h * 1.45 ? 2 : 1;
  const radius = Math.max(2, Math.min(bounds.h * 0.27, bounds.w / (fanCount * 3)));
  for (let index = 0; index < fanCount; index += 1) {
    const x = bounds.x + bounds.w * (index + 1) / (fanCount + 1);
    const y = bounds.y + bounds.h / 2;
    graphics.fillStyle(plan.palette.propDark, 0.94);
    graphics.fillCircle(x, y, radius);
    graphics.lineStyle(1, plan.palette.parapetLight, 0.46);
    graphics.strokeCircle(x, y, radius);
    graphics.lineBetween(x - radius * 0.7, y, x + radius * 0.7, y);
    graphics.lineBetween(x, y - radius * 0.7, x, y + radius * 0.7);
  }
}

function drawVent(graphics, module, plan) {
  const center = centerOf(module.bounds);
  const radius = Math.max(2, Math.min(module.bounds.w, module.bounds.h) / 2);
  graphics.fillStyle(plan.palette.roofShadow, 0.5);
  graphics.fillCircle(center.x + 1.5, center.y + 2, radius);
  graphics.fillStyle(plan.palette.propDark, 1);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.fillStyle(plan.palette.prop, 0.86);
  graphics.fillCircle(
    center.x - radius * 0.18,
    center.y - radius * 0.18,
    radius * 0.5
  );
}

function drawHatch(graphics, module, plan) {
  drawRect(graphics, {
    x: module.bounds.x + 2,
    y: module.bounds.y + 3,
    w: module.bounds.w,
    h: module.bounds.h
  }, plan.palette.roofShadow, 0.46);
  drawRect(graphics, module.bounds, plan.palette.propDark, 1);
  strokeRect(graphics, module.bounds, 2, plan.palette.prop, 0.82);
  const inset = Math.max(2, Math.min(4, module.bounds.w * 0.16));
  strokeRect(graphics, {
    x: module.bounds.x + inset,
    y: module.bounds.y + inset,
    w: Math.max(1, module.bounds.w - inset * 2),
    h: Math.max(1, module.bounds.h - inset * 2)
  }, 1, plan.palette.serviceMid, 0.46);
}

function drawAntenna(graphics, module, plan) {
  const center = centerOf(module.bounds);
  const radius = Math.max(2, Math.min(module.bounds.w, module.bounds.h) * 0.2);
  graphics.fillStyle(plan.palette.roofShadow, 0.48);
  graphics.fillCircle(center.x + 1.5, center.y + 2, radius * 1.35);
  graphics.fillStyle(plan.palette.propDark, 1);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.lineStyle(2, plan.palette.prop, 0.92);
  graphics.lineBetween(center.x, center.y - radius, center.x, module.bounds.y);
  graphics.lineStyle(1, plan.palette.prop, 0.78);
  graphics.lineBetween(center.x, center.y, module.bounds.x, module.bounds.y + module.bounds.h);
  graphics.lineBetween(
    center.x,
    center.y,
    module.bounds.x + module.bounds.w,
    module.bounds.y + module.bounds.h
  );
}

function drawSatelliteDish(graphics, module, plan) {
  const center = centerOf(module.bounds);
  const radius = Math.max(3, Math.min(module.bounds.w, module.bounds.h) * 0.42);
  graphics.fillStyle(plan.palette.roofShadow, 0.46);
  graphics.fillCircle(center.x + 2, center.y + 2, radius);
  graphics.fillStyle(plan.palette.prop, 0.95);
  graphics.fillCircle(center.x, center.y, radius);
  graphics.fillStyle(plan.palette.roofShade, 1);
  graphics.fillCircle(
    center.x + radius * 0.34,
    center.y - radius * 0.18,
    radius * 0.72
  );
}

function drawAccentStrip(graphics, module, plan) {
  if (module.variant === "club") {
    graphics.lineStyle(8, plan.palette.accentSoft, 0.18);
    graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
    graphics.lineStyle(3, plan.palette.accent, 0.96);
    graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
    graphics.lineStyle(1, plan.palette.label, 0.72);
    graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
    return;
  }
  graphics.lineStyle(4, plan.palette.accentSoft, 0.34);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
  graphics.lineStyle(2, plan.palette.accent, 0.94);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
}

function drawRoofRidge(graphics, module, plan) {
  graphics.lineStyle(5, plan.palette.roofShadow, 0.4);
  graphics.lineBetween(
    module.x1 + 1,
    module.y1 + 2,
    module.x2 + 1,
    module.y2 + 2
  );
  graphics.lineStyle(2, plan.palette.parapetLight, 0.5);
  graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
}

function drawCrossMarker(graphics, module, plan) {
  const { bounds } = module;
  const center = centerOf(bounds);
  const thickness = Math.max(2, Math.floor(Math.min(bounds.w, bounds.h) * 0.18));
  drawRect(graphics, {
    x: center.x - thickness / 2 + 1,
    y: bounds.y + 2,
    w: thickness,
    h: bounds.h
  }, plan.palette.roofShadow, 0.38);
  drawRect(graphics, {
    x: center.x - thickness / 2,
    y: bounds.y,
    w: thickness,
    h: bounds.h
  }, plan.palette.accent, 0.95);
  drawRect(graphics, {
    x: bounds.x,
    y: center.y - thickness / 2,
    w: bounds.w,
    h: thickness
  }, plan.palette.accent, 0.95);
}

function drawYard(graphics, module, plan) {
  drawRect(graphics, module.bounds, plan.palette.yard, 1);
  strokeRect(graphics, module.bounds, 1, plan.palette.fence, 0.8);
}

function drawFence(graphics, module, plan) {
  if (
    Number.isFinite(module.x1)
      && Number.isFinite(module.y1)
      && Number.isFinite(module.x2)
      && Number.isFinite(module.y2)
  ) {
    graphics.lineStyle(2, plan.palette.fence, 0.9);
    graphics.lineBetween(module.x1, module.y1, module.x2, module.y2);
  } else if (module.bounds) {
    strokeRect(graphics, module.bounds, 2, plan.palette.fence, 0.9);
  }
}

const MODULE_RENDERERS = {
  [MODULE_KINDS.FOUNDATION]: drawFoundation,
  [MODULE_KINDS.ROOF_MASS]: drawRoofMass,
  [MODULE_KINDS.ROOF_TEXTURE_LINE]: drawRoofTextureLine,
  [MODULE_KINDS.PARAPET_EDGE]: drawParapetEdge,
  [MODULE_KINDS.ROOF_ANNEX]: drawRoofAnnex,
  [MODULE_KINDS.FRONTAGE]: drawFrontage,
  [MODULE_KINDS.SERVICE_STRIP]: drawServiceStrip,
  [MODULE_KINDS.SERVICE_LIGHT]: drawServiceLight,
  [MODULE_KINDS.SKYLIGHT]: drawSkylight,
  [MODULE_KINDS.HVAC]: drawHvac,
  [MODULE_KINDS.VENT]: drawVent,
  [MODULE_KINDS.HATCH]: drawHatch,
  [MODULE_KINDS.ANTENNA]: drawAntenna,
  [MODULE_KINDS.SATELLITE_DISH]: drawSatelliteDish,
  [MODULE_KINDS.ACCENT_STRIP]: drawAccentStrip,
  [MODULE_KINDS.ROOF_RIDGE]: drawRoofRidge,
  [MODULE_KINDS.CROSS_MARKER]: drawCrossMarker,
  [MODULE_KINDS.YARD]: drawYard,
  [MODULE_KINDS.FENCE]: drawFence
};

function drawDebugBounds(graphics, module) {
  if (!module.bounds) return;
  graphics.lineStyle(1, 0xffd65c, 0.45);
  graphics.strokeRect(
    module.bounds.x,
    module.bounds.y,
    module.bounds.w,
    module.bounds.h
  );
}

export function renderBuildingPresentation(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  for (const module of plan.modules || []) {
    const renderer = MODULE_RENDERERS[module.kind];
    if (renderer) renderer(graphics, module, plan, options);
    if (options.showModuleBounds) drawDebugBounds(graphics, module);
  }
  return plan;
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = cachedBuildingPlan(building, options);
  return renderBuildingPresentation(graphics, plan, options);
}
