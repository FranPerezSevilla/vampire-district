import {
  connectedComponents,
  graphEdgeCount,
  pointInRect,
  pointInSurface,
  pointInsideWorld,
  rectInsideWorld,
  rectOverlapArea,
  surfaceOverlapArea,
  rectsTouchOrOverlap,
  sampleSegment
} from "./geometry.js";

const ID_PATTERN = /^[a-zA-Z0-9]+(?:[._:-][a-zA-Z0-9]+)*$/;

function issue(code, message, context = {}) {
  return { code, message, context };
}

function duplicateIds(items = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    const id = String(item?.id || "");
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

function pointOnAny(point, areas = [], margin = 0.01) {
  return areas.some(area => pointInSurface(point, area, margin));
}

function graphComponents(nodes = [], edges = []) {
  const adjacency = new Map(nodes.map(node => [node.id, new Set()]));
  for (const edge of edges) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) continue;
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }
  const unvisited = new Set(adjacency.keys());
  const components = [];
  while (unvisited.size) {
    const [start] = unvisited;
    unvisited.delete(start);
    const queue = [start];
    const component = [];
    while (queue.length) {
      const id = queue.shift();
      component.push(id);
      for (const neighbour of adjacency.get(id) || []) {
        if (!unvisited.has(neighbour)) continue;
        unvisited.delete(neighbour);
        queue.push(neighbour);
      }
    }
    components.push(component);
  }
  return components;
}

function crosswalkContinuations(crosswalk) {
  if (crosswalk.orientation === "horizontal") {
    return [
      { x: crosswalk.x - 1, y: crosswalk.y + crosswalk.h / 2 },
      { x: crosswalk.x + crosswalk.w + 1, y: crosswalk.y + crosswalk.h / 2 }
    ];
  }
  return [
    { x: crosswalk.x + crosswalk.w / 2, y: crosswalk.y - 1 },
    { x: crosswalk.x + crosswalk.w / 2, y: crosswalk.y + crosswalk.h + 1 }
  ];
}

function roofAreasFor(runtime, layer) {
  return runtime.roofAreas?.[layer] || runtime.roofAreas?.[String(layer)] || [];
}

function zoneAt(blueprint, point) {
  return blueprint.districts.find(district => pointInRect(point, district.bounds, 0.01)) || null;
}

