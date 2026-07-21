export const LAYERS = Object.freeze({
  SEWER: -1,
  STREET: 0,
  ROOF_LOW: 1,
  ROOF_HIGH: 2
});

export const LAYER_NAMES = Object.freeze({
  [-1]: "Sewers",
  [0]: "Street",
  [1]: "Low rooftops",
  [2]: "High rooftop refuge"
});

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1440;
const SIDEWALK_DEPTH = 22;
const ALLEY_WALK_DEPTH = 8;

function rect(id, x, y, w, h, extra = {}) {
  return Object.freeze({ id, x, y, w, h, ...extra });
}

function building(id, name, x, y, w, h, color, trim, sign) {
  return Object.freeze({ id, name, x, y, w, h, color, trim, sign });
}

function sidewalkBands(road) {
  const depth = road.kind === "alley" ? ALLEY_WALK_DEPTH : SIDEWALK_DEPTH;
  const bands = [];
  if (road.y > 0) bands.push(rect(`${road.id}-north-walk`, road.x, Math.max(0, road.y - depth), road.w, depth, { roadId: road.id }));
  if (road.y + road.h < WORLD_HEIGHT) bands.push(rect(`${road.id}-south-walk`, road.x, road.y + road.h, road.w, Math.min(depth, WORLD_HEIGHT - road.y - road.h), { roadId: road.id }));
  if (road.x > 0) bands.push(rect(`${road.id}-west-walk`, Math.max(0, road.x - depth), road.y, depth, road.h, { roadId: road.id }));
  if (road.x + road.w < WORLD_WIDTH) bands.push(rect(`${road.id}-east-walk`, road.x + road.w, road.y, Math.min(depth, WORLD_WIDTH - road.x - road.w), road.h, { roadId: road.id }));
  return bands;
}

function zebraPair(id, x, y, verticalRoadWidth = 112, horizontalRoadHeight = 112) {
  return [
    rect(`${id}-across-vertical`, x - verticalRoadWidth / 2, y - 10, verticalRoadWidth, 20, { orientation: "horizontal" }),
    rect(`${id}-across-horizontal`, x - 10, y - horizontalRoadHeight / 2, 20, horizontalRoadHeight, { orientation: "vertical" })
  ];
}

function lamp(id, x, y, name = "sidewalk streetlight", radius = 78) {
  return Object.freeze({ id, x, y, radius, name, layer: LAYERS.STREET });
}

function dumpster(id, name, x, y, extra = {}) {
  return Object.freeze({
    id,
    name,
    x,
    y,
    layer: LAYERS.STREET,
    radius: 36,
    hitRadius: 14,
    maxDurability: 3,
    cleanRadius: 90,
    ...extra
  });
}

export const roads = Object.freeze([
  rect("eastWestAvenue", 0, 292, 960, 92, { label: "East-West Avenue", kind: "road" }),
  rect("northSouthAvenue", 426, 0, 92, 640, { label: "North-South Avenue", kind: "road" }),
  rect("southServiceAlley", 90, 502, 790, 44, { label: "South service alley", kind: "alley" }),
  rect("northAlley", 246, 244, 474, 44, { label: "North alley", kind: "alley" }),
  rect("warehouseAlley", 96, 382, 198, 44, { label: "Warehouse alley", kind: "alley" }),
  rect("eastBoulevard", 960, 292, 1440, 92, { label: "Saint Orison Boulevard", kind: "road" }),
  rect("southSpine", 426, 640, 112, 800, { label: "Mourning Avenue", kind: "road" }),
  rect("midtownAvenue", 1032, 0, 112, 1440, { label: "Glasshouse Avenue", kind: "road" }),
  rect("foundryAvenue", 1632, 0, 112, 1440, { label: "Foundry Avenue", kind: "road" }),
  rect("harborAvenue", 2184, 0, 112, 1440, { label: "Harbor Avenue", kind: "road" }),
  rect("canalBoulevard", 0, 704, 2400, 112, { label: "Canal Boulevard", kind: "road" }),
  rect("industrialBoulevard", 0, 1136, 2400, 112, { label: "Blackwater Boulevard", kind: "road" }),
  rect("northServiceLane", 960, 170, 1240, 56, { label: "North service lane", kind: "alley" }),
  rect("midServiceLane", 1120, 500, 1080, 56, { label: "Midtown service lane", kind: "alley" }),
  rect("southServiceLane", 120, 920, 2040, 56, { label: "South service lane", kind: "alley" }),
  rect("eastBackLane", 1320, 404, 56, 732, { label: "East back lane", kind: "alley" }),
  rect("harborBackLane", 1920, 226, 56, 910, { label: "Harbor back lane", kind: "alley" })
]);

