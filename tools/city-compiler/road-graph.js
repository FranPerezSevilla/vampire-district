import {
  bottom,
  pointInSurface,
  right,
  surfaceOverlapArea
} from "./geometry.js";

const EPSILON = 0.001;
const ROAD_CLASS_PRIORITY = Object.freeze({ alley: 1, local: 2, major: 3 });
const MINIMUM_PARALLEL_ROAD_BLOCK_DEPTH = 36;
const MINIMUM_PARALLEL_ROAD_OVERLAP = 120;
const DIRECTIONS = Object.freeze(["north", "east", "south", "west"]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value)));
}

function rounded(value, precision = 3) {
  const scale = 10 ** precision;
  return Math.round(finite(value) * scale) / scale;
}

function coordinateToken(value) {
  const normalized = rounded(value);
  return String(normalized).replace(/-/g, "m").replace(/\./g, "p");
}

function pointKey(point) {
  return `${coordinateToken(point.x)}:${coordinateToken(point.y)}`;
}

function edgeKey(a, b) {
  const left = pointKey(a);
  const rightKey = pointKey(b);
  return left < rightKey ? `${left}|${rightKey}` : `${rightKey}|${left}`;
}

function orientationForRect(road) {
  return finite(road?.w) >= finite(road?.h) ? "horizontal" : "vertical";
}

function roadClassFor(road) {
  if (String(road?.kind || "") === "alley") return "alley";
  return Math.min(finite(road?.w), finite(road?.h)) >= 96 ? "major" : "local";
}

function roadLine(road) {
  const orientation = orientationForRect(road);
  const horizontal = orientation === "horizontal";
  const fixed = horizontal ? finite(road.y) + finite(road.h) / 2 : finite(road.x) + finite(road.w) / 2;
  const start = horizontal ? finite(road.x) : finite(road.y);
  const end = horizontal ? right(road) : bottom(road);
  return {
    id: String(road.id),
    label: String(road.label || road.id),
    kind: String(road.kind || "road"),
    roadClass: roadClassFor(road),
    orientation,
    fixed: rounded(fixed),
    start: rounded(Math.min(start, end)),
    end: rounded(Math.max(start, end)),
    width: rounded(horizontal ? finite(road.h) : finite(road.w)),
    generated: road.generated === true,
    sourceRoadIds: [String(road.id)],
    source: road
  };
}

function intervalGap(value, min, max) {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

function perpendicularConnection(horizontal, vertical, tolerance) {
  const x = vertical.fixed;
  const y = horizontal.fixed;
  const xGap = intervalGap(x, horizontal.start, horizontal.end);
  const yGap = intervalGap(y, vertical.start, vertical.end);
  if (xGap > vertical.width / 2 + tolerance) return null;
  if (yGap > horizontal.width / 2 + tolerance) return null;
  return { x: rounded(x), y: rounded(y) };
}

function intervalsTouch(left, rightValue, tolerance) {
  return Math.max(left.start, rightValue.start) <= Math.min(left.end, rightValue.end) + tolerance;
}


function lateralBounds(line) {
  return { min: line.fixed - line.width / 2, max: line.fixed + line.width / 2 };
}

function intervalContains(container, candidate, tolerance) {
  return candidate.start >= container.start - tolerance && candidate.end <= container.end + tolerance;
}

function pruneSubsumedParallelLines(lines, tolerance) {
  const absorbedById = new Map(lines.map(line => [line.id, new Set()]));
  const removed = new Set();
  const strength = line => [ROAD_CLASS_PRIORITY[line.roadClass] || 0, line.width, line.end - line.start];
  const strongerOrEqual = (left, rightValue) => {
    const a = strength(left);
    const b = strength(rightValue);
    for (let index = 0; index < a.length; index++) {
      if (a[index] !== b[index]) return a[index] > b[index];
    }
    return left.id < rightValue.id;
  };
  for (let candidateIndex = 0; candidateIndex < lines.length; candidateIndex++) {
    const candidate = lines[candidateIndex];
    if (removed.has(candidate.id)) continue;
    for (let containerIndex = 0; containerIndex < lines.length; containerIndex++) {
      if (candidateIndex === containerIndex) continue;
      const container = lines[containerIndex];
      if (removed.has(container.id) || candidate.orientation !== container.orientation) continue;
      if (!intervalContains(container, candidate, tolerance)) continue;
      const candidateLateral = lateralBounds(candidate);
      const containerLateral = lateralBounds(container);
      const lateralOverlap = Math.min(candidateLateral.max, containerLateral.max)
        - Math.max(candidateLateral.min, containerLateral.min);
      if (lateralOverlap <= tolerance) continue;
      if (!strongerOrEqual(container, candidate)) continue;
      removed.add(candidate.id);
      absorbedById.get(container.id).add(candidate.id);
      for (const inherited of absorbedById.get(candidate.id)) absorbedById.get(container.id).add(inherited);
      break;
    }
  }
  return lines.filter(line => !removed.has(line.id)).map(line => ({
    ...line,
    absorbedSourceIds: [...absorbedById.get(line.id)].sort()
  }));
}


function strongestRoadClass(values) {
  return [...values].sort((left, rightValue) => (
    (ROAD_CLASS_PRIORITY[rightValue] || 0) - (ROAD_CLASS_PRIORITY[left] || 0)
  ))[0] || "local";
}

function sortedUnique(values) {
  return [...new Set(values.map(value => rounded(value)))].sort((a, b) => a - b);
}

function pointFor(line, coordinate) {
  return line.orientation === "horizontal"
    ? { x: rounded(coordinate), y: line.fixed }
    : { x: line.fixed, y: rounded(coordinate) };
}

function mergeAtomicEdges(candidates) {
  const merged = new Map();
  for (const candidate of candidates) {
    const key = edgeKey(candidate.a, candidate.b);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...candidate,
        sourceRoadIds: new Set(candidate.sourceRoadIds),
        labels: new Set([candidate.label]),
        roadClasses: new Set([candidate.roadClass]),
        generated: candidate.generated
      });
      continue;
    }
    current.width = Math.max(current.width, candidate.width);
    for (const sourceRoadId of candidate.sourceRoadIds) current.sourceRoadIds.add(sourceRoadId);
    current.labels.add(candidate.label);
    current.roadClasses.add(candidate.roadClass);
    current.generated ||= candidate.generated;
  }
  return [...merged.values()].map(edge => ({
    ...edge,
    sourceRoadIds: [...edge.sourceRoadIds].sort(),
    label: [...edge.labels][0],
    roadClass: strongestRoadClass(edge.roadClasses),
    kind: strongestRoadClass(edge.roadClasses) === "alley" ? "alley" : "road"
  }));
}

function directionFrom(node, other) {
  if (Math.abs(finite(other.x) - finite(node.x)) > Math.abs(finite(other.y) - finite(node.y))) {
    return finite(other.x) > finite(node.x) ? "east" : "west";
  }
  return finite(other.y) > finite(node.y) ? "south" : "north";
}

function opposite(direction) {
  return ({ north: "south", south: "north", east: "west", west: "east" })[direction] || null;
}

function boundsFromPoints(points) {
  const xs = points.map(point => finite(point.x));
  const ys = points.map(point => finite(point.y));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x: rounded(x),
    y: rounded(y),
    w: rounded(Math.max(EPSILON, Math.max(...xs) - x)),
    h: rounded(Math.max(EPSILON, Math.max(...ys) - y))
  };
}

function clippedRect(rect, world) {
  const x = Math.max(0, finite(rect.x));
  const y = Math.max(0, finite(rect.y));
  const maxX = Math.min(finite(world.width), right(rect));
  const maxY = Math.min(finite(world.height), bottom(rect));
  return {
    ...rect,
    x: rounded(x),
    y: rounded(y),
    w: rounded(Math.max(0, maxX - x)),
    h: rounded(Math.max(0, maxY - y))
  };
}

function expandedRect(rect, amount) {
  return {
    x: finite(rect.x) - amount,
    y: finite(rect.y) - amount,
    w: finite(rect.w) + amount * 2,
    h: finite(rect.h) + amount * 2
  };
}

function pointNearSurface(point, surfaces, margin) {
  return surfaces.some(surface => pointInSurface(point, expandedRect(surface, margin)));
}

function distanceToPoint(a, b) {
  return Math.hypot(finite(a.x) - finite(b.x), finite(a.y) - finite(b.y));
}

function nodeKind(directions, widths) {
  const directionSet = new Set(directions);
  if (directions.length <= 1) return "end";
  if (directions.length === 2) {
    const [first, second] = directions;
    if (opposite(first) === second) {
      return Math.abs(finite(widths[0]) - finite(widths[1])) > 0.5 ? "transition" : "straight";
    }
    return "corner";
  }
  if (directionSet.size === 3) return "t-junction";
  if (directionSet.size === 4 && directions.length === 4) return "crossroad";
  return "complex";
}

