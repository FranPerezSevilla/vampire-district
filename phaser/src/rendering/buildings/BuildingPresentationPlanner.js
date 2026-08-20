import {
  BUILDING_PRESENTATION_VERSION,
  DETAIL_LEVELS,
  FRONTAGE_KINDS,
  MODULE_KINDS,
  MODULE_LAYERS,
  ROOFTOP_PROP_KINDS,
  getBuildingLayoutRecipe,
  resolveBuildingPalette,
  resolveBuildingPresentationDefinition
} from "./BuildingPresentationCatalog.js";
import {
  ROOF_SURFACE_KINDS,
  resolveBuildingVisualProfile
} from "./BuildingVisualProfileCatalog.js";
import {
  boundsFromPoints,
  clamp,
  createRoofSilhouetteGeometry,
  insetRect,
  normalizeRect,
  rectContains,
  rectsOverlap
} from "./BuildingSilhouetteGeometry.js";

const EPSILON = 0.001;
const VALID_FRONTAGE_EDGES = new Set(["north", "east", "south", "west"]);

function stableHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function moduleBounds(module) {
  if (module.bounds) return module.bounds;
  if (Array.isArray(module.points) && module.points.length > 0) return boundsFromPoints(module.points);
  if ([module.x1, module.y1, module.x2, module.y2].every(Number.isFinite)) {
    return {
      x: Math.min(module.x1, module.x2),
      y: Math.min(module.y1, module.y2),
      w: Math.abs(module.x2 - module.x1),
      h: Math.abs(module.y2 - module.y1)
    };
  }
  return null;
}

function moduleId(building, suffix) {
  return `${building.id || building.sign || "building"}:presentation:${suffix}`;
}

function requestedLayoutId(building, options) {
  const requested = options.layoutId
    || building.presentation?.layoutId
    || building.presentation?.layout;
  return getBuildingLayoutRecipe(requested)?.id || null;
}

function recipeFits(recipe, footprint) {
  return footprint.w >= (recipe.minimumWidth || 0)
    && footprint.h >= (recipe.minimumHeight || 0);
}

function chooseLayoutRecipe(building, footprint, definition, visualProfile, random, options) {
  const explicit = requestedLayoutId(building, options);
  if (explicit) {
    const recipe = getBuildingLayoutRecipe(explicit);
    if (recipeFits(recipe, footprint)) return { recipe, fallback: false, requested: explicit };
    return {
      recipe: getBuildingLayoutRecipe("rectangle"),
      fallback: true,
      requested: explicit
    };
  }

  if (definition.archetypeId !== "generic") {
    const preferred = getBuildingLayoutRecipe(definition.layoutId)
      || getBuildingLayoutRecipe(definition.archetype.defaultLayout);
    if (preferred && recipeFits(preferred, footprint)) {
      return { recipe: preferred, fallback: false, requested: null };
    }
    return {
      recipe: getBuildingLayoutRecipe("rectangle"),
      fallback: true,
      requested: preferred?.id || definition.layoutId
    };
  }

  const candidates = (visualProfile.layoutCandidates || definition.archetype.layoutCandidates)
    .map(getBuildingLayoutRecipe)
    .filter(recipe => recipe && recipeFits(recipe, footprint));
  const recipe = candidates[Math.floor(random() * candidates.length)]
    || getBuildingLayoutRecipe("rectangle");
  return { recipe, fallback: false, requested: null };
}

function hasFrontageOverride(building, options) {
  return options.frontage !== undefined
    || building.presentation?.frontage !== undefined;
}

function applyVisualProfileDefaults(building, definition, visualProfile, options) {
  return {
    ...definition,
    frontage: hasFrontageOverride(building, options)
      ? definition.frontage
      : (visualProfile.frontage || definition.frontage),
    showLabel: Boolean(definition.showLabel || visualProfile.showLabel)
  };
}

function createFoundationModule(building, footprint, visualProfile) {
  return {
    id: moduleId(building, "foundation"),
    kind: MODULE_KINDS.FOUNDATION,
    layer: MODULE_LAYERS.foundation,
    role: visualProfile.serviceStrip ? "low-roof-with-service-edge" : "low-service-roof",
    profileId: visualProfile.id,
    bounds: { ...footprint }
  };
}