export const sidewalks = Object.freeze(roads.flatMap(sidewalkBands));

export const crosswalks = Object.freeze([
  ...zebraPair("cross-core", 472, 338, 92, 92),
  ...zebraPair("cross-core-west", 300, 338, 20, 92),
  ...zebraPair("cross-glass-north", 1088, 338, 112, 92),
  ...zebraPair("cross-foundry-north", 1688, 338, 112, 92),
  ...zebraPair("cross-harbor-north", 2240, 338, 112, 92),
  ...zebraPair("cross-mourning-canal", 482, 760, 112, 112),
  ...zebraPair("cross-glass-canal", 1088, 760, 112, 112),
  ...zebraPair("cross-foundry-canal", 1688, 760, 112, 112),
  ...zebraPair("cross-harbor-canal", 2240, 760, 112, 112),
  ...zebraPair("cross-mourning-blackwater", 482, 1192, 112, 112),
  ...zebraPair("cross-glass-blackwater", 1088, 1192, 112, 112),
  ...zebraPair("cross-foundry-blackwater", 1688, 1192, 112, 112),
  ...zebraPair("cross-harbor-blackwater", 2240, 1192, 112, 112)
]);

export const buildings = Object.freeze([
  building("refugeTower", "ROOFTOP REFUGE", 86, 86, 150, 128, 0x20122f, 0xd7c8ff, "REFUGE"),
  building("club", "CLUB", 590, 374, 170, 112, 0x241126, 0xd11fb9, "CLUB"),
  building("church", "CHURCH", 800, 418, 124, 126, 0x1b1824, 0x8b6f9e, "CHURCH"),
  building("police", "POLICE STATION", 690, 88, 174, 122, 0x14223a, 0x4da3ff, "POLICE"),
  building("marketBlock", "MARKET BLOCK", 280, 92, 130, 150, 0x181a2a, 0x777d99, "MARKET"),
  building("tenementNorth", "TENEMENT", 528, 92, 122, 148, 0x171827, 0x7f849a, "FLATS"),
  building("warehouse", "WAREHOUSE", 106, 410, 154, 98, 0x171716, 0x6e5b37, "WARE"),
  building("shops", "SHOPS", 294, 414, 140, 110, 0x181322, 0x8a5ca8, "SHOPS"),
  building("oldBlock", "OLD BLOCK", 532, 504, 130, 86, 0x18151f, 0x5b5167, "OLD"),
  building("glassArcade", "GLASS ARCADE", 1168, 42, 190, 108, 0x161827, 0x6a7394, "ARCADE"),
  building("saintOrisonHotel", "SAINT ORISON HOTEL", 1392, 42, 208, 108, 0x211927, 0xa9789a, "HOTEL"),
  building("northFoundry", "NORTH FOUNDRY", 1768, 46, 140, 104, 0x1e1c1b, 0x8f7250, "FOUNDRY"),
  building("harborRegistry", "HARBOR REGISTRY", 1988, 46, 166, 104, 0x16202a, 0x62869c, "REGISTRY"),
  building("neonCourt", "NEON COURT", 1168, 422, 130, 60, 0x21152a, 0xb44ddb, "COURT"),
  building("glassTenements", "GLASS TENEMENTS", 1398, 418, 204, 66, 0x171925, 0x7f849a, "FLATS"),
  building("foundryOffices", "FOUNDRY OFFICES", 1768, 418, 132, 66, 0x1e1c1b, 0x927654, "OFFICES"),
  building("harborClinic", "HARBOR CLINIC", 1992, 418, 160, 66, 0x142129, 0x70a3a8, "CLINIC"),
  building("canalMarketWest", "CANAL MARKET", 1168, 574, 190, 102, 0x1e1725, 0x9b6db2, "MARKET"),
  building("canalResidences", "CANAL RESIDENCES", 1398, 574, 202, 102, 0x191b28, 0x747d98, "HOMES"),
  building("foundryStores", "FOUNDRY STORES", 1768, 574, 132, 102, 0x211b16, 0x9c7445, "STORES"),
  building("harborColdStore", "COLD STORE", 1992, 574, 160, 102, 0x172129, 0x5d889e, "COLD"),
  building("mourningDepot", "MOURNING DEPOT", 86, 842, 302, 58, 0x1b1b1e, 0x756b5b, "DEPOT"),
  building("canalSchool", "NIGHT SCHOOL", 560, 842, 420, 58, 0x181b29, 0x6f7899, "SCHOOL"),
  building("glassSouth", "GLASS SOUTH", 1168, 842, 430, 58, 0x171925, 0x77809d, "GLASS"),
  building("foundryYards", "FOUNDRY YARDS", 1768, 842, 132, 58, 0x211b16, 0x9d774b, "YARDS"),
  building("harborGarages", "HARBOR GARAGES", 1992, 842, 160, 58, 0x172129, 0x63879a, "GARAGE"),
  building("westMills", "WEST MILLS", 82, 994, 304, 112, 0x1e1b18, 0x82684d, "MILLS"),
  building("mourningRows", "MOURNING ROWS", 560, 994, 420, 112, 0x1a1924, 0x756f8e, "ROWS"),
  building("blackwaterExchange", "BLACKWATER EXCHANGE", 1168, 994, 430, 112, 0x151d28, 0x5c809c, "EXCHANGE"),
  building("foundryPlant", "FOUNDRY PLANT", 1768, 994, 132, 112, 0x201a16, 0xa17848, "PLANT"),
  building("harborPacking", "HARBOR PACKING", 1992, 994, 160, 112, 0x172028, 0x62879b, "PACKING"),
  building("southMortuary", "MUNICIPAL MORTUARY", 82, 1282, 304, 118, 0x19171d, 0x6f647a, "MORTUARY"),
  building("southHousing", "SOUTH HOUSING", 560, 1282, 420, 118, 0x181a26, 0x727b96, "HOUSING"),
  building("blackwaterTerminal", "BLACKWATER TERMINAL", 1168, 1282, 430, 118, 0x151d25, 0x5d8092, "TERMINAL"),
  building("foundryFreight", "FOUNDRY FREIGHT", 1768, 1282, 132, 118, 0x211b17, 0x9a7448, "FREIGHT"),
  building("harborWarehouses", "HARBOR WAREHOUSES", 1992, 1282, 160, 118, 0x172028, 0x5f8192, "WARE")
]);