function classifyNode(node, incident, nodeById) {
  const legs = incident.map(edge => {
    const otherId = edge.from === node.id ? edge.to : edge.from;
    const other = nodeById.get(otherId);
    return {
      edge,
      other,
      direction: directionFrom(node, other),
      width: finite(edge.width),
      orientation: edge.orientation
    };
  }).sort((left, rightValue) => DIRECTIONS.indexOf(left.direction) - DIRECTIONS.indexOf(rightValue.direction));
  const horizontal = legs.filter(leg => leg.orientation === "horizontal");
  const vertical = legs.filter(leg => leg.orientation === "vertical");
  const horizontalWidth = Math.max(0, ...horizontal.map(leg => leg.width));
  const verticalWidth = Math.max(0, ...vertical.map(leg => leg.width));
  const maxWidth = Math.max(horizontalWidth, verticalWidth, 1);
  return {
    node,
    legs,
    kind: nodeKind(legs.map(leg => leg.direction), legs.map(leg => leg.width)),
    horizontalWidth,
    verticalWidth,
    maxWidth,
    hasHorizontal: horizontal.length > 0,
    hasVertical: vertical.length > 0
  };
}

function junctionRect(profile, world) {
  const width = profile.hasHorizontal && profile.hasVertical ? profile.verticalWidth : profile.maxWidth;
  const height = profile.hasHorizontal && profile.hasVertical ? profile.horizontalWidth : profile.maxWidth;
  return clippedRect({
    id: `road-junction:${profile.node.id}`,
    x: finite(profile.node.x) - width / 2,
    y: finite(profile.node.y) - height / 2,
    w: width,
    h: height,
    geometry: "rect",
    pieceKind: "junction",
    junctionKind: profile.kind,
    graphNodeId: profile.node.id,
    kind: profile.legs.some(leg => leg.edge.roadClass === "major") ? "road" : "alley",
    label: `Road ${profile.kind}`,
    generated: true,
    suppressStripe: true
  }, world);
}

function transitionPolygon(profile, world) {
  const node = profile.node;
  const horizontal = profile.legs.every(leg => leg.orientation === "horizontal");
  const negativeDirection = horizontal ? "west" : "north";
  const positiveDirection = horizontal ? "east" : "south";
  const negative = profile.legs.find(leg => leg.direction === negativeDirection);
  const positive = profile.legs.find(leg => leg.direction === positiveDirection);
  if (!negative || !positive) return null;
  const halfLength = profile.maxWidth / 2;
  let points;
  if (horizontal) {
    const leftX = Math.max(0, finite(node.x) - halfLength);
    const rightX = Math.min(finite(world.width), finite(node.x) + halfLength);
    points = [
      { x: leftX, y: finite(node.y) - negative.width / 2 },
      { x: rightX, y: finite(node.y) - positive.width / 2 },
      { x: rightX, y: finite(node.y) + positive.width / 2 },
      { x: leftX, y: finite(node.y) + negative.width / 2 }
    ];
  } else {
    const topY = Math.max(0, finite(node.y) - halfLength);
    const bottomY = Math.min(finite(world.height), finite(node.y) + halfLength);
    points = [
      { x: finite(node.x) - negative.width / 2, y: topY },
      { x: finite(node.x) + negative.width / 2, y: topY },
      { x: finite(node.x) + positive.width / 2, y: bottomY },
      { x: finite(node.x) - positive.width / 2, y: bottomY }
    ];
  }
  const bounds = boundsFromPoints(points);
  return {
    id: `road-transition:${node.id}`,
    ...bounds,
    geometry: "polygon",
    points: points.map(point => ({ x: rounded(point.x), y: rounded(point.y) })),
    pieceKind: "transition",
    junctionKind: "transition",
    graphNodeId: node.id,
    orientation: horizontal ? "horizontal" : "vertical",
    kind: profile.legs.some(leg => leg.edge.roadClass === "major") ? "road" : "alley",
    label: "Road width transition",
    generated: true,
    suppressStripe: true
  };
}

function nodePiece(profile, world) {
  if (profile.kind === "transition") return transitionPolygon(profile, world) || junctionRect(profile, world);
  return junctionRect(profile, world);
}

function approachGap(leftPiece, rightPiece, edge) {
  if (edge.orientation === "horizontal") {
    return Math.max(0, Math.max(finite(leftPiece.x), finite(rightPiece.x)) - Math.min(right(leftPiece), right(rightPiece)));
  }
  return Math.max(0, Math.max(finite(leftPiece.y), finite(rightPiece.y)) - Math.min(bottom(leftPiece), bottom(rightPiece)));
}

function junctionAuthorities(profiles, world, edges = [], minimumApproachLength = 0) {
  const provisional = profiles.map(profile => nodePiece(profile, world));
  const profileIndexByNode = new Map(profiles.map((profile, index) => [profile.node.id, index]));
  const parent = provisional.map((_, index) => index);

  const find = index => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const union = (left, rightValue) => {
    const leftRoot = find(left);
    const rightRoot = find(rightValue);
    if (leftRoot === rightRoot) return;
    parent[rightRoot] = leftRoot;
  };

  for (let left = 0; left < provisional.length; left++) {
    for (let rightValue = left + 1; rightValue < provisional.length; rightValue++) {
      if (surfaceOverlapArea(provisional[left], provisional[rightValue]) > 0.01) union(left, rightValue);
    }
  }

  const absorbedShortApproachEdgeIds = [];
  for (const edge of edges) {
    const fromIndex = profileIndexByNode.get(edge.from);
    const toIndex = profileIndexByNode.get(edge.to);
    if (fromIndex == null || toIndex == null) continue;
    const gap = approachGap(provisional[fromIndex], provisional[toIndex], edge);
    if (gap < minimumApproachLength - EPSILON) {
      union(fromIndex, toIndex);
      if (gap > EPSILON) absorbedShortApproachEdgeIds.push(edge.id);
    }
  }

  const componentsByRoot = new Map();
  for (let index = 0; index < provisional.length; index++) {
    const root = find(index);
    const component = componentsByRoot.get(root) || [];
    component.push(index);
    componentsByRoot.set(root, component);
  }

  const pieces = [];
  const pieceByNode = new Map();
  for (const component of componentsByRoot.values()) {
    const componentProfiles = component.map(index => profiles[index]);
    const componentPieces = component.map(index => provisional[index]);
    const nodeIds = componentProfiles.map(profile => profile.node.id).sort();
    let piece;
    if (component.length === 1) {
      piece = { ...componentPieces[0], graphNodeIds: nodeIds };
    } else {
      const x = Math.min(...componentPieces.map(item => finite(item.x)));
      const y = Math.min(...componentPieces.map(item => finite(item.y)));
      const maxX = Math.max(...componentPieces.map(item => right(item)));
      const maxY = Math.max(...componentPieces.map(item => bottom(item)));
      const nodeIdSet = new Set(nodeIds);
      const absorbedEdges = edges.filter(edge => nodeIdSet.has(edge.from) && nodeIdSet.has(edge.to));
      piece = clippedRect({
        id: `road-junction-cluster:${nodeIds.map(id => id.replace("road-node:", "")).join(":")}`,
        x,
        y,
        w: maxX - x,
        h: maxY - y,
        geometry: "rect",
        pieceKind: "junction",
        junctionKind: "complex-cluster",
        graphNodeId: nodeIds[0],
        graphNodeIds: nodeIds,
        graphEdgeIds: absorbedEdges.map(edge => edge.id).sort(),
        sourceRoadIds: [...new Set(absorbedEdges.flatMap(edge => edge.sourceRoadIds || []))].sort(),
        kind: componentProfiles.some(profile => profile.legs.some(leg => leg.edge.roadClass === "major")) ? "road" : "alley",
        label: "Complex road junction",
        generated: true,
        suppressStripe: true,
        absorbedShortApproaches: true
      }, world);
    }
    pieces.push(piece);
    for (const nodeId of nodeIds) pieceByNode.set(nodeId, piece);
  }
  return { pieces, pieceByNode, absorbedShortApproachEdgeIds: [...new Set(absorbedShortApproachEdgeIds)].sort() };
}

function trimForLeg(profile, piece, leg) {
  if (leg.direction === "east") return right(piece) - finite(profile.node.x);
  if (leg.direction === "west") return finite(profile.node.x) - finite(piece.x);
  if (leg.direction === "south") return bottom(piece) - finite(profile.node.y);
  return finite(profile.node.y) - finite(piece.y);
}

