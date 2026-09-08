# M14 · Avenue capacity and public transport

## Goal

Use two lanes in each direction on major avenues, distribute 1,000 civilian cars citywide, and operate three usable bus lines with passenger stops.

## In scope

- Geometry authority: city compiler directed lanes/connectors and regenerated streaming pack.
- Movement authority: TrafficDriverRuntime and shared VehicleModel; bus itineraries and scheduled braking feed this same driver.
- Population: TrafficPopulationPolicy; fixed local proxy pool remains bounded.
- Transit service: three broad itineraries (circular, north–south return, east–west return), stops, NPC transfers, passenger lifecycle.
- Composition: GameplayRuntime, GameScene, NpcSystem/PedestrianSystem, InteractionSystem's existing chooser, TrafficMaterializationSystem and vehicle archetype/view.
- Focused compiler, density, transit, input and vehicle tests.

## Out of scope

- Browser tests/playtesting (explicit user instruction), merging PR 73, fares, timetables, new persistence/input/gameplay loops, unrelated city redesign.

## Acceptance criteria

- Major avenues have four compiler-owned lanes, with valid continuous junction transitions; routes use both lanes per direction.
- Exactly 1,000 civilian traffic identities are allocated across the city; buses are additional service vehicles.
- Three named lines have repeatable broad routes, curbside stops and physical braking/dwell/departure.
- Real NPCs wait, board, ride and alight at later stops without duplicate owners.
- Enter near a bus uses the existing chooser for passenger boarding or theft; passengers follow the bus and can request a safe exit at a stop; stolen buses use VehicleSystem.
- No second movement owner, visible route snapping or camera-based creation of campaign vehicles.
- Native tests, compiler validation and static suite checks pass; browser exclusion is reported.

## Validation and delivery

Run check:fast, inspect check:affected:plan against origin/main and execute its non-browser checks. Add focused native service and lane tests. Publish to the existing draft PR 73 and its Pages branch, with bounded CI observation.


## Implementation

- 660 directed lanes, including four-lane avenues; parallel through lanes and turns retain their index and use compiler connectors at capacity changes. Dashed avenue dividers follow the road presentation owner.
- Exactly 1,000 cars plus two buses on each of three lines. The 64 local slots retain camera/chunk/clearance guards and prefer eligible buses when a slot frees.
- Broad car circuits require seven source roads, ten lane stages and 1,000 units of spatial extent; parallel lane IDs cannot disguise a tiny circuit.
- Stop scheduling and NPC passenger ownership are separate from movement. Both cars and buses use the same physical driver. Stopped buses accept the player through the existing chooser; theft uses the real materializer/vehicle transfer.
- Passenger lifecycle includes safe exits, hospital/layer recovery, impact/crowd/noise filtering and checkpoint deferral. Visible NPCs never board a dormant invisible bus.
- Native verification includes three streamed 1,000-car viewpoints, the 32-car three-minute circulation regression, 300 seconds of six-bus operation with actual NPC walking, shared-menu input and actual materializer hijacking.
- Compiler validation passes with zero errors/warnings. The cumulative affected plan selects release-candidate coverage; browser execution is excluded by the user.

### Dense-flow corrections

Extending the streamed density proof from 90 to 180 seconds exposed real blocked queues. Civilian circuits had been using cul-de-sacs as lane-switch shortcuts, and a blocked downstream exit could hold priority over the movement that would free it. These are corrected in the existing planner and junction permission owner.

A separate short-fragment defect folded curb-lane turns backwards at intersections adjacent to chunk seams: the old 35% per-end trim left only 21 units for a 45-unit lateral offset. The compiler now allocates available fragment length to its actual junctions, preserves parallel lanes through turns, and excludes right turns without a forward arc. Geometry is regenerated, not patched at runtime. The permanent compiler regression covers the observed crossing and the forward-turn property across production topology.

The junction owner now records downstream and waiting-approach dependencies. Recovery searches remain bounded to one per frame, but the least recently attempted eligible driver receives that budget. A 56-driver obstruction regression exceeds the retry budget and verifies that no population ID is starved of an attempt.

Dense Blackwater traffic exposed a rear car reserving a different turn while its queue leader waited, denying the leader that physically blocked it. Admission now also requires a clear physical approach; waiting behind the head of a queue grants neither a permit nor future path priority. The reproduced 180-second case then clears all 21 long stops, sees 143 distinct vehicles, and records zero contacts/overlaps. The full three-viewpoint gate below uses the final implementation.

The old density fixture placed the player on the road in Old Quarter, contrary to its stated sidewalk-observer purpose. The three viewpoints now assert that their player position is outside the compiler road surface. Blocked-player and collided-queue manoeuvres retain separate 20/60 Hz physical regressions. Queue recovery follows the same driver after its proxy leaves the streamed area; leaving the camera before travelling 100 units no longer produces a false unresolved stop.

The 32-car cohort changes with the four-lane topology. Its one longest queue lasts 20.3 seconds, then clears; all cars complete a broad circuit and at least 34 handoffs. Its bounded wait assertion is now 30 seconds, while the identity, contact, coverage and completed-circuit requirements remain in place. This is a changed congestion bound, not evidence of the former 15-second bound.


## Final native validation

- `check:fast`: **897/897 native tests pass**; static ownership of 41 browser specs across 8 suites passes.
- Three 180-second streamed viewpoints conserve 1,000 cars plus six buses, with zero contacts/overlaps/camera spawns and no old unresolved queue.
- Recurring coverage: 567/574 through lanes; district-share error 0.04267; all 14 districts and both avenue lanes/directions are represented.
- Six-bus service, existing-menu passenger/theft flow, missed/displaced stops, 20/60 Hz recovery, 32-car circulation and 56-driver search fairness pass.
- City validation: 0 errors, 0 warnings, 87.9/A; generated pack parity passes.
- No browser tests/playtests. Exact published source commit and native CI/Pages status belong in the live PR handoff.
