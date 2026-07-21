import { blockTemplateById, districtRecipeById } from "./catalog.js";
import { currentCityBlueprint } from "./current-city.js";
import { pointInRect, rectArea } from "./geometry.js";
import { defineCityBlueprint } from "./model.js";
import { createRng } from "./rng.js";
import { scoreCityBlueprint } from "./score.js";
import { validateCityBlueprint } from "./validate.js";

const STREET_LAYER = 0;
const LOW_ROOF_LAYER = 1;
const SIDEWALK_DEPTH = 22;
const ALLEY_WALK_DEPTH = 8;
const PRESERVED_FOUNDRY_BUILDINGS = new Set(["harborRegistry"]);
const GENERATED_PREFIX = "foundry:";

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

function center(item) {
  return {
    x: Number(item?.x || 0) + Number(item?.w || 0) / 2,
    y: Number(item?.y || 0) + Number(item?.h || 0) / 2
  };
}

function pointOf(item) {
  return { x: Number(item?.x || 0), y: Number(item?.y || 0) };
}

function foundryDistrict(blueprint = currentCityBlueprint) {
  const district = blueprint.districts.find(candidate => candidate.id === "foundry");
  if (!district) throw new Error("Foundry district is missing from the city blueprint.");
  return district;
}

function isInFoundry(point, bounds) {
  return pointInRect(point, bounds, 0.01);
}

function rect(id, x, y, w, h, extra = {}) {
  return { id, x: round(x), y: round(y), w: round(w), h: round(h), ...extra };
}

function sidewalkBands(road, world) {
  const depth = road.kind === "alley" ? ALLEY_WALK_DEPTH : SIDEWALK_DEPTH;
  const bands = [];
  if (road.y > 0) bands.push(rect(`${road.id}:north-walk`, road.x, Math.max(0, road.y - depth), road.w, depth, { roadId: road.id }));
  if (road.y + road.h < world.height) bands.push(rect(`${road.id}:south-walk`, road.x, road.y + road.h, road.w, Math.min(depth, world.height - road.y - road.h), { roadId: road.id }));
  if (road.x > 0) bands.push(rect(`${road.id}:west-walk`, Math.max(0, road.x - depth), road.y, depth, road.h, { roadId: road.id }));
  if (road.x + road.w < world.width) bands.push(rect(`${road.id}:east-walk`, road.x + road.w, road.y, Math.min(depth, world.width - road.x - road.w), road.h, { roadId: road.id }));
  return bands;
}

function generatedBuilding(id, name, sign, lot, templateId) {
  const template = blockTemplateById[templateId];
  if (!template) throw new Error(`Missing block template ${templateId}.`);
  const palette = {
    "machine-shop": { color: 0x211b17, trim: 0xa57b4d },
    "loading-bay": { color: 0x191b1c, trim: 0x826b4d },
    housing: { color: 0x1b1a23, trim: 0x756f8e }
  }[template.family] || { color: 0x1d1b1a, trim: 0x8f7250 };
  return {
    id,
    name,
    sign,
    x: round(lot.x),
    y: round(lot.y),
    w: round(lot.w),
    h: round(lot.h),
    color: palette.color,
    trim: palette.trim,
    generated: true,
    districtId: "foundry",
    templateId,
    family: template.family
  };
}

function generatedRoads(rng) {
  const northY = rng.pick([104, 110, 116, 122]);
  const northH = rng.pick([38, 42, 46]);
  const eastY = rng.pick([242, 248, 254]);
  const eastH = rng.pick([30, 34, 38]);
  return {
    northY,
    northH,
    eastY,
    eastH,
    roads: [
      rect("foundry:road:north-yard", 1744, northY, 232, northH, { label: "Foundry north yard", kind: "alley", generated: true }),
      rect("foundry:road:north-drop", 1920, northY + northH, 56, 226 - (northY + northH), { label: "Foundry north yard drop", kind: "alley", generated: true }),
      rect("foundry:road:east-link", 1976, eastY, 208, eastH, { label: "Foundry east service link", kind: "alley", generated: true })
    ]
  };
}