function segmentForEdge(edge, fromProfile, toProfile, fromPiece, toPiece, nodeById) {
  const from = nodeById.get(edge.from);
  const to = nodeById.get(edge.to);
  const fromLeg = fromProfile.legs.find(leg => leg.edge.id === edge.id);
  const toLeg = toProfile.legs.find(leg => leg.edge.id === edge.id);
  const fromTrim = trimForLeg(fromProfile, fromPiece, fromLeg);
  const toTrim = trimForLeg(toProfile, toPiece, toLeg);
  const horizontal = edge.orientation === "horizontal";
  if (horizontal) {
    const minX = Math.min(finite(from.x), finite(to.x));
    const maxX = Math.max(finite(from.x), finite(to.x));
    const start = minX + (finite(from.x) <= finite(to.x) ? fromTrim : toTrim);
    const end = maxX - (finite(from.x) <= finite(to.x) ? toTrim : fromTrim);
    if (end - start <= EPSILON) return null;
    return {
      id: `road-segment:${edge.id}`,
      x: rounded(start),
      y: rounded(finite(from.y) - finite(edge.width) / 2),
      w: rounded(end - start),
      h: rounded(edge.width),
      geometry: "rect",
      pieceKind: "segment",
      orientation: "horizontal",
      graphEdgeId: edge.id,
      fromNodeId: edge.from,
      toNodeId: edge.to,
      sourceRoadIds: [...edge.sourceRoadIds],
      roadClass: edge.roadClass,
      kind: edge.kind,
      label: edge.label,
      generated: true
    };
  }
  const minY = Math.min(finite(from.y), finite(to.y));
  const maxY = Math.max(finite(from.y), finite(to.y));
  const start = minY + (finite(from.y) <= finite(to.y) ? fromTrim : toTrim);
  const end = maxY - (finite(from.y) <= finite(to.y) ? toTrim : fromTrim);
  if (end - start <= EPSILON) return null;
  return {
    id: `road-segment:${edge.id}`,
    x: rounded(finite(from.x) - finite(edge.width) / 2),
    y: rounded(start),
    w: rounded(edge.width),
    h: rounded(end - start),
    geometry: "rect",
    pieceKind: "segment",
    orientation: "vertical",
    graphEdgeId: edge.id,
    fromNodeId: edge.from,
    toNodeId: edge.to,
    sourceRoadIds: [...edge.sourceRoadIds],
    roadClass: edge.roadClass,
    kind: edge.kind,
    label: edge.label,
    generated: true
  };
}

function sidewalkStrips(segments, width, world) {
  const strips = [];
  for (const segment of segments) {
    if (segment.orientation === "horizontal") {
      strips.push(clippedRect({
        id: `sidewalk:${segment.graphEdgeId}:north`,
        x: segment.x,
        y: segment.y - width,
        w: segment.w,
        h: width,
        geometry: "rect",
        graphEdgeId: segment.graphEdgeId,
        side: "north",
        orientation: "horizontal",
        roadPieceId: segment.id,
        junctionOwned: false,
        trimEdges: ["north", "south"],
        anchorKind: "kerb-strip",
        bandKind: "road-edge",
        generated: true
      }, world));
      strips.push(clippedRect({
        id: `sidewalk:${segment.graphEdgeId}:south`,
        x: segment.x,
        y: segment.y + segment.h,
        w: segment.w,
        h: width,
        geometry: "rect",
        graphEdgeId: segment.graphEdgeId,
        side: "south",
        orientation: "horizontal",
        roadPieceId: segment.id,
        junctionOwned: false,
        trimEdges: ["north", "south"],
        anchorKind: "kerb-strip",
        bandKind: "road-edge",
        generated: true
      }, world));
    } else {
      strips.push(clippedRect({
        id: `sidewalk:${segment.graphEdgeId}:west`,
        x: segment.x - width,
        y: segment.y,
        w: width,
        h: segment.h,
        geometry: "rect",
        graphEdgeId: segment.graphEdgeId,
        side: "west",
        orientation: "vertical",
        roadPieceId: segment.id,
        junctionOwned: false,
        trimEdges: ["west", "east"],
        anchorKind: "kerb-strip",
        bandKind: "road-edge",
        generated: true
      }, world));
      strips.push(clippedRect({
        id: `sidewalk:${segment.graphEdgeId}:east`,
        x: segment.x + segment.w,
        y: segment.y,
        w: width,
        h: segment.h,
        geometry: "rect",
        graphEdgeId: segment.graphEdgeId,
        side: "east",
        orientation: "vertical",
        roadPieceId: segment.id,
        junctionOwned: false,
        trimEdges: ["west", "east"],
        anchorKind: "kerb-strip",
        bandKind: "road-edge",
        generated: true
      }, world));
    }
  }
  return strips.filter(strip => strip.w > EPSILON && strip.h > EPSILON);
}

function stripAxisBounds(strip) {
  return strip.orientation === "horizontal"
    ? { start: finite(strip.x), end: right(strip) }
    : { start: finite(strip.y), end: bottom(strip) };
}

function splitIntervalsAroundCut(intervals, cutStart, cutEnd) {
  const result = [];
  for (const interval of intervals) {
    if (cutEnd <= interval.start + EPSILON || cutStart >= interval.end - EPSILON) {
      result.push(interval);
      continue;
    }
    if (cutStart > interval.start + EPSILON) result.push({ start: interval.start, end: Math.min(interval.end, cutStart) });
    if (cutEnd < interval.end - EPSILON) result.push({ start: Math.max(interval.start, cutEnd), end: interval.end });
  }
  return result;
}

function buildRoadEdgeBands(baseStrips, obstacles, minimumFragmentLength = 8) {
  const bands = [];
  const sources = [];
  for (const strip of baseStrips) {
    const axis = stripAxisBounds(strip);
    let intervals = [{ start: axis.start, end: axis.end }];
    for (const obstacle of obstacles) {
      if (surfaceOverlapArea(strip, obstacle) <= 0.01) continue;
      const cutStart = strip.orientation === "horizontal"
        ? Math.max(axis.start, finite(obstacle.x))
        : Math.max(axis.start, finite(obstacle.y));
      const cutEnd = strip.orientation === "horizontal"
        ? Math.min(axis.end, right(obstacle))
        : Math.min(axis.end, bottom(obstacle));
      if (cutEnd - cutStart <= EPSILON) continue;
      intervals = splitIntervalsAroundCut(intervals, cutStart, cutEnd);
    }

    const retained = intervals.filter(interval => interval.end - interval.start >= minimumFragmentLength - EPSILON);
    const openLength = retained.reduce((sum, interval) => sum + interval.end - interval.start, 0);
    const discardedLength = intervals.reduce((sum, interval) => {
      const length = interval.end - interval.start;
      return sum + (length < minimumFragmentLength - EPSILON ? length : 0);
    }, 0);
    const sourceLength = axis.end - axis.start;
    const blockedLength = Math.max(0, sourceLength - openLength - discardedLength);
    const source = {
      ...strip,
      sourceLength: rounded(sourceLength),
      openLength: rounded(openLength),
      blockedLength: rounded(blockedLength),
      discardedLength: rounded(discardedLength),
      fragmentCount: retained.length,
      minimumFragmentLength
    };
    sources.push(source);

    retained.forEach((interval, index) => {
      const fullLength = Math.abs(interval.start - axis.start) <= EPSILON && Math.abs(interval.end - axis.end) <= EPSILON;
      const fragment = {
        ...strip,
        id: fullLength ? strip.id : `${strip.id}:fragment:${String(index + 1).padStart(2, "0")}`,
        sourceStripId: strip.id,
        sourceLength: rounded(sourceLength),
        fragmentIndex: index,
        fragmentCount: retained.length,
        continuous: true,
        minimumFragmentLength
      };
      if (strip.orientation === "horizontal") {
        fragment.x = rounded(interval.start);
        fragment.w = rounded(interval.end - interval.start);
      } else {
        fragment.y = rounded(interval.start);
        fragment.h = rounded(interval.end - interval.start);
      }
      bands.push(fragment);
    });
  }
  return { bands, sources };
}

function clippedPolygonSurface(surface, world) {
  const points = (surface.points || []).map(point => ({
    x: rounded(clamp(point.x, 0, finite(world.width))),
    y: rounded(clamp(point.y, 0, finite(world.height)))
  }));
  const bounds = boundsFromPoints(points);
  return {
    ...surface,
    ...bounds,
    geometry: "polygon",
    points
  };
}

function sidewalkSurfaceAccepted(surface, buildings, roads = []) {
  if (!surface || finite(surface.w) <= EPSILON || finite(surface.h) <= EPSILON) return false;
  if (buildings.some(building => surfaceOverlapArea(surface, building) > EPSILON)) return false;
  return !roads.some(road => surfaceOverlapArea(surface, road) > EPSILON);
}

function junctionSidewalkRect(piece, width, role, side, extra = {}) {
  const values = side === "north"
    ? { x: piece.x, y: piece.y - width, w: piece.w, h: width }
    : side === "south"
      ? { x: piece.x, y: bottom(piece), w: piece.w, h: width }
      : side === "west"
        ? { x: piece.x - width, y: piece.y, w: width, h: piece.h }
        : { x: right(piece), y: piece.y, w: width, h: piece.h };
  return {
    id: `sidewalk-junction:${piece.id}:${role}:${side}`,
    ...values,
    geometry: "rect",
    pieceKind: "junction-sidewalk",
    junctionPieceId: piece.id,
    graphNodeId: piece.graphNodeId,
    graphNodeIds: [...(piece.graphNodeIds || [piece.graphNodeId])],
    side,
    role,
    junctionOwned: true,
    trimEdges: side === "north" || side === "south" ? ["north", "south"] : ["west", "east"],
    anchorKind: role === "closure" ? "junction-closure" : "junction-side",
    generated: true,
    ...extra
  };
}