export function validateCityBlueprint(blueprint) {
  const errors = [];
  const warnings = [];
  const runtime = blueprint?.runtime || {};
  const world = blueprint?.world || { width: 0, height: 0 };
  const allowedBuildingRoadOverlaps = new Set(
    blueprint?.metadata?.validationExceptions?.allowedBuildingRoadOverlaps || []
  );
  const collections = {
    districts: blueprint?.districts || [],
    recipes: blueprint?.recipes || [],
    blockTemplates: blueprint?.blockTemplates || [],
    landmarks: blueprint?.landmarks || [],
    roads: runtime.roads || [],
    roadGraphNodes: runtime.roadGraphNodes || [],
    roadGraphEdges: runtime.roadGraphEdges || [],
    roadJunctions: runtime.roadJunctions || [],
    roadTransitions: runtime.roadTransitions || [],
    sidewalks: runtime.sidewalks || [],
    crosswalks: runtime.crosswalks || [],
    buildings: runtime.buildings || [],
    rooftopRoutes: runtime.rooftopRoutes || [],
    fireEscapes: runtime.fireEscapes || [],
    sewerTunnels: runtime.sewerTunnels || [],
    sewerAccesses: runtime.sewerAccesses || [],
    lights: runtime.lights || [],
    dumpsters: runtime.dumpsters || [],
    shadowZones: runtime.shadowZones || [],
    pedestrianRoutes: runtime.pedestrianRoutes || [],
    vehicles: runtime.vehicles || []
  };

  if (!blueprint?.id) errors.push(issue("CITY_ID_MISSING", "The city blueprint requires an id."));
  if (!(world.width > 0 && world.height > 0)) errors.push(issue("WORLD_INVALID", "World dimensions must be positive.", { world }));

  for (const [name, items] of Object.entries(collections)) {
    for (const id of duplicateIds(items)) errors.push(issue("DUPLICATE_ID", `${name} contains duplicate id ${id}.`, { collection: name, id }));
    for (const item of items) {
      if (!ID_PATTERN.test(String(item?.id || ""))) {
        errors.push(issue("UNSTABLE_ID", `${name} contains an unstable or empty id.`, { collection: name, id: item?.id || null }));
      }
    }
  }

  const rectangular = [
    ["district", collections.districts.map(item => ({ ...item.bounds, id: item.id }))],
    ["road", collections.roads],
    ["sidewalk", collections.sidewalks],
    ["crosswalk", collections.crosswalks],
    ["building", collections.buildings],
    ["sewerTunnel", collections.sewerTunnels],
    ["shadowZone", collections.shadowZones]
  ];
  for (const [kind, items] of rectangular) {
    for (const item of items) {
      if (!rectInsideWorld(item, world)) errors.push(issue("OUT_OF_BOUNDS_RECT", `${kind} ${item.id} leaves the world bounds.`, { kind, id: item.id }));
    }
  }

  for (const building of collections.buildings) {
    for (const road of collections.roads) {
      const overlap = surfaceOverlapArea(building, road);
      if (overlap <= 0.01) continue;
      const key = `${building.id}:${road.id}`;
      const entry = issue(
        allowedBuildingRoadOverlaps.has(key) ? "LEGACY_BUILDING_ROAD_OVERLAP" : "BUILDING_OVER_ROAD",
        `${building.id} overlaps road ${road.id}.`,
        { buildingId: building.id, roadId: road.id, overlap, exceptionKey: key }
      );
      if (allowedBuildingRoadOverlaps.has(key)) warnings.push(entry);
      else errors.push(entry);
    }
  }

  const graphNodeIds = new Set(collections.roadGraphNodes.map(node => node.id));
  for (const edge of collections.roadGraphEdges) {
    if (!graphNodeIds.has(edge.from) || !graphNodeIds.has(edge.to)) {
      errors.push(issue("ROAD_GRAPH_EDGE_NODE_MISSING", `${edge.id} references a missing graph node.`, { edgeId: edge.id, from: edge.from, to: edge.to }));
      continue;
    }
    const from = collections.roadGraphNodes.find(node => node.id === edge.from);
    const to = collections.roadGraphNodes.find(node => node.id === edge.to);
    if (Math.abs(from.x - to.x) > 0.01 && Math.abs(from.y - to.y) > 0.01) {
      errors.push(issue("ROAD_GRAPH_DIAGONAL_EDGE", `${edge.id} is not axis aligned in road graph v1.`, { edgeId: edge.id }));
    }
  }
  const graphRoadComponents = graphComponents(collections.roadGraphNodes, collections.roadGraphEdges);
  if (graphRoadComponents.length > 1) {
    errors.push(issue("ROAD_GRAPH_DISCONNECTED", `Road graph has ${graphRoadComponents.length} disconnected components.`, {
      components: graphRoadComponents
    }));
  }

  const junctionOwners = new Map();
  for (const piece of [...collections.roadJunctions, ...collections.roadTransitions]) {
    for (const nodeId of piece.graphNodeIds || [piece.graphNodeId]) {
      junctionOwners.set(nodeId, (junctionOwners.get(nodeId) || 0) + 1);
    }
  }
  for (const node of collections.roadGraphNodes) {
    if (junctionOwners.get(node.id) !== 1) {
      errors.push(issue("ROAD_NODE_JUNCTION_AUTHORITY", `${node.id} must own exactly one junction or transition piece.`, {
        nodeId: node.id,
        count: junctionOwners.get(node.id) || 0
      }));
    }
  }

  for (let leftIndex = 0; leftIndex < collections.roads.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < collections.roads.length; rightIndex++) {
      const overlap = surfaceOverlapArea(collections.roads[leftIndex], collections.roads[rightIndex]);
      if (overlap <= 0.01) continue;
      errors.push(issue("ROAD_PIECE_OVERLAP", `${collections.roads[leftIndex].id} overlaps ${collections.roads[rightIndex].id}.`, {
        leftId: collections.roads[leftIndex].id,
        rightId: collections.roads[rightIndex].id,
        overlap
      }));
    }
  }

  for (const crosswalk of collections.crosswalks) {
    if (!collections.roads.some(road => surfaceOverlapArea(crosswalk, road) > 0.01)) {
      errors.push(issue("CROSSWALK_WITHOUT_ROAD", `${crosswalk.id} does not intersect a road.`, { crosswalkId: crosswalk.id }));
    }
    if ([...collections.roadJunctions, ...collections.roadTransitions].some(piece => surfaceOverlapArea(crosswalk, piece) > 0.01)) {
      errors.push(issue("CROSSWALK_OVER_JUNCTION", `${crosswalk.id} overlaps a junction authority surface.`, { crosswalkId: crosswalk.id }));
    }
    const continuations = crosswalkContinuations(crosswalk);
    if (!continuations.every(point => pointOnAny(point, collections.sidewalks, 1.5))) {
      errors.push(issue("CROSSWALK_WITHOUT_TWO_SIDEWALKS", `${crosswalk.id} does not connect two valid sidewalk continuations.`, {
        crosswalkId: crosswalk.id,
        continuations
      }));
    }
  }

  for (let leftIndex = 0; leftIndex < collections.lights.length; leftIndex++) {
    const light = collections.lights[leftIndex];
    const point = { x: light.x, y: light.y };
    if (!pointInsideWorld(point, world)) errors.push(issue("LIGHT_OUT_OF_BOUNDS", `${light.id} is outside the world.`, { lightId: light.id }));
    if (!pointOnAny(point, collections.sidewalks, 0.5)) {
      errors.push(issue("LIGHT_OFF_SIDEWALK", `${light.id} is not on a final sidewalk.`, { lightId: light.id, point }));
    }
    if (pointOnAny(point, collections.roads, 0.1)) {
      errors.push(issue("LIGHT_ON_ROAD", `${light.id} overlaps the carriageway.`, { lightId: light.id, point }));
    }
    if (pointOnAny(point, collections.crosswalks, 0.1)) {
      errors.push(issue("LIGHT_ON_CROSSWALK", `${light.id} overlaps a crossing.`, { lightId: light.id, point }));
    }
    if (pointOnAny(point, collections.buildings, 8)) {
      errors.push(issue("LIGHT_INSIDE_BUILDING_CLEARANCE", `${light.id} overlaps a building clearance.`, { lightId: light.id, point }));
    }
    for (let rightIndex = leftIndex + 1; rightIndex < collections.lights.length; rightIndex++) {
      const other = collections.lights[rightIndex];
      const distance = Math.hypot(light.x - other.x, light.y - other.y);
      if (distance < 100) errors.push(issue("LIGHTS_TOO_CLOSE", `${light.id} and ${other.id} are too close.`, { leftId: light.id, rightId: other.id, distance }));
    }
  }

  for (const dumpster of collections.dumpsters) {
    const point = { x: dumpster.x, y: dumpster.y };
    if (!pointInsideWorld(point, world)) errors.push(issue("DUMPSTER_OUT_OF_BOUNDS", `${dumpster.id} is outside the world.`, { dumpsterId: dumpster.id }));
    const majorRoad = collections.roads.find(road => road.kind === "road" && pointInRect(point, road));
    if (majorRoad) warnings.push(issue("DUMPSTER_ON_MAJOR_ROAD", `${dumpster.id} sits inside ${majorRoad.id}.`, { dumpsterId: dumpster.id, roadId: majorRoad.id }));
  }

  for (const route of collections.pedestrianRoutes) {
    if (!Array.isArray(route.points) || route.points.length < 2) {
      errors.push(issue("PEDESTRIAN_ROUTE_TOO_SHORT", `${route.id} requires at least two points.`, { routeId: route.id }));
      continue;
    }
    const closed = [...route.points, route.points[0]];
    for (let index = 0; index < closed.length - 1; index++) {
      const segment = sampleSegment(closed[index], closed[index + 1], 10);
      const offSurface = segment.find(point => !pointOnAny(point, [...collections.sidewalks, ...collections.crosswalks], 0.75));
      if (offSurface) {
        errors.push(issue("PEDESTRIAN_ROUTE_OFF_SURFACE", `${route.id} leaves authored pedestrian surfaces.`, { routeId: route.id, segmentIndex: index, point: offSurface }));
        break;
      }
    }
  }

  for (const route of collections.rooftopRoutes) {
    const a = { x: route.ax, y: route.ay };
    const b = { x: route.bx, y: route.by };
    if (!pointOnAny(a, roofAreasFor(runtime, route.aLayer), 2)) {
      errors.push(issue("ROOF_ROUTE_START_INVALID", `${route.id} starts outside a roof on layer ${route.aLayer}.`, { routeId: route.id, point: a }));
    }
    if (!pointOnAny(b, roofAreasFor(runtime, route.bLayer), 2)) {
      errors.push(issue("ROOF_ROUTE_END_INVALID", `${route.id} ends outside a roof on layer ${route.bLayer}.`, { routeId: route.id, point: b }));
    }
  }

  for (const escape of collections.fireEscapes) {
    if (!pointOnAny(escape.roof, roofAreasFor(runtime, escape.roof?.layer), 2)) {
      errors.push(issue("FIRE_ESCAPE_ROOF_INVALID", `${escape.id} does not terminate on a roof.`, { escapeId: escape.id, roof: escape.roof }));
    }
  }

  for (const access of collections.sewerAccesses) {
    if (!pointOnAny(access.sewer, collections.sewerTunnels, 1)) {
      errors.push(issue("SEWER_ACCESS_INVALID", `${access.id} does not connect to a sewer tunnel.`, { accessId: access.id, sewer: access.sewer }));
    }
    if (access.street && !pointInsideWorld(access.street, world)) {
      errors.push(issue("SEWER_STREET_ACCESS_OUT_OF_BOUNDS", `${access.id} street access is outside the world.`, { accessId: access.id }));
    }
  }

  const buildingIds = new Set(collections.buildings.map(building => building.id));
  const districtIds = new Set(collections.districts.map(district => district.id));
  const recipeIds = new Set(collections.recipes.map(recipe => recipe.id));
  for (const district of collections.districts) {
    if (!recipeIds.has(district.recipeId)) errors.push(issue("DISTRICT_RECIPE_MISSING", `${district.id} references missing recipe ${district.recipeId}.`, { districtId: district.id }));
    for (const neighbour of district.neighbours || []) {
      if (!districtIds.has(neighbour)) errors.push(issue("DISTRICT_NEIGHBOUR_MISSING", `${district.id} references missing neighbour ${neighbour}.`, { districtId: district.id, neighbour }));
    }
  }
  for (const landmark of collections.landmarks) {
    if (!buildingIds.has(landmark.buildingId)) errors.push(issue("LANDMARK_BUILDING_MISSING", `${landmark.id} references missing building ${landmark.buildingId}.`, { landmarkId: landmark.id }));
    if (!districtIds.has(landmark.districtId)) errors.push(issue("LANDMARK_DISTRICT_MISSING", `${landmark.id} references missing district ${landmark.districtId}.`, { landmarkId: landmark.id }));
  }

  for (const vehicle of collections.vehicles) {
    const point = { x: vehicle.x, y: vehicle.y };
    if (!pointInsideWorld(point, world, 4)) errors.push(issue("VEHICLE_OUT_OF_BOUNDS", `${vehicle.id} is outside the world.`, { vehicleId: vehicle.id }));
    const obstacle = collections.buildings.find(building => pointInRect(point, building, 2));
    if (obstacle) errors.push(issue("VEHICLE_INSIDE_BUILDING", `${vehicle.id} starts inside ${obstacle.id}.`, { vehicleId: vehicle.id, buildingId: obstacle.id }));
  }

  for (const zoneId of blueprint.protectedZones || []) {
    if (!districtIds.has(zoneId)) errors.push(issue("PROTECTED_ZONE_MISSING", `Protected zone ${zoneId} does not exist.`, { zoneId }));
  }

  const roofs = Object.values(runtime.roofAreas || {}).flat();
  const districtsWithRoofs = new Set(roofs.map(roof => zoneAt(blueprint, { x: roof.x + roof.w / 2, y: roof.y + roof.h / 2 })?.id).filter(Boolean));
  for (const district of collections.districts) {
    if (!districtsWithRoofs.has(district.id)) warnings.push(issue("DISTRICT_WITHOUT_ROOF_GAMEPLAY", `${district.id} currently has no authored rooftop area.`, { districtId: district.id }));
  }

  const roadTouches = (left, right) => rectsTouchOrOverlap(left, right, 0.01);
  const roadComponents = connectedComponents(collections.roads, roadTouches);
  const roadEdges = collections.roadGraphEdges.length || graphEdgeCount(collections.roads, roadTouches);
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      worldArea: world.width * world.height,
      roadNodes: collections.roadGraphNodes.length || collections.roads.length,
      roadEdges,
      roadPieces: collections.roads.length,
      roadJunctions: collections.roadJunctions.length,
      roadTransitions: collections.roadTransitions.length,
      roadComponents: graphRoadComponents.length || roadComponents.length,
      roadCycleSurplus: Math.max(0, roadEdges - (collections.roadGraphNodes.length || collections.roads.length) + (graphRoadComponents.length || roadComponents.length)),
      districtCount: collections.districts.length,
      recipeCount: collections.recipes.length,
      buildingCount: collections.buildings.length,
      roofCount: roofs.length,
      pedestrianRouteCount: collections.pedestrianRoutes.length,
      lightCount: collections.lights.length,
      dumpsterCount: collections.dumpsters.length,
      vehicleCount: collections.vehicles.length,
      legacyBuildingRoadOverlapCount: warnings.filter(item => item.code === "LEGACY_BUILDING_ROAD_OVERLAP").length,
      errorCount: errors.length,
      warningCount: warnings.length
    }
  };
}