function generatedBuildings(rng, roadPlan) {
  const westX = 1754 + rng.int(0, 3) * 2;
  const westRight = 1904 - rng.int(0, 3) * 2;
  const eastX = 1988 + rng.int(0, 3) * 2;
  const eastRight = 2162 - rng.int(0, 3) * 2;
  const middleY = rng.pick([398, 400, 402]);
  const middleH = rng.pick([80, 84, 86]);
  const lowerY = rng.pick([570, 572, 574]);
  const lowerH = rng.pick([108, 112, 116]);
  const topY = rng.pick([18, 20, 22, 24]);
  const topH = roadPlan.northY - topY - 10;
  const middleWestTemplate = rng.pick(["machine-shop-row-a", "loading-bay-a"]);
  const middleEastTemplate = rng.pick(["loading-bay-a", "row-housing-a"]);
  const lowerWestTemplate = rng.pick(["loading-bay-a", "machine-shop-row-a"]);
  const lowerEastTemplate = rng.pick(["loading-bay-a", "row-housing-a"]);

  return [
    generatedBuilding("foundry:block-01:machine-shop", "NORTH MACHINE SHOP", "MACHINE", { x: westX, y: topY, w: westRight - westX, h: topH }, "machine-shop-row-a"),
    generatedBuilding("foundry:block-02:west-works", "WEST WORKS", "WORKS", { x: westX, y: middleY, w: westRight - westX, h: middleH }, middleWestTemplate),
    generatedBuilding("foundry:block-03:east-loading", "EAST LOADING", "LOAD", { x: eastX, y: middleY, w: eastRight - eastX, h: middleH }, middleEastTemplate),
    generatedBuilding("foundry:block-04:west-yard", "WEST YARD", "YARD", { x: westX, y: lowerY, w: westRight - westX, h: lowerH }, lowerWestTemplate),
    generatedBuilding("foundry:block-05:east-works", "EAST WORKS", "WORKS", { x: eastX, y: lowerY, w: eastRight - eastX, h: lowerH }, lowerEastTemplate)
  ];
}

function roofFor(building) {
  const inset = 6;
  return rect(`${building.id}:roof`, building.x + inset, building.y + inset, building.w - inset * 2, building.h - inset * 2, {
    color: building.color + 0x101010,
    label: building.sign,
    buildingId: building.id,
    generated: true,
    districtId: "foundry"
  });
}

function generatedVerticalLayer(buildings, rng) {
  const byId = Object.fromEntries(buildings.map(building => [building.id, building]));
  const westMiddle = roofFor(byId["foundry:block-02:west-works"]);
  const eastMiddle = roofFor(byId["foundry:block-03:east-loading"]);
  const westLower = roofFor(byId["foundry:block-04:west-yard"]);
  const eastLower = roofFor(byId["foundry:block-05:east-works"]);
  const roofs = rng.chance(0.55) ? [westMiddle, eastMiddle, eastLower, westLower] : [westMiddle, eastMiddle, eastLower];
  const middleY = round(westMiddle.y + westMiddle.h / 2);
  const lowerY = round(eastLower.y + eastLower.h / 2);
  const routes = [
    {
      id: "foundry:roof-route:west-east",
      ax: round(westMiddle.x + westMiddle.w), ay: middleY,
      bx: round(eastMiddle.x), by: middleY,
      aLayer: LOW_ROOF_LAYER, bLayer: LOW_ROOF_LAYER,
      aToB: "jump to east loading roof", bToA: "jump to west works roof",
      generated: true
    },
    {
      id: "foundry:roof-route:east-south",
      ax: round(eastMiddle.x + eastMiddle.w / 2), ay: round(eastMiddle.y + eastMiddle.h),
      bx: round(eastLower.x + eastLower.w / 2), by: round(eastLower.y),
      aLayer: LOW_ROOF_LAYER, bLayer: LOW_ROOF_LAYER,
      aToB: "jump to south works roof", bToA: "jump to east loading roof",
      generated: true
    }
  ];
  if (roofs.includes(westLower)) {
    routes.push({
      id: "foundry:roof-route:south-cross",
      ax: round(westLower.x + westLower.w), ay: lowerY,
      bx: round(eastLower.x), by: lowerY,
      aLayer: LOW_ROOF_LAYER, bLayer: LOW_ROOF_LAYER,
      aToB: "jump to east works roof", bToA: "jump to west yard roof",
      generated: true
    });
  }
  const fireEscapes = [
    {
      id: "foundry:fire-escape:west",
      name: "Foundry west fire escape",
      street: { x: 1754, y: middleY },
      roof: { layer: LOW_ROOF_LAYER, x: westMiddle.x + 4, y: middleY },
      generated: true
    },
    {
      id: "foundry:fire-escape:east",
      name: "Foundry east fire escape",
      street: { x: 2172, y: lowerY },
      roof: { layer: LOW_ROOF_LAYER, x: eastLower.x + eastLower.w - 4, y: lowerY },
      generated: true
    }
  ];
  return { roofs, routes, fireEscapes };
}