function createRoofMassModule(building, geometry, layoutId, visualProfile) {
  return {
    id: moduleId(building, "roof-mass"),
    kind: MODULE_KINDS.ROOF_MASS,
    layer: MODULE_LAYERS.roof,
    layoutId,
    profileId: visualProfile.id,
    surfaceKind: visualProfile.surfaceKind,
    points: geometry.contour.map(point => ({ ...point })),
    bounds: { ...geometry.contourBounds }
  };
}

function createParapetModules(building, geometry) {
  return geometry.parapetEdges.map((edge, index) => ({
    id: moduleId(building, `edge:${index}:${edge.orientation}`),
    kind: MODULE_KINDS.PARAPET_EDGE,
    layer: MODULE_LAYERS.edge,
    orientation: edge.orientation,
    x1: edge.x1,
    y1: edge.y1,
    x2: edge.x2,
    y2: edge.y2,
    bounds: { ...edge.bounds }
  }));
}

function frontageDimensions(frontage, footprint) {
  const minSide = Math.min(footprint.w, footprint.h);
  if (frontage === FRONTAGE_KINDS.POLICE) {
    return { width: clamp(footprint.w * 0.24, 30, 58), depth: clamp(minSide * 0.1, 11, 17) };
  }
  if (frontage === FRONTAGE_KINDS.CLUB) {
    return { width: clamp(footprint.w * 0.25, 28, 56), depth: clamp(minSide * 0.1, 11, 18) };
  }
  if (frontage === FRONTAGE_KINDS.CHURCH) {
    return { width: clamp(footprint.w * 0.17, 20, 38), depth: clamp(minSide * 0.095, 10, 16) };
  }
  if (frontage === FRONTAGE_KINDS.NONE) return { width: 0, depth: 0 };
  return { width: clamp(footprint.w * 0.15, 18, 36), depth: clamp(minSide * 0.065, 7, 11) };
}

function createFrontageModule(building, footprint, definition) {
  if (definition.frontage === FRONTAGE_KINDS.NONE) return null;
  const edge = VALID_FRONTAGE_EDGES.has(definition.frontageEdge)
    ? definition.frontageEdge
    : "south";
  const dimensions = frontageDimensions(definition.frontage, footprint);
  const inset = Math.max(0, Math.min(2, Math.min(footprint.w, footprint.h) / 2 - 0.5));
  const horizontal = edge === "north" || edge === "south";
  const available = Math.max(1, (horizontal ? footprint.w : footprint.h) - inset * 2);
  const availableDepth = Math.max(1, (horizontal ? footprint.h : footprint.w) - inset * 2);
  const primarySize = clamp(dimensions.width, 1, available);
  const depth = clamp(dimensions.depth, 1, availableDepth);
  const offset = definition.frontageOffset * Math.max(0, (available - primarySize) / 2);
  let bounds;

  if (horizontal) {
    const x = footprint.x + footprint.w / 2 - primarySize / 2 + offset;
    const y = edge === "north"
      ? footprint.y + inset
      : footprint.y + footprint.h - depth - inset;
    bounds = { x, y, w: primarySize, h: depth };
  } else {
    const y = footprint.y + footprint.h / 2 - primarySize / 2 + offset;
    const x = edge === "west"
      ? footprint.x + inset
      : footprint.x + footprint.w - depth - inset;
    bounds = { x, y, w: depth, h: primarySize };
  }

  return {
    id: moduleId(building, `frontage:${definition.frontage}`),
    kind: MODULE_KINDS.FRONTAGE,
    layer: MODULE_LAYERS.frontage,
    variant: definition.frontage,
    edge,
    bounds
  };
}