function junctionCornerPad(piece, width, quadrant) {
  const x = quadrant.x < 0 ? finite(piece.x) - width : right(piece);
  const y = quadrant.y < 0 ? finite(piece.y) - width : bottom(piece);
  const trimEdges = quadrant.id === "nw"
    ? ["north", "west"]
    : quadrant.id === "ne"
      ? ["north", "east"]
      : quadrant.id === "se"
        ? ["south", "east"]
        : ["south", "west"];
  return {
    id: `sidewalk-junction:${piece.id}:corner:${quadrant.id}`,
    x,
    y,
    w: width,
    h: width,
    geometry: "rect",
    pieceKind: "junction-sidewalk",
    junctionPieceId: piece.id,
    graphNodeId: piece.graphNodeId,
    graphNodeIds: [...(piece.graphNodeIds || [piece.graphNodeId])],
    corner: quadrant.id,
    role: "corner",
    junctionOwned: true,
    trimEdges,
    anchorKind: "junction-corner",
    generated: true
  };
}

function transitionSidewalkSurfaces(profile, piece, width, world, buildings, roads) {
  if (!Array.isArray(piece.points) || piece.points.length !== 4) return [];
  const [first, second, third, fourth] = piece.points;
  let surfaces;
  if (profile.legs.every(leg => leg.orientation === "horizontal")) {
    const northOuterA = { x: first.x, y: first.y - width };
    const northOuterB = { x: second.x, y: second.y - width };
    const southOuterA = { x: fourth.x, y: fourth.y + width };
    const southOuterB = { x: third.x, y: third.y + width };
    surfaces = [
      clippedPolygonSurface({
        id: `sidewalk-transition:${piece.id}:north`,
        points: [northOuterA, northOuterB, second, first],
        pieceKind: "junction-sidewalk",
        junctionPieceId: piece.id,
        graphNodeId: piece.graphNodeId,
        graphNodeIds: [...(piece.graphNodeIds || [piece.graphNodeId])],
        side: "north",
        role: "transition-offset",
        junctionOwned: true,
        trimSegments: [[northOuterA, northOuterB], [first, second]],
        anchorKind: "transition-kerb",
        generated: true
      }, world),
      clippedPolygonSurface({
        id: `sidewalk-transition:${piece.id}:south`,
        points: [fourth, third, southOuterB, southOuterA],
        pieceKind: "junction-sidewalk",
        junctionPieceId: piece.id,
        graphNodeId: piece.graphNodeId,
        graphNodeIds: [...(piece.graphNodeIds || [piece.graphNodeId])],
        side: "south",
        role: "transition-offset",
        junctionOwned: true,
        trimSegments: [[fourth, third], [southOuterA, southOuterB]],
        anchorKind: "transition-kerb",
        generated: true
      }, world)
    ];
  } else {
    const westOuterA = { x: first.x - width, y: first.y };
    const westOuterB = { x: fourth.x - width, y: fourth.y };
    const eastOuterA = { x: second.x + width, y: second.y };
    const eastOuterB = { x: third.x + width, y: third.y };
    surfaces = [
      clippedPolygonSurface({
        id: `sidewalk-transition:${piece.id}:west`,
        points: [westOuterA, first, fourth, westOuterB],
        pieceKind: "junction-sidewalk",
        junctionPieceId: piece.id,
        graphNodeId: piece.graphNodeId,
        graphNodeIds: [...(piece.graphNodeIds || [piece.graphNodeId])],
        side: "west",
        role: "transition-offset",
        junctionOwned: true,
        trimSegments: [[westOuterA, westOuterB], [first, fourth]],
        anchorKind: "transition-kerb",
        generated: true
      }, world),
      clippedPolygonSurface({
        id: `sidewalk-transition:${piece.id}:east`,
        points: [second, eastOuterA, eastOuterB, third],
        pieceKind: "junction-sidewalk",
        junctionPieceId: piece.id,
        graphNodeId: piece.graphNodeId,
        graphNodeIds: [...(piece.graphNodeIds || [piece.graphNodeId])],
        side: "east",
        role: "transition-offset",
        junctionOwned: true,
        trimSegments: [[second, third], [eastOuterA, eastOuterB]],
        anchorKind: "transition-kerb",
        generated: true
      }, world)
    ];
  }
  return surfaces.filter(surface => sidewalkSurfaceAccepted(surface, buildings, roads));
}

function junctionOwnedSidewalks(profiles, pieceByNode, width, world, buildings, roads) {
  const surfaces = [];
  const quadrants = [
    { id: "nw", x: -1, y: -1 },
    { id: "ne", x: 1, y: -1 },
    { id: "se", x: 1, y: 1 },
    { id: "sw", x: -1, y: 1 }
  ];
  const profileByNode = new Map(profiles.map(profile => [profile.node.id, profile]));
  const uniquePieces = [...new Map([...pieceByNode.values()].map(piece => [piece.id, piece])).values()];

  for (const piece of uniquePieces) {
    const owners = (piece.graphNodeIds || [piece.graphNodeId]).map(id => profileByNode.get(id)).filter(Boolean);
    if (!owners.length) continue;
    if (owners.length === 1 && owners[0].kind === "transition") {
      surfaces.push(...transitionSidewalkSurfaces(owners[0], piece, width, world, buildings, roads));
      continue;
    }

    const directions = new Set(owners.flatMap(profile => profile.legs.map(leg => leg.direction)));
    const hasHorizontal = owners.some(profile => profile.hasHorizontal);
    const hasVertical = owners.some(profile => profile.hasVertical);
    const allStraight = owners.every(profile => profile.kind === "straight");

    if (!allStraight) {
      for (const quadrant of quadrants) {
        const pad = clippedRect(junctionCornerPad(piece, width, quadrant), world);
        if (sidewalkSurfaceAccepted(pad, buildings, roads)) surfaces.push(pad);
      }
    }

    const closureSides = new Set();
    if (allStraight) {
      if (hasHorizontal) closureSides.add("north").add("south");
      if (hasVertical) closureSides.add("west").add("east");
    } else {
      if (hasHorizontal) {
        if (!directions.has("north")) closureSides.add("north");
        if (!directions.has("south")) closureSides.add("south");
      }
      if (hasVertical) {
        if (!directions.has("west")) closureSides.add("west");
        if (!directions.has("east")) closureSides.add("east");
      }
      for (const owner of owners.filter(profile => profile.kind === "end" && profile.legs.length === 1)) {
        closureSides.add(opposite(owner.legs[0].direction));
      }
    }

    for (const side of closureSides) {
      const closure = clippedRect(junctionSidewalkRect(piece, width, "closure", side), world);
      if (sidewalkSurfaceAccepted(closure, buildings, roads)) surfaces.push(closure);
    }
  }

  return surfaces;
}

function crosswalkForLeg(profile, piece, leg, thickness, inset, world) {
  const node = profile.node;
  let crosswalk;
  if (leg.direction === "east") {
    crosswalk = {
      x: right(piece) + inset,
      y: finite(node.y) - leg.width / 2,
      w: thickness,
      h: leg.width,
      orientation: "vertical"
    };
  } else if (leg.direction === "west") {
    crosswalk = {
      x: finite(piece.x) - inset - thickness,
      y: finite(node.y) - leg.width / 2,
      w: thickness,
      h: leg.width,
      orientation: "vertical"
    };
  } else if (leg.direction === "south") {
    crosswalk = {
      x: finite(node.x) - leg.width / 2,
      y: bottom(piece) + inset,
      w: leg.width,
      h: thickness,
      orientation: "horizontal"
    };
  } else {
    crosswalk = {
      x: finite(node.x) - leg.width / 2,
      y: finite(piece.y) - inset - thickness,
      w: leg.width,
      h: thickness,
      orientation: "horizontal"
    };
  }
  const clipped = clippedRect({
    id: `crosswalk:${profile.node.id}:${leg.direction}`,
    ...crosswalk,
    geometry: "rect",
    graphNodeId: profile.node.id,
    graphEdgeId: leg.edge.id,
    leg: leg.direction,
    generated: true
  }, world);
  return clipped.w > EPSILON && clipped.h > EPSILON ? clipped : null;
}

function crosswalkContinuationPoints(crosswalk) {
  return crosswalk.orientation === "horizontal"
    ? [
        { x: crosswalk.x - 1, y: crosswalk.y + crosswalk.h / 2 },
        { x: crosswalk.x + crosswalk.w + 1, y: crosswalk.y + crosswalk.h / 2 }
      ]
    : [
        { x: crosswalk.x + crosswalk.w / 2, y: crosswalk.y - 1 },
        { x: crosswalk.x + crosswalk.w / 2, y: crosswalk.y + crosswalk.h + 1 }
      ];
}

