# Testing strategy

_Last updated: 2026-07-30_

## Goal

The project must keep reliable regression coverage while city topology and systemic interactions change. Tests protect reusable framework and gameplay contracts without forcing retired authored missions back into production.

## Boot profiles

The application resolves one boot profile before campaign state or Phaser scenes are composed.

```text
normal    persistent campaign, zero production missions, direct street free roam
explore   isolated state, zero missions, street free roam
playtest  isolated bounded Hunt, Feed, Escape session
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

### Playtest mode

Direct route:

```text
?mode=playtest
```

Playtest mode:

- starts from the same accepted street spawn as free roam;
- uses in-memory campaign state and never mutates the normal save;
- keeps the real feeding, Hunger, powers, witnesses, Heat, Exposure, police, vehicle and layer systems active;
- adds one bounded session observer rather than registering a campaign mission;
- provides onboarding, a three-step objective loop, a result report, reliable restart and embedded feedback;
- is covered by `tests/browser/playtest-slice.spec.js` inside the `browser-boot` domain.

Detailed contract: [`PLAYTEST_SLICE_0_1.md`](PLAYTEST_SLICE_0_1.md).

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
- source ownership and boot ordering;
- playtest objective progression, completion, timeout and result statistics.

Archived journalist/`Clean the Scene` definitions remain valid fixture data but are never assumed as production defaults.

### Current CI selection and browser scope

Pull requests use one `pr-fast` job. It checks suite ownership, plans affected validation against the base branch, installs Chromium only when needed, then executes the plan. Main pushes and scheduled/manual runs retain the broader native, city-analysis and semantic browser jobs. The 41 browser specifications are owned by eight canonical npm suites.

For PR #73 and its continuation branch `codex/traffic-junction-topology`, the author explicitly excluded browser execution. CI therefore runs `check:fast` without installing Chromium; local city changes also run `city:validate` / `city:topology`. The affected plan still lists browser coverage transparently. A static suite-ownership check is not execution of those browser tests.

At gameplay implementation `163e870` (2026-09-08), 911 native tests pass. The wider-city geometry is valid with zero errors/warnings and all 99 generated city/chunk/pack files reproduce byte-for-byte. Native flow, recovery, 600-car/six-bus density, transit and performance contracts pass; the user separately approved the Pages driving result. This is not a new browser/FPS measurement.

For documentation-only changes, run the affected plan against the preceding implementation to establish the documentation scope, and retain the implementation validation evidence. Follow the repository's required fast gate before publishing.

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
4. Never mutate the user's persistent save from explore, playtest or scenario mode.
5. Do not mock the system under test; prepare real systems deterministically.
6. Keep normal-boot coverage for player-facing production entry surfaces.
7. Production tests must not silently rely on archived mission definitions.
8. Mission framework tests must pass definitions explicitly.
9. Add narrative golden paths only for active production content.
10. Long stress/memory/endurance checks belong to nightly or manual validation.
