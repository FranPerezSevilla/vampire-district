import {
  FRONTAGE_KINDS,
  MODULE_KINDS
} from "./BuildingPresentationCatalog.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizedText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizedWords(value) {
  return normalizedText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export const ROOF_SURFACE_KINDS = deepFreeze({
  SMOOTH: "smooth",
  MEMBRANE: "membrane",
  CORRUGATED: "corrugated",
  CIVIC: "civic",
  NIGHT: "night",
  PITCHED: "pitched"
});

const PROFILE_ALIASES = deepFreeze({
  apartments: "residential",
  apartment: "residential",
  flats: "residential",
  housing: "residential",
  depot: "warehouse",
  storage: "warehouse",
  factory: "industrial",
  foundry: "industrial",
  garage: "industrial",
  workshop: "industrial",
  retail: "commercial",
  office: "commercial",
  nightclub: "club",
  cathedral: "church"
});

export const BUILDING_VISUAL_PROFILES = deepFreeze({
  default: {
    id: "default",
    surfaceKind: ROOF_SURFACE_KINDS.SMOOTH,
    layoutCandidates: ["rectangle", "rectangle", "rectangle", "rectangle", "l-shape", "stepped", "t-shape"],
    frontage: FRONTAGE_KINDS.GENERIC,
    signatureProps: [],
    propPool: [MODULE_KINDS.HVAC, MODULE_KINDS.SKYLIGHT, MODULE_KINDS.HATCH, MODULE_KINDS.VENT],
    roofTint: 0x293041,
    roofTintAmount: 0.08,
    textureSpacing: 24,
    serviceStrip: null,
    serviceLight: false,
    annex: null,
    shadowDepthScale: 0.92,
    showLabel: false
  },
  residential: {
    id: "residential",
    surfaceKind: ROOF_SURFACE_KINDS.SMOOTH,
    layoutCandidates: ["rectangle", "rectangle", "rectangle", "l-shape", "stepped"],
    frontage: FRONTAGE_KINDS.GENERIC,
    signatureProps: [MODULE_KINDS.HATCH],
    propPool: [MODULE_KINDS.HVAC, MODULE_KINDS.VENT, MODULE_KINDS.SKYLIGHT],
    roofTint: 0x303445,
    roofTintAmount: 0.12,
    textureSpacing: 28,
    serviceStrip: null,
    serviceLight: false,
    annex: null,
    shadowDepthScale: 0.95,
    showLabel: false
  },
  commercial: {
    id: "commercial",
    surfaceKind: ROOF_SURFACE_KINDS.MEMBRANE,
    layoutCandidates: ["rectangle", "rectangle", "rectangle", "stepped", "l-shape"],
    frontage: FRONTAGE_KINDS.GENERIC,
    signatureProps: [MODULE_KINDS.HVAC],
    propPool: [MODULE_KINDS.SKYLIGHT, MODULE_KINDS.HATCH, MODULE_KINDS.VENT],
    roofTint: 0x303346,
    roofTintAmount: 0.1,
    textureSpacing: 30,
    serviceStrip: null,
    serviceLight: false,
    annex: null,
    shadowDepthScale: 0.98,
    showLabel: false
  },
  warehouse: {
    id: "warehouse",
    surfaceKind: ROOF_SURFACE_KINDS.CORRUGATED,
    layoutCandidates: ["rectangle", "rectangle", "rectangle", "rectangle"],
    frontage: FRONTAGE_KINDS.NONE,
    signatureProps: [MODULE_KINDS.SKYLIGHT],
    propPool: [MODULE_KINDS.HATCH, MODULE_KINDS.HVAC, MODULE_KINDS.VENT],
    roofTint: 0x18384b,
    roofTintAmount: 0.34,
    textureSpacing: 9,
    serviceStrip: "warehouse",
    serviceLight: false,
    annex: null,
    shadowDepthScale: 1.14,
    showLabel: false
  },
  industrial: {
    id: "industrial",
    surfaceKind: ROOF_SURFACE_KINDS.MEMBRANE,
    layoutCandidates: ["rectangle", "rectangle", "rectangle", "rectangle"],
    frontage: FRONTAGE_KINDS.NONE,
    signatureProps: [MODULE_KINDS.HVAC],
    propPool: [MODULE_KINDS.HATCH, MODULE_KINDS.VENT, MODULE_KINDS.SKYLIGHT],
    roofTint: 0x4a342b,
    roofTintAmount: 0.32,
    textureSpacing: 30,
    serviceStrip: "loading",
    serviceLight: true,
    annex: {
      kind: "service-room",
      chance: 1,
      anchor: "north-east",
      widthRatio: 0.29,
      heightRatio: 0.34
    },
    shadowDepthScale: 1.18,
    showLabel: false
  },
  police: {
    id: "police",
    surfaceKind: ROOF_SURFACE_KINDS.CIVIC,
    layoutCandidates: ["rectangle"],
    frontage: FRONTAGE_KINDS.POLICE,
    signatureProps: [MODULE_KINDS.ANTENNA, MODULE_KINDS.HVAC],
    propPool: [MODULE_KINDS.HATCH, MODULE_KINDS.VENT],
    roofTint: 0x233754,
    roofTintAmount: 0.28,
    textureSpacing: 34,
    serviceStrip: "civic",
    serviceLight: false,
    annex: null,
    shadowDepthScale: 1.08,
    showLabel: false
  },
  club: {
    id: "club",
    surfaceKind: ROOF_SURFACE_KINDS.NIGHT,
    layoutCandidates: ["irregular", "l-shape", "stepped"],
    frontage: FRONTAGE_KINDS.CLUB,
    signatureProps: [MODULE_KINDS.SKYLIGHT],
    propPool: [MODULE_KINDS.HVAC, MODULE_KINDS.VENT],
    roofTint: 0x271a31,
    roofTintAmount: 0.34,
    textureSpacing: 36,
    serviceStrip: null,
    serviceLight: false,
    annex: null,
    shadowDepthScale: 1.06,
    showLabel: false
  },
  church: {
    id: "church",
    surfaceKind: ROOF_SURFACE_KINDS.PITCHED,
    layoutCandidates: ["cross", "t-shape"],
    frontage: FRONTAGE_KINDS.CHURCH,
    signatureProps: [],
    propPool: [MODULE_KINDS.HATCH, MODULE_KINDS.VENT],
    roofTint: 0x3d3840,
    roofTintAmount: 0.16,
    textureSpacing: 40,
    serviceStrip: null,
    serviceLight: false,
    annex: null,
    shadowDepthScale: 1.08,
    showLabel: false
  }
});