function generatedCrosswalks(roadPlan) {
  const centerY = round(roadPlan.eastY + roadPlan.eastH / 2);
  return [
    rect("foundry:crosswalk:east-link-west", 1920, centerY - 8, 56, 16, { orientation: "horizontal", generated: true }),
    rect("foundry:crosswalk:east-link-east", 2184, centerY - 8, 112, 16, { orientation: "horizontal", generated: true })
  ];
}

function generatedLights(roadPlan) {
  return [
    { id: "foundry:lamp:north-yard-01", x: 1790, y: roadPlan.northY - 4, radius: 72, name: "north yard light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:north-yard-02", x: 1880, y: roadPlan.northY + roadPlan.northH + 4, radius: 72, name: "north yard light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:north-drop", x: 1916, y: round((roadPlan.northY + roadPlan.northH + 226) / 2), radius: 68, name: "north drop light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:east-link-01", x: 2020, y: roadPlan.eastY - 4, radius: 70, name: "east link light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:east-link-02", x: 2120, y: roadPlan.eastY + roadPlan.eastH + 4, radius: 70, name: "east link light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:west-middle", x: 1754, y: 438, radius: 66, name: "west works light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:east-middle", x: 2172, y: 438, radius: 66, name: "east loading light", layer: STREET_LAYER, generated: true },
    { id: "foundry:lamp:south-yard", x: 1754, y: 630, radius: 64, name: "south yard light", layer: STREET_LAYER, generated: true }
  ];
}

function generatedDumpsters() {
  return [
    { id: "foundry:dumpster:north-yard", name: "north yard dumpster", x: 1908, y: 92, layer: STREET_LAYER, radius: 36, hitRadius: 14, maxDurability: 3, cleanRadius: 90, generated: true },
    { id: "foundry:dumpster:middle-east", name: "east loading dumpster", x: 1984, y: 490, layer: STREET_LAYER, radius: 36, hitRadius: 14, maxDurability: 3, cleanRadius: 90, generated: true },
    { id: "foundry:dumpster:south-west", name: "west yard dumpster", x: 1908, y: 694, layer: STREET_LAYER, radius: 36, hitRadius: 14, maxDurability: 3, cleanRadius: 90, generated: true },
    { id: "foundry:dumpster:south-east", name: "east works dumpster", x: 2168, y: 694, layer: STREET_LAYER, radius: 36, hitRadius: 14, maxDurability: 3, cleanRadius: 90, generated: true }
  ];
}

function generatedPedestrianRoute() {
  return {
    id: "foundry:pedestrian-route:works-loop",
    name: "Foundry works sidewalk loop",
    generated: true,
    points: [
      { x: 1754, y: 270 },
      { x: 1908, y: 270 },
      { x: 1908, y: 398 },
      { x: 1754, y: 398 }
    ]
  };
}

function generatedSewerAccesses() {
  return [
    { id: "foundry:sewer-access:north", name: "Foundry north manhole", street: { x: 1688, y: 198 }, sewer: { x: 1688, y: 198 }, generated: true },
    { id: "foundry:sewer-access:central", name: "Foundry central manhole", street: { x: 1688, y: 338 }, sewer: { x: 1688, y: 338 }, generated: true }
  ];
}