export const roofAreas = Object.freeze({
  [LAYERS.ROOF_LOW]: Object.freeze([
    rect("refugeLowerRoof", 92, 176, 148, 62, { color: 0x2d3045, label: "REFUGE LOW" }),
    rect("marketRoof", 286, 98, 118, 138, { color: 0x303246, label: "MARKET" }),
    rect("tenementRoof", 528, 98, 122, 138, { color: 0x2b2d42, label: "TENEMENT" }),
    rect("policeRoof", 696, 96, 162, 110, { color: 0x26344f, label: "POLICE" }),
    rect("warehouseRoof", 112, 416, 142, 86, { color: 0x2b2a25, label: "WARE" }),
    rect("shopsRoof", 300, 420, 128, 98, { color: 0x2e233d, label: "SHOPS" }),
    rect("oldBlockRoof", 538, 510, 118, 74, { color: 0x292538, label: "OLD" }),
    rect("clubRoof", 596, 380, 158, 98, { color: 0x30263e, label: "CLUB" }),
    rect("churchRoof", 806, 424, 112, 114, { color: 0x2a2538, label: "CHURCH" })
  ]),
  [LAYERS.ROOF_HIGH]: Object.freeze([
    rect("refugeHighRoof", 96, 92, 140, 112, { color: 0x3a3a52, label: "HIGH REFUGE" })
  ])
});

