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

const EPSILON = 0.001;
const VALID_FRONTAGE_EDGES = new Set(["north", "east", "south", "west"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function normalizedRect(source = {}) {
  return {
    x: Number(source.x) || 0,
    y: Number(source.y) || 0,
    w: Math.max(1, Number(source.w) || 1),
    h: Math.max(1, Number(source.h) || 1)
  };
}

function insetRect(rect, amount) {
  const safe = Math.max(0, Math.min(Number(amount) || 0, Math.min(rect.w, rect.h) / 2 - 0.5));
  return {
    x: rect.x + safe,
    y: rect.y + safe,
    w: Math.max(1, rect.w - safe * 2),
    h: Math.max(1, rect.h - safe * 2)
  };
}

function rectsOverlap(a, b, margin = 0) {
  return a.x < b.x + b.w + margin
    && a.x + a.w > b.x - margin
    && a.y < b.y + b.h + margin
    && a.y + a.h > b.y - margin;
}

function rectContains(outer, inner, epsilon = EPSILON) {
  return inner.x >= outer.x - epsilon
    && inner.y >= outer.y - epsilon
    && inner.x + inner.w <= outer.x + outer.w + epsilon
    && inner.y + inner.h <= outer.y + outer.h + epsilon;
}

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

function chooseLayoutRecipe(building, footprint, definition, random, options) {
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

  const candidates = definition.archetype.layoutCandidates
    .map(getBuildingLayoutRecipe)
    .filter(recipe => recipe && recipeFits(recipe, footprint));
  const recipe = candidates[Math.floor(random() * candidates.length)]
    || getBuildingLayoutRecipe("rectangle");
  return { recipe, fallback: false, requested: null };
}

function createRoofGrid(building, footprint, recipe) {
  const outerInset = clamp(Math.min(footprint.w, footprint.h) * 0.055, 5, 12);
  const roofBounds = insetRect(footprint, outerInset);
  const cellWidth = roofBounds.w / recipe.columns;
  const cellHeight = roofBounds.h / recipe.rows;
  const cells = [];
  const occupiedByKey = new Map();

  for (let row = 0; row < recipe.rows; row += 1) {
    for (let column = 0; column < recipe.columns; column += 1) {
      if (recipe.mask[row]?.[column] !== "1") continue;
      const bounds = {
        x: roofBounds.x + column * cellWidth,
        y: roofBounds.y + row * cellHeight,
        w: cellWidth,
        h: cellHeight
      };
      const cell = {
        id: moduleId(building, `roof:${row}:${column}`),
        kind: MODULE_KINDS.ROOF_CELL,
        layer: MODULE_LAYERS.roof,
        row,
        column,
        bounds
      };
      cells.push(cell);
      occupiedByKey.set(`${row}:${column}`, cell);
    }
  }

  return {
    bounds: roofBounds,
    columns: recipe.columns,
    rows: recipe.rows,
    cellWidth,
    cellHeight,
    cells,
    occupiedByKey
  };
}

function edgeBounds(x1, y1, x2, y2) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1)
  };
}

function createParapetEdges(building, grid) {
  const edges = [];
  const neighbourFor = {
    north: [-1, 0],
    east: [0, 1],
    south: [1, 0],
    west: [0, -1]
  };

  for (const cell of grid.cells) {
    for (const [orientation, [rowDelta, columnDelta]] of Object.entries(neighbourFor)) {
      const neighbourKey = `${cell.row + rowDelta}:${cell.column + columnDelta}`;
      if (grid.occupiedByKey.has(neighbourKey)) continue;
      const { x, y, w, h } = cell.bounds;
      let x1;
      let y1;
      let x2;
      let y2;
      if (orientation === "north") [x1, y1, x2, y2] = [x, y, x + w, y];
      else if (orientation === "east") [x1, y1, x2, y2] = [x + w, y, x + w, y + h];
      else if (orientation === "south") [x1, y1, x2, y2] = [x, y + h, x + w, y + h];
      else [x1, y1, x2, y2] = [x, y, x, y + h];

      edges.push({
        id: moduleId(building, `edge:${cell.row}:${cell.column}:${orientation}`),
        kind: MODULE_KINDS.PARAPET_EDGE,
        layer: MODULE_LAYERS.edge,
        orientation,
        x1,
        y1,
        x2,
        y2,
        bounds: edgeBounds(x1, y1, x2, y2)
      });
    }
  }
  return edges;
}

