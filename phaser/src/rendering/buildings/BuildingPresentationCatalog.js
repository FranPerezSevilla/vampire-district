const DEFAULT_BUILDING_COLOR = 0x262838;
const DEFAULT_BUILDING_TRIM = 0x5a5869;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function splitColor(color) {
  const value = Number.isFinite(Number(color)) ? Number(color) >>> 0 : 0;
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff
  };
}

function joinColor({ r, g, b }) {
  return (clampChannel(r) << 16) | (clampChannel(g) << 8) | clampChannel(b);
}

export function mixBuildingColor(a, b, amount = 0.5) {
  const from = splitColor(a);
  const to = splitColor(b);
  const t = Math.max(0, Math.min(1, Number(amount) || 0));
  return joinColor({
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t
  });
}

export function scaleBuildingColor(color, factor = 1) {
  const value = splitColor(color);
  const multiplier = Math.max(0, Number(factor) || 0);
  return joinColor({
    r: value.r * multiplier,
    g: value.g * multiplier,
    b: value.b * multiplier
  });
}

export const BUILDING_PRESENTATION_VERSION = 2;

export const MODULE_KINDS = deepFreeze({
  FOUNDATION: "foundation",
  ROOF_CELL: "roof-cell",
  PARAPET_EDGE: "parapet-edge",
  FRONTAGE: "frontage",
  SKYLIGHT: "skylight",
  HVAC: "hvac",
  VENT: "vent",
  HATCH: "hatch",
  ANTENNA: "antenna",
  SATELLITE_DISH: "satellite-dish",
  ACCENT_STRIP: "accent-strip",
  ROOF_RIDGE: "roof-ridge",
  CROSS_MARKER: "cross-marker",
  YARD: "yard",
  FENCE: "fence"
});

export const MODULE_LAYERS = deepFreeze({
  foundation: 0,
  roof: 10,
  edge: 20,
  frontage: 30,
  rooftop: 40,
  identity: 50
});

export const FRONTAGE_KINDS = deepFreeze({
  NONE: "none",
  GENERIC: "generic",
  POLICE: "police",
  CLUB: "club",
  CHURCH: "church"
});

export const DETAIL_LEVELS = deepFreeze({
  minimal: { propDensity: 0.45, maximumProps: 2 },
  standard: { propDensity: 0.72, maximumProps: 4 },
  rich: { propDensity: 1, maximumProps: 6 }
});

export const LAYOUT_RECIPES = deepFreeze({
  rectangle: {
    id: "rectangle",
    columns: 2,
    rows: 2,
    mask: ["11", "11"],
    minimumWidth: 0,
    minimumHeight: 0
  },
  "l-shape": {
    id: "l-shape",
    columns: 3,
    rows: 2,
    mask: ["110", "111"],
    minimumWidth: 130,
    minimumHeight: 90
  },
  "t-shape": {
    id: "t-shape",
    columns: 3,
    rows: 2,
    mask: ["111", "010"],
    minimumWidth: 150,
    minimumHeight: 100
  },
  stepped: {
    id: "stepped",
    columns: 3,
    rows: 2,
    mask: ["111", "011"],
    minimumWidth: 145,
    minimumHeight: 90
  },
  cross: {
    id: "cross",
    columns: 3,
    rows: 3,
    mask: ["010", "111", "010"],
    minimumWidth: 105,
    minimumHeight: 130
  },
  irregular: {
    id: "irregular",
    columns: 3,
    rows: 3,
    mask: ["110", "111", "011"],
    minimumWidth: 130,
    minimumHeight: 115
  }
});

const ARCHETYPE_ALIASES = deepFreeze({
  cathedral: "church",
  chapel: "church",
  parish: "church",
  nightclub: "club",
  lounge: "club",
  precinct: "police",
  constabulary: "police"
});

export const BUILDING_ARCHETYPES = deepFreeze({
  generic: {
    id: "generic",
    defaultLayout: "rectangle",
    layoutCandidates: ["rectangle", "rectangle", "rectangle", "rectangle", "l-shape", "t-shape", "stepped"],
    frontage: FRONTAGE_KINDS.GENERIC,
    propPool: [MODULE_KINDS.SKYLIGHT, MODULE_KINDS.HVAC, MODULE_KINDS.VENT, MODULE_KINDS.HATCH],
    labelColor: 0xefe6ff,
    accent: 0x77809c,
    accentSoft: 0x444a61
  },
  police: {
    id: "police",
    defaultLayout: "rectangle",
    layoutCandidates: ["rectangle"],
    frontage: FRONTAGE_KINDS.POLICE,
    propPool: [MODULE_KINDS.HVAC, MODULE_KINDS.HATCH, MODULE_KINDS.VENT],
    requiredIdentity: [MODULE_KINDS.ANTENNA, MODULE_KINDS.ACCENT_STRIP],
    labelColor: 0xc9ddff,
    accent: 0x4b82df,
    accentSoft: 0x263f72
  },
  club: {
    id: "club",
    defaultLayout: "irregular",
    layoutCandidates: ["irregular", "l-shape", "stepped"],
    frontage: FRONTAGE_KINDS.CLUB,
    propPool: [MODULE_KINDS.SKYLIGHT, MODULE_KINDS.HVAC, MODULE_KINDS.VENT],
    requiredIdentity: [MODULE_KINDS.ACCENT_STRIP],
    labelColor: 0xffc2f4,
    accent: 0xd84bbb,
    accentSoft: 0x6d285f
  },
  church: {
    id: "church",
    defaultLayout: "cross",
    layoutCandidates: ["cross", "t-shape"],
    frontage: FRONTAGE_KINDS.CHURCH,
    propPool: [MODULE_KINDS.VENT, MODULE_KINDS.HATCH],
    requiredIdentity: [MODULE_KINDS.ROOF_RIDGE, MODULE_KINDS.CROSS_MARKER],
    labelColor: 0xffedbd,
    accent: 0xd6ad55,
    accentSoft: 0x746039
  }
});

