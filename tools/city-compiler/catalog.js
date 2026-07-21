import { defineBlockTemplate, defineDistrictRecipe } from "./model.js";

export const districtRecipes = Object.freeze([
  defineDistrictRecipe({
    id: "old-quarter",
    label: "Old Quarter",
    roadStyle: "dense-medieval-grid",
    roadWidths: { major: [82, 104], local: [44, 68], alley: [24, 46] },
    blockSize: [110, 250],
    density: { buildings: 0.82, alleys: 0.58, pedestrians: 0.42, lighting: 0.48, shadows: 0.68 },
    buildingWeights: { tenement: 4, shops: 3, civic: 2, warehouse: 1, religious: 1 },
    gameplay: { chaseLoops: [2, 4], hidingSpots: [5, 9], roofNetworks: [2, 4], sewerEntrances: [2, 4], darkRoutes: [3, 6] },
    tags: ["narrative-core", "vertical", "dense"]
  }),
  defineDistrictRecipe({
    id: "nightlife-commercial",
    label: "Glasshouse nightlife and commerce",
    roadStyle: "boulevards-with-courts",
    roadWidths: { major: [96, 132], local: [58, 84], alley: [30, 50] },
    blockSize: [170, 340],
    density: { buildings: 0.68, alleys: 0.30, pedestrians: 0.54, lighting: 0.82, shadows: 0.28 },
    buildingWeights: { club: 3, hotel: 2, commercial: 4, tenement: 2, office: 1 },
    gameplay: { chaseLoops: [2, 4], hidingSpots: [3, 6], roofNetworks: [1, 3], sewerEntrances: [1, 3], darkRoutes: [1, 3] },
    tags: ["neon", "social", "open"]
  }),
  defineDistrictRecipe({
    id: "industrial-maze",
    label: "Foundry industrial maze",
    roadStyle: "long-industrial",
    roadWidths: { major: [104, 138], local: [60, 88], alley: [34, 58] },
    blockSize: [190, 430],
    density: { buildings: 0.64, alleys: 0.46, pedestrians: 0.18, lighting: 0.38, shadows: 0.62 },
    buildingWeights: { warehouse: 4, factory: 3, workerHousing: 2, office: 1, commercial: 0.4 },
    gameplay: { chaseLoops: [2, 4], hidingSpots: [5, 9], roofNetworks: [1, 3], sewerEntrances: [2, 4], darkRoutes: [3, 5] },
    tags: ["industrial", "vehicle-friendly", "yards"]
  }),
  defineDistrictRecipe({
    id: "canal-mixed",
    label: "Canal mixed-use corridor",
    roadStyle: "bridges-and-market-streets",
    roadWidths: { major: [96, 124], local: [52, 76], alley: [28, 48] },
    blockSize: [150, 320],
    density: { buildings: 0.70, alleys: 0.34, pedestrians: 0.46, lighting: 0.60, shadows: 0.42 },
    buildingWeights: { market: 3, housing: 4, school: 1, depot: 1, shops: 2 },
    gameplay: { chaseLoops: [2, 4], hidingSpots: [4, 8], roofNetworks: [1, 2], sewerEntrances: [2, 4], darkRoutes: [2, 4] },
    tags: ["mixed-use", "bridges", "market"]
  }),
  defineDistrictRecipe({
    id: "blackwater-industrial",
    label: "Blackwater heavy logistics",
    roadStyle: "wide-logistics-grid",
    roadWidths: { major: [112, 148], local: [66, 94], alley: [38, 62] },
    blockSize: [220, 480],
    density: { buildings: 0.52, alleys: 0.26, pedestrians: 0.10, lighting: 0.26, shadows: 0.78 },
    buildingWeights: { terminal: 3, mill: 2, freight: 3, mortuary: 1, housing: 1 },
    gameplay: { chaseLoops: [2, 5], hidingSpots: [5, 10], roofNetworks: [0, 2], sewerEntrances: [2, 4], darkRoutes: [4, 7] },
    tags: ["dark", "wide", "logistics"]
  }),
  defineDistrictRecipe({
    id: "harbor-logistics",
    label: "Harbor logistics strip",
    roadStyle: "longitudinal-docks",
    roadWidths: { major: [100, 138], local: [58, 84], alley: [32, 54] },
    blockSize: [150, 360],
    density: { buildings: 0.60, alleys: 0.38, pedestrians: 0.20, lighting: 0.44, shadows: 0.62 },
    buildingWeights: { warehouse: 4, garage: 2, clinic: 1, registry: 1, coldStore: 2 },
    gameplay: { chaseLoops: [1, 3], hidingSpots: [4, 8], roofNetworks: [0, 2], sewerEntrances: [2, 4], darkRoutes: [3, 5] },
    tags: ["harbor", "linear", "service-lanes"]
  })
]);

