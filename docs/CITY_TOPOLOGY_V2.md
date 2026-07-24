# City Topology V2 — five-times-area site-first city

_Last updated: 2026-07-24_

## Status

**Implemented on the City Topology V2 branch.**

This pass replaces the complete playable urban geometry after the production mission registry was emptied. The former `2400 × 1440` layout is not preserved as a protected core.

## World scale

```text
previous world     2400 × 1440
previous area      3,456,000
new world          4800 × 3600
new area           17,280,000
area multiplier    exactly 5×
chunk size         512 × 512
chunk grid         10 × 8
chunk files        80
```

The viewport remains `960 × 640`. The larger world continues to use asynchronous chunk files, active/prefetch windows, entity dormancy, district packs and macro simulation.

## Site-first landmarks

Large landmarks are reserved before road placement and ordinary parcels.

Implemented sites:

- **Saint Vesper Hospital** with a compound footprint, separate emergency wing, ring road and emergency approach;
- **Central Police Headquarters** with a dedicated civic site and service access;
- **City Hall** with a separate civic block;
- **Cathedral of the Last Dawn** with a large close and perimeter access;
- **Vesper City University** with a campus block and surrounding streets.

The hospital is the mandatory acceptance landmark for this pass. The other four are included to prove that the model is not special-cased to one building type.

Each site records:

```text
semantic landmark ID
reserved campus bounds
district
building footprint
required access modes
siteFirst = true
fixed = false
movable = true
```

No reserved site intersects a road. Ordinary generated buildings are placed only after the sites and road network exist.

## Road topology

Road geometry version 1 is generated from an explicit centreline graph rather than independent road rectangles. The graph contains 114 nodes and 158 edges. Each node or near-node cluster owns one junction surface; every straight edge is clipped to those boundaries.

Current generated geometry:

```text
straight road segments   153
junction authority pieces 111
transition polygons         0 currently, supported and unit-tested
road-piece overlaps         0
```

`roadCorridors` continues to preserve semantic multi-segment routes and future curve intent. The hospital ring and Foundry hook remain named corridor identities, but runtime pieces are now generated from graph edges.

See [`ROAD_GRAPH_GEOMETRY.md`](ROAD_GRAPH_GEOMETRY.md) for the complete generation and validation contract.

## Districts

Fourteen streamed districts:

```text
Hospital Ward
Civic Centre
Cathedral Hill
North Harbor
West Market
Old Quarter
Glasshouse
University District
Canal West
Foundry Ward
Canal East
Harbor North
Blackwater Industrial
South Harbor
```

`old-quarter` remains a normal, unprotected district. It is no longer a narrative exception.

## Urban systems

Generated topology includes:

- 93 buildings;
- 7 reserved landmark sites;
- 114 authoritative road nodes and 158 edges;
- 153 clipped road segments and 111 junction authority pieces;
- 741 final sidewalk surfaces, including 486 owned by junctions;
- 137 crosswalk pieces outside junction centres;
- 11 regenerated pedestrian loops;
- 105 post-layout streetlights;
- 28 body-hiding dumpsters snapped after layout outside 564 junction/crosswalk exclusion zones;
- 30 playable roofs;
- 5 rooftop links;
- 9 fire escapes;
- 12 connected sewer tunnels;
- 10 sewer/shaft accesses.

Hard validation requires:

- one connected road graph;
- exactly one junction/transition authority per graph node;
- zero road-piece overlap;
- no building/road overlap;
- no landmark-site/road overlap;
- every crosswalk outside junction authority and connected to two sidewalks;
- every pedestrian route remains on final sidewalk surfaces;
- every light and dumpster is placed after layout and clear of roads, crossings, buildings and prop-exclusion zones;
- every rooftop route and fire escape terminates on a roof;
- every sewer access reaches a sewer tunnel.

## Traffic and police

The macro graph expands from 8 to 14 nodes and 22 edges.

Civilian traffic keeps the same fixed pool of ten local proxies. Traffic lanes now follow the new cross-city spines and boulevards. Motorized police uses the same new graph/lane assets but retains separate authority.

Police route/spawn data is exported by the topology rather than treating the former police-station coordinates as a global constant.

## Persistence migration

The topology version is stored as:

```text
city.topologyVersion = 2
```

On first load from an older topology, authored vehicle position, angle and parked flags are reset to the new authored anchors. The migration preserves:

- ownership/stolen status;
- hull condition;
- trunk contents;
- cash and ledger;
- reputation;
- other campaign world flags.

This prevents an old parked vehicle from appearing inside a newly generated building without undoing player-owned state or paid maintenance.

## Production boundary

Future missions must reference semantic sites or district IDs after topology acceptance.

They must not reintroduce raw-coordinate protection for:

- roads;
- districts;
- landmark campuses;
- rooftop routes;
- sewers.

The city defines the available spaces. Mission content consumes that accepted topology.
