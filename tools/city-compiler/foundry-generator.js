import { blockTemplateById, districtRecipeById } from "./catalog.js";
import { currentCityBlueprint } from "./current-city.js";
import { rectArea } from "./geometry.js";
import { defineCityBlueprint } from "./model.js";
import { createRng } from "./rng.js";
import { scoreCityBlueprint } from "./score.js";
import { validateCityBlueprint } from "./validate.js";

const STREET_LAYER = 0;
const LOW_ROOF_LAYER = 1;
const GENERATED_PREFIX = "foundry:";
const PILOT_BUILDING_IDS = Object.freeze([
  "foundry:block-01:machine-shop",
  "foundry:block-02:west-works",
  "foundry:block-03:east-loading",
  "foundry:block-04:west-yard",
  "foundry:block-05:east-works"
]);
const PILOT_BUILDING_ID_SET = new Set(PILOT_BUILDING_IDS);
const PILOT_ROAD_IDS = Object.freeze([
  "foundry:road:north-yard",
  "foundry:road:north-drop",
  "foundry:road:east-link"
]);
const PILOT_ROUTE_IDS = Object.freeze([
  "foundry:roof-route:west-east",
  "foundry:roof-route:east-south",
  "foundry:roof-route:south-cross"
]);
const PILOT_ESCAPE_IDS = Object.freeze([
  "foundry:fire-escape:west",
  "foundry:fire-escape:east"
]);
const PILOT_SEWER_IDS = Object.freeze([
  "foundry:sewer-access:north",
  "foundry:sewer-access:central"
]);
const PILOT_DUMPSTER_IDS = Object.freeze([
  "foundry:dumpster:north-yard",
  "foundry:dumpster:middle-east",
  "foundry:dumpster:south-west",
  "foundry:dumpster:south-east"
]);
const PILOT_LIGHT_PREFIX = "foundry:lamp:";
const PILOT_SHADOW_PREFIX = "foundry:shadow:";
const PILOT_NAV_PREFIX = "foundry:navigation:";
const PILOT_VEHICLE_ID = "foundry:vehicle:utility";
const PILOT_PEDESTRIAN_ROUTE_ID = "foundry:pedestrian-route:works-loop";

