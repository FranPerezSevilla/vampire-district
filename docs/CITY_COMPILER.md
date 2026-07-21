# City Compiler

_Last updated: 2026-07-21_

## Purpose

The City Compiler is an offline, deterministic toolchain for designing Bloodnight District through authored intent, reusable district recipes, reusable block templates, hard validation and comparable scoring.

It does **not** generate a different city for each player. Development generates candidate cities from stable seeds; a selected candidate is reviewed, polished and committed as normal game data.

## Design principle

```text
Authored city intent
        ↓
District recipes and block templates
        ↓
Candidate generation
        ↓
Hard validation
        ↓
Quality scoring
        ↓
Human selection and polish
        ↓
Stable runtime data
```

The compiler must never replace human direction. It exists to generate valid alternatives, expose structural weaknesses and prevent repetitive manual placement work.

## Foundation scope

City Compiler 1 intentionally leaves the playable city unchanged.

Implemented:

- `CityBlueprint` model;
- `DistrictRecipe` model;
- `BlockTemplate` model;
- six initial district recipes;
- six reusable block templates;
- import of the current authored district without duplicating runtime geometry;
- stable protected zones and landmark contracts;
- hard validators;
- quality scoring;
- JSON manifest and report output;
- layered SVG debug map;
- unit coverage.

The current city remains authored in `phaser/src/data/district.js`. The compiler consumes those exports as its baseline candidate.

## Commands

Validate the current city without writing files:

```bash
npm run city:validate
```

Generate review artifacts:

```bash
npm run city:compile
```

Default output:

```text
.city-compiler/current-city/city-blueprint.json
.city-compiler/current-city/city-report.json
.city-compiler/current-city/city-debug.svg
```

A custom directory can be supplied directly:

```bash
node tools/city-compiler/compile.js --output-dir=tmp/foundry-review
```

## CityBlueprint

The blueprint is the global design contract:

```js
{
  id: "bloodnight-current-city",
  seed: "bloodnight-current-city-v1",
  world: { width: 2400, height: 1440 },
  protectedZones: ["old-quarter"],
  districts: [...],
  landmarks: [...],
  recipes: [...],
  blockTemplates: [...],
  runtime: {...}
}
```

### Protected zones

Protected zones cannot be replaced by future generation stages without an explicit migration. The initial protected zone is `old-quarter`, preserving the existing opening mission, refuge, police station, nightclub, church, rooftop route and sewer contract.

### Landmarks

Landmarks bind narrative meaning to stable building ids and access requirements. The initial contract includes:

- refuge;
- police station;
- nightclub;
- church;
- harbor registry;
- Blackwater terminal.

Future generators must preserve the required district and access layers even when they produce different surrounding blocks.

## District recipes

A recipe defines the gameplay and spatial identity of a district rather than merely its palette.

Initial recipes:

```text
old-quarter
nightlife-commercial
industrial-maze
canal-mixed
blackwater-industrial
harbor-logistics
```

Each recipe defines:

- road width ranges;
- preferred block-size ranges;
- building, alley, pedestrian, lighting and shadow density;
- weighted building families;
- desired chase loops;
- hiding spots;
- rooftop networks;
- sewer entrances;
- dark routes;
- identity tags.

## Block templates

Templates are semantic urban modules, not bare rectangles.

Initial families:

```text
tenement courtyard
row housing
warehouse yard
factory court
market passage
civic landmark
```

A template may expose:

- valid frontages;
- service access;
- pedestrian passages;
- rooftop entry and jump sockets;
- dumpster sockets;
- lighting sockets;
- parked-vehicle sockets;
- mission-target sockets;
- hidden-body sockets;
- rotation and mirroring variants.

Future generation fills parcels with compatible templates instead of inventing arbitrary building rectangles.

## Hard validation

A candidate is rejected when it violates a hard contract.

Current validators cover:

- missing or unstable ids;
- duplicate ids inside one collection;
- invalid world bounds;
- buildings crossing roads;
- disconnected road graph;
- crossings that do not intersect roads;
- lights outside pedestrian surfaces;
- pedestrian routes leaving sidewalks or crossings;
- rooftop route endpoints outside compatible roofs;
- fire escapes that do not terminate on roofs;
- sewer access points outside tunnels;
- missing district recipes or neighbours;
- landmarks referencing missing buildings or districts;
- vehicles outside the world or inside buildings;
- missing protected zones.

Warnings currently identify:

- dumpsters placed inside major roads;
- districts without authored rooftop gameplay.

Warnings do not reject the city, but they lower confidence and appear in the JSON/SVG output.

## Scoring

A valid candidate receives a comparable score from 0 to 100.

Initial components:

```text
roadConnectivity
 districtIdentity
 systemicDistribution
 pedestrianCoverage
 verticalAndUnderground
 hardValidity
```

The score is diagnostic, not an automatic design decision. A human selects among the strongest valid candidates.

## SVG debug map

The SVG overlays:

- district bounds and recipe ids;
- sewer network;
- sidewalks;
- roads and alleys;
- crossings;
- buildings;
- pedestrian routes;
- rooftop routes;
- streetlights;
- dumpsters;
- vehicles;
- protected landmarks;
- validation and scoring summary.

It is intended for quick review in a browser, Inkscape or source-control attachments.

## Stable ids

Generated ids must be semantic and deterministic:

```text
foundry:block-04:lot-02:warehouse
foundry:block-04:north-lamp-03
foundry:block-04:service-dumpster-01
```

Coordinate-only ids are forbidden because small layout edits would invalidate save flags and mission references.

## Next stage: Foundry pilot

City Compiler 2 should regenerate only Foundry Ward while keeping every other district authored and protected.

Pilot goals:

1. Generate a connected Foundry road subgraph from a fixed seed.
2. Produce blocks and parcels.
3. Fill parcels from industrial templates.
4. Generate sidewalks, crossings, service lanes and prop sockets.
5. Guarantee at least two vehicle chase loops.
6. Guarantee multiple hiding and dark routes.
7. Expose traffic lane and intersection metadata for Milestone 13.
8. Compare multiple valid Foundry candidates through the same report and SVG output.
9. Keep the existing city available as the control candidate.

The complete city should not be regenerated until the Foundry pilot proves that generated space is more playable and distinctive than the current authored ward.
