# City Compiler — Current city baseline

_Generated from seed `bloodnight-current-city-v1` on 2026-07-21._

## Result

```text
Overall score              82.7 / 100
Grade                      B
Hard validation            PASS
Errors                     0
Warnings                   17
```

The current city is a valid control candidate after explicitly registering ten known legacy geometry exceptions. Generated candidates do not inherit those exceptions.

## Component scores

```text
Road connectivity          100.0
District identity           83.0
Systemic distribution       88.5
Pedestrian coverage         89.5
Vertical and underground    29.4
Hard validity              100.0
```

## Interpretation

### Strong: road connectivity

The authored road graph has:

```text
17 road/alley nodes
37 graph connections
1 connected component
21 cycle-surplus connections
```

The city already offers strong macro connectivity and many alternative street routes. Future candidates should not score below the current road baseline without a deliberate gameplay reason.

### Strong: systemic distribution

The current city distributes 107 streetlights across all eight districts. Dumpsters and vehicles are less evenly spread, but the combined systemic coverage remains high.

```text
District          lights  dumpsters  vehicles
Old Quarter            7          5         1
Glasshouse            22          3         1
Foundry               16          2         0
Harbor North           6          0         1
Canal West            17          1         0
Canal East            18          1         1
Blackwater            15          2         0
Harbor South           6          0         0
```

The Foundry pilot should add at least one vehicle socket and retain multiple evidence/hiding sockets. Harbor North and Harbor South particularly need container coverage before they become mission-heavy.

### Strong: pedestrian coverage

Five authored pedestrian loops remain entirely on sidewalks and crossings. Coverage is good but not complete: future generation should create district-local loops instead of reusing long generic paths.

### Moderate: district identity

Six recipes serve eight current district zones. Canal and Harbor are intentionally split into two zones that share a recipe. This is acceptable, but generated candidates should differentiate their local block composition even when they share the same high-level recipe.

### Weak: vertical and underground integration

This is the principal structural weakness.

```text
10 authored roof areas
7 rooftop routes
7 sewer accesses
```

Only the Old Quarter currently contains authored rooftop gameplay. Seven of eight district zones produce `DISTRICT_WITHOUT_ROOF_GAMEPLAY` warnings:

```text
Glasshouse
Foundry
Harbor North
Canal West
Canal East
Blackwater
Harbor South
```

The sewer network reaches more of the city, but rooftop and sewer access are not yet balanced as parallel traversal layers. The Foundry pilot should therefore prove at least one generated roof network and two sewer entrances, rather than focusing only on roads.

## Registered legacy geometry debt

The authored control city contains ten known building/road overlaps:

```text
club:eastWestAvenue
church:southServiceAlley
warehouse:southServiceAlley
warehouse:warehouseAlley
shops:northSouthAvenue
shops:southServiceAlley
oldBlock:southServiceAlley
canalMarketWest:eastBackLane
glassSouth:eastBackLane
blackwaterExchange:eastBackLane
```

These are warnings only for the imported control blueprint. They are not general exemptions. Any newly generated candidate with an unregistered building/road overlap fails hard validation.

## Baseline counts

```text
World                    2400 × 1440
Districts                           8
Roads / alleys                     17
Sidewalk bands                     54
Crosswalk rectangles               26
Buildings                          36
Roof areas                         10
Rooftop routes                      7
Sewer tunnels                      11
Sewer accesses                      7
Streetlights                      107
Dumpsters                          14
Pedestrian routes                   5
Vehicles                            4
```

## Foundry pilot acceptance target

The generated Foundry candidate should:

- keep the complete city hard-valid without adding exceptions;
- preserve global road connectivity;
- expose at least two distinct vehicle chase loops;
- include at least one rooftop network with a valid street entry and exit;
- include at least two sewer entrances;
- include multiple dark approaches and body-hiding sockets;
- add at least one parked-vehicle socket;
- avoid repeating the same industrial block template consecutively;
- score above the current Foundry contribution without reducing the total city score below 82.7;
- retain stable semantic ids under the `foundry:` namespace.

The current authored city remains the control candidate for all comparisons.