function frontageDimensions(frontage, footprint) {
  const minSide = Math.min(footprint.w, footprint.h);
  if (frontage === FRONTAGE_KINDS.POLICE) {
    return { width: clamp(footprint.w * 0.23, 28, 54), depth: clamp(minSide * 0.11, 12, 18) };
  }
  if (frontage === FRONTAGE_KINDS.CLUB) {
    return { width: clamp(footprint.w * 0.25, 28, 56), depth: clamp(minSide * 0.12, 13, 19) };
  }
  if (frontage === FRONTAGE_KINDS.CHURCH) {
    return { width: clamp(footprint.w * 0.16, 20, 36), depth: clamp(minSide * 0.11, 12, 18) };
  }
  if (frontage === FRONTAGE_KINDS.NONE) return { width: 0, depth: 0 };
  return { width: clamp(footprint.w * 0.17, 18, 38), depth: clamp(minSide * 0.085, 9, 14) };
}

function createFrontageModule(building, footprint, definition) {
  if (definition.frontage === FRONTAGE_KINDS.NONE) return null;
  const edge = VALID_FRONTAGE_EDGES.has(definition.frontageEdge)
    ? definition.frontageEdge
    : "south";
  const dimensions = frontageDimensions(definition.frontage, footprint);
  const inset = 2;
  const horizontal = edge === "north" || edge === "south";
  const available = horizontal ? footprint.w - inset * 2 : footprint.h - inset * 2;
  const primarySize = Math.min(dimensions.width, available);
  const offset = definition.frontageOffset * Math.max(0, (available - primarySize) / 2);
  let bounds;

  if (horizontal) {
    const x = footprint.x + footprint.w / 2 - primarySize / 2 + offset;
    const y = edge === "north"
      ? footprint.y + inset
      : footprint.y + footprint.h - dimensions.depth - inset;
    bounds = { x, y, w: primarySize, h: dimensions.depth };
  } else {
    const y = footprint.y + footprint.h / 2 - primarySize / 2 + offset;
    const x = edge === "west"
      ? footprint.x + inset
      : footprint.x + footprint.w - dimensions.depth - inset;
    bounds = { x, y, w: dimensions.depth, h: primarySize };
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

function propDimensions(kind, cell) {
  const shortSide = Math.min(cell.bounds.w, cell.bounds.h);
  if (kind === MODULE_KINDS.SKYLIGHT) {
    return {
      w: clamp(cell.bounds.w * 0.48, 16, 46),
      h: clamp(cell.bounds.h * 0.34, 11, 30)
    };
  }
  if (kind === MODULE_KINDS.HVAC) {
    return {
      w: clamp(shortSide * 0.26, 12, 24),
      h: clamp(shortSide * 0.22, 10, 20)
    };
  }
  if (kind === MODULE_KINDS.HATCH) {
    const size = clamp(shortSide * 0.18, 9, 16);
    return { w: size, h: size };
  }
  if (kind === MODULE_KINDS.ANTENNA) {
    const size = clamp(shortSide * 0.16, 9, 15);
    return { w: size, h: size };
  }
  if (kind === MODULE_KINDS.SATELLITE_DISH) {
    const size = clamp(shortSide * 0.2, 10, 18);
    return { w: size, h: size * 0.8 };
  }
  const size = clamp(shortSide * 0.11, 5, 9);
  return { w: size, h: size };
}

function candidateAnchors(grid, random) {
  const anchors = [];
  const ratios = [
    [0.5, 0.5],
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7]
  ];
  for (const cell of grid.cells) {
    for (const [xRatio, yRatio] of ratios) {
      anchors.push({
        cell,
        x: cell.bounds.x + cell.bounds.w * xRatio,
        y: cell.bounds.y + cell.bounds.h * yRatio
      });
    }
  }
  return shuffled(anchors, random);
}

function createPlacedProp(building, kind, anchor, index) {
  const dimensions = propDimensions(kind, anchor.cell);
  return {
    id: moduleId(building, `prop:${index}:${kind}`),
    kind,
    layer: MODULE_LAYERS.rooftop,
    bounds: {
      x: anchor.x - dimensions.w / 2,
      y: anchor.y - dimensions.h / 2,
      w: dimensions.w,
      h: dimensions.h
    }
  };
}

function propBudget(footprint, definition) {
  const level = DETAIL_LEVELS[definition.detailLevel] || DETAIL_LEVELS.standard;
  const area = footprint.w * footprint.h;
  const areaBudget = 1 + Math.floor(area / 28000);
  const archetypeAdjustment = definition.archetypeId === "church" ? -1 : 0;
  return clamp(
    Math.round((areaBudget + archetypeAdjustment) * level.propDensity),
    definition.archetypeId === "club" ? 1 : 0,
    level.maximumProps
  );
}

function createRooftopProps(building, footprint, grid, frontage, definition, random) {
  const reserved = frontage ? [frontage.bounds] : [];
  const modules = [];
  const requestedKinds = definition.propKinds || definition.archetype.propPool;
  const propKinds = requestedKinds.filter(kind => ROOFTOP_PROP_KINDS.includes(kind));
  const anchors = candidateAnchors(grid, random);
  const budget = propBudget(footprint, definition);
  const queue = [];

  if (definition.archetypeId === "club" && propKinds.includes(MODULE_KINDS.SKYLIGHT)) {
    queue.push(MODULE_KINDS.SKYLIGHT);
  }
  if (definition.archetypeId === "police") queue.push(MODULE_KINDS.ANTENNA);
  while (queue.length < budget && propKinds.length > 0) {
    queue.push(propKinds[Math.floor(random() * propKinds.length)]);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const kind = queue[index];
    let placed = null;
    for (const anchor of anchors) {
      const candidate = createPlacedProp(building, kind, anchor, index);
      const safeCell = insetRect(anchor.cell.bounds, 4);
      if (!rectContains(safeCell, candidate.bounds)) continue;
      if (!rectContains(footprint, candidate.bounds)) continue;
      if (reserved.some(bounds => rectsOverlap(bounds, candidate.bounds, 4))) continue;
      placed = candidate;
      break;
    }
    if (!placed) continue;
    modules.push(placed);
    reserved.push(placed.bounds);
    const usedIndex = anchors.findIndex(anchor => {
      const candidate = createPlacedProp(building, kind, anchor, index);
      return Math.abs(candidate.bounds.x - placed.bounds.x) < EPSILON
        && Math.abs(candidate.bounds.y - placed.bounds.y) < EPSILON;
    });
    if (usedIndex >= 0) anchors.splice(usedIndex, 1);
  }

  return modules;
}

function lineModule(building, suffix, kind, x1, y1, x2, y2, extras = {}) {
  return {
    id: moduleId(building, suffix),
    kind,
    layer: MODULE_LAYERS.identity,
    x1,
    y1,
    x2,
    y2,
    bounds: edgeBounds(x1, y1, x2, y2),
    ...extras
  };
}

function createPoliceIdentity(building, grid, edges, frontage) {
  const modules = [];
  const horizontalEdges = edges.filter(edge => edge.orientation === "south" || edge.orientation === "north");
  const selected = horizontalEdges.slice(0, 2);
  for (let index = 0; index < selected.length; index += 1) {
    const edge = selected[index];
    const length = Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1);
    const ratio = Math.min(0.3, 18 / Math.max(1, length));
    const x1 = edge.x1 + (edge.x2 - edge.x1) * 0.08;
    const y1 = edge.y1 + (edge.y2 - edge.y1) * 0.08;
    const x2 = x1 + (edge.x2 - edge.x1) * ratio;
    const y2 = y1 + (edge.y2 - edge.y1) * ratio;
    modules.push(lineModule(building, `police-accent:${index}`, MODULE_KINDS.ACCENT_STRIP, x1, y1, x2, y2, {
      variant: "police"
    }));
  }
  if (frontage) frontage.identity = "police";
  return modules;
}