function createRoofAnnexModule(building, geometry, footprint, visualProfile, random) {
  const specification = visualProfile.annex;
  if (!specification || random() > (specification.chance ?? 1)) return null;
  if (footprint.w < 110 || footprint.h < 80) return null;

  const candidates = [...geometry.cells].sort((a, b) => (
    a.row - b.row || b.column - a.column
  ));
  const cell = candidates.find(candidate => candidate.bounds.w >= 34 && candidate.bounds.h >= 30);
  if (!cell) return null;

  const safe = insetRect(cell.bounds, 6);
  const width = clamp(
    geometry.contourBounds.w * (specification.widthRatio || 0.28),
    28,
    safe.w
  );
  const height = clamp(
    geometry.contourBounds.h * (specification.heightRatio || 0.34),
    24,
    safe.h
  );
  if (width < 18 || height < 18) return null;

  const bounds = {
    x: safe.x + safe.w - width,
    y: safe.y,
    w: width,
    h: height
  };
  if (!rectContains(footprint, bounds)) return null;

  return {
    id: moduleId(building, "annex:service-room"),
    kind: MODULE_KINDS.ROOF_ANNEX,
    layer: MODULE_LAYERS.annex,
    variant: specification.kind || "service-room",
    surfaceKind: visualProfile.surfaceKind,
    bounds
  };
}

function mergeIntervals(intervals, maximumGap = 0) {
  const sorted = intervals
    .filter(interval => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
  const merged = [];

  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end + maximumGap) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function textureLineModule(building, suffix, variant, x1, y1, x2, y2) {
  return {
    id: moduleId(building, `texture:${suffix}`),
    kind: MODULE_KINDS.ROOF_TEXTURE_LINE,
    layer: MODULE_LAYERS.surface,
    variant,
    x1,
    y1,
    x2,
    y2,
    bounds: {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1)
    }
  };
}

function verticalTextureSegments(building, geometry, spacing, variant) {
  const modules = [];
  const bounds = geometry.contourBounds;
  const margin = 4;
  let index = 0;

  for (let x = bounds.x + spacing; x < bounds.x + bounds.w - spacing * 0.45; x += spacing) {
    const intervals = geometry.cells
      .filter(cell => x >= cell.bounds.x + margin && x <= cell.bounds.x + cell.bounds.w - margin)
      .map(cell => ({
        start: cell.bounds.y + margin,
        end: cell.bounds.y + cell.bounds.h - margin
      }));
    for (const interval of mergeIntervals(intervals, margin * 2)) {
      modules.push(textureLineModule(
        building,
        `${variant}:v:${index++}`,
        variant,
        x,
        interval.start,
        x,
        interval.end
      ));
    }
  }
  return modules;
}

function horizontalTextureSegments(building, geometry, ratios, variant) {
  const modules = [];
  const bounds = geometry.contourBounds;
  const margin = 4;
  let index = 0;

  for (const ratio of ratios) {
    const y = bounds.y + bounds.h * ratio;
    const intervals = geometry.cells
      .filter(cell => y >= cell.bounds.y + margin && y <= cell.bounds.y + cell.bounds.h - margin)
      .map(cell => ({
        start: cell.bounds.x + margin,
        end: cell.bounds.x + cell.bounds.w - margin
      }));
    for (const interval of mergeIntervals(intervals, margin * 2)) {
      modules.push(textureLineModule(
        building,
        `${variant}:h:${index++}`,
        variant,
        interval.start,
        y,
        interval.end,
        y
      ));
    }
  }
  return modules;
}

function createRoofTextureModules(building, geometry, visualProfile) {
  if (visualProfile.surfaceKind === ROOF_SURFACE_KINDS.CORRUGATED) {
    return verticalTextureSegments(
      building,
      geometry,
      clamp(visualProfile.textureSpacing || 9, 7, 14),
      ROOF_SURFACE_KINDS.CORRUGATED
    );
  }
  if (visualProfile.surfaceKind === ROOF_SURFACE_KINDS.MEMBRANE) {
    return horizontalTextureSegments(
      building,
      geometry,
      geometry.contourBounds.h >= 130 ? [0.28, 0.54, 0.78] : [0.36, 0.68],
      ROOF_SURFACE_KINDS.MEMBRANE
    );
  }
  if (visualProfile.surfaceKind === ROOF_SURFACE_KINDS.CIVIC) {
    return [
      ...horizontalTextureSegments(building, geometry, [0.5], ROOF_SURFACE_KINDS.CIVIC),
      ...verticalTextureSegments(
        building,
        geometry,
        Math.max(24, geometry.contourBounds.w * 0.48),
        ROOF_SURFACE_KINDS.CIVIC
      ).slice(0, 1)
    ];
  }
  return [];
}

