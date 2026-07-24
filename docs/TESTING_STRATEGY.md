# Testing strategy

_Last updated: 2026-07-23_

## Goal

The project must keep reliable regression coverage while city topology and systemic interactions change. Tests protect reusable framework and gameplay contracts without forcing retired authored missions back into production.

## Boot profiles

The application resolves one boot profile before campaign state or Phaser scenes are composed.

```text
normal    persistent campaign, zero production missions, direct street free roam
explore   isolated state, zero missions, street free roam
scenario  isolated deterministic test state
```

### Normal mode

Normal mode:

- loads/saves the persistent campaign;
- prunes mission records/checkpoints absent from the registered definitions;
- skips campaign entry, mission board and authored tutorial;
- starts on street at `1540, 1515`;
- keeps wallet, reputation, vehicles, maintenance and world persistence active.

### Exploration mode

Direct route:

```text
?mode=explore
```

Exploration mode:

- starts on the street with full controls;
- uses in-memory campaign state;
- never mutates the normal save;
- keeps vehicles, pedestrians, traffic, police, witnesses, combat and evidence active.

### Browser scenarios

Automated browser tests use:

```text
?testScenario=vehicle-core
?testScenario=street-damage
?testScenario=police-escalation
?testScenario=input-locks
?testScenario=urban-explore
```

A scenario uses real runtime systems. It replaces only repeated preparation with a deterministic starting state.

Browser API:

```js
window.NBD_BOOT_PROFILE
window.NBD_SCENARIOS.list()
window.NBD_SCENARIOS.apply(id)
window.NBD_SCENARIOS.snapshot()
window.NBD_SCENARIO_READY
```

## Regression pyramid

### Unit tests

Run on every commit and own pure rules:

- campaign state/migration and mission-registry pruning;
- generic `MissionRunner` with explicitly supplied fixture definitions;
- wallet/reputation/checkpoint rules;
- vehicle kinematics, maintenance and rollback;
- pedestrian surfaces/routes;
- police population and motorized routing/reservation;
- traffic/materialization/contact/impact rules;
- City Compiler validation and topology metadata;
- source ownership and boot ordering.

Archived journalist/`Clean the Scene` definitions remain valid fixture data but are never assumed as production defaults.

### Pull-request browser checks

Three independent jobs run after unit tests.

```text
browser-boot
  runtime composition, normal free-roam boot, routes, render quality, accessibility

browser-systems
  vehicles, city/streaming, traffic, maintenance, evidence, perception, police, input locks

browser-campaign
  legacy mission-save pruning, cash preservation and persistent missionless free roam
```

### Golden paths

There is currently no authored production campaign, so mission-specific Chromium golden paths have been removed:

- journalist killed;
- journalist drained;
- sire report/post-mission free roam;
- intro/camera narrative ordering;
- campaign entry/board flow.

`test:browser:golden` temporarily runs the persistent free-roam baseline. New narrative golden paths return only after new missions are authored against stable semantic city sites.

## City topology regression coverage

Implemented pure compiler/geometry coverage protects:

- graph derivation and connectivity;
- exactly one junction authority per node;
- junction-owned sidewalks clear of roads and buildings;
- continuous road-edge bands covering every unblocked segment side;
- no road-edge band fragments below 36 px;
- micro-approaches absorbed before band generation;
- prop-exclusion zones with valid bounds;
- clipped corner, T and crossroad geometry;
- tapered mixed-width transitions;
- zero road-piece overlap;
- crosswalk endpoints on two valid sidewalks and outside junction centres;
- lights and dumpsters outside junction/crosswalk exclusion zones;
- post-layout lights clear of roads, crossings and buildings;
- deterministic full-city regeneration.

`tests/browser/road-graph-geometry.spec.js` repeats the production-data checks inside the running browser build.

## Rules for new tests

1. Prefer pure unit tests when rendering/input is unnecessary.
2. A browser test should verify one gameplay loop or authority boundary.
3. Add a scenario when preparation is longer than the behaviour tested.
4. Never mutate the user's persistent save from explore/scenario mode.
5. Do not mock the system under test; prepare real systems deterministically.
6. Keep normal-boot coverage for player-facing entry surfaces.
7. Production tests must not silently rely on archived mission definitions.
8. Mission framework tests must pass definitions explicitly.
9. Add narrative golden paths only for active production content.
10. Long stress/memory/endurance checks belong to nightly or manual validation.