function buildCrosswalks(profiles, pieceByNode, sidewalks, world, options) {
  const candidates = [];
  const junctionPieces = [...new Map([...pieceByNode.values()].map(piece => [piece.id, piece])).values()];
  for (const profile of profiles) {
    if (!["t-junction", "crossroad", "complex"].includes(profile.kind)) continue;
    const piece = pieceByNode.get(profile.node.id);
    const majorLegs = profile.legs.filter(leg => leg.edge.roadClass === "major");
    const eligibleLegs = majorLegs.length >= 2
      ? profile.legs.filter(leg => leg.edge.roadClass !== "alley")
      : majorLegs.length === 1
        ? profile.legs.filter(leg => leg.edge.roadClass === "local")
        : [];
    for (const leg of eligibleLegs) {
      const otherNodeId = leg.edge.from === profile.node.id ? leg.edge.to : leg.edge.from;
      if (pieceByNode.get(otherNodeId)?.id === piece.id) continue;
      const crosswalk = crosswalkForLeg(
        profile,
        piece,
        leg,
        options.crosswalkThickness,
        options.crosswalkInset,
        world
      );
      if (crosswalk) candidates.push(crosswalk);
    }
  }
  const result = [];
  for (const candidate of candidates.sort((left, rightValue) => left.id.localeCompare(rightValue.id))) {
    if (junctionPieces.some(piece => surfaceOverlapArea(piece, candidate) > 0.01)) continue;
    if (!crosswalkContinuationPoints(candidate).every(point => sidewalks.some(sidewalk => pointInSurface(point, sidewalk, 1.5)))) continue;
    if (result.some(existing => surfaceOverlapArea(existing, candidate) > 0.01)) continue;
    result.push(candidate);
  }
  return result;
}

function stripLength(strip) {
  if (strip.orientation === "horizontal") return finite(strip.w);
  if (strip.orientation === "vertical") return finite(strip.h);
  return strip.w >= strip.h ? finite(strip.w) : finite(strip.h);
}

function kerbPoint(strip, distance, inset = 4) {
  if (strip.w >= strip.h) {
    return {
      x: rounded(finite(strip.x) + distance),
      y: rounded(strip.side === "north" ? finite(strip.y) + inset : bottom(strip) - inset)
    };
  }
  return {
    x: rounded(strip.side === "west" ? finite(strip.x) + inset : right(strip) - inset),
    y: rounded(finite(strip.y) + distance)
  };
}

function projectedKerbPoint(strip, anchor, inset = 4, endClearance = 28) {
  const length = stripLength(strip);
  const clearance = Math.min(Math.max(4, endClearance), Math.max(4, length / 2));
  const distance = strip.w >= strip.h
    ? clamp(finite(anchor.x) - finite(strip.x), clearance, length - clearance)
    : clamp(finite(anchor.y) - finite(strip.y), clearance, length - clearance);
  return kerbPoint(strip, distance, inset);
}

function stripRoadClass(strip, edgeById) {
  return edgeById.get(strip.graphEdgeId)?.roadClass || "local";
}

function spacingForClass(roadClass, options) {
  if (roadClass === "major") return options.lightSpacingMajor;
  if (roadClass === "alley") return options.lightSpacingAlley;
  return options.lightSpacingLocal;
}

function shouldUseStrip(strip, roadClass) {
  if (roadClass === "major") return true;
  if (strip.side === "north" || strip.side === "west") return true;
  return false;
}

function buildPropExclusionZones(profiles, pieceByNode, crosswalks, world, options) {
  const zones = [];
  const uniquePieces = [...new Map([...pieceByNode.values()].map(piece => [piece.id, piece])).values()];
  for (const piece of uniquePieces) {
    zones.push(clippedRect({
      id: `prop-exclusion:junction:${piece.id}`,
      ...expandedRect(piece, options.sidewalkWidth + options.propJunctionClearance),
      geometry: "rect",
      exclusionKind: "junction-envelope",
      junctionPieceId: piece.id,
      graphNodeId: piece.graphNodeId,
      graphNodeIds: [...(piece.graphNodeIds || [piece.graphNodeId])],
      generated: true
    }, world));
  }

  for (const profile of profiles) {
    const piece = pieceByNode.get(profile.node.id);
    for (const leg of profile.legs) {
      const lateral = leg.width / 2 + options.sidewalkWidth + options.propApproachClearance;
      const length = options.propApproachLength;
      const values = leg.direction === "east"
        ? { x: right(piece), y: finite(profile.node.y) - lateral, w: length, h: lateral * 2 }
        : leg.direction === "west"
          ? { x: finite(piece.x) - length, y: finite(profile.node.y) - lateral, w: length, h: lateral * 2 }
          : leg.direction === "south"
            ? { x: finite(profile.node.x) - lateral, y: bottom(piece), w: lateral * 2, h: length }
            : { x: finite(profile.node.x) - lateral, y: finite(piece.y) - length, w: lateral * 2, h: length };
      const zone = clippedRect({
        id: `prop-exclusion:approach:${profile.node.id}:${leg.direction}`,
        ...values,
        geometry: "rect",
        exclusionKind: "junction-approach",
        graphNodeId: profile.node.id,
        graphEdgeId: leg.edge.id,
        leg: leg.direction,
        generated: true
      }, world);
      if (zone.w > EPSILON && zone.h > EPSILON) zones.push(zone);
    }
  }

  for (const crosswalk of crosswalks) {
    const zone = clippedRect({
      id: `prop-exclusion:crosswalk:${crosswalk.id}`,
      ...expandedRect(crosswalk, options.propCrosswalkClearance),
      geometry: "rect",
      exclusionKind: "crosswalk-clearance",
      graphNodeId: crosswalk.graphNodeId,
      graphEdgeId: crosswalk.graphEdgeId,
      generated: true
    }, world);
    if (zone.w > EPSILON && zone.h > EPSILON) zones.push(zone);
  }

  return zones;
}

function lightCandidateValid(point, context) {
  if (point.x < context.margin || point.y < context.margin) return false;
  if (point.x > context.world.width - context.margin || point.y > context.world.height - context.margin) return false;
  if (!context.sidewalks.some(sidewalk => pointInSurface(point, sidewalk))) return false;
  if (context.roads.some(road => pointInSurface(point, road))) return false;
  if (context.propExclusionZones.some(zone => pointInSurface(point, zone))) return false;
  if (pointNearSurface(point, context.buildings, context.buildingClearance)) return false;
  if (context.accepted.some(light => distanceToPoint(light, point) < context.minimumSpacing)) return false;
  return true;
}

function nearestValidSidewalkPoint(anchor, context, maxDistance = 180) {
  const candidates = [];
  for (const sidewalk of context.sidewalks.filter(item => item.graphEdgeId && item.side)) {
    const point = projectedKerbPoint(
      sidewalk,
      anchor,
      context.kerbInset,
      context.endClearance
    );
    const distance = distanceToPoint(anchor, point);
    if (distance <= maxDistance) candidates.push({ point, distance, sidewalk });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.sidewalk.id.localeCompare(b.sidewalk.id));
  return candidates.find(candidate => lightCandidateValid(candidate.point, context)) || null;
}

function buildLights({
  graph,
  segments,
  sidewalks,
  crosswalks,
  junctions,
  propExclusionZones,
  buildings,
  world,
  options
}) {
  const edgeById = new Map(graph.edges.map(edge => [edge.id, edge]));
  const accepted = [];
  const context = {
    roads: [...segments, ...junctions],
    sidewalks,
    crosswalks,
    propExclusionZones,
    buildings,
    world,
    margin: options.lightWorldMargin,
    buildingClearance: options.lightBuildingClearance,
    minimumSpacing: options.lightMinimumSpacing,
    kerbInset: options.lightKerbInset,
    endClearance: options.lightEndClearance,
    accepted
  };

  for (const anchor of graph.authoredLightAnchors || []) {
    const candidate = nearestValidSidewalkPoint(anchor, context, options.authoredLightSnapDistance);
    if (!candidate) continue;
    accepted.push({
      id: String(anchor.id),
      x: candidate.point.x,
      y: candidate.point.y,
      radius: finite(anchor.radius, 72),
      name: String(anchor.name || anchor.id),
      layer: 0,
      semantic: true,
      generated: true,
      graphEdgeId: candidate.sidewalk.graphEdgeId,
      sidewalkId: candidate.sidewalk.id,
      kerbSide: candidate.sidewalk.side,
      anchorKind: "kerb-light",
      placementPhase: "post-layout"
    });
  }

  for (const strip of sidewalks.filter(item => item.graphEdgeId && item.side)) {
    const roadClass = stripRoadClass(strip, edgeById);
    if (!shouldUseStrip(strip, roadClass)) continue;
    const spacing = spacingForClass(roadClass, options);
    const length = stripLength(strip);
    const margin = Math.max(options.lightEndClearance, spacing * 0.28);
    const usable = length - margin * 2;
    if (usable <= 0) continue;
    const count = Math.max(1, Math.floor(usable / spacing) + 1);
    for (let index = 0; index < count; index++) {
      const distance = count === 1 ? length / 2 : margin + usable * (index / (count - 1));
      const point = kerbPoint(strip, distance, options.lightKerbInset);
      if (!lightCandidateValid(point, context)) continue;
      const fragmentToken = strip.sourceStripId && strip.id !== strip.sourceStripId
        ? `:f${String(finite(strip.fragmentIndex) + 1).padStart(2, "0")}`
        : "";
      accepted.push({
        id: `lamp:${strip.graphEdgeId}:${strip.side}${fragmentToken}:${String(index + 1).padStart(2, "0")}`,
        x: rounded(point.x),
        y: rounded(point.y),
        radius: options.lightRadius,
        name: `${edgeById.get(strip.graphEdgeId)?.label || "Street"} post-layout light`,
        layer: 0,
        generated: true,
        graphEdgeId: strip.graphEdgeId,
        sidewalkId: strip.id,
        kerbSide: strip.side,
        anchorKind: "kerb-light",
        placementPhase: "post-layout"
      });
    }
  }
  return accepted;
}

