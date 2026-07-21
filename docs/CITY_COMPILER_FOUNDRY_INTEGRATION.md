# City Compiler — Foundry 04 runtime integration

_Last updated: 2026-07-21_

## Status

**🟡 `foundry-pilot-04` is integrated into the playable runtime on the integration branch. Automated and manual acceptance remain before merging.**

## Production data flow

```text
seed foundry-pilot-04
        ↓
City Compiler deterministic candidate
        ↓
phaser/src/data/generated/foundry-04.js
        ↓
phaser/src/data/district.js and vehicles.js
        ↓
playable street / roof / sewer systems
```

The browser does not execute the generator during startup. The selected candidate is exported as static version-controlled data. A no-drift unit regression compares every generated runtime collection against the deterministic compiler output for seed 04.

## Runtime replacement

The integration replaces only Foundry-owned data in the northern Foundry district:

- three local service roads;
- generated sidewalks and two crossings;
- five industrial blocks;
- four low roofs;
- three rooftop jumps;
- two fire escapes;
- two sewer entrances;
- eight streetlights;
- four dumpsters/body-hiding sockets;
- four dark service routes;
- one pedestrian works loop;
- three navigation points;
- one parked utility sedan.

Preserved:

- all arterial roads;
- every other district;
- the Old Quarter and campaign geometry;
- Harbor Registry at the eastern edge;
- existing southern Foundry/Blackwater geometry outside the pilot bounds.

## Playable contracts

The integrated city must support:

1. both authored vehicle chase loops without building collision;
2. pedestrian movement entirely on sidewalks/crossings;
3. climbing from street to each side of the Foundry roof network;
4. all three rooftop jumps;
5. descending back to street;
6. entering and exiting the sewer through both Foundry manholes;
7. destruction and persistence for all eight lights and four dumpsters;
8. entering, stealing, driving and persisting the Foundry utility sedan.

## Automated validation

Unit regressions verify:

- the playable candidate ID is `foundry-pilot-04`;
- obsolete northern Foundry buildings are removed;
- Harbor Registry is preserved;
- every generated road, sidewalk, crossing, building, roof, route, access, light, dumpster, shadow, pedestrian route and vehicle matches the compiler output;
- the complete city remains hard-valid;
- the city score remains at least 84.9;
- the selected pedestrian route stays on pedestrian surfaces.

The focused Chromium loop verifies:

- generated counts in the actual Phaser scene;
- utility-vehicle spawn;
- driveable sample points around both chase loops;
- west fire-escape up/down interactions;
- west-to-east roof jump interaction;
- standable points across all four roofs;
- north sewer down/up interactions.

## Manual acceptance

Manual review should focus on spatial feel rather than raw validity:

- Foundry reads as an industrial neighbourhood, not five rectangles;
- both driving loops are understandable at speed;
- alleys are wide enough for the current vehicle handling;
- fire escapes are discoverable;
- rooftop jumps communicate their destination;
- the preserved Harbor Registry feels embedded rather than isolated;
- lights, dumpsters and the utility vehicle sit in plausible places;
- the neighbourhood is visually distinct from Glasshouse and Harbor.

## Save compatibility

New generated objects use stable semantic IDs under `foundry:`. Existing southern district objects keep their IDs. Removed northern prototype props/buildings had no player-owned inventory contract; street-prop flags for removed prototype IDs become dormant rather than being reassigned to unrelated objects.