function createClubIdentity(building, edges, frontage, random) {
  const preferred = edges.filter(edge => edge.orientation === "south" || edge.orientation === "east");
  const fallback = edges.filter(edge => edge.orientation === "north" || edge.orientation === "west");
  const selected = [...preferred, ...shuffled(fallback, random)].slice(0, 5);
  const modules = selected.map((edge, index) => lineModule(
    building,
    `club-neon:${index}`,
    MODULE_KINDS.ACCENT_STRIP,
    edge.x1,
    edge.y1,
    edge.x2,
    edge.y2,
    { variant: "club" }
  ));
  if (frontage) frontage.identity = "club";
  return modules;
}

function createChurchIdentity(building, grid, frontage) {
  const centerX = grid.bounds.x + grid.bounds.w / 2;
  const centerY = grid.bounds.y + grid.bounds.h / 2;
  const modules = [
    lineModule(
      building,
      "church-ridge:vertical",
      MODULE_KINDS.ROOF_RIDGE,
      centerX,
      grid.bounds.y + 3,
      centerX,
      grid.bounds.y + grid.bounds.h - 3,
      { variant: "church" }
    ),
    lineModule(
      building,
      "church-ridge:horizontal",
      MODULE_KINDS.ROOF_RIDGE,
      grid.bounds.x + grid.bounds.w * 0.18,
      centerY,
      grid.bounds.x + grid.bounds.w * 0.82,
      centerY,
      { variant: "church" }
    )
  ];
  const markerSize = clamp(Math.min(grid.cellWidth, grid.cellHeight) * 0.18, 8, 16);
  const markerY = frontage
    ? frontage.bounds.y - markerSize - 3
    : grid.bounds.y + grid.bounds.h * 0.72;
  modules.push({
    id: moduleId(building, "church-cross"),
    kind: MODULE_KINDS.CROSS_MARKER,
    layer: MODULE_LAYERS.identity,
    bounds: {
      x: centerX - markerSize / 2,
      y: clamp(markerY, grid.bounds.y + 2, grid.bounds.y + grid.bounds.h - markerSize - 2),
      w: markerSize,
      h: markerSize
    },
    variant: "church"
  });
  if (frontage) frontage.identity = "church";
  return modules;
}

