import { MODULE_KINDS } from "./BuildingPresentationCatalog.js";
import { createBuildingPresentationPlan } from "./BuildingPresentationPlanner.js";
import {
  clearBuildingPresentationCache as clearBaseBuildingPresentationCache,
  renderBuildingPresentation as renderBaseBuildingPresentation
} from "./BuildingPresentationRenderer.js";

const POLISHED_PLAN_CACHE = new WeakMap();

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

function cachedPlan(building, options = {}) {
  if (!building || typeof building !== "object" || options.cache === false) {
    return createBuildingPresentationPlan(building, options);
  }
  const key = planningOptionsKey(options);
  let entries = POLISHED_PLAN_CACHE.get(building);
  if (!entries) {
    entries = new Map();
    POLISHED_PLAN_CACHE.set(building, entries);
  }
  if (!entries.has(key)) entries.set(key, createBuildingPresentationPlan(building, options));
  return entries.get(key);
}

function forwardFillStyle(graphics, style) {
  graphics.fillStyle(style.color, style.alpha);
}

function layeredRectShadow(graphics, style, args, scale = 1) {
  const [x, y, w, h] = args.map(Number);
  const alpha = Math.max(0, Number(style.alpha) || 0);
  const passes = [
    { x: 3.2 * scale, y: 3.8 * scale, spread: 1.3 * scale, alpha: alpha * 0.16 },
    { x: 1.7 * scale, y: 2.1 * scale, spread: 0.6 * scale, alpha: alpha * 0.27 },
    { x: 0.6 * scale, y: 0.9 * scale, spread: 0, alpha: alpha * 0.42 }
  ];
  for (const pass of passes) {
    graphics.fillStyle(style.color, pass.alpha);
    graphics.fillRect(
      x + pass.x - pass.spread,
      y + pass.y - pass.spread,
      Math.max(1, w + pass.spread * 2),
      Math.max(1, h + pass.spread * 2)
    );
  }
  forwardFillStyle(graphics, style);
}

function offsetPoints(points, x, y) {
  return points.map(point => ({ x: point.x + x, y: point.y + y }));
}

function layeredPolygonShadow(graphics, style, points, closePath) {
  const alpha = Math.max(0, Number(style.alpha) || 0);
  const passes = [
    { x: 3.2, y: 3.8, alpha: alpha * 0.16 },
    { x: 1.7, y: 2.1, alpha: alpha * 0.27 },
    { x: 0.6, y: 0.9, alpha: alpha * 0.42 }
  ];
  for (const pass of passes) {
    graphics.fillStyle(style.color, pass.alpha);
    graphics.fillPoints(offsetPoints(points, pass.x, pass.y), closePath);
  }
  forwardFillStyle(graphics, style);
}

function layeredCircleShadow(graphics, style, args) {
  const [x, y, radius] = args.map(Number);
  const alpha = Math.max(0, Number(style.alpha) || 0);
  const passes = [
    { x: 2.8, y: 3.3, radius: radius + 1, alpha: alpha * 0.14 },
    { x: 1.4, y: 1.8, radius: radius + 0.4, alpha: alpha * 0.26 },
    { x: 0.5, y: 0.8, radius, alpha: alpha * 0.42 }
  ];
  for (const pass of passes) {
    graphics.fillStyle(style.color, pass.alpha);
    graphics.fillCircle(x + pass.x, y + pass.y, Math.max(1, pass.radius));
  }
  forwardFillStyle(graphics, style);
}

function inwardOffset(orientation, amount) {
  if (orientation === "north") return { x: 0, y: amount };
  if (orientation === "east") return { x: -amount, y: 0 };
  if (orientation === "south") return { x: 0, y: -amount };
  return { x: amount, y: 0 };
}

function outwardOffset(orientation, amount) {
  if (orientation === "north") return { x: 0, y: -amount };
  if (orientation === "east") return { x: amount, y: 0 };
  if (orientation === "south") return { x: 0, y: amount };
  return { x: -amount, y: 0 };
}

function drawArchitecturalParapet(graphics, module, plan, line, args) {
  const [x1, y1, x2, y2] = args.map(Number);
  const orientation = module.orientation;
  const lightFacing = orientation === "north" || orientation === "west";
  const width = Number(line.width) || 1;
  const color = Number(line.color);
  const alpha = Number(line.alpha) || 0;
  const depth = Math.max(3, Number(plan.effects?.wallDepth) || 5);

  if (width >= 5 && color === plan.palette.parapetDark) {
    if (!lightFacing) {
      const outward = outwardOffset(orientation, depth * 0.42);
      graphics.lineStyle(Math.max(3, depth * 0.9), plan.palette.wall, 0.78);
      graphics.lineBetween(
        x1 + outward.x,
        y1 + outward.y,
        x2 + outward.x,
        y2 + outward.y
      );
      graphics.lineStyle(1, plan.palette.wallHighlight, 0.13);
      graphics.lineBetween(
        x1 + outward.x * 0.24,
        y1 + outward.y * 0.24,
        x2 + outward.x * 0.24,
        y2 + outward.y * 0.24
      );
    } else {
      graphics.lineStyle(3, plan.palette.parapetDark, 0.54);
      graphics.lineBetween(x1, y1, x2, y2);
    }
    return;
  }

  if (width >= 3 && (
    color === plan.palette.parapetLight
      || color === plan.palette.parapetMid
      || color === plan.palette.parapetDark
  )) {
    graphics.lineStyle(2.5, plan.palette.parapetMid, lightFacing ? 0.76 : 0.68);
    graphics.lineBetween(x1, y1, x2, y2);
    if (lightFacing) {
      graphics.lineStyle(1, plan.palette.parapetLight, 0.32);
      graphics.lineBetween(x1, y1, x2, y2);
    }
    return;
  }

  const inward = inwardOffset(orientation, 0.4);
  graphics.lineStyle(
    Math.min(1.2, Math.max(1, width)),
    plan.palette.roofShadow,
    Math.min(0.42, Math.max(0.24, alpha))
  );
  graphics.lineBetween(
    x1 + inward.x,
    y1 + inward.y,
    x2 + inward.x,
    y2 + inward.y
  );
}

