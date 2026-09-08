# More visible civilian traffic

## Goal

The user likes the M12 traffic but wants many more cars. Increase the visible
population substantially compared with the published 223-driver / 32-slot build.

## In scope

- Existing authorities: `TrafficPopulationPolicy` road-capacity bootstrap and
  `TrafficLocalAssignmentPolicy` fixed local proxy pool.
- Start by doubling population and local capacity; choose the final values from
  native circulation measurements in the existing three streamed viewpoints.
- Focused density tests/helper and current traffic documentation. Address a
  concrete throughput or runtime-cost regression if the larger load exposes it.

## Out of scope

- No browser tests (explicit user instruction), changed player/police controls,
  new routing or simulation owner, generated roads, visible spawns, relocation,
  recurring itinerary replacement or automatic merge.

## Acceptance criteria

- [x] Substantially more visible traffic than M12 in the measured viewpoints.
- [x] Predefined broad circuits and off-camera materialization remain intact.
- [x] No new traffic contacts or sustained gridlock in native comparisons.
- [x] Bounded native runtime-cost measurements and relevant regressions pass.
- [ ] Publish in PR 73 and inspect native CI/Pages with bounded checks.

## Validation and delivery

Use the production streaming/materialization density harness, `check:fast` and
inspect `check:affected:plan -- --base=origin/main`. The user's browser exclusion
overrides browser commands selected by the cumulative affected plan. Keep PR 73
draft and report actual published head and Pages status.

## Measured result

Final configuration: **437 global drivers / 64 local slots**, with the published
M12 circuit, phase and junction behavior. Compared with M12 at identical streamed
viewpoints and 60-second windows, visible means increase **1.45 → 5.22**,
**11.63 → 20.50** and **6.31 → 11.68**. Recurring coverage is **428/434 lanes**
and **145 source roads**, with all 14 districts served.

The larger population continues to 90 seconds: all five observed stops longer
than 15 seconds travel at least 100 units afterward; maximum stop is 20.3 s.
No traffic contacts, overlaps or guarded-camera spawns occur. Initial placement
counts distinguish 436 recurring-loop phases from one valid one-time entry leg;
all 437 starting poses are separated.

Native traffic cost in the final isolated comparison is 6.34–10.39 ms mean and
9.36–14.32 ms p95. Measured hot-path copies, duplicate presentation work, progress
scans and bootstrap destination scans were reduced without changing driving.
This is not browser FPS evidence. The full validation and published commit/CI/Pages
status are recorded in the live PR handoff.

Full validation: **890/890 native unit tests pass**, plus static ownership of
41 browser specs across 8 suites. No browser tests were executed.