function round(value, precision = 1) {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function slug(value) {
  return String(value || "candidate")
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "candidate";
}

function foundryDistrict(blueprint = currentCityBlueprint) {
  const district = blueprint.districts.find(candidate => candidate.id === "foundry");
  if (!district) throw new Error("Foundry district is missing from the city blueprint.");
  return district;
}

function byId(items = [], id) {
  const item = items.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Foundry Topology V2 baseline is missing ${id}.`);
  return item;
}

function withoutIds(items = [], ids = []) {
  const excluded = ids instanceof Set ? ids : new Set(ids);
  return items.filter(item => !excluded.has(item?.id));
}

function withoutPrefix(items = [], prefix) {
  return items.filter(item => !String(item?.id || "").startsWith(prefix));
}

function isPilotBuilding(item) {
  return PILOT_BUILDING_ID_SET.has(item?.id);
}

function pilotGenerated(items = []) {
  return items.filter(item => String(item?.id || "").startsWith(GENERATED_PREFIX));
}

function pilotBuildings(items = []) {
  return items.filter(isPilotBuilding);
}

function paletteFor(family) {
  return {
    "machine-shop": { color: 0x211b17, trim: 0xa57b4d },
    "loading-bay": { color: 0x191b1c, trim: 0x826b4d },
    housing: { color: 0x1b1a23, trim: 0x756f8e },
    market: { color: 0x21191a, trim: 0xa77858 },
    tenement: { color: 0x20191c, trim: 0x8d6c70 },
    civic: { color: 0x202026, trim: 0x8a8598 }
  }[family] || { color: 0x1d1b1a, trim: 0x8f7250 };
}

function chooseBuildingVariants(runtime, rng) {
  const templateChoices = {
    "foundry:block-01:machine-shop": ["loading-bay-a", "row-housing-a", "market-passage-a"],
    "foundry:block-02:west-works": ["row-housing-a", "tenement-courtyard-a", "market-passage-a", "civic-landmark-a"],
    "foundry:block-03:east-loading": ["row-housing-a", "market-passage-a", "civic-landmark-a"],
    "foundry:block-04:west-yard": ["row-housing-a", "market-passage-a", "civic-landmark-a"],
    "foundry:block-05:east-works": ["row-housing-a", "market-passage-a", "civic-landmark-a"]
  };

  return PILOT_BUILDING_IDS.map(id => {
    const baseline = byId(runtime.buildings, id);
    const templateId = rng.pick(templateChoices[id]);
    const template = blockTemplateById[templateId];
    const palette = paletteFor(template.family);
    return {
      ...baseline,
      templateId,
      family: template.family,
      color: palette.color,
      trim: palette.trim,
      generated: true,
      districtId: "foundry"
    };
  });
}

function roofFor(building) {
  const inset = 6;
  return {
    id: `${building.id}:roof`,
    x: building.x + inset,
    y: building.y + inset,
    w: building.w - inset * 2,
    h: building.h - inset * 2,
    color: building.color + 0x101010,
    label: building.sign,
    buildingId: building.id,
    generated: true,
    districtId: "foundry"
  };
}

function verticalLayer(buildings) {
  const map = Object.fromEntries(buildings.map(building => [building.id, building]));
  const westMiddle = roofFor(map["foundry:block-02:west-works"]);
  const eastMiddle = roofFor(map["foundry:block-03:east-loading"]);
  const westLower = roofFor(map["foundry:block-04:west-yard"]);
  const eastLower = roofFor(map["foundry:block-05:east-works"]);
  const roofs = [westMiddle, eastMiddle, westLower, eastLower];
  const middleY = round(westMiddle.y + westMiddle.h / 2);
  const lowerY = round(westLower.y + westLower.h / 2);
  const routes = [
    {
      id: PILOT_ROUTE_IDS[0],
      ax: westMiddle.x + westMiddle.w, ay: middleY,
      bx: eastMiddle.x, by: middleY,
      aLayer: LOW_ROOF_LAYER, bLayer: LOW_ROOF_LAYER,
      aToB: "jump to east loading roof", bToA: "jump to west works roof",
      generated: true
    },
    {
      id: PILOT_ROUTE_IDS[1],
      ax: round(eastMiddle.x + eastMiddle.w / 2), ay: eastMiddle.y + eastMiddle.h,
      bx: round(eastLower.x + eastLower.w / 2), by: eastLower.y,
      aLayer: LOW_ROOF_LAYER, bLayer: LOW_ROOF_LAYER,
      aToB: "jump to south works roof", bToA: "jump to east loading roof",
      generated: true
    },
    {
      id: PILOT_ROUTE_IDS[2],
      ax: westLower.x + westLower.w, ay: lowerY,
      bx: eastLower.x, by: lowerY,
      aLayer: LOW_ROOF_LAYER, bLayer: LOW_ROOF_LAYER,
      aToB: "jump to east works roof", bToA: "jump to west yard roof",
      generated: true
    }
  ];
  const fireEscapes = [
    {
      id: PILOT_ESCAPE_IDS[0],
      name: "Foundry west fire escape",
      street: { x: westMiddle.x - 20, y: middleY },
      roof: { layer: LOW_ROOF_LAYER, x: westMiddle.x, y: middleY },
      generated: true
    },
    {
      id: PILOT_ESCAPE_IDS[1],
      name: "Foundry east fire escape",
      street: { x: eastMiddle.x + eastMiddle.w + 16, y: middleY },
      roof: { layer: LOW_ROOF_LAYER, x: eastMiddle.x + eastMiddle.w, y: middleY },
      generated: true
    }
  ];
  return { roofs, routes, fireEscapes };
}

function generatedLights() {
  return [
    { id: "foundry:lamp:north-yard-01", x: 1450, y: 2155, radius: 72, name: "north yard light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:north-yard-02", x: 1550, y: 2217, radius: 72, name: "north yard light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:north-yard-west", x: 1395, y: 2180, radius: 68, name: "north yard west light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:north-yard-east", x: 1805, y: 2180, radius: 68, name: "north yard east light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:north-drop", x: 1735, y: 2240, radius: 68, name: "north drop light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:east-link-01", x: 1900, y: 2315, radius: 70, name: "east link light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:east-link-02", x: 2100, y: 2377, radius: 70, name: "east link light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:east-link-03", x: 2285, y: 2345, radius: 66, name: "east gate light", layer: STREET_LAYER, generated: true }
  ];
}

function generatedShadows() {
  return [
    { id: "foundry:shadow:north-yard", x: 1400, y: 2160, w: 400, h: 52, name: "north yard shadow", strength: 0.78, generated: true },
    { id: "foundry:shadow:north-drop", x: 1740, y: 2212, w: 60, h: 108, name: "north drop shadow", strength: 0.84, generated: true },
    { id: "foundry:shadow:east-link", x: 1800, y: 2320, w: 480, h: 52, name: "east link shadow", strength: 0.76, generated: true },
    { id: "foundry:shadow:south-yard", x: 1660, y: 2520, w: 60, h: 220, name: "south yard shadow", strength: 0.86, generated: true }
  ];
}

function generatedNavigationPoints() {
  return [
    { id: "foundry:navigation:north-yard", x: 1680, y: 2186, generated: true },
    { id: "foundry:navigation:east-link", x: 2080, y: 2346, generated: true },
    { id: "foundry:navigation:canal", x: 1680, y: 2820, generated: true }
  ];
}

function generatedVehicle(runtime, rng) {
  const baseline = byId(runtime.vehicles, PILOT_VEHICLE_ID);
  return {
    ...baseline,
    archetypeId: rng.pick(["compact", "sedan", "van"]),
    angle: rng.chance(0.5) ? 0 : Math.PI,
    generated: true
  };
}

function chaseLoops() {
  return [
    {
      id: "foundry:chase-loop:west-yard",
      roadIds: ["canalBoulevard", "foundry:road:north-yard", "foundry:road:north-drop", "foundry:road:east-link"],
      length: 620,
      character: "tight industrial yard loop"
    },
    {
      id: "foundry:chase-loop:east-service",
      roadIds: ["foundry:road:east-link", "policeEastLane", "canalBoulevard"],
      length: 780,
      character: "fast service-road loop"
    }
  ];
}

function candidatePlan(seed, runtime, buildings, vertical, vehicle) {
  return {
    seed,
    districtId: "foundry",
    topologyVersion: 2,
    generatedRoadIds: PILOT_ROAD_IDS,
    chaseLoops: chaseLoops(),
    blocks: buildings.map(building => ({
      id: building.id.split(":").slice(0, 2).join(":"),
      buildingId: building.id,
      templateId: building.templateId,
      family: building.family,
      footprint: { x: building.x, y: building.y, w: building.w, h: building.h }
    })),
    roofNetwork: {
      roofIds: vertical.roofs.map(item => item.id),
      routeIds: vertical.routes.map(item => item.id),
      entryIds: vertical.fireEscapes.map(item => item.id)
    },
    darkRouteIds: generatedShadows().map(item => item.id),
    sewerAccessIds: PILOT_SEWER_IDS,
    vehicleSocketIds: [vehicle.id],
    retainedTopologyIds: {
      roads: PILOT_ROAD_IDS,
      pedestrianRoute: PILOT_PEDESTRIAN_ROUTE_ID,
      dumpsters: PILOT_DUMPSTER_IDS
    },
    baselineWorld: { ...runtime.world }
  };
}

export function generateFoundryCandidate(seed, { baseBlueprint = currentCityBlueprint } = {}) {
  const normalizedSeed = slug(seed);
  const rng = createRng(normalizedSeed);
  foundryDistrict(baseBlueprint);
  const runtime = baseBlueprint.runtime;
  const buildings = chooseBuildingVariants(runtime, rng);
  const vertical = verticalLayer(buildings);
  const vehicle = generatedVehicle(runtime, rng);
  const roofAreas = Object.fromEntries(Object.entries(runtime.roofAreas || {}).map(([layer, areas]) => [
    layer,
    areas.filter(area => !PILOT_BUILDING_ID_SET.has(area.buildingId))
  ]));
  roofAreas[LOW_ROOF_LAYER] = [...(roofAreas[LOW_ROOF_LAYER] || []), ...vertical.roofs];

  const candidateRuntime = {
    ...runtime,
    buildings: [...runtime.buildings.filter(item => !isPilotBuilding(item)), ...buildings],
    roofAreas,
    rooftopRoutes: [...withoutIds(runtime.rooftopRoutes, PILOT_ROUTE_IDS), ...vertical.routes],
    fireEscapes: [...withoutIds(runtime.fireEscapes, PILOT_ESCAPE_IDS), ...vertical.fireEscapes],
    lights: withoutPrefix(runtime.lights, PILOT_LIGHT_PREFIX),
    shadowZones: [...withoutPrefix(runtime.shadowZones, PILOT_SHADOW_PREFIX), ...generatedShadows()],
    streetNavigationPoints: [
      ...withoutPrefix(runtime.streetNavigationPoints || [], PILOT_NAV_PREFIX),
      ...generatedNavigationPoints()
    ],
    vehicles: [...withoutIds(runtime.vehicles, [PILOT_VEHICLE_ID]), vehicle]
  };
  const plan = candidatePlan(normalizedSeed, baseBlueprint, buildings, vertical, vehicle);

  return defineCityBlueprint({
    ...baseBlueprint,
    id: `bloodnight-foundry-${normalizedSeed}`,
    seed: normalizedSeed,
    runtime: candidateRuntime,
    metadata: {
      ...baseBlueprint.metadata,
      mode: "generated-foundry-topology-v2-variant",
      compilerStage: "foundry-topology-v2",
      generatedAtRuntime: false,
      foundryPilot: plan
    }
  });
}

export function scoreFoundryCandidate(
  blueprint,
  validation = validateCityBlueprint(blueprint),
  cityScore = scoreCityBlueprint(blueprint, validation)
) {
  const runtime = blueprint.runtime;
  const plan = blueprint.metadata?.foundryPilot || {};
  const buildings = pilotBuildings(runtime.buildings);
  const families = new Set(buildings.map(item => item.family).filter(Boolean));
  const templateFit = buildings.every(building => {
    const template = blockTemplateById[building.templateId];
    if (!template) return false;
    return building.w >= template.footprint.minWidth
      && building.w <= template.footprint.maxWidth
      && building.h >= template.footprint.minHeight
      && building.h <= template.footprint.maxHeight;
  });
  const roofs = Object.values(runtime.roofAreas || {}).flat().filter(item => PILOT_BUILDING_ID_SET.has(item.buildingId));
  const roofRoutes = withoutIds(runtime.rooftopRoutes, []).filter(item => PILOT_ROUTE_IDS.includes(item.id));
  const fireEscapes = runtime.fireEscapes.filter(item => PILOT_ESCAPE_IDS.includes(item.id));
  const sewerAccesses = runtime.sewerAccesses.filter(item => PILOT_SEWER_IDS.includes(item.id));
  const district = foundryDistrict(blueprint);
  const bounds = district.bounds;
  const lights = runtime.lights.filter(item => (
    item.x >= bounds.x && item.x <= bounds.x + bounds.w
    && item.y >= bounds.y && item.y <= bounds.y + bounds.h
  ));
  const dumpsters = runtime.dumpsters.filter(item => PILOT_DUMPSTER_IDS.includes(item.id));
  const vehicles = runtime.vehicles.filter(item => item.id === PILOT_VEHICLE_ID);
  const shadows = runtime.shadowZones.filter(item => String(item.id).startsWith(PILOT_SHADOW_PREFIX));
  const buildingCoverage = buildings.reduce((sum, item) => sum + rectArea(item), 0) / rectArea(district.bounds);
  const loopCount = plan.chaseLoops?.length || 0;
  const loopLengthQuality = (plan.chaseLoops || []).filter(loop => loop.length >= 450 && loop.length <= 900).length / Math.max(1, loopCount);
  const components = {
    hardValidity: validation.valid ? 100 : 0,
    roadLoops: Math.min(100, loopCount / 2 * 75 + loopLengthQuality * 25),
    blockDiversity: Math.min(100, families.size / 3 * 100),
    traversal: Math.min(100,
      Math.min(1, roofs.length / 3) * 28
      + Math.min(1, roofRoutes.length / 2) * 24
      + Math.min(1, fireEscapes.length / 2) * 18
      + Math.min(1, sewerAccesses.length / 2) * 30
    ),
    systemicSockets: Math.min(100,
      Math.min(1, lights.length / 8) * 25
      + Math.min(1, dumpsters.length / 4) * 25
      + Math.min(1, vehicles.length) * 20
      + Math.min(1, shadows.length / 3) * 30
    ),
    buildableCoverage: Math.max(0, 100 - Math.abs(buildingCoverage - 0.18) / 0.12 * 100),
    globalCityScore: cityScore.total
  };
  const weights = {
    hardValidity: 0.12,
    roadLoops: 0.18,
    blockDiversity: 0.10,
    traversal: 0.20,
    systemicSockets: 0.15,
    buildableCoverage: 0.10,
    globalCityScore: 0.15
  };
  const total = Object.entries(components).reduce((sum, [key, value]) => sum + value * weights[key], 0);
  const baselineValidation = validateCityBlueprint(currentCityBlueprint);
  const baselineScore = scoreCityBlueprint(currentCityBlueprint, baselineValidation);
  const acceptance = {
    valid: validation.valid,
    chaseLoops: loopCount >= 2,
    rooftopNetwork: roofs.length >= 3 && roofRoutes.length >= 2 && fireEscapes.length >= 2,
    sewerEntrances: sewerAccesses.length >= 2,
    darkRoutes: shadows.length >= 3,
    hidingSockets: dumpsters.length >= 4,
    parkedVehicle: vehicles.length >= 1,
    templateFit,
    scoreAtLeastBaseline: cityScore.total >= baselineScore.total
  };
  return {
    total: round(total),
    grade: total >= 88 ? "A" : total >= 78 ? "B" : total >= 68 ? "C" : total >= 55 ? "D" : "E",
    components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, round(value)])),
    weights,
    acceptance,
    accepted: Object.values(acceptance).every(Boolean),
    diagnostics: {
      buildingCoverage: round(buildingCoverage, 3),
      familyCount: families.size,
      families: [...families].sort(),
      loopCount,
      roofs: roofs.length,
      roofRoutes: roofRoutes.length,
      fireEscapes: fireEscapes.length,
      sewerAccesses: sewerAccesses.length,
      lights: lights.length,
      dumpsters: dumpsters.length,
      vehicles: vehicles.length,
      darkRoutes: shadows.length,
      templateFit,
      baselineCityScore: baselineScore.total,
      candidateCityScore: cityScore.total
    }
  };
}

export function evaluateFoundryCandidate(blueprint) {
  const validation = validateCityBlueprint(blueprint);
  const cityScore = scoreCityBlueprint(blueprint, validation);
  const foundryScore = scoreFoundryCandidate(blueprint, validation, cityScore);
  return { blueprint, validation, cityScore, foundryScore };
}

export function generateFoundryCandidates({ seedPrefix = "foundry-pilot", count = 24, baseBlueprint = currentCityBlueprint } = {}) {
  const total = Math.max(1, Math.floor(Number(count) || 1));
  return Array.from({ length: total }, (_, index) => {
    const seed = `${slug(seedPrefix)}-${String(index + 1).padStart(2, "0")}`;
    return evaluateFoundryCandidate(generateFoundryCandidate(seed, { baseBlueprint }));
  });
}

export function rankFoundryCandidates(candidates = []) {
  return [...candidates].sort((left, right) => {
    if (left.foundryScore.accepted !== right.foundryScore.accepted) return left.foundryScore.accepted ? -1 : 1;
    if (left.validation.valid !== right.validation.valid) return left.validation.valid ? -1 : 1;
    if (right.foundryScore.total !== left.foundryScore.total) return right.foundryScore.total - left.foundryScore.total;
    if (right.cityScore.total !== left.cityScore.total) return right.cityScore.total - left.cityScore.total;
    if (left.validation.warnings.length !== right.validation.warnings.length) return left.validation.warnings.length - right.validation.warnings.length;
    return left.blueprint.seed.localeCompare(right.blueprint.seed);
  });
}

export function foundryCandidateSummary(result, rank = null) {
  return {
    rank,
    id: result.blueprint.id,
    seed: result.blueprint.seed,
    valid: result.validation.valid,
    errors: result.validation.errors.length,
    warnings: result.validation.warnings.length,
    cityScore: result.cityScore,
    foundryScore: result.foundryScore,
    plan: result.blueprint.metadata?.foundryPilot || null
  };
}

export { foundryDistrict, districtRecipeById };
