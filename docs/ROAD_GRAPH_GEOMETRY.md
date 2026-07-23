# Road graph geometry — intersections, transitions and post-layout furniture

_Last updated: 2026-07-23_

## Status

**Implemented in PR #34.**

This pass replaces the City Topology V2 road rectangles as runtime authority with an explicit axis-aligned centreline graph. Rectangles remain an output format for straight road pieces and chunk bounds, not the city input model.

The change addresses visual failures found during playtesting:

- horizontal and vertical roads were drawn through each other at corners and crossroads;
- small streets intruded into wider carriageways instead of terminating at a junction;
- several close road endpoints created duplicated centre surfaces;
- crosswalks could occupy the same visual area as an intersection;
- streetlights were generated before final road, sidewalk and building clearances existed.

## Decision

The source of truth is now:

```text
roadGraphNodes + roadGraphEdges
```

The generated runtime geometry is:

```text
road graph
→ node classification
→ one authority surface per node/near-node cluster
→ clipped straight segments
→ width-transition polygons
→ sidewalks and corner pads
→ crosswalks outside junction authority
→ buildings/clearances
→ post-layout streetlights
→ pedestrian routes and navigation points
→ 80 streamed chunks
```

The initial graph was derived once from the accepted City Topology V2 road input. It is now stored explicitly in:

```text
tools/city-compiler/city-road-graph-v1.js
```

Future road changes edit or regenerate that graph. The old 46 rectangle records are no longer patched manually after compilation.

## Graph contract

### Node

```js
{
  id,
  x,
  y,
  sourceRoadIds
}
```

Generated node metadata also includes:

```js
{
  degree,
  junctionKind
}
```

Current supported node kinds:

```text
end
straight
transition
corner
t-junction
crossroad
complex
```

### Edge

```js
{
  id,
  from,
  to,
  width,
  orientation,   // horizontal | vertical in geometry v1
  roadClass,     // major | local | alley
  kind,
  label,
  sourceRoadIds
}
```

An edge describes connectivity and width. It does not own the centre of an intersection.

## Generation phases

### Phase 1 — Graph integrity

The compiler rejects:

- duplicate node or edge IDs;
- edges referencing missing nodes;
- zero/negative widths;
- diagonal edges in axis-aligned geometry v1;
- disconnected road components.

### Phase 2 — Node classification

Incident edge directions and widths classify every node:

- degree 1 → end;
- degree 2, opposite/equal width → straight;
- degree 2, opposite/different width → transition;
- degree 2, perpendicular → corner;
- degree 3 → T junction;
- degree 4 → crossroad;
- other combinations → complex.

### Phase 3 — Junction authority

Every graph node owns exactly one junction or transition surface.

A small number of provisional node surfaces may overlap when two source endpoints are effectively part of one complex connection. Those nodes are clustered into one authority surface rather than rendered as overlapping pieces.

Current city:

```text
graph nodes                  114
single/cluster authorities   111
multi-node clusters            3
nodes without authority        0
nodes with duplicate authority 0
```

### Phase 4 — Clipped road segments

Each edge is shortened at both ends by the exact extent of its node authority surfaces. Straight pieces therefore touch junctions but never draw through them.

Runtime road pieces:

```text
straight segments   153
junction pieces     111
transition pieces     0 in the current city
all road pieces     264
road-piece overlaps   0
```

Transition support is active even though the current accepted graph has no collinear width-change node. Unit coverage verifies that a narrow road joining a wider collinear road produces one four-point taper polygon.

### Phase 5 — Sidewalks

Sidewalk strips are derived from the sides of clipped segments. Corner pads fill valid pedestrian space around node authority pieces while respecting building clearances.

The compiler no longer generates a full sidewalk band through the middle of an intersection.

Current output:

```text
sidewalk surfaces  632
```

### Phase 6 — Crosswalks

Crosswalks are generated from eligible junction legs only. They are placed beyond the junction surface and are accepted only when:

- they intersect a carriageway segment;
- they do not overlap any junction/transition authority;
- both ends continue onto final sidewalk surfaces;
- they do not overlap another crosswalk.

Current output:

```text
crosswalks                  141
crosswalk/junction overlaps   0
invalid sidewalk endpoints    0
```

### Phase 7 — Streetlights

Lights are no longer produced from raw road intervals. Candidate points are sampled only after roads, junctions, sidewalks, crosswalks and buildings are final.

A light is rejected when it:

- is outside the world;
- is not on a final sidewalk;
- lies on a road or crossing;
- violates building or junction clearance;
- is too close to another accepted light.

Seven semantic authored light identities are preserved by snapping them to the nearest valid final sidewalk point. All other lights have deterministic graph-edge/side IDs.

Current output:

```text
post-layout lights   138
invalid lights         0
```

### Phase 8 — Pedestrian routes and NPC starts

The eleven existing semantic pedestrian route IDs are retained. Each route is regenerated as a four-point loop inside a suitable final sidewalk strip near its original district anchor.

Navigation points are regenerated from those routes. Civilians with a `pedestrianRouteId` start at the first generated route point instead of retaining obsolete pre-graph coordinates.

### Phase 9 — Streaming

`npm run city:topology` now performs the complete deterministic sequence:

```text
city:roads
→ city:validate
→ city:streaming
```

It rewrites:

```text
phaser/src/data/generated/city-topology-v2.js
phaser/assets/city/current/manifest.json
phaser/assets/city/current/chunks/*.json
```

The streaming contract remains `10 × 8`, 80 chunk files.

## Runtime rendering

`GameScene` and `GameSceneCore` render:

- rectangle straight segments;
- rectangle junction authority pieces;
- polygon transition pieces;
- lateral trim/centre markings on straight segments only.

Junctions do not receive duplicated end borders or independent centre stripes. The compiler SVG renderer uses the same polygon-aware surface contract and can display graph nodes for diagnostics.

## Validation and tests

Hard validation now includes:

```text
ROAD_GRAPH_EDGE_NODE_MISSING
ROAD_GRAPH_DIAGONAL_EDGE
ROAD_GRAPH_DISCONNECTED
ROAD_NODE_JUNCTION_AUTHORITY
ROAD_PIECE_OVERLAP
CROSSWALK_OVER_JUNCTION
CROSSWALK_WITHOUT_TWO_SIDEWALKS
LIGHT_OFF_SIDEWALK
LIGHT_ON_ROAD
LIGHT_ON_CROSSWALK
LIGHT_INSIDE_BUILDING_CLEARANCE
LIGHTS_TOO_CLOSE
```

Focused tests cover:

- deriving a graph from rectangle input;
- corners without overlapping surfaces;
- mixed-width T junctions;
- tapered collinear width transitions;
- crosswalk-to-sidewalk continuity;
- post-layout light clearances;
- deterministic recompilation of the full city graph.

Browser coverage imports the production topology and rechecks junction ownership, road-piece overlap, crossing continuity and light placement inside the running Phaser build.

## Commands

```bash
npm run city:roads
npm run city:validate
npm run city:streaming
npm run city:topology
npm test
npm run test:browser:systems
```

## Current limitation and next geometry version

Road geometry v1 is deliberately axis-aligned. `roadCorridors` still preserves higher-level polyline/curve intent, but true diagonal and curved carriageway polygons are not claimed by this pass.

A future geometry version can add arbitrary polyline offsets and rounded joins without changing:

- stable graph node/edge identities;
- semantic landmark sites;
- district IDs;
- traffic/police macro identities;
- mission references to semantic sites.
