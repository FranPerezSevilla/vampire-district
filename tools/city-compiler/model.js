const ID_PATTERN = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function assertStableId(id, label = "id") {
  const normalized = String(id || "").trim();
  if (!ID_PATTERN.test(normalized)) {
    throw new TypeError(`${label} must be a stable lowercase id: ${normalized || "<empty>"}`);
  }
  return normalized;
}

export function defineDistrictRecipe(input = {}) {
  const id = assertStableId(input.id, "District recipe id");
  const roadWidths = input.roadWidths || {};
  const density = input.density || {};
  const gameplay = input.gameplay || {};
  return deepFreeze({
    id,
    label: String(input.label || id),
    roadStyle: String(input.roadStyle || "orthogonal-mixed"),
    roadWidths: {
      major: [...(roadWidths.major || [92, 128])],
      local: [...(roadWidths.local || [48, 72])],
      alley: [...(roadWidths.alley || [28, 52])]
    },
    blockSize: [...(input.blockSize || [160, 360])],
    density: {
      buildings: finite(density.buildings, 0.62),
      alleys: finite(density.alleys, 0.25),
      pedestrians: finite(density.pedestrians, 0.25),
      lighting: finite(density.lighting, 0.55),
      shadows: finite(density.shadows, 0.35)
    },
    buildingWeights: { ...(input.buildingWeights || { mixed: 1 }) },
    gameplay: {
      chaseLoops: [...(gameplay.chaseLoops || [1, 3])],
      hidingSpots: [...(gameplay.hidingSpots || [2, 6])],
      roofNetworks: [...(gameplay.roofNetworks || [0, 2])],
      sewerEntrances: [...(gameplay.sewerEntrances || [1, 3])],
      darkRoutes: [...(gameplay.darkRoutes || [1, 3])]
    },
    tags: [...(input.tags || [])]
  });
}

export function defineBlockTemplate(input = {}) {
  const id = assertStableId(input.id, "Block template id");
  const footprint = input.footprint || {};
  return deepFreeze({
    id,
    label: String(input.label || id),
    family: String(input.family || "mixed"),
    footprint: {
      minWidth: finite(footprint.minWidth, 100),
      maxWidth: finite(footprint.maxWidth, footprint.minWidth || 200),
      minHeight: finite(footprint.minHeight, 80),
      maxHeight: finite(footprint.maxHeight, footprint.minHeight || 180)
    },
    frontages: [...(input.frontages || ["north"])],
    serviceAccess: [...(input.serviceAccess || [])],
    passages: [...(input.passages || [])],
    roof: {
      enabled: input.roof?.enabled !== false,
      height: String(input.roof?.height || "low"),
      entrySockets: [...(input.roof?.entrySockets || [])],
      jumpSockets: [...(input.roof?.jumpSockets || [])]
    },
    sockets: {
      dumpsters: finite(input.sockets?.dumpsters, 0),
      lights: finite(input.sockets?.lights, 0),
      parkedVehicles: finite(input.sockets?.parkedVehicles, 0),
      missionTargets: finite(input.sockets?.missionTargets, 0),
      hiddenBodies: finite(input.sockets?.hiddenBodies, 0)
    },
    variants: [...(input.variants || ["identity", "rotate-90", "rotate-180", "rotate-270"])]
  });
}

export function defineCityBlueprint(input = {}) {
  const id = assertStableId(input.id, "City blueprint id");
  const world = input.world || {};
  const width = finite(world.width);
  const height = finite(world.height);
  if (width <= 0 || height <= 0) throw new RangeError("City world dimensions must be positive.");

  return deepFreeze({
    schemaVersion: Math.max(1, Math.floor(finite(input.schemaVersion, 1))),
    id,
    seed: String(input.seed || id),
    world: { width, height },
    protectedZones: [...(input.protectedZones || [])],
    districts: [...(input.districts || [])],
    landmarks: [...(input.landmarks || [])],
    recipes: [...(input.recipes || [])],
    blockTemplates: [...(input.blockTemplates || [])],
    runtime: { ...(input.runtime || {}) },
    metadata: { ...(input.metadata || {}) }
  });
}