export const sewerTunnels = Object.freeze([
  rect("sewerNorthSouth", 426, 42, 92, 1358),
  rect("sewerMainCross", 72, 292, 2240, 92),
  rect("sewerCanal", 72, 704, 2240, 112),
  rect("sewerBlackwater", 72, 1136, 2240, 112),
  rect("sewerGlass", 1032, 42, 112, 1358),
  rect("sewerFoundry", 1632, 42, 112, 1358),
  rect("sewerHarbor", 2184, 42, 112, 1358),
  rect("sewerSouthLoop", 116, 426, 680, 76),
  rect("sewerWestBranch", 156, 150, 84, 285),
  rect("sewerEastBranch", 704, 156, 84, 315),
  rect("sewerNorthShortcut", 302, 190, 330, 62)
]);

const generatedHorizontalLights = [
  ...Array.from({ length: 10 }, (_, index) => lamp(`lamp-orison-n-${index + 1}`, 1010 + index * 135, 278, "Saint Orison north sidewalk light")),
  ...Array.from({ length: 10 }, (_, index) => lamp(`lamp-orison-s-${index + 1}`, 1010 + index * 135, 398, "Saint Orison south sidewalk light")),
  ...Array.from({ length: 11 }, (_, index) => lamp(`lamp-canal-n-${index + 1}`, 90 + index * 210, 688, "Canal north sidewalk light")),
  ...Array.from({ length: 11 }, (_, index) => lamp(`lamp-canal-s-${index + 1}`, 90 + index * 210, 832, "Canal south sidewalk light")),
  ...Array.from({ length: 11 }, (_, index) => lamp(`lamp-blackwater-n-${index + 1}`, 90 + index * 210, 1120, "Blackwater north sidewalk light")),
  ...Array.from({ length: 11 }, (_, index) => lamp(`lamp-blackwater-s-${index + 1}`, 90 + index * 210, 1264, "Blackwater south sidewalk light"))
];

const generatedVerticalLights = [1016, 1160, 1616, 1760, 2168, 2312].flatMap((x, column) => (
  Array.from({ length: 6 }, (_, index) => lamp(
    `lamp-avenue-${column + 1}-${index + 1}`,
    x,
    90 + index * 220,
    "avenue sidewalk light"
  ))
));

export const lights = Object.freeze([
  lamp("lampCrossA", 390, 280, "crossroad west sidewalk light"),
  lamp("lampCrossB", 550, 396, "crossroad east sidewalk light"),
  lamp("lampPolice", 668, 280, "police avenue sidewalk light"),
  lamp("lampClub", 570, 396, "club sidewalk light", 70),
  lamp("lampChurch", 782, 396, "church sidewalk light", 70),
  lamp("lampWarehouse", 82, 394, "warehouse sidewalk light", 64),
  lamp("lampNorth", 410, 168, "north avenue sidewalk light", 66),
  ...generatedHorizontalLights,
  ...generatedVerticalLights
]);