function streetFurnitureCandidateValid(point, context) {
  if (point.x < context.margin || point.y < context.margin) return false;
  if (point.x > context.world.width - context.margin || point.y > context.world.height - context.margin) return false;
  if (pointNearSurface(point, context.roads, context.roadClearance)) return false;
  if (pointNearSurface(point, context.crosswalks, context.crosswalkClearance)) return false;
  if (context.propExclusionZones.some(zone => pointInSurface(point, zone))) return false;
  if (pointNearSurface(point, context.buildings, context.buildingClearance)) return false;
  if (context.lights.some(light => distanceToPoint(light, point) < context.lightClearance)) return false;
  if (context.accepted.some(prop => distanceToPoint(prop, point) < context.minimumSpacing)) return false;
  return true;
}

function radialServiceCandidates(anchor, maxDistance, step = 24) {
  const candidates = [];
  for (let radius = step; radius <= maxDistance; radius += step) {
    for (let index = 0; index < 16; index++) {
      const angle = index * Math.PI * 2 / 16;
      candidates.push({
        x: rounded(finite(anchor.x) + Math.cos(angle) * radius),
        y: rounded(finite(anchor.y) + Math.sin(angle) * radius),
        distance: radius,
        anchorKind: "service-yard"
      });
    }
  }
  return candidates;
}

export function placePostLayoutDumpsters(dumpsters = [], {
  roads = [],
  sidewalks = [],
  crosswalks = [],
  propExclusionZones = [],
  buildings = [],
  lights = [],
  world,
  kerbInset = 4,
  endClearance = 36,
  snapDistance = 260,
  worldMargin = 20,
  roadClearance = 6,
  crosswalkClearance = 24,
  buildingClearance = 18,
  lightClearance = 42,
  minimumSpacing = 90
} = {}) {
  const accepted = [];
  const strips = sidewalks.filter(item => item.graphEdgeId && item.side);
  const context = {
    roads,
    sidewalks,
    crosswalks,
    propExclusionZones,
    buildings,
    lights,
    world,
    margin: worldMargin,
    roadClearance,
    crosswalkClearance,
    buildingClearance,
    lightClearance,
    minimumSpacing,
    accepted
  };

  for (const definition of dumpsters) {
    const sourceAnchor = { x: finite(definition.x), y: finite(definition.y) };
    let point = sourceAnchor;
    let anchorKind = "service-yard";
    let sidewalk = null;

    if (!streetFurnitureCandidateValid(point, context)) {
      const kerbCandidates = strips.map(strip => {
        const candidate = projectedKerbPoint(strip, sourceAnchor, kerbInset, endClearance);
        return {
          point: candidate,
          sidewalk: strip,
          distance: distanceToPoint(sourceAnchor, candidate),
          anchorKind: "service-kerb"
        };
      }).filter(candidate => candidate.distance <= snapDistance)
        .sort((left, rightValue) => left.distance - rightValue.distance || left.sidewalk.id.localeCompare(rightValue.sidewalk.id));
      const kerb = kerbCandidates.find(candidate => streetFurnitureCandidateValid(candidate.point, context));
      if (kerb) {
        point = kerb.point;
        sidewalk = kerb.sidewalk;
        anchorKind = kerb.anchorKind;
      } else {
        const yard = radialServiceCandidates(sourceAnchor, snapDistance)
          .find(candidate => streetFurnitureCandidateValid(candidate, context));
        if (!yard) throw new Error(`Unable to place street furniture ${definition.id} outside road exclusions.`);
        point = yard;
        anchorKind = yard.anchorKind;
      }
    }

    const placed = {
      ...definition,
      x: rounded(point.x),
      y: rounded(point.y),
      generated: true,
      placementPhase: "post-layout",
      anchorKind,
      sourceAnchor,
      ...(sidewalk ? {
        graphEdgeId: sidewalk.graphEdgeId,
        sidewalkId: sidewalk.id,
        kerbSide: sidewalk.side
      } : {})
    };
    accepted.push(placed);
  }

  return accepted;
}

export function deriveAxisAlignedRoadGraph(roads = [], {
  tolerance = 0.01,
  authoredLightAnchors = [],
  pedestrianRouteAnchors = [],
  corridors = []
} = {}) {
  const lines = pruneSubsumedParallelLines(roads.map(roadLine), tolerance);
  const splitById = new Map(lines.map(line => [line.id, new Set([line.start, line.end])]));
  const extensionById = new Map(lines.map(line => [line.id, { start: line.start, end: line.end }]));

  for (let leftIndex = 0; leftIndex < lines.length; leftIndex++) {
    const leftLine = lines[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < lines.length; rightIndex++) {
      const rightLine = lines[rightIndex];
      if (leftLine.orientation !== rightLine.orientation) {
        const horizontal = leftLine.orientation === "horizontal" ? leftLine : rightLine;
        const vertical = leftLine.orientation === "vertical" ? leftLine : rightLine;
        const connection = perpendicularConnection(horizontal, vertical, tolerance);
        if (!connection) continue;
        const horizontalSplits = splitById.get(horizontal.id);
        const verticalSplits = splitById.get(vertical.id);
        const horizontalExtension = extensionById.get(horizontal.id);
        const verticalExtension = extensionById.get(vertical.id);
        if (Math.abs(connection.x - horizontal.start) <= (vertical.width + horizontal.width) / 2 + tolerance || connection.x < horizontal.start) {
          horizontalSplits.delete(horizontal.start);
          horizontalExtension.start = connection.x < horizontal.start
            ? connection.x
            : Math.max(horizontalExtension.start, connection.x);
        }
        if (Math.abs(connection.x - horizontal.end) <= (vertical.width + horizontal.width) / 2 + tolerance || connection.x > horizontal.end) {
          horizontalSplits.delete(horizontal.end);
          horizontalExtension.end = connection.x > horizontal.end
            ? connection.x
            : Math.min(horizontalExtension.end, connection.x);
        }
        if (Math.abs(connection.y - vertical.start) <= (horizontal.width + vertical.width) / 2 + tolerance || connection.y < vertical.start) {
          verticalSplits.delete(vertical.start);
          verticalExtension.start = connection.y < vertical.start
            ? connection.y
            : Math.max(verticalExtension.start, connection.y);
        }
        if (Math.abs(connection.y - vertical.end) <= (horizontal.width + vertical.width) / 2 + tolerance || connection.y > vertical.end) {
          verticalSplits.delete(vertical.end);
          verticalExtension.end = connection.y > vertical.end
            ? connection.y
            : Math.min(verticalExtension.end, connection.y);
        }
        horizontalSplits.add(connection.x);
        verticalSplits.add(connection.y);
        continue;
      }

      if (Math.abs(leftLine.fixed - rightLine.fixed) > tolerance) continue;
      if (!intervalsTouch(leftLine, rightLine, tolerance)) continue;
      for (const value of [rightLine.start, rightLine.end]) {
        if (value >= leftLine.start - tolerance && value <= leftLine.end + tolerance) splitById.get(leftLine.id).add(value);
      }
      for (const value of [leftLine.start, leftLine.end]) {
        if (value >= rightLine.start - tolerance && value <= rightLine.end + tolerance) splitById.get(rightLine.id).add(value);
      }
    }
  }

  const candidates = [];
  for (const line of lines) {
    const extension = extensionById.get(line.id);
    const coordinates = sortedUnique([
      ...splitById.get(line.id),
      extension.start,
      extension.end
    ]).filter(value => value >= extension.start - tolerance && value <= extension.end + tolerance);
    for (let index = 0; index < coordinates.length - 1; index++) {
      const start = coordinates[index];
      const end = coordinates[index + 1];
      if (end - start <= tolerance) continue;
      candidates.push({
        a: pointFor(line, start),
        b: pointFor(line, end),
        orientation: line.orientation,
        width: line.width,
        roadClass: line.roadClass,
        kind: line.kind,
        label: line.label,
        sourceRoadIds: [...new Set([
          ...(line.sourceRoadIds || [line.id]),
          ...(line.absorbedSourceIds || [])
        ].flatMap(id => String(id).split("+")))].sort(),
        generated: line.generated
      });
    }
  }

  const atomic = mergeAtomicEdges(candidates);
  const nodeRecords = new Map();
  for (const edge of atomic) {
    for (const point of [edge.a, edge.b]) {
      const key = pointKey(point);
      const record = nodeRecords.get(key) || {
        id: `road-node:${key}`,
        x: rounded(point.x),
        y: rounded(point.y),
        sourceRoadIds: new Set()
      };
      for (const sourceId of edge.sourceRoadIds) record.sourceRoadIds.add(sourceId);
      nodeRecords.set(key, record);
    }
  }
  const nodes = [...nodeRecords.values()]
    .sort((left, rightValue) => left.y - rightValue.y || left.x - rightValue.x)
    .map(record => ({ ...record, sourceRoadIds: [...record.sourceRoadIds].sort() }));
  const nodeIdByKey = new Map(nodes.map(node => [pointKey(node), node.id]));
  const edges = atomic
    .sort((left, rightValue) => (
      left.a.y - rightValue.a.y || left.a.x - rightValue.a.x || left.b.y - rightValue.b.y || left.b.x - rightValue.b.x
    ))
    .map(edge => {
      const fromPoint = pointKey(edge.a) <= pointKey(edge.b) ? edge.a : edge.b;
      const toPoint = fromPoint === edge.a ? edge.b : edge.a;
      const id = `road-edge:${edge.orientation === "horizontal" ? "h" : "v"}:${pointKey(fromPoint)}:${pointKey(toPoint)}`;
      return {
        id,
        from: nodeIdByKey.get(pointKey(fromPoint)),
        to: nodeIdByKey.get(pointKey(toPoint)),
        width: rounded(edge.width),
        orientation: edge.orientation,
        roadClass: edge.roadClass,
        kind: edge.kind,
        label: edge.label,
        sourceRoadIds: [...edge.sourceRoadIds],
        generated: edge.generated
      };
    });
  return {
    version: 1,
    geometry: "axis-aligned-centreline-graph",
    nodes,
    edges,
    corridors: [...corridors],
    authoredLightAnchors: [...authoredLightAnchors],
    pedestrianRouteAnchors: [...pedestrianRouteAnchors]
  };
}