function generatedShadows(roadPlan) {
  return [
    rect("foundry:shadow:north-yard", 1744, roadPlan.northY, 232, roadPlan.northH, { name: "north yard shadow", strength: 0.78, generated: true }),
    rect("foundry:shadow:north-drop", 1920, roadPlan.northY + roadPlan.northH, 56, 226 - (roadPlan.northY + roadPlan.northH), { name: "north drop shadow", strength: 0.84, generated: true }),
    rect("foundry:shadow:east-link", 1976, roadPlan.eastY, 208, roadPlan.eastH, { name: "east link shadow", strength: 0.76, generated: true }),
    rect("foundry:shadow:back-lane", 1920, 384, 56, 320, { name: "foundry back-lane shadow", strength: 0.86, generated: true })
  ];
}

function generatedVehicle(rng) {
  const archetypeId = rng.pick(["compact", "sedan", "van"]);
  return {
    id: "foundry:vehicle:utility",
    name: "Foundry utility vehicle",
    archetypeId,
    x: rng.int(1808, 1872),
    y: 338,
    angle: rng.chance(0.5) ? 0 : Math.PI,
    layer: STREET_LAYER,
    ownership: "parked",
    startOwned: false,
    ownerId: "foundry_shift_worker",
    factionId: null,
    parked: true,
    generated: true
  };
}

function filterGenerated(items = []) {
  return items.filter(item => !String(item?.id || "").startsWith(GENERATED_PREFIX));
}

function withoutFoundryPoint(items, bounds, pointResolver = pointOf) {
  return filterGenerated(items).filter(item => !isInFoundry(pointResolver(item), bounds));
}

function withoutFoundryBuildings(items, bounds) {
  return filterGenerated(items).filter(item => PRESERVED_FOUNDRY_BUILDINGS.has(item.id) || !isInFoundry(center(item), bounds));
}

function withoutFoundryRoutes(items, bounds) {
  return filterGenerated(items).filter(route => {
    const a = { x: route.ax, y: route.ay };
    const b = { x: route.bx, y: route.by };
    return !isInFoundry(a, bounds) && !isInFoundry(b, bounds);
  });
}

function withoutFoundryFireEscapes(items, bounds) {
  return filterGenerated(items).filter(item => !isInFoundry(item.street || item.roof, bounds) && !isInFoundry(item.roof, bounds));
}

function withoutFoundryRoofAreas(roofAreas, bounds) {
  return Object.fromEntries(Object.entries(roofAreas || {}).map(([layer, areas]) => [
    layer,
    filterGenerated(areas).filter(area => !isInFoundry(center(area), bounds))
  ]));
}

function chaseLoops(roadPlan) {
  const westLength = (1920 - 1744) * 2 + (226 - roadPlan.northY) * 2;
  const eastLength = (2184 - 1976) * 2 + (292 - roadPlan.eastY) * 2;
  return [
    {
      id: "foundry:chase-loop:west-yard",
      roadIds: ["foundryAvenue", "northServiceLane", "harborBackLane", "foundry:road:north-drop", "foundry:road:north-yard"],
      length: round(westLength),
      character: "tight industrial yard loop"
    },
    {
      id: "foundry:chase-loop:east-service",
      roadIds: ["harborBackLane", "foundry:road:east-link", "harborAvenue", "eastBoulevard"],
      length: round(eastLength),
      character: "fast service-road loop"
    }
  ];
}

function candidatePlan(seed, roads, buildings, vertical, shadows) {
  const loops = chaseLoops(roads);
  return {
    seed,
    districtId: "foundry",
    generatedRoadIds: roads.roads.map(item => item.id),
    chaseLoops: loops,
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
    darkRouteIds: shadows.map(item => item.id),
    sewerAccessIds: ["foundry:sewer-access:north", "foundry:sewer-access:central"],
    vehicleSocketIds: ["foundry:vehicle:utility"]
  };
}

