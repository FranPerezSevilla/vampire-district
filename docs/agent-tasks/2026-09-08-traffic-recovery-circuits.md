# Traffic recovery and broad circuits

## Goal

Blocked civilian drivers can recover in and around junctions using player vehicle controls; their predefined routes repeat broad city circuits.

## In scope

- Authority: `TrafficDriverRuntime`, shared `VehicleModel` kinematics, and `TrafficDriverJunctions` permissions.
- Files: driver runtime/controller/world/junctions, journey planner, focused driver/network unit simulations, and current traffic documentation.
- Update the existing browser itinerary assertion to recognize the closing lane of a circuit; do not execute browser tests.
- PR-specific workflow exception: PR 73 runs native units/simulations and static suite ownership only, honoring the user's no-browser instruction; other PRs and main retain their validation.
- Permit collision-free emergency manoeuvres in crossings, coordinate their swept paths with ordinary traffic, and allow an existing overlap to decrease while separating.
- If a complete bypass is unavailable, reverse a bounded safe distance and reassess. Keep wrecks disabled and avoid new contacts, buildings and road edges.
- Recognize a sustained blocked queue rather than treating every junction wait as indefinitely normal.
- Preplan and repeat circuits spanning distant streets, with continuous physical pose at the seam. Preserve a legal departure from dead ends.

## Out of scope

- No player handling changes, new gameplay loop, generated-city edits, police changes, global CI refactor, browser tests, or automatic merge.

## Acceptance criteria

- [x] A driver blocked in a crossing can reverse/separate and bypass with native controls.
- [x] Following cars can use free opposing pavement around a sustained obstruction; conflicting crossing traffic remains separated.
- [x] Partial reverse gains room when the complete manoeuvre cannot yet be found, then replans; a blocked rear causes no invented movement.
- [x] Preplanned broad circuits repeat without snapping or a one-block loop.
- [x] Dense network simulation and relevant unit tests pass; documentation reflects the actual evidence.

## Validation

Run focused native driver/network simulations, `npm run check:fast`, and inspect `npm run check:affected:plan -- --base=origin/main`.
The user explicitly excludes browser tests; do not execute the affected runner's browser suites or use browser results as an acceptance gate.

## Delivery

Publish to existing draft PR 73 and its Pages branch. No automatic merge.

## Local evidence

- `check:fast`: 888/888 unit tests and static suite ownership pass.
- Focused driver/recovery/network suite: 17/17 pass, including the generated crossing at 20 and 60 Hz, existing contact separation, two followers using opposing pavement, blocked rear, bounded partial reverse/reassessment, and exact physical continuity at the circuit seam.
- 32 native cars circulate for 180 seconds without contact, overlap, slot replacement or a 15-second stop; every car completes a circuit and at least 30 handoffs.
- All 434 generated starting lanes produce a broad circular route in the planner audit; minimum length 2340.99 world units.
- The circuit coverage assertion now measures a repeated broad route (at least 7 source roads and 1000 world units of extent), replacing the obsolete expectation of continuously accumulating 25 distinct directed lanes across unrelated trips.
- The affected plan selects the cumulative release-candidate suite. Browser execution is excluded by the user; no browser test was run.