function createServiceStripModule(building, footprint, visualProfile) {
  if (!visualProfile.serviceStrip || footprint.w < 60 || footprint.h < 45) return null;
  const horizontalInset = clamp(footprint.w * 0.035, 6, 14);
  const height = clamp(footprint.h * 0.055, 7, 12);
  return {
    id: moduleId(building, `service-strip:${visualProfile.serviceStrip}`),
    kind: MODULE_KINDS.SERVICE_STRIP,
    layer: MODULE_LAYERS.service,
    variant: visualProfile.serviceStrip,
    slots: clamp(Math.floor((footprint.w - horizontalInset * 2) / 34), 2, 8),
    bounds: {
      x: footprint.x + horizontalInset,
      y: footprint.y + footprint.h - height - 2,
      w: Math.max(1, footprint.w - horizontalInset * 2),
      h: height
    }
  };
}

function createServiceLightModule(building, footprint, visualProfile, annex, serviceStrip) {
  if (!visualProfile.serviceLight) return null;
  const size = clamp(Math.min(footprint.w, footprint.h) * 0.055, 8, 13);
  const anchorX = annex
    ? annex.bounds.x + annex.bounds.w * 0.56
    : serviceStrip
      ? serviceStrip.bounds.x + serviceStrip.bounds.w * 0.72
      : footprint.x + footprint.w * 0.72;
  const anchorY = annex
    ? annex.bounds.y + annex.bounds.h - 2
    : serviceStrip
      ? serviceStrip.bounds.y
      : footprint.y + footprint.h * 0.75;
  const bounds = {
    x: clamp(anchorX - size / 2, footprint.x, footprint.x + footprint.w - size),
    y: clamp(anchorY - size / 2, footprint.y, footprint.y + footprint.h - size),
    w: size,
    h: size
  };
  return {
    id: moduleId(building, "service-light"),
    kind: MODULE_KINDS.SERVICE_LIGHT,
    layer: MODULE_LAYERS.service,
    variant: "warm",
    bounds
  };
}

function rawPropDimensions(kind, geometry, visualProfile) {
  const roof = geometry.contourBounds;
  const shortSide = Math.min(roof.w, roof.h);
  if (kind === MODULE_KINDS.SKYLIGHT) {
    const warehouse = visualProfile.id === "warehouse";
    const club = visualProfile.id === "club";
    return {
      w: clamp(roof.w * (warehouse ? 0.34 : club ? 0.32 : 0.27), warehouse ? 30 : 22, 66),
      h: clamp(roof.h * (warehouse ? 0.19 : club ? 0.23 : 0.18), warehouse ? 16 : 14, 38)
    };
  }
  if (kind === MODULE_KINDS.HVAC) {
    const industrial = visualProfile.id === "industrial";
    return {
      w: clamp(shortSide * (industrial ? 0.18 : 0.2), 18, 36),
      h: clamp(shortSide * (industrial ? 0.14 : 0.15), 14, 26)
    };
  }
  if (kind === MODULE_KINDS.HATCH) {
    const size = clamp(shortSide * 0.12, 11, 18);
    return { w: size, h: size };
  }
  if (kind === MODULE_KINDS.ANTENNA) {
    const size = clamp(shortSide * 0.13, 12, 20);
    return { w: size, h: size };
  }
  if (kind === MODULE_KINDS.SATELLITE_DISH) {
    const size = clamp(shortSide * 0.15, 13, 22);
    return { w: size, h: size * 0.82 };
  }
  const size = clamp(shortSide * 0.075, 7, 11);
  return { w: size, h: size };
}