const PROFILE_RULES = deepFreeze([
  {
    profileId: "warehouse",
    tokens: ["ware", "warehouse", "depot", "storage", "logistics", "freight", "hangar", "distribution"]
  },
  {
    profileId: "industrial",
    tokens: ["works", "factory", "foundry", "plant", "garage", "workshop", "mill", "industrial", "forge"]
  },
  {
    profileId: "residential",
    tokens: ["flats", "apartments", "apartment", "homes", "housing", "residence", "residential", "tenement"]
  },
  {
    profileId: "commercial",
    tokens: ["shops", "shop", "market", "office", "offices", "mall", "retail", "store"]
  }
]);

function normalizedSurface(value) {
  const key = normalizedText(value);
  return Object.values(ROOF_SURFACE_KINDS).includes(key) ? key : null;
}

function normalizedProfile(value) {
  const key = normalizedText(value);
  if (!key) return null;
  const alias = PROFILE_ALIASES[key] || key;
  return BUILDING_VISUAL_PROFILES[alias] ? alias : null;
}

function classificationWords(building = {}) {
  return new Set([
    building.id,
    building.sign,
    building.label,
    building.name,
    building.kind,
    building.landmarkId,
    building.districtId
  ].flatMap(normalizedWords));
}

export function classifyBuildingVisualProfile(building = {}, archetypeId = "generic") {
  const explicit = normalizedProfile(
    building.presentation?.profileId
      || building.presentation?.profile
      || building.presentationProfile
  );
  if (explicit) return explicit;

  const archetypeProfile = normalizedProfile(archetypeId);
  if (archetypeId !== "generic" && archetypeProfile) return archetypeProfile;

  const words = classificationWords(building);
  for (const rule of PROFILE_RULES) {
    if (rule.tokens.some(token => words.has(token))) return rule.profileId;
  }
  return "default";
}

export function getBuildingVisualProfile(id) {
  return BUILDING_VISUAL_PROFILES[normalizedProfile(id) || "default"];
}

export function resolveBuildingVisualProfile(building = {}, archetypeId = "generic", options = {}) {
  const explicit = building.presentation || {};
  const requestedProfile = normalizedProfile(
    options.profileId
      || options.profile
      || explicit.profileId
      || explicit.profile
  );
  const profileId = requestedProfile || classifyBuildingVisualProfile(building, archetypeId);
  const profile = getBuildingVisualProfile(profileId);
  const requestedSurface = normalizedSurface(
    options.surfaceKind
      || options.roofSurface
      || explicit.surfaceKind
      || explicit.roofSurface
  );

  return {
    ...profile,
    id: profileId,
    surfaceKind: requestedSurface || profile.surfaceKind,
    layoutCandidates: [...profile.layoutCandidates],
    signatureProps: [...profile.signatureProps],
    propPool: [...profile.propPool],
    annex: profile.annex ? { ...profile.annex } : null,
    showLabel: Boolean(options.showLabel ?? explicit.showLabel ?? profile.showLabel)
  };
}