function createIdentityModules(building, grid, edges, frontage, definition, random) {
  if (definition.archetypeId === "police") return createPoliceIdentity(building, grid, edges, frontage);
  if (definition.archetypeId === "club") return createClubIdentity(building, edges, frontage, random);
  if (definition.archetypeId === "church") return createChurchIdentity(building, grid, frontage);
  return [];
}

function createFoundationModule(building, footprint) {
  return {
    id: moduleId(building, "foundation"),
    kind: MODULE_KINDS.FOUNDATION,
    layer: MODULE_LAYERS.foundation,
    bounds: { ...footprint }
  };
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
  const footprint = normalizedRect(building);
  const definition = resolveBuildingPresentationDefinition(building, options);
  const seed = buildingPresentationSeed(building, definition.seed);
  const random = createRandom(seed);
  const selection = chooseLayoutRecipe(building, footprint, definition, random, options);
  const grid = createRoofGrid(building, footprint, selection.recipe);
  const edges = createParapetEdges(building, grid);
  const frontage = createFrontageModule(building, footprint, definition);
  const props = createRooftopProps(building, footprint, grid, frontage, definition, random);
  const identity = createIdentityModules(building, grid, edges, frontage, definition, random);
  const modules = [
    createFoundationModule(building, footprint),
    ...grid.cells,
    ...edges,
    ...(frontage ? [frontage] : []),
    ...props,
    ...identity
  ].sort((a, b) => (a.layer || 0) - (b.layer || 0));
  const palette = resolveBuildingPalette(building, definition.archetypeId);
  const warnings = [];
  if (selection.fallback) {
    warnings.push(`Layout '${selection.requested}' does not fit the authored footprint; using 'rectangle'.`);
  }

  return {
    version: BUILDING_PRESENTATION_VERSION,
    buildingId: building.id || null,
    seed,
    archetype: definition.archetypeId,
    layoutId: selection.recipe.id,
    detailLevel: definition.detailLevel,
    labelColor: palette.label,
    collisionFootprint: { ...footprint },
    visualFootprint: { ...footprint },
    roofGrid: {
      bounds: { ...grid.bounds },
      columns: grid.columns,
      rows: grid.rows,
      occupiedCells: grid.cells.map(cell => ({ row: cell.row, column: cell.column }))
    },
    frontage: frontage ? {
      kind: frontage.variant,
      edge: frontage.edge,
      bounds: { ...frontage.bounds }
    } : null,
    palette,
    modules,
    moduleCounts: moduleCounts(modules),
    warnings
  };
}