function fittedPropDimensions(kind, cell, geometry, visualProfile) {
  const raw = rawPropDimensions(kind, geometry, visualProfile);
  return {
    w: Math.max(1, Math.min(raw.w, Math.max(1, cell.bounds.w - 10))),
    h: Math.max(1, Math.min(raw.h, Math.max(1, cell.bounds.h - 10)))
  };
}

function createCandidateAnchors(geometry, random) {
  const anchors = [];
  const ratios = [
    [0.5, 0.5],
    [0.34, 0.34],
    [0.66, 0.34],
    [0.34, 0.66],
    [0.66, 0.66]
  ];
  for (const cell of geometry.cells) {
    for (const [xRatio, yRatio] of ratios) {
      anchors.push({
        cell,
        x: cell.bounds.x + cell.bounds.w * xRatio,
        y: cell.bounds.y + cell.bounds.h * yRatio,
        tie: random()
      });
    }
  }
  return anchors;
}

function normalizedAnchorPosition(anchor, geometry) {
  const bounds = geometry.contourBounds;
  return {
    x: bounds.w > 0 ? (anchor.x - bounds.x) / bounds.w : 0.5,
    y: bounds.h > 0 ? (anchor.y - bounds.y) / bounds.h : 0.5
  };
}

function anchorPreferenceScore(kind, anchor, geometry, visualProfile) {
  const position = normalizedAnchorPosition(anchor, geometry);
  const centerDistance = Math.hypot(position.x - 0.5, position.y - 0.5);
  if (kind === MODULE_KINDS.SKYLIGHT) return centerDistance * 5 + anchor.tie * 0.14;
  if (kind === MODULE_KINDS.ANTENNA) {
    return (1 - position.x) * 1.4 + position.y * 1.5 + anchor.tie * 0.2;
  }
  if (kind === MODULE_KINDS.HVAC) {
    const targetX = visualProfile.id === "industrial" ? 0.32 : 0.38;
    const targetY = visualProfile.id === "industrial" ? 0.64 : 0.48;
    return Math.abs(position.x - targetX) * 1.5
      + Math.abs(position.y - targetY) * 1.2
      + anchor.tie * 0.22;
  }
  if (kind === MODULE_KINDS.HATCH) {
    return position.x * 0.7 + (1 - position.y) * 0.9 + anchor.tie * 0.3;
  }
  return centerDistance + anchor.tie * 0.8;
}

function createPlacedProp(building, kind, anchor, geometry, visualProfile, index) {
  const dimensions = fittedPropDimensions(kind, anchor.cell, geometry, visualProfile);
  return {
    id: moduleId(building, `prop:${index}:${kind}`),
    kind,
    layer: MODULE_LAYERS.rooftop,
    profileId: visualProfile.id,
    bounds: {
      x: anchor.x - dimensions.w / 2,
      y: anchor.y - dimensions.h / 2,
      w: dimensions.w,
      h: dimensions.h
    }
  };
}

function propBudget(footprint, definition, visualProfile) {
  const level = DETAIL_LEVELS[definition.detailLevel] || DETAIL_LEVELS.standard;
  const area = footprint.w * footprint.h;
  const areaTier = area >= 70000 ? 2 : 1;
  const churchAdjustment = definition.archetypeId === "church" ? -1 : 0;
  const desired = Math.max(0, Math.round(areaTier * level.propDensity) + churchAdjustment);
  const signatureCount = visualProfile.signatureProps?.length || 0;
  const minimum = ["club", "warehouse", "industrial"].includes(visualProfile.id) ? 1 : 0;
  return clamp(
    Math.max(desired, minimum, Math.min(signatureCount, level.maximumProps)),
    0,
    level.maximumProps
  );
}

function createPropQueue(definition, visualProfile, budget, random) {
  const explicitAllowList = Array.isArray(definition.propKinds);
  const allowedKinds = explicitAllowList
    ? definition.propKinds.filter(kind => ROOFTOP_PROP_KINDS.includes(kind))
    : ROOFTOP_PROP_KINDS;
  const allowed = new Set(allowedKinds);
  const signatures = visualProfile.signatureProps.filter(kind => allowed.has(kind));
  const pool = (explicitAllowList ? allowedKinds : visualProfile.propPool)
    .filter(kind => allowed.has(kind));
  const queue = signatures.slice(0, budget);
  let cycle = shuffled([...new Set(pool)], random);

  while (queue.length < budget && cycle.length > 0) {
    queue.push(cycle.shift());
    if (cycle.length === 0 && queue.length < budget) {
      cycle = shuffled([...new Set(pool)], random);
    }
  }
  return queue;
}

