# City Topology V2 — five-times-area site-first city

_Last updated: 2026-07-23_

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

The city contains 46 connected road rectangles grouped into semantic corridors.

The current Phaser renderer still consumes axis-aligned road rectangles. A higher-level `roadCorridors` collection now preserves multi-segment topology and future curve intent:

```text
geometry     polyline
curveHint    rounded-corners | future-spline
points       ordered centre-line points
segments     current rendered road IDs
```

The hospital ring and Foundry hook are already bent multi-segment routes. A future curved-road renderer can replace their visual approximation without changing district, traffic or mission identities.

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
- 168 sidewalk bands;
- 66 crosswalk pieces;
- 11 connected pedestrian loops;
- 549 streamed streetlights;
- 28 body-hiding dumpsters;
- 29 playable roofs;
- 5 rooftop links;
- 9 fire escapes;
- 12 connected sewer tunnels;
- 10 sewer/shaft accesses;
- 62 navigation points.

Hard validation requires:

- one connected road component;
- no building/road overlap;
- no landmark-site/road overlap;
- every crosswalk intersects a road;
- every pedestrian route remains on sidewalks/crosswalks;
- every light is anchored to a pedestrian surface;
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
