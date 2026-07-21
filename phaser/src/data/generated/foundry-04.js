export const SELECTED_FOUNDRY_SEED = "foundry-pilot-04";

export const foundryRoads = Object.freeze([
  Object.freeze({ id: "foundry:road:north-yard", x: 1744, y: 104, w: 232, h: 38, label: "Foundry north yard", kind: "alley", generated: true }),
  Object.freeze({ id: "foundry:road:north-drop", x: 1920, y: 142, w: 56, h: 84, label: "Foundry north yard drop", kind: "alley", generated: true }),
  Object.freeze({ id: "foundry:road:east-link", x: 1976, y: 248, w: 208, h: 34, label: "Foundry east service link", kind: "alley", generated: true })
]);

export const foundryExtraSidewalks = Object.freeze([
  Object.freeze({ id: "foundry:sidewalk:back-lane-route", x: 1904, y: 270, w: 12, h: 128, roadId: "harborBackLane", generated: true, purpose: "continuous Foundry pedestrian loop" })
]);

export const foundryCrosswalks = Object.freeze([
  Object.freeze({ id: "foundry:crosswalk:east-link-west", x: 1920, y: 257, w: 56, h: 16, orientation: "horizontal", generated: true }),
  Object.freeze({ id: "foundry:crosswalk:east-link-east", x: 2184, y: 257, w: 112, h: 16, orientation: "horizontal", generated: true })
]);

export const foundryBuildings = Object.freeze([
  Object.freeze({ id: "foundry:block-01:machine-shop", name: "NORTH MACHINE SHOP", sign: "MACHINE", x: 1758, y: 20, w: 146, h: 74, color: 0x211b17, trim: 0xa57b4d, generated: true, districtId: "foundry", templateId: "machine-shop-row-a", family: "machine-shop" }),
  Object.freeze({ id: "foundry:block-02:west-works", name: "WEST WORKS", sign: "WORKS", x: 1758, y: 400, w: 146, h: 86, color: 0x191b1c, trim: 0x826b4d, generated: true, districtId: "foundry", templateId: "loading-bay-a", family: "loading-bay" }),
  Object.freeze({ id: "foundry:block-03:east-loading", name: "EAST LOADING", sign: "LOAD", x: 1988, y: 400, w: 174, h: 86, color: 0x1b1a23, trim: 0x756f8e, generated: true, districtId: "foundry", templateId: "row-housing-a", family: "housing" }),
  Object.freeze({ id: "foundry:block-04:west-yard", name: "WEST YARD", sign: "YARD", x: 1758, y: 570, w: 146, h: 108, color: 0x211b17, trim: 0xa57b4d, generated: true, districtId: "foundry", templateId: "machine-shop-row-a", family: "machine-shop" }),
  Object.freeze({ id: "foundry:block-05:east-works", name: "EAST WORKS", sign: "WORKS", x: 1988, y: 570, w: 174, h: 108, color: 0x1b1a23, trim: 0x756f8e, generated: true, districtId: "foundry", templateId: "row-housing-a", family: "housing" })
]);

export const foundryRoofs = Object.freeze([
  Object.freeze({ id: "foundry:block-02:west-works:roof", x: 1764, y: 406, w: 134, h: 74, color: 0x292b2c, label: "WORKS", buildingId: "foundry:block-02:west-works", generated: true, districtId: "foundry" }),
  Object.freeze({ id: "foundry:block-03:east-loading:roof", x: 1994, y: 406, w: 162, h: 74, color: 0x2b2a33, label: "LOAD", buildingId: "foundry:block-03:east-loading", generated: true, districtId: "foundry" }),
  Object.freeze({ id: "foundry:block-05:east-works:roof", x: 1994, y: 576, w: 162, h: 96, color: 0x2b2a33, label: "WORKS", buildingId: "foundry:block-05:east-works", generated: true, districtId: "foundry" }),
  Object.freeze({ id: "foundry:block-04:west-yard:roof", x: 1764, y: 576, w: 134, h: 96, color: 0x312b27, label: "YARD", buildingId: "foundry:block-04:west-yard", generated: true, districtId: "foundry" })
]);

export const foundryRooftopRoutes = Object.freeze([
  Object.freeze({ id: "foundry:roof-route:west-east", ax: 1898, ay: 443, bx: 1994, by: 443, aLayer: 1, bLayer: 1, aToB: "jump to east loading roof", bToA: "jump to west works roof", generated: true }),
  Object.freeze({ id: "foundry:roof-route:east-south", ax: 2075, ay: 480, bx: 2075, by: 576, aLayer: 1, bLayer: 1, aToB: "jump to south works roof", bToA: "jump to east loading roof", generated: true }),
  Object.freeze({ id: "foundry:roof-route:south-cross", ax: 1898, ay: 624, bx: 1994, by: 624, aLayer: 1, bLayer: 1, aToB: "jump to east works roof", bToA: "jump to west yard roof", generated: true })
]);

export const foundryFireEscapes = Object.freeze([
  Object.freeze({ id: "foundry:fire-escape:west", name: "Foundry west fire escape", street: Object.freeze({ x: 1754, y: 443 }), roof: Object.freeze({ layer: 1, x: 1768, y: 443 }), generated: true }),
  Object.freeze({ id: "foundry:fire-escape:east", name: "Foundry east fire escape", street: Object.freeze({ x: 2172, y: 624 }), roof: Object.freeze({ layer: 1, x: 2152, y: 624 }), generated: true })
]);