function createRooftopProps(
  building,
  footprint,
  geometry,
  frontage,
  annex,
  serviceStrip,
  definition,
  visualProfile,
  random
) {
  const reserved = [frontage?.bounds, annex?.bounds, serviceStrip?.bounds].filter(Boolean);
  const modules = [];
  const anchors = createCandidateAnchors(geometry, random);
  const queue = createPropQueue(
    definition,
    visualProfile,
    propBudget(footprint, definition, visualProfile),
    random
  );

  for (let index = 0; index < queue.length; index += 1) {
    const kind = queue[index];
    const orderedAnchors = anchors
      .map(anchor => ({
        anchor,
        score: anchorPreferenceScore(kind, anchor, geometry, visualProfile)
      }))
      .sort((a, b) => a.score - b.score);
    let placed = null;
    let usedAnchor = null;

    for (const { anchor } of orderedAnchors) {
      const candidate = createPlacedProp(
        building,
        kind,
        anchor,
        geometry,
        visualProfile,
        index
      );
      const safeCell = insetRect(anchor.cell.bounds, 4);
      if (!rectContains(safeCell, candidate.bounds)) continue;
      if (!rectContains(footprint, candidate.bounds)) continue;
      if (reserved.some(bounds => rectsOverlap(bounds, candidate.bounds, 6))) continue;
      placed = candidate;
      usedAnchor = anchor;
      break;
    }

    if (!placed) continue;
    modules.push(placed);
    reserved.push(placed.bounds);
    const usedIndex = anchors.indexOf(usedAnchor);
    if (usedIndex >= 0) anchors.splice(usedIndex, 1);
  }

  return modules;
}

function lineModule(
  building,
  suffix,
  kind,
  x1,
  y1,
  x2,
  y2,
  extras = {},
  layer = MODULE_LAYERS.identity
) {
  return {
    id: moduleId(building, suffix),
    kind,
    layer,
    x1,
    y1,
    x2,
    y2,
    bounds: {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1)
    },
    ...extras
  };
}

function edgeLength(edge) {
  return Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1);
}

function shortenedEdge(edge, startRatio, lengthRatio) {
  const dx = edge.x2 - edge.x1;
  const dy = edge.y2 - edge.y1;
  return {
    x1: edge.x1 + dx * startRatio,
    y1: edge.y1 + dy * startRatio,
    x2: edge.x1 + dx * Math.min(1, startRatio + lengthRatio),
    y2: edge.y1 + dy * Math.min(1, startRatio + lengthRatio)
  };
}

function createPoliceIdentity(building, edges, frontage) {
  const priority = orientation => ({ south: 0, north: 1, east: 2, west: 3 })[orientation] ?? 4;
  const byPreference = [...edges].sort((a, b) => (
    priority(a.orientation) - priority(b.orientation) || edgeLength(b) - edgeLength(a)
  ));
  const selected = [];
  for (const edge of byPreference) {
    if (edgeLength(edge) < 24) continue;
    if (selected.some(existing => existing.orientation === edge.orientation)) continue;
    selected.push(edge);
    if (selected.length === 2) break;
  }

  const modules = selected.map((edge, index) => {
    const segment = shortenedEdge(edge, index === 0 ? 0.08 : 0.68, 0.24);
    return lineModule(
      building,
      `police-accent:${index}`,
      MODULE_KINDS.ACCENT_STRIP,
      segment.x1,
      segment.y1,
      segment.x2,
      segment.y2,
      { variant: "police" }
    );
  });
  if (frontage) frontage.identity = "police";
  return modules;
}