export function compileAxisAlignedRoadGraph(graph, {
  world,
  buildings = [],
  sidewalkWidth = 22,
  crosswalkThickness = 14,
  crosswalkInset = 8,
  propJunctionClearance = 10,
  propApproachClearance = 8,
  propApproachLength = 92,
  propCrosswalkClearance = 24,
  minimumApproachLength = 36,
  minimumSidewalkFragmentLength = 36,
  lightRadius = 64,
  lightSpacingMajor = 360,
  lightSpacingLocal = 300,
  lightSpacingAlley = 260,
  lightEndClearance = 70,
  lightWorldMargin = 8,
  lightBuildingClearance = 12,
  lightMinimumSpacing = 150,
  lightKerbInset = 5,
  authoredLightSnapDistance = 220
} = {}) {
  if (!graph?.nodes?.length || !graph?.edges?.length) throw new TypeError("Road graph requires nodes and edges.");
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
  const edgeById = new Map(graph.edges.map(edge => [edge.id, edge]));
  const incidentByNode = new Map(graph.nodes.map(node => [node.id, []]));
  for (const edge of graph.edges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) throw new Error(`Road edge ${edge.id} references a missing node.`);
    incidentByNode.get(edge.from).push(edge);
    incidentByNode.get(edge.to).push(edge);
  }
  const profiles = graph.nodes.map(node => classifyNode(node, incidentByNode.get(node.id), nodeById));
  const { pieces, pieceByNode, absorbedShortApproachEdgeIds } = junctionAuthorities(
    profiles,
    world,
    graph.edges,
    minimumApproachLength
  );
  const profileByNode = new Map(profiles.map(profile => [profile.node.id, profile]));
  const segments = graph.edges.map(edge => segmentForEdge(
    edge,
    profileByNode.get(edge.from),
    profileByNode.get(edge.to),
    pieceByNode.get(edge.from),
    pieceByNode.get(edge.to),
    nodeById
  )).filter(Boolean);
  const junctions = pieces.filter(Boolean);
  const roads = [...segments, ...junctions];
  const baseRoadEdgeBands = sidewalkStrips(segments, sidewalkWidth, world);
  const { bands: roadEdgeBands, sources: roadEdgeBandSources } = buildRoadEdgeBands(
    baseRoadEdgeBands,
    [...buildings, ...roads],
    minimumSidewalkFragmentLength
  );
  const junctionSidewalks = junctionOwnedSidewalks(
    profiles,
    pieceByNode,
    sidewalkWidth,
    world,
    buildings,
    roads
  );
  const sidewalks = [...roadEdgeBands, ...junctionSidewalks];
  const options = {
    sidewalkWidth,
    crosswalkThickness,
    crosswalkInset,
    propJunctionClearance,
    propApproachClearance,
    propApproachLength,
    propCrosswalkClearance,
    minimumApproachLength,
    minimumSidewalkFragmentLength,
    lightRadius,
    lightSpacingMajor,
    lightSpacingLocal,
    lightSpacingAlley,
    lightEndClearance,
    lightWorldMargin,
    lightBuildingClearance,
    lightMinimumSpacing,
    lightKerbInset,
    authoredLightSnapDistance
  };
  const crosswalks = buildCrosswalks(profiles, pieceByNode, sidewalks, world, options);
  const propExclusionZones = buildPropExclusionZones(profiles, pieceByNode, crosswalks, world, options);
  const lights = buildLights({
    graph,
    segments,
    sidewalks,
    crosswalks,
    junctions,
    propExclusionZones,
    buildings,
    world,
    options
  });
  return {
    graph: {
      ...graph,
      nodes: graph.nodes.map(node => ({
        ...node,
        junctionKind: profileByNode.get(node.id).kind,
        degree: incidentByNode.get(node.id).length
      })),
      edges: [...graph.edges]
    },
    roads,
    roadSegments: segments,
    roadJunctions: junctions.filter(piece => piece.pieceKind === "junction"),
    roadTransitions: junctions.filter(piece => piece.pieceKind === "transition"),
    sidewalks,
    roadEdgeBands,
    roadEdgeBandSources,
    junctionSidewalks,
    crosswalks,
    propExclusionZones,
    buildingObstacles: [...buildings],
    lights,
    stats: {
      graphNodeCount: graph.nodes.length,
      graphEdgeCount: graph.edges.length,
      roadPieceCount: roads.length,
      roadSegmentCount: segments.length,
      junctionCount: junctions.length,
      transitionCount: junctions.filter(piece => piece.pieceKind === "transition").length,
      sidewalkCount: sidewalks.length,
      roadEdgeBandCount: roadEdgeBands.length,
      roadEdgeBandSourceCount: roadEdgeBandSources.length,
      absorbedShortApproachCount: absorbedShortApproachEdgeIds.length,
      junctionSidewalkCount: junctionSidewalks.length,
      crosswalkCount: crosswalks.length,
      propExclusionZoneCount: propExclusionZones.length,
      lightCount: lights.length
    }
  };
}