export const foundrySewerAccesses = Object.freeze([
  Object.freeze({ id: "foundry:sewer-access:north", name: "Foundry north manhole", street: Object.freeze({ x: 1688, y: 198 }), sewer: Object.freeze({ x: 1688, y: 198 }), generated: true }),
  Object.freeze({ id: "foundry:sewer-access:central", name: "Foundry central manhole", street: Object.freeze({ x: 1688, y: 338 }), sewer: Object.freeze({ x: 1688, y: 338 }), generated: true })
]);

export const foundryLights = Object.freeze([
  Object.freeze({ id: "foundry:lamp:north-yard-01", x: 1790, y: 100, radius: 72, name: "north yard light", layer: 0, generated: true }),
  Object.freeze({ id: "foundry:lamp:north-yard-02", x: 1880, y: 146, radius: 72, name: "north yard light", layer: 0, generated: true }),
  Object.freeze({ id: "foundry:lamp:north-drop", x: 1916, y: 184, radius: 68, name: "north drop light", layer: 0, generated: true }),
  Object.freeze({ id: "foundry:lamp:east-link-01", x: 2020, y: 244, radius: 70, name: "east link light", layer: 0, generated: true }),
  Object.freeze({ id: "foundry:lamp:east-link-02", x: 2120, y: 286, radius: 70, name: "east link light", layer: 0, generated: true }),
  Object.freeze({ id: "foundry:lamp:west-middle", x: 1754, y: 438, radius: 66, name: "west works light", layer: 0, generated: true }),
  Object.freeze({ id: "foundry:lamp:east-middle", x: 2172, y: 438, radius: 66, name: "east loading light", layer: 0, generated: true }),
  Object.freeze({ id: "foundry:lamp:south-yard", x: 1754, y: 630, radius: 64, name: "south yard light", layer: 0, generated: true })
]);

export const foundryDumpsters = Object.freeze([
  Object.freeze({ id: "foundry:dumpster:north-yard", name: "north yard dumpster", x: 1908, y: 92, layer: 0, radius: 36, hitRadius: 14, maxDurability: 3, cleanRadius: 90, generated: true }),
  Object.freeze({ id: "foundry:dumpster:middle-east", name: "east loading dumpster", x: 1984, y: 490, layer: 0, radius: 36, hitRadius: 14, maxDurability: 3, cleanRadius: 90, generated: true }),
  Object.freeze({ id: "foundry:dumpster:south-west", name: "west yard dumpster", x: 1908, y: 694, layer: 0, radius: 36, hitRadius: 14, maxDurability: 3, cleanRadius: 90, generated: true }),
  Object.freeze({ id: "foundry:dumpster:south-east", name: "east works dumpster", x: 2168, y: 694, layer: 0, radius: 36, hitRadius: 14, maxDurability: 3, cleanRadius: 90, generated: true })
]);

export const foundryShadows = Object.freeze([
  Object.freeze({ id: "foundry:shadow:north-yard", x: 1744, y: 104, w: 232, h: 38, name: "north yard shadow", strength: 0.78, generated: true }),
  Object.freeze({ id: "foundry:shadow:north-drop", x: 1920, y: 142, w: 56, h: 84, name: "north drop shadow", strength: 0.84, generated: true }),
  Object.freeze({ id: "foundry:shadow:east-link", x: 1976, y: 248, w: 208, h: 34, name: "east link shadow", strength: 0.76, generated: true }),
  Object.freeze({ id: "foundry:shadow:back-lane", x: 1920, y: 384, w: 56, h: 320, name: "foundry back-lane shadow", strength: 0.86, generated: true })
]);

export const foundryPedestrianRoutes = Object.freeze([
  Object.freeze({ id: "foundry:pedestrian-route:works-loop", name: "Foundry works sidewalk loop", generated: true, points: Object.freeze([
    Object.freeze({ x: 1754, y: 270 }),
    Object.freeze({ x: 1830, y: 270 }),
    Object.freeze({ x: 1908, y: 270 }),
    Object.freeze({ x: 1908, y: 334 }),
    Object.freeze({ x: 1908, y: 398 }),
    Object.freeze({ x: 1830, y: 398 }),
    Object.freeze({ x: 1754, y: 398 }),
    Object.freeze({ x: 1754, y: 334 })
  ]) })
]);

export const foundryNavigationPoints = Object.freeze([
  Object.freeze({ id: "foundry:navigation:north-yard", x: 1860, y: 123, generated: true }),
  Object.freeze({ id: "foundry:navigation:east-link", x: 2080, y: 265, generated: true }),
  Object.freeze({ id: "foundry:navigation:avenue", x: 1850, y: 338, generated: true })
]);

export const foundryVehicle = Object.freeze({
  id: "foundry:vehicle:utility",
  name: "Foundry utility vehicle",
  archetypeId: "sedan",
  x: 1812,
  y: 338,
  angle: 0,
  layer: 0,
  ownership: "parked",
  startOwned: false,
  ownerId: "foundry_shift_worker",
  factionId: null,
  parked: true,
  generated: true
});