export function generateFoundryCandidate(seed, { baseBlueprint = currentCityBlueprint } = {}) {
  const normalizedSeed = slug(seed);
  const rng = createRng(normalizedSeed);
  const district = foundryDistrict(baseBlueprint);
  const bounds = district.bounds;
  const roadPlan = generatedRoads(rng);
  const buildings = generatedBuildings(rng, roadPlan);
  const vertical = generatedVerticalLayer(buildings, rng);
  const crosswalks = generatedCrosswalks(roadPlan);
  const lights = generatedLights(roadPlan);
  const dumpsters = generatedDumpsters();
  const sewerAccesses = generatedSewerAccesses();
  const shadows = generatedShadows(roadPlan);
  const vehicle = generatedVehicle(rng);
  const pedestrianRoute = generatedPedestrianRoute();
  const generatedSidewalks = roadPlan.roads.flatMap(road => sidewalkBands(road, baseBlueprint.world));
  const runtime = baseBlueprint.runtime;
  const roofAreas = withoutFoundryRoofAreas(runtime.roofAreas, bounds);
  roofAreas[LOW_ROOF_LAYER] = [...(roofAreas[LOW_ROOF_LAYER] || []), ...vertical.roofs];

  const candidateRuntime = {
    ...runtime,
    roads: [...filterGenerated(runtime.roads), ...roadPlan.roads],
    sidewalks: [...filterGenerated(runtime.sidewalks), ...generatedSidewalks],
    crosswalks: [...filterGenerated(runtime.crosswalks), ...crosswalks],
    buildings: [...withoutFoundryBuildings(runtime.buildings, bounds), ...buildings],
    roofAreas,
    rooftopRoutes: [...withoutFoundryRoutes(runtime.rooftopRoutes, bounds), ...vertical.routes],
    fireEscapes: [...withoutFoundryFireEscapes(runtime.fireEscapes, bounds), ...vertical.fireEscapes],
    sewerTunnels: filterGenerated(runtime.sewerTunnels),
    sewerAccesses: [...withoutFoundryPoint(runtime.sewerAccesses, bounds, item => item.street || item.sewer), ...sewerAccesses],
    lights: [...withoutFoundryPoint(runtime.lights, bounds), ...lights],
    dumpsters: [...withoutFoundryPoint(runtime.dumpsters, bounds), ...dumpsters],
    shadowZones: [...filterGenerated(runtime.shadowZones), ...shadows],
    pedestrianRoutes: [...filterGenerated(runtime.pedestrianRoutes), pedestrianRoute],
    streetNavigationPoints: [
      ...(runtime.streetNavigationPoints || []),
      { x: 1860, y: round(roadPlan.northY + roadPlan.northH / 2) },
      { x: 2080, y: round(roadPlan.eastY + roadPlan.eastH / 2) },
      { x: 1850, y: 338 }
    ],
    vehicles: [...withoutFoundryPoint(runtime.vehicles, bounds), vehicle]
  };
  const plan = candidatePlan(normalizedSeed, roadPlan, buildings, vertical, shadows);

  return defineCityBlueprint({
    ...baseBlueprint,
    id: `bloodnight-foundry-${normalizedSeed}`,
    seed: normalizedSeed,
    runtime: candidateRuntime,
    metadata: {
      ...baseBlueprint.metadata,
      mode: "generated-foundry-pilot",
      compilerStage: "foundry-pilot",
      generatedAtRuntime: false,
      foundryPilot: plan
    }
  });
}

function generatedByPrefix(items = []) {
  return items.filter(item => String(item?.id || "").startsWith(GENERATED_PREFIX));
}

export function scoreFoundryCandidate(blueprint, validation = validateCityBlueprint(blueprint), cityScore = scoreCityBlueprint(blueprint, validation)) {
  const runtime = blueprint.runtime;
  const plan = blueprint.metadata?.foundryPilot || {};
  const buildings = generatedByPrefix(runtime.buildings);
  const families = new Set(buildings.map(item => item.family).filter(Boolean));
  const templateFit = buildings.every(building => {
    const template = blockTemplateById[building.templateId];
    if (!template) return false;
    return building.w >= template.footprint.minWidth
      && building.w <= template.footprint.maxWidth
      && building.h >= template.footprint.minHeight
      && building.h <= template.footprint.maxHeight;
  });
  const roofs = generatedByPrefix(Object.values(runtime.roofAreas || {}).flat());
  const roofRoutes = generatedByPrefix(runtime.rooftopRoutes);
  const fireEscapes = generatedByPrefix(runtime.fireEscapes);
  const sewerAccesses = generatedByPrefix(runtime.sewerAccesses);
  const lights = generatedByPrefix(runtime.lights);
  const dumpsters = generatedByPrefix(runtime.dumpsters);
  const vehicles = generatedByPrefix(runtime.vehicles);
  const shadows = generatedByPrefix(runtime.shadowZones);
  const district = foundryDistrict(blueprint);
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