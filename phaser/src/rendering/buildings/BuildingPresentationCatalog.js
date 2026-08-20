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

export const BUILDING_PRESENTATION_VERSION = 4;

export const MODULE_KINDS = deepFreeze({
  FOUNDATION: "foundation",
  ROOF_MASS: "roof-mass",
  ROOF_ANNEX: "roof-annex",
  ROOF_TEXTURE_LINE: "roof-texture-line",
  PARAPET_EDGE: "parapet-edge",
  FRONTAGE: "frontage",
  SERVICE_STRIP: "service-strip",
  SERVICE_LIGHT: "service-light",
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

export const ROOFTOP_PROP_KINDS = deepFreeze([
  MODULE_KINDS.SKYLIGHT,
  MODULE_KINDS.HVAC,
  MODULE_KINDS.VENT,
  MODULE_KINDS.HATCH,
  MODULE_KINDS.ANTENNA,
  MODULE_KINDS.SATELLITE_DISH
]);

export const MODULE_LAYERS = deepFreeze({
  foundation: 0,
  roof: 10,
  surface: 15,
  edge: 20,
  annex: 26,
  frontage: 30,
  service: 35,
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

// Normal gameplay should read silhouette first and roof detail second. Rich is
// reserved for close-up experiments; even it remains deliberately restrained.
export const DETAIL_LEVELS = deepFreeze({
  minimal: { propDensity: 0.58, maximumProps: 1 },
  standard: { propDensity: 0.88, maximumProps: 2 },
  rich: { propDensity: 1, maximumProps: 3 }
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
    signatureProps: [],
    propPool: [MODULE_KINDS.HVAC, MODULE_KINDS.SKYLIGHT, MODULE_KINDS.HATCH, MODULE_KINDS.VENT],
    labelColor: 0xefe6ff,
    accent: 0x77809c,
    accentSoft: 0x444a61
  },
  police: {
    id: "police",
    defaultLayout: "rectangle",
    layoutCandidates: ["rectangle"],
    frontage: FRONTAGE_KINDS.POLICE,
    signatureProps: [MODULE_KINDS.ANTENNA, MODULE_KINDS.HVAC],
    propPool: [MODULE_KINDS.HATCH, MODULE_KINDS.VENT],
    requiredIdentity: [MODULE_KINDS.ACCENT_STRIP],
    labelColor: 0xc9ddff,
    accent: 0x4b82df,
    accentSoft: 0x263f72
  },
  club: {
    id: "club",
    defaultLayout: "irregular",
    layoutCandidates: ["irregular", "l-shape", "stepped"],
    frontage: FRONTAGE_KINDS.CLUB,
    signatureProps: [MODULE_KINDS.SKYLIGHT],
    propPool: [MODULE_KINDS.HVAC, MODULE_KINDS.VENT],
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
    signatureProps: [],
    propPool: [MODULE_KINDS.HATCH, MODULE_KINDS.VENT],
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
  const explicit = normalizedArchetype(
    building.presentation?.archetype
      || building.presentationArchetype
  );
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
    profileId: options.profileId || options.profile || explicit.profileId || explicit.profile || null,
    surfaceKind: options.surfaceKind || options.roofSurface || explicit.surfaceKind || explicit.roofSurface || null,
    showLabel: Boolean(options.showLabel ?? explicit.showLabel ?? false),
    propKinds: Array.isArray(options.propKinds || explicit.propKinds)
      ? [...(options.propKinds || explicit.propKinds)]
      : null
  };
}

export function resolveBuildingPalette(building = {}, archetypeId = "generic", visualProfile = null) {
  const archetype = getBuildingArchetype(archetypeId);
  const authoredBase = Number.isFinite(Number(building.color))
    ? Number(building.color)
    : DEFAULT_BUILDING_COLOR;
  const authoredTrim = Number.isFinite(Number(building.trim))
    ? Number(building.trim)
    : DEFAULT_BUILDING_TRIM;
  const profileTint = Number.isFinite(Number(visualProfile?.roofTint))
    ? Number(visualProfile.roofTint)
    : authoredBase;
  const profileAmount = Math.max(0, Math.min(1, Number(visualProfile?.roofTintAmount) || 0));
  const base = mixBuildingColor(authoredBase, profileTint, profileAmount);
  const trim = mixBuildingColor(authoredTrim, profileTint, profileAmount * 0.2);
  const accent = archetype.accent;

  return {
    worldShadow: mixBuildingColor(base, 0x010207, 0.9),
    foundation: mixBuildingColor(base, 0x171a25, 0.24),
    foundationShadow: mixBuildingColor(base, 0x05060a, 0.7),
    foundationSeam: mixBuildingColor(trim, base, 0.7),
    wall: mixBuildingColor(base, 0x040509, 0.72),
    wallHighlight: mixBuildingColor(trim, 0xa7abb5, 0.18),
    roof: mixBuildingColor(base, 0x3b414f, 0.12),
    roofShade: mixBuildingColor(base, 0x080a11, 0.5),
    roofShadow: mixBuildingColor(base, 0x020308, 0.82),
    annexRoof: mixBuildingColor(base, 0x252a35, 0.26),
    roofTexture: mixBuildingColor(trim, base, 0.7),
    roofTextureHighlight: mixBuildingColor(trim, 0xd3deea, 0.18),
    parapetLight: mixBuildingColor(trim, 0xd4d2dc, 0.24),
    parapetMid: mixBuildingColor(trim, base, 0.44),
    parapetDark: mixBuildingColor(trim, 0x08090e, 0.6),
    seam: mixBuildingColor(trim, base, 0.72),
    prop: mixBuildingColor(trim, 0x9ea2ac, 0.28),
    propDark: mixBuildingColor(trim, 0x090a10, 0.6),
    glass: mixBuildingColor(archetypeId === "club" ? accent : 0x315b92, 0x090d16, 0.34),
    glassHighlight: mixBuildingColor(archetypeId === "club" ? accent : 0x72a4e1, 0xffffff, 0.16),
    canopy: mixBuildingColor(base, trim, 0.28),
    serviceDark: mixBuildingColor(base, 0x05070a, 0.78),
    serviceMid: mixBuildingColor(trim, base, 0.64),
    serviceWindow: mixBuildingColor(0x17233a, accent, archetypeId === "police" ? 0.18 : 0.05),
    serviceLight: 0xf2b35e,
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