export const dumpsters = Object.freeze([
  dumpster("dumpsterNorthAlley", "north alley dumpster", 318, 262),
  dumpster("dumpsterWarehouse", "warehouse dumpster", 176, 392),
  dumpster("dumpsterClubRear", "club rear dumpster", 676, 502),
  dumpster("dumpsterChurchRear", "church rear dumpster", 850, 556),
  dumpster("dumpsterSouthService", "south service dumpster", 380, 528),
  dumpster("dumpsterGlassNorth", "glass arcade dumpster", 1280, 218),
  dumpster("dumpsterNeonCourt", "neon court dumpster", 1348, 514),
  dumpster("dumpsterCanalMarket", "canal market dumpster", 1220, 548),
  dumpster("dumpsterFoundryLane", "foundry lane dumpster", 1888, 520),
  dumpster("dumpsterHarborLane", "harbor lane dumpster", 1948, 680),
  dumpster("dumpsterSouthRows", "mourning rows dumpster", 900, 944),
  dumpster("dumpsterBlackwater", "blackwater exchange dumpster", 1480, 1122),
  dumpster("dumpsterFoundryFreight", "foundry freight dumpster", 1888, 1260),
  dumpster("dumpsterHarborTerminal", "harbor terminal dumpster", 2140, 1260)
]);

export const bodyHideSpots = Object.freeze(dumpsters.map(item => Object.freeze({
  id: item.id,
  name: item.name,
  layer: item.layer,
  x: item.x,
  y: item.y,
  radius: item.radius,
  cleanRadius: item.cleanRadius,
  streetPropId: item.id
})));

export const shadowZones = Object.freeze([
  rect("northAlleyShadow", 246, 244, 474, 44, { name: "north alley shadow", strength: 0.74 }),
  rect("southServiceShadow", 90, 502, 790, 44, { name: "south service shadow", strength: 0.78 }),
  rect("warehouseAlleyShadow", 96, 382, 198, 44, { name: "warehouse alley shadow", strength: 0.70 }),
  rect("clubSideShadow", 546, 340, 88, 34, { name: "club side shadow", strength: 0.70 }),
  rect("clubRearShadow", 584, 486, 190, 34, { name: "club rear shadow", strength: 0.66 }),
  rect("churchRearShadow", 778, 546, 150, 34, { name: "church rear shadow", strength: 0.68 }),
  rect("northServiceShadow", 960, 170, 1240, 56, { name: "north service-lane shadow", strength: 0.72 }),
  rect("midServiceShadow", 1120, 500, 1080, 56, { name: "midtown service-lane shadow", strength: 0.74 }),
  rect("southServiceLongShadow", 120, 920, 2040, 56, { name: "south service-lane shadow", strength: 0.78 }),
  rect("eastBackShadow", 1320, 404, 56, 732, { name: "east back-lane shadow", strength: 0.80 }),
  rect("harborBackShadow", 1920, 226, 56, 910, { name: "harbor back-lane shadow", strength: 0.82 }),
  rect("districtDarkness", 0, 0, WORLD_WIDTH, WORLD_HEIGHT, { name: "district darkness", strength: 0.18 })
]);