function createClubIdentity(building, edges, frontage) {
  const preferred = edges
    .filter(edge => edge.orientation === "south" || edge.orientation === "east")
    .sort((a, b) => edgeLength(b) - edgeLength(a));
  const fallback = [...edges].sort((a, b) => edgeLength(b) - edgeLength(a));
  const edge = preferred[0] || fallback[0];
  if (!edge) return [];
  const segment = shortenedEdge(edge, 0.08, 0.84);
  if (frontage) frontage.identity = "club";
  return [lineModule(
    building,
    "club-neon",
    MODULE_KINDS.ACCENT_STRIP,
    segment.x1,
    segment.y1,
    segment.x2,
    segment.y2,
    { variant: "club" }
  )];
}

function southernCenterCell(geometry) {
  const centerX = geometry.contourBounds.x + geometry.contourBounds.w / 2;
  return [...geometry.cells].sort((a, b) => (
    b.row - a.row
    || Math.abs((a.bounds.x + a.bounds.w / 2) - centerX)
      - Math.abs((b.bounds.x + b.bounds.w / 2) - centerX)
  ))[0];
}

function createChurchIdentity(building, geometry, frontage) {
  const centerX = geometry.contourBounds.x + geometry.contourBounds.w / 2;
  const centerY = geometry.contourBounds.y + geometry.contourBounds.h / 2;
  const modules = [
    lineModule(
      building,
      "church-ridge:vertical",
      MODULE_KINDS.ROOF_RIDGE,
      centerX,
      geometry.contourBounds.y + 3,
      centerX,
      geometry.contourBounds.y + geometry.contourBounds.h - 3,
      { variant: "church" }
    ),
    lineModule(
      building,
      "church-ridge:horizontal",
      MODULE_KINDS.ROOF_RIDGE,
      geometry.contourBounds.x + geometry.contourBounds.w * 0.2,
      centerY,
      geometry.contourBounds.x + geometry.contourBounds.w * 0.8,
      centerY,
      { variant: "church" }
    )
  ];
  const cell = southernCenterCell(geometry);
  const maximumSize = Math.max(1, Math.min(cell.bounds.w - 6, cell.bounds.h - 6));
  const markerSize = Math.max(1, Math.min(
    clamp(Math.min(geometry.cellWidth, geometry.cellHeight) * 0.2, 9, 17),
    maximumSize
  ));
  const cellCenterX = cell.bounds.x + cell.bounds.w / 2;
  const cellCenterY = cell.bounds.y + cell.bounds.h / 2;
  modules.push({
    id: moduleId(building, "church-cross"),
    kind: MODULE_KINDS.CROSS_MARKER,
    layer: MODULE_LAYERS.identity,
    bounds: {
      x: cellCenterX - markerSize / 2,
      y: cellCenterY - markerSize / 2,
      w: markerSize,
      h: markerSize
    },
    variant: "church"
  });
  if (frontage) frontage.identity = "church";
  return modules;
}

function createIdentityModules(building, geometry, edges, frontage, definition) {
  if (definition.archetypeId === "police") return createPoliceIdentity(building, edges, frontage);
  if (definition.archetypeId === "club") return createClubIdentity(building, edges, frontage);
  if (definition.archetypeId === "church") return createChurchIdentity(building, geometry, frontage);
  return [];
}

function moduleCounts(modules) {
  return modules.reduce((counts, module) => {
    counts[module.kind] = (counts[module.kind] || 0) + 1;
    return counts;
  }, {});
}

export function buildingPresentationSeed(building = {}, override) {
  if (Number.isFinite(Number(override))) return Number(override) >>> 0;
  const stableIdentity = [
    building.id,
    building.sign,
    building.x,
    building.y,
    building.w,
    building.h,
    building.districtId
  ].join("|");
  return stableHash(stableIdentity);
}

export function moduleFitsBuildingFootprint(module, footprint) {
  const bounds = moduleBounds(module);
  return Boolean(bounds && rectContains(footprint, bounds));
}

