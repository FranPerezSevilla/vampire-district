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

export const roads = [
  { id: "eastWestAvenue", x: 0, y: 292, w: 960, h: 92, label: "East-West Avenue" },
  { id: "northSouthAvenue", x: 426, y: 0, w: 92, h: 640, label: "North-South Avenue" },
  { id: "southServiceAlley", x: 90, y: 502, w: 790, h: 44, label: "South service alley" },
  { id: "northAlley", x: 246, y: 244, w: 474, h: 44, label: "North alley" },
  { id: "warehouseAlley", x: 96, y: 382, w: 198, h: 44, label: "Warehouse alley" }
];

export const buildings = [
  { id: "refugeTower", name: "ROOFTOP REFUGE", x: 86, y: 86, w: 150, h: 128, color: 0x20122f, trim: 0xd7c8ff, sign: "REFUGE" },
  { id: "club", name: "CLUB", x: 590, y: 374, w: 170, h: 112, color: 0x241126, trim: 0xd11fb9, sign: "CLUB" },
  { id: "church", name: "CHURCH", x: 708, y: 438, w: 156, h: 112, color: 0x1b1824, trim: 0x8b6f9e, sign: "CHURCH" },
  { id: "police", name: "POLICE STATION", x: 690, y: 88, w: 174, h: 122, color: 0x14223a, trim: 0x4da3ff, sign: "POLICE" },
  { id: "marketBlock", name: "MARKET BLOCK", x: 280, y: 92, w: 130, h: 150, color: 0x181a2a, trim: 0x777d99, sign: "MARKET" },
  { id: "tenementNorth", name: "TENEMENT", x: 528, y: 92, w: 122, h: 148, color: 0x171827, trim: 0x7f849a, sign: "FLATS" },
  { id: "warehouse", name: "WAREHOUSE", x: 106, y: 410, w: 154, h: 98, color: 0x171716, trim: 0x6e5b37, sign: "WARE" },
  { id: "shops", name: "SHOPS", x: 294, y: 414, w: 140, h: 110, color: 0x181322, trim: 0x8a5ca8, sign: "SHOPS" },
  { id: "oldBlock", name: "OLD BLOCK", x: 532, y: 504, w: 130, h: 86, color: 0x18151f, trim: 0x5b5167, sign: "OLD" }
];

export const roofAreas = {
  [LAYERS.ROOF_LOW]: [
    { id: "refugeLowerRoof", x: 92, y: 176, w: 148, h: 62, color: 0x2d3045, label: "REFUGE LOW" },
    { id: "marketRoof", x: 286, y: 98, w: 118, h: 138, color: 0x303246, label: "MARKET" },
    { id: "tenementRoof", x: 528, y: 98, w: 122, h: 138, color: 0x2b2d42, label: "TENEMENT" },
    { id: "policeRoof", x: 696, y: 96, w: 162, h: 110, color: 0x26344f, label: "POLICE" },
    { id: "warehouseRoof", x: 112, y: 416, w: 142, h: 86, color: 0x2b2a25, label: "WARE" },
    { id: "shopsRoof", x: 300, y: 420, w: 128, h: 98, color: 0x2e233d, label: "SHOPS" },
    { id: "oldBlockRoof", x: 538, y: 510, w: 118, h: 74, color: 0x292538, label: "OLD" },
    { id: "clubRoof", x: 596, y: 380, w: 158, h: 98, color: 0x30263e, label: "CLUB" },
    { id: "churchRoof", x: 714, y: 444, w: 144, h: 100, color: 0x2a2538, label: "CHURCH" }
  ],
  [LAYERS.ROOF_HIGH]: [
    { id: "refugeHighRoof", x: 96, y: 92, w: 140, h: 112, color: 0x3a3a52, label: "HIGH REFUGE" }
  ]
};

export const sewerTunnels = [
  { id: "sewerNorthSouth", x: 426, y: 42, w: 92, h: 560 },
  { id: "sewerMainCross", x: 72, y: 292, w: 820, h: 92 },
  { id: "sewerSouthLoop", x: 116, y: 426, w: 680, h: 76 },
  { id: "sewerWestBranch", x: 156, y: 150, w: 84, h: 285 },
  { id: "sewerEastBranch", x: 704, y: 156, w: 84, h: 315 },
  { id: "sewerNorthShortcut", x: 302, y: 190, w: 330, h: 62 }
];

export const lights = [
  { id: "lampCrossA", x: 472, y: 324, radius: 78, name: "crossroad streetlight" },
  { id: "lampCrossB", x: 504, y: 324, radius: 78, name: "east crossroad streetlight" },
  { id: "lampPolice", x: 740, y: 240, radius: 78, name: "police avenue streetlight" },
  { id: "lampClub", x: 638, y: 362, radius: 70, name: "club streetlight" },
  { id: "lampChurch", x: 716, y: 420, radius: 72, name: "church streetlight" },
  { id: "lampWarehouse", x: 222, y: 380, radius: 64, name: "warehouse streetlight" },
  { id: "lampNorth", x: 432, y: 168, radius: 66, name: "north avenue streetlight" }
];