function drawMutedRectOutline(graphics, bounds, plan) {
  const x = Number(bounds.x);
  const y = Number(bounds.y);
  const w = Number(bounds.w);
  const h = Number(bounds.h);

  graphics.lineStyle(2.5, plan.palette.parapetMid, 0.7);
  graphics.lineBetween(x, y, x + w, y);
  graphics.lineBetween(x, y, x, y + h);

  graphics.lineStyle(1, plan.palette.parapetLight, 0.28);
  graphics.lineBetween(x + 1, y + 1, x + w - 1, y + 1);
  graphics.lineBetween(x + 1, y + 1, x + 1, y + h - 1);

  graphics.lineStyle(2, plan.palette.parapetDark, 0.6);
  graphics.lineBetween(x, y + h, x + w, y + h);
  graphics.lineBetween(x + w, y, x + w, y + h);
}

function createModuleGraphicsProxy(graphics, module, plan) {
  const state = {
    fill: { color: null, alpha: 1 },
    line: { width: 1, color: null, alpha: 1 }
  };
  let proxy;

  const handlers = {
    fillStyle(color, alpha = 1) {
      state.fill = { color: Number(color), alpha: Number(alpha) };
      graphics.fillStyle(color, alpha);
      return proxy;
    },

    lineStyle(width, color, alpha = 1) {
      state.line = {
        width: Number(width),
        color: Number(color),
        alpha: Number(alpha)
      };
      let nextWidth = Number(width);
      let nextAlpha = Number(alpha);
      const architecturalDarkLine = Number(color) === plan.palette.parapetDark
        && (
          module.kind === MODULE_KINDS.PARAPET_EDGE
            || module.kind === MODULE_KINDS.FOUNDATION
            || module.kind === MODULE_KINDS.ROOF_ANNEX
        );
      if (architecturalDarkLine) {
        const parapetEdge = module.kind === MODULE_KINDS.PARAPET_EDGE;
        nextWidth = Math.min(parapetEdge ? 3 : 2, nextWidth);
        nextAlpha = Math.min(parapetEdge ? 0.54 : 0.6, nextAlpha);
      } else if (Number(color) === plan.palette.parapetLight) {
        nextWidth = Math.min(2, nextWidth);
        nextAlpha = Math.min(0.36, nextAlpha);
      } else if (Number(color) === plan.palette.wallHighlight) {
        nextAlpha = Math.min(0.16, nextAlpha);
      }
      graphics.lineStyle(nextWidth, color, nextAlpha);
      return proxy;
    },

    fillRect(...args) {
      const shadowColor = state.fill.color === plan.palette.worldShadow
        || state.fill.color === plan.palette.roofShadow;
      if (shadowColor && state.fill.alpha >= 0.35) {
        layeredRectShadow(
          graphics,
          state.fill,
          args,
          state.fill.color === plan.palette.worldShadow ? 1.35 : 0.9
        );
      } else {
        graphics.fillRect(...args);
      }
      return proxy;
    },

    fillPoints(points, closePath) {
      if (
        module.kind === MODULE_KINDS.ROOF_MASS
          && state.fill.color === plan.palette.roofShadow
          && state.fill.alpha >= 0.35
      ) {
        layeredPolygonShadow(graphics, state.fill, points, closePath);
      } else {
        graphics.fillPoints(points, closePath);
      }
      return proxy;
    },

    fillCircle(...args) {
      if (
        state.fill.color === plan.palette.roofShadow
          && state.fill.alpha >= 0.35
      ) {
        layeredCircleShadow(graphics, state.fill, args);
      } else {
        graphics.fillCircle(...args);
      }
      return proxy;
    },

    lineBetween(...args) {
      if (module.kind === MODULE_KINDS.PARAPET_EDGE) {
        drawArchitecturalParapet(graphics, module, plan, state.line, args);
      } else {
        graphics.lineBetween(...args);
      }
      return proxy;
    },

    strokeRect(...args) {
      if (
        (module.kind === MODULE_KINDS.FOUNDATION
          || module.kind === MODULE_KINDS.ROOF_ANNEX)
          && state.line.color === plan.palette.parapetDark
      ) {
        drawMutedRectOutline(graphics, {
          x: args[0],
          y: args[1],
          w: args[2],
          h: args[3]
        }, plan);
      } else {
        graphics.strokeRect(...args);
      }
      return proxy;
    },

    strokeCircle(...args) {
      graphics.strokeCircle(...args);
      return proxy;
    }
  };

  proxy = new Proxy(graphics, {
    get(target, property) {
      if (Object.hasOwn(handlers, property)) return handlers[property];
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  return proxy;
}

export function clearBuildingPresentationCache(building) {
  if (building && typeof building === "object") POLISHED_PLAN_CACHE.delete(building);
  clearBaseBuildingPresentationCache(building);
}

export function renderBuildingPresentation(graphics, plan, options = {}) {
  if (!graphics || !plan) return plan;
  for (const module of plan.modules || []) {
    const moduleGraphics = createModuleGraphicsProxy(graphics, module, plan);
    renderBaseBuildingPresentation(
      moduleGraphics,
      { ...plan, modules: [module] },
      options
    );
  }
  return plan;
}

export function drawBuildingPresentation(graphics, building, options = {}) {
  const plan = cachedPlan(building, options);
  return renderBuildingPresentation(graphics, plan, options);
}