export function createBuildingPresentationPlan(building = {}, options = {}) {
  const footprint = normalizeRect(building);
  const rawDefinition = resolveBuildingPresentationDefinition(building, options);
  const visualProfile = resolveBuildingVisualProfile(
    building,
    rawDefinition.archetypeId,
    {
      ...options,
      profileId: rawDefinition.profileId,
      surfaceKind: rawDefinition.surfaceKind,
      showLabel: rawDefinition.showLabel
    }
  );
  const definition = applyVisualProfileDefaults(
    building,
    rawDefinition,
    visualProfile,
    options
  );
  const seed = buildingPresentationSeed(building, definition.seed);
  const random = createRandom(seed);
  const selection = chooseLayoutRecipe(
    building,
    footprint,
    definition,
    visualProfile,
    random,
    options
  );
  const geometry = createRoofSilhouetteGeometry(footprint, selection.recipe);
  const foundation = createFoundationModule(building, footprint, visualProfile);
  const roofMass = createRoofMassModule(
    building,
    geometry,
    selection.recipe.id,
    visualProfile
  );
  const texture = createRoofTextureModules(building, geometry, visualProfile);
  const edges = createParapetModules(building, geometry);
  const frontage = createFrontageModule(building, footprint, definition);
  const annex = createRoofAnnexModule(
    building,
    geometry,
    footprint,
    visualProfile,
    random
  );
  const serviceStrip = createServiceStripModule(
    building,
    footprint,
    visualProfile
  );
  const serviceLight = createServiceLightModule(
    building,
    footprint,
    visualProfile,
    annex,
    serviceStrip
  );
  const props = createRooftopProps(
    building,
    footprint,
    geometry,
    frontage,
    annex,
    serviceStrip,
    definition,
    visualProfile,
    random
  );
  const identity = createIdentityModules(
    building,
    geometry,
    edges,
    frontage,
    definition
  );
  const modules = [
    foundation,
    roofMass,
    ...texture,
    ...edges,
    ...(annex ? [annex] : []),
    ...(frontage ? [frontage] : []),
    ...(serviceStrip ? [serviceStrip] : []),
    ...(serviceLight ? [serviceLight] : []),
    ...props,
    ...identity
  ].sort((a, b) => (a.layer || 0) - (b.layer || 0));
  const palette = resolveBuildingPalette(
    building,
    definition.archetypeId,
    visualProfile
  );
  const warnings = [];
  if (selection.fallback) {
    warnings.push(
      `Layout '${selection.requested}' does not fit the authored footprint; using 'rectangle'.`
    );
  }
  const minimumSide = Math.min(footprint.w, footprint.h);

  return {
    version: BUILDING_PRESENTATION_VERSION,
    buildingId: building.id || null,
    seed,
    archetype: definition.archetypeId,
    profileId: visualProfile.id,
    surfaceKind: visualProfile.surfaceKind,
    layoutId: selection.recipe.id,
    detailLevel: definition.detailLevel,
    showLabel: Boolean(definition.showLabel),
    labelColor: palette.label,
    collisionFootprint: { ...footprint },
    visualFootprint: { ...footprint },
    effects: {
      shadowDepth: clamp(
        minimumSide * 0.085 * (visualProfile.shadowDepthScale || 1),
        7,
        18
      ),
      wallDepth: clamp(minimumSide * 0.045, 4, 9)
    },
    silhouette: {
      points: geometry.contour.map(point => ({ ...point })),
      bounds: { ...geometry.contourBounds },
      exposedEdgeCount: geometry.parapetEdges.length
    },
    roofGrid: {
      bounds: { ...geometry.roofBounds },
      columns: geometry.columns,
      rows: geometry.rows,
      occupiedCells: geometry.cells.map(cell => ({
        row: cell.row,
        column: cell.column
      }))
    },
    frontage: frontage ? {
      kind: frontage.variant,
      edge: frontage.edge,
      bounds: { ...frontage.bounds }
    } : null,
    annex: annex ? {
      kind: annex.variant,
      bounds: { ...annex.bounds }
    } : null,
    service: serviceStrip ? {
      kind: serviceStrip.variant,
      bounds: { ...serviceStrip.bounds },
      light: Boolean(serviceLight)
    } : null,
    palette,
    modules,
    moduleCounts: moduleCounts(modules),
    warnings
  };
}