const CLASSIFICATION_RULES = deepFreeze([
  { archetype: "police", tokens: ["police", "precinct", "constable", "constabulary"] },
  { archetype: "club", tokens: ["nightclub", "club", "lounge"] },
  { archetype: "church", tokens: ["cathedral", "church", "chapel", "parish"] }
]);

function normalizedText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizedArchetype(value) {
  const key = normalizedText(value);
  if (!key) return null;
  const alias = ARCHETYPE_ALIASES[key] || key;
  return BUILDING_ARCHETYPES[alias] ? alias : null;
}

function classificationText(building = {}) {
  return [
    building.id,
    building.sign,
    building.label,
    building.name,
    building.kind,
    building.landmarkId,
    building.districtId
  ].map(normalizedText).filter(Boolean).join(" ");
}

export function classifyBuildingPresentation(building = {}) {
  const explicit = normalizedArchetype(building.presentation?.archetype || building.presentationArchetype);
  if (explicit) return explicit;

  const haystack = classificationText(building);
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.tokens.some(token => haystack.includes(token))) return rule.archetype;
  }
  return "generic";
}

export function getBuildingArchetype(id) {
  return BUILDING_ARCHETYPES[normalizedArchetype(id) || "generic"];
}

export function getBuildingLayoutRecipe(id) {
  return LAYOUT_RECIPES[normalizedText(id)] || null;
}

export function resolveBuildingPresentationDefinition(building = {}, options = {}) {
  const explicit = building.presentation || {};
  const archetypeId = normalizedArchetype(options.archetype || explicit.archetype)
    || classifyBuildingPresentation(building);
  const archetype = getBuildingArchetype(archetypeId);
  const requestedLayout = normalizedText(options.layoutId || explicit.layoutId || explicit.layout);
  const layoutId = getBuildingLayoutRecipe(requestedLayout)
    ? requestedLayout
    : archetype.defaultLayout;
  const requestedFrontage = normalizedText(options.frontage || explicit.frontage);
  const frontage = Object.values(FRONTAGE_KINDS).includes(requestedFrontage)
    ? requestedFrontage
    : archetype.frontage;
  const detailLevel = DETAIL_LEVELS[options.detailLevel || explicit.detailLevel]
    ? (options.detailLevel || explicit.detailLevel)
    : "standard";

  return {
    archetypeId,
    archetype,
    layoutId,
    frontage,
    frontageEdge: normalizedText(options.frontageEdge || explicit.frontageEdge) || "south",
    frontageOffset: Number.isFinite(Number(options.frontageOffset ?? explicit.frontageOffset))
      ? Math.max(-1, Math.min(1, Number(options.frontageOffset ?? explicit.frontageOffset)))
      : 0,
    detailLevel,
    seed: options.seed ?? explicit.seed,
    propKinds: Array.isArray(options.propKinds || explicit.propKinds)
      ? [...(options.propKinds || explicit.propKinds)]
      : null
  };
}

export function resolveBuildingPalette(building = {}, archetypeId = "generic") {
  const archetype = getBuildingArchetype(archetypeId);
  const base = Number.isFinite(Number(building.color)) ? Number(building.color) : DEFAULT_BUILDING_COLOR;
  const authoredTrim = Number.isFinite(Number(building.trim)) ? Number(building.trim) : DEFAULT_BUILDING_TRIM;
  const accent = archetype.accent;

  return {
    foundation: mixBuildingColor(base, 0x11131d, 0.28),
    foundationShadow: mixBuildingColor(base, 0x05060a, 0.58),
    roof: mixBuildingColor(base, 0x181a24, 0.22),
    roofRaised: mixBuildingColor(base, 0x353849, 0.16),
    roofShade: mixBuildingColor(base, 0x080910, 0.46),
    parapetLight: mixBuildingColor(authoredTrim, 0xb7b7c1, 0.18),
    parapetDark: mixBuildingColor(authoredTrim, 0x101018, 0.42),
    seam: mixBuildingColor(authoredTrim, base, 0.72),
    prop: mixBuildingColor(authoredTrim, 0x8d919d, 0.24),
    propDark: mixBuildingColor(authoredTrim, 0x101118, 0.52),
    glass: mixBuildingColor(archetypeId === "club" ? accent : 0x35558d, 0x10131d, 0.34),
    glassHighlight: mixBuildingColor(archetypeId === "club" ? accent : 0x6e96dd, 0xffffff, 0.12),
    accent,
    accentSoft: archetype.accentSoft,
    label: archetype.labelColor,
    yard: 0x202a24,
    fence: 0x4a4651
  };
}

export function buildingPresentationLabelColor(building = {}) {
  return getBuildingArchetype(classifyBuildingPresentation(building)).labelColor;
}