export const pedestrianRoutes = Object.freeze([
  Object.freeze({
    id: "core_market_loop",
    name: "Market and central crosswalk loop",
    points: Object.freeze([
      Object.freeze({ x: 300, y: 280 }),
      Object.freeze({ x: 414, y: 280 }),
      Object.freeze({ x: 414, y: 338, crosswalk: true }),
      Object.freeze({ x: 530, y: 338, crosswalk: true }),
      Object.freeze({ x: 530, y: 396 }),
      Object.freeze({ x: 300, y: 396 }),
      Object.freeze({ x: 300, y: 338, crosswalk: true })
    ])
  }),
  Object.freeze({
    id: "east_promenade_loop",
    name: "Saint Orison promenade loop",
    points: Object.freeze([
      Object.freeze({ x: 1160, y: 278 }),
      Object.freeze({ x: 1608, y: 278 }),
      Object.freeze({ x: 1688, y: 278 }),
      Object.freeze({ x: 1688, y: 398, crosswalk: true }),
      Object.freeze({ x: 1160, y: 398 }),
      Object.freeze({ x: 1088, y: 398, crosswalk: true }),
      Object.freeze({ x: 1088, y: 278, crosswalk: true })
    ])
  }),
  Object.freeze({
    id: "canal_loop",
    name: "Canal Boulevard loop",
    points: Object.freeze([
      Object.freeze({ x: 1160, y: 688 }),
      Object.freeze({ x: 1608, y: 688 }),
      Object.freeze({ x: 1688, y: 688 }),
      Object.freeze({ x: 1688, y: 832, crosswalk: true }),
      Object.freeze({ x: 1160, y: 832 }),
      Object.freeze({ x: 1088, y: 832, crosswalk: true }),
      Object.freeze({ x: 1088, y: 688, crosswalk: true })
    ])
  }),
  Object.freeze({
    id: "blackwater_loop",
    name: "Blackwater Boulevard loop",
    points: Object.freeze([
      Object.freeze({ x: 560, y: 1120 }),
      Object.freeze({ x: 1016, y: 1120 }),
      Object.freeze({ x: 1088, y: 1120 }),
      Object.freeze({ x: 1088, y: 1264, crosswalk: true }),
      Object.freeze({ x: 560, y: 1264 }),
      Object.freeze({ x: 482, y: 1264, crosswalk: true }),
      Object.freeze({ x: 482, y: 1120, crosswalk: true })
    ])
  }),
  Object.freeze({
    id: "harbor_loop",
    name: "Harbor avenue and canal loop",
    points: Object.freeze([
      Object.freeze({ x: 2168, y: 398 }),
      Object.freeze({ x: 2168, y: 688 }),
      Object.freeze({ x: 2240, y: 688, crosswalk: true }),
      Object.freeze({ x: 2312, y: 688 }),
      Object.freeze({ x: 2312, y: 832 }),
      Object.freeze({ x: 2240, y: 832, crosswalk: true }),
      Object.freeze({ x: 2168, y: 832 })
    ])
  })
]);

export const streetNavigationPoints = Object.freeze([
  { x: 472, y: 338 },
  { x: 300, y: 338 },
  { x: 1088, y: 338 },
  { x: 1688, y: 338 },
  { x: 2240, y: 338 },
  { x: 482, y: 760 },
  { x: 1088, y: 760 },
  { x: 1688, y: 760 },
  { x: 2240, y: 760 },
  { x: 482, y: 1192 },
  { x: 1088, y: 1192 },
  { x: 1688, y: 1192 },
  { x: 2240, y: 1192 },
  ...pedestrianRoutes.flatMap(route => route.points.map(point => ({ x: point.x, y: point.y })))
]);

export const districtZones = Object.freeze([
  rect("old-quarter", 0, 0, 960, 640, { name: "Old Quarter" }),
  rect("glasshouse", 960, 0, 680, 704, { name: "Glasshouse Ward" }),
  rect("foundry", 1640, 0, 544, 704, { name: "Foundry Ward" }),
  rect("harbor-north", 2184, 0, 216, 704, { name: "Harbor Approach" }),
  rect("canal-west", 0, 640, 1032, 496, { name: "Canal West" }),
  rect("canal-east", 1032, 704, 1152, 432, { name: "Canal East" }),
  rect("blackwater", 0, 1136, 2184, 304, { name: "Blackwater Industrial" }),
  rect("harbor-south", 2184, 704, 216, 736, { name: "South Harbor" })
]);

