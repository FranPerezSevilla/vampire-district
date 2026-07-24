# Road graph geometry — intersections, transitions and post-layout furniture

_Last updated: 2026-07-24_

## Status

**Geometry v1 was introduced in PR #34, junction ownership was polished in PR #35, and geometry v3 now guarantees continuous road-edge bands.**

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
→ segment sidewalks and junction-owned closures/corner pads
→ crosswalks outside junction authority
→ explicit prop-exclusion envelopes and approach zones
→ buildings/clearances
→ post-layout kerb lights and service furniture
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
  orientation,   // horizontal | vertical in geometry v3
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
- diagonal edges in axis-aligned geometry v3;
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
single/cluster authorities   104
multi-node clusters           10
nodes without authority        0
nodes with duplicate authority 0
```

### Phase 4 — Clipped road segments

Each edge is shortened at both ends by the exact extent of its node authority surfaces. Straight pieces therefore touch junctions but never draw through them.

Runtime road pieces:

```text
straight segments   147
junction pieces     104
transition pieces     0 in the current city
all road pieces     251
road-piece overlaps   0
```

Transition support is active even though the current accepted graph has no collinear width-change node. Unit coverage verifies that a narrow road joining a wider collinear road produces one four-point taper polygon.

### Phase 5 — Continuous road-edge bands and junction sidewalks

Road-edge bands are now a distinct compiler layer derived from each clipped road segment. Every segment side creates one source band; buildings and other road surfaces subtract only the conflicting longitudinal intervals instead of deleting the complete side. The remaining intervals are emitted as deterministic continuous fragments.

Six 8–28 px micro-approaches are absorbed into compound junction authority before band generation. This prevents tiny isolated rectangles from appearing between neighbouring intersections. Fragments shorter than 36 px are treated as orphan residue and discarded; valid longer portions remain continuous.

Junctions still own the local pedestrian envelope: corner pads, closed sides of T junctions, straight-node closures, dead-end caps and tapered offset polygons. Segment bands draw only longitudinal kerb edges, while junction-owned surfaces draw only exposed edges.

Current output:

```text
road-edge band sources      294
continuous road-edge bands  309
junction-owned surfaces     469
total sidewalk surfaces     778
absorbed micro-approaches      6
band/road overlaps             0
band/building overlaps         0
fragments below 36 px          0
```

### Phase 6 — Crosswalks

Crosswalks are generated from eligible junction legs only. They are placed beyond the junction surface and are accepted only when:

- they intersect a carriageway segment;
- they do not overlap any junction/transition authority;
- both ends continue onto final sidewalk surfaces;
- they do not overlap another crosswalk.

Current output:

```text
crosswalks                  137
crosswalk/junction overlaps   0
invalid sidewalk endpoints    0
```

### Phase 7 — Streetlights

Lights are no longer produced from raw road intervals. Candidate points are sampled only after roads, junctions, sidewalks, crosswalks and buildings are final.

A light is rejected when it:

- is outside the world;
- is not on a final sidewalk kerb;
- lies on a road, crossing or generated prop-exclusion zone;
- violates building clearance;
- is too close to another accepted light.

Seven semantic authored light identities are preserved by snapping them to the nearest valid outer kerb. All other lights have deterministic graph-edge/side IDs.

Current output:

```text
post-layout lights   126
invalid lights         0
```


### Phase 7b — Prop exclusions and service furniture

Each junction produces a no-prop envelope plus approach-leg clearances. Crosswalks add their own expanded clearance zones. Dumpsters are evaluated only after those zones, roads, sidewalks, buildings and lights exist. Invalid legacy anchors are deterministically snapped to a valid service kerb or service-yard point, while body-hide spots follow the relocated dumpster.

Current output:

```text
prop exclusion zones   557
post-layout dumpsters   28
invalid dumpsters         0
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

Junctions do not receive duplicated end borders or independent centre stripes. Sidewalk rendering is two-pass: surfaces are filled first, then only explicit `trimEdges`/`trimSegments` are drawn. The compiler SVG renderer follows the same road-before-sidewalk order and can overlay prop-exclusion zones for diagnostics.

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
JUNCTION_SIDEWALK_ROAD_OVERLAP
JUNCTION_SIDEWALK_BUILDING_OVERLAP
ROAD_EDGE_BAND_FRAGMENT_TOO_SHORT
ROAD_EDGE_BAND_ROAD_OVERLAP
ROAD_EDGE_BAND_BUILDING_OVERLAP
ROAD_EDGE_BAND_COVERAGE
ROAD_EDGE_BAND_MISSING
PROP_EXCLUSION_INVALID_BOUNDS
```

Focused tests cover:

- deriving a graph from rectangle input;
- corners without overlapping surfaces;
- mixed-width T junctions;
- tapered collinear width transitions;
- crosswalk-to-sidewalk continuity;
- post-layout light clearances;
- absorption of micro-approaches into compound junctions;
- partial building conflicts splitting bands without deleting the full side;
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

Road geometry v3 is deliberately axis-aligned. `roadCorridors` still preserves higher-level polyline/curve intent, but true diagonal and curved carriageway polygons are not claimed by this pass.

A future geometry version can add arbitrary polyline offsets and rounded joins without changing:

- stable graph node/edge identities;
- semantic landmark sites;
- district IDs;
- traffic/police macro identities;
- mission references to semantic sites.