export function roadGraphIntegrity(graph, compiled = null) {
  const errors = [];
  const nodes = new Map((graph?.nodes || []).map(node => [node.id, node]));
  const edges = graph?.edges || [];
  const duplicateNodeIds = graph?.nodes?.filter((node, index, all) => all.findIndex(item => item.id === node.id) !== index) || [];
  const duplicateEdgeIds = edges.filter((edge, index, all) => all.findIndex(item => item.id === edge.id) !== index);
  if (duplicateNodeIds.length) errors.push({ code: "ROAD_GRAPH_DUPLICATE_NODE", ids: duplicateNodeIds.map(node => node.id) });
  if (duplicateEdgeIds.length) errors.push({ code: "ROAD_GRAPH_DUPLICATE_EDGE", ids: duplicateEdgeIds.map(edge => edge.id) });
  for (const edge of edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) {
      errors.push({ code: "ROAD_GRAPH_MISSING_NODE", edgeId: edge.id, from: edge.from, to: edge.to });
      continue;
    }
    if (Math.abs(from.x - to.x) > EPSILON && Math.abs(from.y - to.y) > EPSILON) {
      errors.push({ code: "ROAD_GRAPH_DIAGONAL_EDGE", edgeId: edge.id });
    }
    if (!(finite(edge.width) > 0)) errors.push({ code: "ROAD_GRAPH_INVALID_WIDTH", edgeId: edge.id });
  }
  for (let leftIndex = 0; leftIndex < edges.length; leftIndex++) {
    const leftEdge = edges[leftIndex];
    const leftFrom = nodes.get(leftEdge.from);
    const leftTo = nodes.get(leftEdge.to);
    if (!leftFrom || !leftTo) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < edges.length; rightIndex++) {
      const rightEdge = edges[rightIndex];
      if (leftEdge.orientation !== rightEdge.orientation) continue;
      const rightFrom = nodes.get(rightEdge.from);
      const rightTo = nodes.get(rightEdge.to);
      if (!rightFrom || !rightTo) continue;
      const horizontal = leftEdge.orientation === "horizontal";
      const leftFixed = horizontal ? finite(leftFrom.y) : finite(leftFrom.x);
      const rightFixed = horizontal ? finite(rightFrom.y) : finite(rightFrom.x);
      const centerlineGap = Math.abs(leftFixed - rightFixed);
      if (centerlineGap <= EPSILON) continue;
      const leftStart = horizontal ? Math.min(finite(leftFrom.x), finite(leftTo.x)) : Math.min(finite(leftFrom.y), finite(leftTo.y));
      const leftEnd = horizontal ? Math.max(finite(leftFrom.x), finite(leftTo.x)) : Math.max(finite(leftFrom.y), finite(leftTo.y));
      const rightStart = horizontal ? Math.min(finite(rightFrom.x), finite(rightTo.x)) : Math.min(finite(rightFrom.y), finite(rightTo.y));
      const rightEnd = horizontal ? Math.max(finite(rightFrom.x), finite(rightTo.x)) : Math.max(finite(rightFrom.y), finite(rightTo.y));
      const overlap = Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart));
      const blockDepth = centerlineGap - (finite(leftEdge.width) + finite(rightEdge.width)) / 2;
      if (overlap >= MINIMUM_PARALLEL_ROAD_OVERLAP && blockDepth < MINIMUM_PARALLEL_ROAD_BLOCK_DEPTH - EPSILON) {
        errors.push({
          code: "ROAD_GRAPH_PARALLEL_ROADS_TOO_CLOSE",
          leftEdgeId: leftEdge.id,
          rightEdgeId: rightEdge.id,
          overlap: rounded(overlap),
          blockDepth: rounded(blockDepth),
          requiredBlockDepth: MINIMUM_PARALLEL_ROAD_BLOCK_DEPTH
        });
      }
    }
  }
  if (compiled) {
    const junctionOwners = new Map();
    for (const piece of [...(compiled.roadJunctions || []), ...(compiled.roadTransitions || [])]) {
      for (const nodeId of piece.graphNodeIds || [piece.graphNodeId]) {
        junctionOwners.set(nodeId, (junctionOwners.get(nodeId) || 0) + 1);
      }
    }
    for (const node of graph.nodes || []) {
      if (junctionOwners.get(node.id) !== 1) {
        errors.push({ code: "ROAD_NODE_JUNCTION_AUTHORITY", nodeId: node.id, count: junctionOwners.get(node.id) || 0 });
      }
    }
    const roads = compiled.roads || [];
    for (let leftIndex = 0; leftIndex < roads.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < roads.length; rightIndex++) {
        const overlap = surfaceOverlapArea(roads[leftIndex], roads[rightIndex]);
        if (overlap > 0.01) {
          errors.push({
            code: "ROAD_PIECE_OVERLAP",
            leftId: roads[leftIndex].id,
            rightId: roads[rightIndex].id,
            overlap
          });
        }
      }
    }
    const roadEdgeBandsBySource = new Map();
    for (const band of compiled.roadEdgeBands || []) {
      const sourceId = band.sourceStripId || band.id;
      const items = roadEdgeBandsBySource.get(sourceId) || [];
      items.push(band);
      roadEdgeBandsBySource.set(sourceId, items);
      if (stripLength(band) < finite(band.minimumFragmentLength, 0) - EPSILON) {
        errors.push({ code: "ROAD_EDGE_BAND_FRAGMENT_TOO_SHORT", bandId: band.id, length: stripLength(band) });
      }
      for (const road of roads) {
        const overlap = surfaceOverlapArea(band, road);
        if (overlap > 0.01) errors.push({ code: "ROAD_EDGE_BAND_ROAD_OVERLAP", bandId: band.id, roadId: road.id, overlap });
      }
      for (const building of compiled.buildingObstacles || []) {
        const overlap = surfaceOverlapArea(band, building);
        if (overlap > 0.01) errors.push({ code: "ROAD_EDGE_BAND_BUILDING_OVERLAP", bandId: band.id, buildingId: building.id, overlap });
      }
    }
    for (const source of compiled.roadEdgeBandSources || []) {
      const covered = (roadEdgeBandsBySource.get(source.id) || []).reduce((sum, band) => sum + stripLength(band), 0);
      if (Math.abs(covered - finite(source.openLength)) > 0.01) {
        errors.push({ code: "ROAD_EDGE_BAND_COVERAGE", sourceId: source.id, expected: source.openLength, actual: rounded(covered) });
      }
      if (finite(source.openLength) >= finite(source.minimumFragmentLength, 0) && !(roadEdgeBandsBySource.get(source.id) || []).length) {
        errors.push({ code: "ROAD_EDGE_BAND_MISSING", sourceId: source.id, openLength: source.openLength });
      }
    }

    for (const sidewalk of compiled.junctionSidewalks || []) {
      for (const road of roads) {
        const overlap = surfaceOverlapArea(sidewalk, road);
        if (overlap > 0.01) {
          errors.push({ code: "JUNCTION_SIDEWALK_ROAD_OVERLAP", sidewalkId: sidewalk.id, roadId: road.id, overlap });
        }
      }
      for (const building of compiled.buildingObstacles || []) {
        const overlap = surfaceOverlapArea(sidewalk, building);
        if (overlap > 0.01) {
          errors.push({ code: "JUNCTION_SIDEWALK_BUILDING_OVERLAP", sidewalkId: sidewalk.id, buildingId: building.id, overlap });
        }
      }
    }
    for (const zone of compiled.propExclusionZones || []) {
      if (!(finite(zone.w) > EPSILON) || !(finite(zone.h) > EPSILON)) {
        errors.push({ code: "PROP_EXCLUSION_INVALID_BOUNDS", zoneId: zone.id });
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function buildPedestrianRoutesFromSidewalks(routeAnchors = [], sidewalks = [], {
  minimumLength = 140,
  endpointInset = 28
} = {}) {
  const candidates = sidewalks
    .filter(sidewalk => sidewalk.graphEdgeId && stripLength(sidewalk) >= minimumLength)
    .map(sidewalk => ({
      sidewalk,
      center: { x: sidewalk.x + sidewalk.w / 2, y: sidewalk.y + sidewalk.h / 2 },
      length: stripLength(sidewalk)
    }));
  const used = new Set();
  const routes = [];
  for (const anchor of routeAnchors) {
    const center = anchor.center || {
      x: anchor.bounds.x + anchor.bounds.w / 2,
      y: anchor.bounds.y + anchor.bounds.h / 2
    };
    const ranked = candidates.map(candidate => {
      const intersectsPreferred = surfaceOverlapArea(candidate.sidewalk, anchor.bounds) > 0.01;
      const distance = distanceToPoint(center, candidate.center);
      const reusePenalty = used.has(candidate.sidewalk.id) ? 10000 : 0;
      return {
        ...candidate,
        score: distance + reusePenalty + (intersectsPreferred ? 0 : 1200)
      };
    }).sort((left, rightValue) => left.score - rightValue.score || rightValue.length - left.length);
    const selected = ranked[0];
    if (!selected) continue;
    used.add(selected.sidewalk.id);
    const strip = selected.sidewalk;
    const inset = Math.min(endpointInset, Math.max(8, selected.length * 0.2));
    const lateralInset = Math.min(6, Math.max(2, Math.min(strip.w, strip.h) * 0.28));
    const points = strip.w >= strip.h
      ? [
          { x: rounded(strip.x + inset), y: rounded(strip.y + lateralInset) },
          { x: rounded(strip.x + strip.w - inset), y: rounded(strip.y + lateralInset) },
          { x: rounded(strip.x + strip.w - inset), y: rounded(strip.y + strip.h - lateralInset) },
          { x: rounded(strip.x + inset), y: rounded(strip.y + strip.h - lateralInset) }
        ]
      : [
          { x: rounded(strip.x + lateralInset), y: rounded(strip.y + inset) },
          { x: rounded(strip.x + strip.w - lateralInset), y: rounded(strip.y + inset) },
          { x: rounded(strip.x + strip.w - lateralInset), y: rounded(strip.y + strip.h - inset) },
          { x: rounded(strip.x + lateralInset), y: rounded(strip.y + strip.h - inset) }
        ];
    routes.push({
      id: String(anchor.id),
      name: String(anchor.name || anchor.id),
      points,
      sidewalkId: strip.id,
      graphEdgeId: strip.graphEdgeId,
      routeKind: "sidewalk-patrol",
      generated: true
    });
  }
  return routes;
}
