# Road graph geometry — intersections, transitions and post-layout furniture

_Last updated: 2026-09-08_

## Status

**Geometry v5 extends the v4 road-edge and block-depth guarantees with wider carriageways, matching traffic lanes and reserved building/roof clearance.**

This pass replaces the City Topology V2 road rectangles as runtime authority with an explicit axis-aligned centreline graph. Rectangles remain an output format for straight road pieces and chunk bounds, not the city input model.

The change addresses visual failures found during playtesting:

- horizontal and vertical roads were drawn through each other at corners and crossroads;
- small streets intruded into wider carriageways instead of terminating at a junction;
- several close road endpoints created duplicated centre surfaces;
- crosswalks could occupy the same visual area as an intersection;
- streetlights were generated before final road, sidewalk and building clearances existed.

## Accepted geometry v5 dimensions

| Class | Width | Lanes per direction |
| --- | ---: | ---: |
| Major avenue | 150 | 2 |
| Local street | 96 | 1 |
| Service / alley | 88 | 1 |

The unchanged world and 107-node / 148-edge graph produce 144 clipped segments, 103 junctions, 772 sidewalk surfaces (288 edge bands plus 484 junction-owned), 141 crossings and 660 directed traffic lanes. Post-layout data contains 86 light records and 28 dumpsters; streetlight rendering/stealth remains retired.

`road-clearance.js` reserves 22 sidewalk units plus four façade-clearance units before final pedestrian generation. It adjusts affected rectangular buildings around their original centres, maps attached roofs/access points, preserves all 93 building identities and rejects a parcel that cannot fit. The hall west approach moves from x=2480 to x=2504 to preserve block depth. Final pedestrian loops follow their actual sidewalk surfaces and keep all fourteen districts covered.

Avenue lane centres use width/8 and 3×width/8; single lanes use width/4. Junction approach trims scale with half the adjoining road width, capped at 96. Repeated `city:topology` generation preserves all generated output bytes. See [the accepted widening task](agent-tasks/2026-09-08-wider-city-roads.md) for native traffic and remaining queue evidence.

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
→ reserved sidewalk space and fitted building/roof clearance
→ segment sidewalks and junction-owned closures/corner pads
→ crosswalks outside junction authority
→ explicit prop-exclusion envelopes and approach zones
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
  orientation,   // horizontal | vertical in geometry v4
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
- diagonal edges in axis-aligned geometry v4;
- disconnected road components.
- parallel road pairs overlapping at least 120 units when they leave less than 36 units of usable block depth.

### Foundry industrial-yard simplification

Geometry v4 removes the redundant Foundry Works Road, north-drop and east-link micro-grid. The district now uses a legible perimeter formed by Foundry North Service, Foundry Service Spine, Civic Avenue and Canal South Service. The enclosed space is an industrial loading yard rather than another public-road block.

The rule is graph-level and independent from streaming chunks: chunks only partition the generated surfaces and never create additional roads.

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
graph nodes                  107
junction authority pieces     103
nodes without authority        0
nodes with duplicate authority 0
```

### Phase 4 — Clipped road segments

Each edge is shortened at both ends by the exact extent of its node authority surfaces. Straight pieces therefore touch junctions but never draw through them.

Runtime road pieces:

```text
straight segments   144
junction pieces     103
transition pieces     0 in the current city
all road pieces     247
road-piece overlaps   0
```

Transition support is active even though the current accepted graph has no collinear width-change node. Unit coverage verifies that a narrow road joining a wider collinear road produces one four-point taper polygon.

### Phase 5 — Continuous road-edge bands and junction sidewalks

Road-edge bands are now a distinct compiler layer derived from each clipped road segment. Every segment side creates one source band; buildings and other road surfaces subtract only the conflicting longitudinal intervals instead of deleting the complete side. The remaining intervals are emitted as deterministic continuous fragments.

Six 8–28 px micro-approaches are absorbed into compound junction authority before band generation. This prevents tiny isolated rectangles from appearing between neighbouring intersections. Fragments shorter than 36 px are treated as orphan residue and discarded; valid longer portions remain continuous.

Junctions still own the local pedestrian envelope: corner pads, closed sides of T junctions, straight-node closures, dead-end caps and tapered offset polygons. Segment bands draw only longitudinal kerb edges, while junction-owned surfaces draw only exposed edges.

Current output:

```text
road-edge band sources      288
continuous road-edge bands  309
junction-owned surfaces     467
total sidewalk surfaces     776
absorbed micro-approaches      1
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
post-layout lights   128
invalid lights         0
```


### Phase 7b — Prop exclusions and service furniture

Each junction produces a no-prop envelope plus approach-leg clearances. Crosswalks add their own expanded clearance zones. Dumpsters are evaluated only after those zones, roads, sidewalks, buildings and lights exist. Invalid legacy anchors are deterministically snapped to a valid service kerb or service-yard point, while body-hide spots follow the relocated dumpster.

Current output:

```text
prop exclusion zones   536
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
ROAD_GRAPH_PARALLEL_ROADS_TOO_CLOSE
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

Road geometry v4 is deliberately axis-aligned. `roadCorridors` still preserves higher-level polyline/curve intent, but true diagonal and curved carriageway polygons are not claimed by this pass.

A future geometry version can add arbitrary polyline offsets and rounded joins without changing:

- stable graph node/edge identities;
- semantic landmark sites;
- district IDs;
- traffic/police macro identities;
- mission references to semantic sites.