export const blockTemplates = Object.freeze([
  defineBlockTemplate({
    id: "tenement-courtyard-a",
    label: "Tenement with inner courtyard",
    family: "tenement",
    footprint: { minWidth: 170, maxWidth: 260, minHeight: 130, maxHeight: 210 },
    frontages: ["north", "east"],
    serviceAccess: ["south"],
    passages: ["west-east"],
    roof: { height: "low", entrySockets: ["south-west"], jumpSockets: ["north", "east"] },
    sockets: { dumpsters: 2, lights: 3, parkedVehicles: 1, missionTargets: 1, hiddenBodies: 1 }
  }),
  defineBlockTemplate({
    id: "row-housing-a",
    label: "Narrow row housing",
    family: "housing",
    footprint: { minWidth: 130, maxWidth: 310, minHeight: 80, maxHeight: 140 },
    frontages: ["north"],
    serviceAccess: ["south"],
    passages: ["rear-service"],
    roof: { height: "low", entrySockets: ["south"], jumpSockets: ["east", "west"] },
    sockets: { dumpsters: 1, lights: 2, parkedVehicles: 2, missionTargets: 1, hiddenBodies: 1 }
  }),
  defineBlockTemplate({
    id: "warehouse-yard-a",
    label: "Warehouse and loading yard",
    family: "warehouse",
    footprint: { minWidth: 190, maxWidth: 430, minHeight: 140, maxHeight: 300 },
    frontages: ["north", "west"],
    serviceAccess: ["south", "east"],
    passages: ["yard-loop"],
    roof: { height: "low", entrySockets: ["yard"], jumpSockets: ["north"] },
    sockets: { dumpsters: 3, lights: 2, parkedVehicles: 4, missionTargets: 2, hiddenBodies: 2 }
  }),
  defineBlockTemplate({
    id: "factory-court-a",
    label: "Factory with enclosed court",
    family: "factory",
    footprint: { minWidth: 230, maxWidth: 480, minHeight: 180, maxHeight: 340 },
    frontages: ["south"],
    serviceAccess: ["east", "west"],
    passages: ["service-court", "rear-cut-through"],
    roof: { height: "low", entrySockets: ["west"], jumpSockets: ["east"] },
    sockets: { dumpsters: 3, lights: 3, parkedVehicles: 3, missionTargets: 2, hiddenBodies: 2 }
  }),
  defineBlockTemplate({
    id: "market-passage-a",
    label: "Market block with public passage",
    family: "market",
    footprint: { minWidth: 150, maxWidth: 300, minHeight: 110, maxHeight: 210 },
    frontages: ["north", "south"],
    serviceAccess: ["east"],
    passages: ["north-south"],
    roof: { height: "low", entrySockets: ["east"], jumpSockets: ["west"] },
    sockets: { dumpsters: 2, lights: 5, parkedVehicles: 1, missionTargets: 2, hiddenBodies: 1 }
  }),
  defineBlockTemplate({
    id: "civic-landmark-a",
    label: "Civic landmark and forecourt",
    family: "civic",
    footprint: { minWidth: 160, maxWidth: 300, minHeight: 120, maxHeight: 240 },
    frontages: ["north", "east", "west"],
    serviceAccess: ["south"],
    passages: ["forecourt"],
    roof: { height: "low", entrySockets: ["south"], jumpSockets: ["east", "west"] },
    sockets: { dumpsters: 1, lights: 5, parkedVehicles: 2, missionTargets: 3, hiddenBodies: 0 }
  })
]);

export const districtRecipeById = Object.freeze(Object.fromEntries(districtRecipes.map(recipe => [recipe.id, recipe])));
export const blockTemplateById = Object.freeze(Object.fromEntries(blockTemplates.map(template => [template.id, template])));