export const rooftopRoutes = Object.freeze([
  Object.freeze({ id: "jumpRefugeMarket", ax: 236, ay: 146, bx: 286, by: 168, aLayer: LAYERS.ROOF_HIGH, bLayer: LAYERS.ROOF_LOW, aToB: "jump to market roof", bToA: "jump to high refuge" }),
  Object.freeze({ id: "jumpRefugeLowMarket", ax: 240, ay: 206, bx: 286, by: 208, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to market roof", bToA: "jump to lower refuge" }),
  Object.freeze({ id: "jumpMarketTenement", ax: 404, ay: 168, bx: 528, by: 168, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to tenement", bToA: "jump to market" }),
  Object.freeze({ id: "jumpTenementPolice", ax: 650, ay: 166, bx: 696, by: 154, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to police roof", bToA: "jump to tenement" }),
  Object.freeze({ id: "jumpShopsWarehouse", ax: 300, ay: 468, bx: 254, by: 456, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to warehouse", bToA: "jump to shops" }),
  Object.freeze({ id: "jumpShopsOldBlock", ax: 428, ay: 468, bx: 538, by: 548, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to old block", bToA: "jump to shops" }),
  Object.freeze({ id: "jumpClubChurch", ax: 754, ay: 430, bx: 806, by: 480, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to church", bToA: "jump to club" })
]);

export const fireEscapes = Object.freeze([
  Object.freeze({ id: "refugeFireEscape", name: "refuge fire escape", street: { x: 176, y: 244 }, roof: { layer: LAYERS.ROOF_LOW, x: 166, y: 206 } }),
  Object.freeze({ id: "marketFireEscape", name: "market fire escape", street: { x: 268, y: 168 }, roof: { layer: LAYERS.ROOF_LOW, x: 345, y: 168 } }),
  Object.freeze({ id: "tenementFireEscape", name: "tenement fire escape", street: { x: 650, y: 168 }, roof: { layer: LAYERS.ROOF_LOW, x: 590, y: 168 } }),
  Object.freeze({ id: "warehouseFireEscape", name: "warehouse fire escape", street: { x: 92, y: 402 }, roof: { layer: LAYERS.ROOF_LOW, x: 180, y: 456 } }),
  Object.freeze({ id: "shopsFireEscape", name: "shops fire escape", street: { x: 438, y: 470 }, roof: { layer: LAYERS.ROOF_LOW, x: 360, y: 468 } }),
  Object.freeze({ id: "oldBlockFireEscape", name: "old block fire escape", street: { x: 520, y: 540 }, roof: { layer: LAYERS.ROOF_LOW, x: 596, y: 540 } }),
  Object.freeze({ id: "clubFireEscape", name: "club fire escape", street: { x: 578, y: 430 }, roof: { layer: LAYERS.ROOF_LOW, x: 675, y: 430 } }),
  Object.freeze({ id: "churchFireEscape", name: "church fire escape", street: { x: 782, y: 500 }, roof: { layer: LAYERS.ROOF_LOW, x: 860, y: 490 } })
]);

export const sewerAccesses = Object.freeze([
  Object.freeze({ id: "crossManhole", name: "crossroad manhole", street: { x: 472, y: 326 }, sewer: { x: 472, y: 326 } }),
  Object.freeze({ id: "westManhole", name: "west alley manhole", street: { x: 176, y: 350 }, sewer: { x: 176, y: 350 } }),
  Object.freeze({ id: "churchManhole", name: "church rear manhole", street: { x: 842, y: 500 }, sewer: { x: 742, y: 500 } }),
  Object.freeze({ id: "glassManhole", name: "glasshouse manhole", street: { x: 1088, y: 760 }, sewer: { x: 1088, y: 760 } }),
  Object.freeze({ id: "foundryManhole", name: "foundry manhole", street: { x: 1688, y: 1192 }, sewer: { x: 1688, y: 1192 } }),
  Object.freeze({ id: "harborManhole", name: "harbor manhole", street: { x: 2240, y: 760 }, sewer: { x: 2240, y: 760 } }),
  Object.freeze({ id: "refugePrivateShaft", name: "private shaft to refuge", street: null, sewer: { x: 176, y: 180 }, roof: { layer: LAYERS.ROOF_HIGH, x: 150, y: 146 } })
]);

function pointInRect(x, y, area) {
  return x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h;
}

export function pointOnPedestrianSurface(x, y) {
  return sidewalks.some(area => pointInRect(x, y, area))
    || crosswalks.some(area => pointInRect(x, y, area));
}

export function districtZoneAt(x, y) {
  return districtZones.find(zone => pointInRect(x, y, zone)) || districtZones[0];
}