export const shadowZones = [
  { id: "districtDarkness", name: "district darkness", x: 0, y: 0, w: 960, h: 640, strength: 0.45 },
  { id: "northAlleyShadow", name: "north alley shadow", x: 246, y: 244, w: 474, h: 44, strength: 0.74 },
  { id: "southServiceShadow", name: "south service shadow", x: 90, y: 502, w: 790, h: 44, strength: 0.78 },
  { id: "warehouseAlleyShadow", name: "warehouse alley shadow", x: 96, y: 382, w: 198, h: 44, strength: 0.70 },
  { id: "clubRearShadow", name: "club rear shadow", x: 584, y: 486, w: 190, h: 34, strength: 0.66 },
  { id: "churchRearShadow", name: "church rear shadow", x: 690, y: 550, w: 188, h: 34, strength: 0.68 }
];

export const rooftopRoutes = [
  { id: "jumpRefugeMarket", ax: 236, ay: 146, bx: 286, by: 168, aLayer: LAYERS.ROOF_HIGH, bLayer: LAYERS.ROOF_LOW, aToB: "jump to market roof", bToA: "jump to high refuge" },
  { id: "jumpRefugeLowMarket", ax: 240, ay: 206, bx: 286, by: 208, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to market roof", bToA: "jump to lower refuge" },
  { id: "jumpMarketTenement", ax: 404, ay: 168, bx: 528, by: 168, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to tenement", bToA: "jump to market" },
  { id: "jumpTenementPolice", ax: 650, ay: 166, bx: 696, by: 154, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to police roof", bToA: "jump to tenement" },
  { id: "jumpShopsWarehouse", ax: 300, ay: 468, bx: 254, by: 456, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to warehouse", bToA: "jump to shops" },
  { id: "jumpShopsOldBlock", ax: 428, ay: 468, bx: 538, by: 548, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to old block", bToA: "jump to shops" },
  { id: "jumpClubChurch", ax: 754, ay: 430, bx: 714, by: 490, aLayer: LAYERS.ROOF_LOW, bLayer: LAYERS.ROOF_LOW, aToB: "jump to church", bToA: "jump to club" }
];

export const fireEscapes = [
  { id: "refugeFireEscape", name: "refuge fire escape", street: { x: 176, y: 244 }, roof: { layer: LAYERS.ROOF_LOW, x: 166, y: 206 } },
  { id: "marketFireEscape", name: "market fire escape", street: { x: 268, y: 168 }, roof: { layer: LAYERS.ROOF_LOW, x: 345, y: 168 } },
  { id: "tenementFireEscape", name: "tenement fire escape", street: { x: 650, y: 168 }, roof: { layer: LAYERS.ROOF_LOW, x: 590, y: 168 } },
  { id: "policeFireEscape", name: "police fire escape", street: { x: 672, y: 170 }, roof: { layer: LAYERS.ROOF_LOW, x: 775, y: 150 } },
  { id: "warehouseFireEscape", name: "warehouse fire escape", street: { x: 92, y: 402 }, roof: { layer: LAYERS.ROOF_LOW, x: 180, y: 456 } },
  { id: "shopsFireEscape", name: "shops fire escape", street: { x: 438, y: 470 }, roof: { layer: LAYERS.ROOF_LOW, x: 360, y: 468 } },
  { id: "oldBlockFireEscape", name: "old block fire escape", street: { x: 520, y: 540 }, roof: { layer: LAYERS.ROOF_LOW, x: 596, y: 540 } },
  { id: "clubFireEscape", name: "club fire escape", street: { x: 578, y: 430 }, roof: { layer: LAYERS.ROOF_LOW, x: 675, y: 430 } },
  { id: "churchFireEscape", name: "church fire escape", street: { x: 690, y: 500 }, roof: { layer: LAYERS.ROOF_LOW, x: 780, y: 495 } }
];

export const sewerAccesses = [
  { id: "crossManhole", name: "crossroad manhole", street: { x: 472, y: 326 }, sewer: { x: 472, y: 326 } },
  { id: "westManhole", name: "west alley manhole", street: { x: 176, y: 350 }, sewer: { x: 176, y: 350 } },
  { id: "churchManhole", name: "church rear manhole", street: { x: 742, y: 500 }, sewer: { x: 742, y: 500 } },
  { id: "refugePrivateShaft", name: "private shaft to refuge", street: null, sewer: { x: 176, y: 180 }, roof: { layer: LAYERS.ROOF_HIGH, x: 150, y: 146 } }
];
