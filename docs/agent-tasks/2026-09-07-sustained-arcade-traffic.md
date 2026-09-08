# PR 73 — sustained arcade traffic

## Goal

Address the user's rejected playthrough: continuously circulating cars, readable
arcade driving, coherent queues across road-piece boundaries, recoverable
collisions, and varied journeys instead of repeated trips around one block.
GTA2 is the requested behavioral reference; an isolated successful turn is not
an acceptance test.

## Scope and authority

- `TrafficRouteCursor`: legal deterministic journey selection and bounded history.
- `TrafficRouteBehaviorPolicy`: longitudinal following, acceleration, braking,
  corner speed, driver reactions and existing legal bypass/rejoin.
- `TrafficJunctionFlowPolicy` / reservation registry: admission and full-body
  clearance, including short links and physically clear queues.
- `TrafficAgentPhysicalAuthorityPolicy` / `TrafficPhysicalConsequencesSystem`:
  contact holds and recovery, without invisible logical movement.
- Existing materialization composition and focused unit/browser coverage.
- One reusable network integration exercise with actual generated topology,
  real route/behavior/junction/physical policies and a fixed 32-car cohort.

No new simulation loop or movement owner in production; no police, radio, city
art, dependency, hosting or generated-geometry changes unless the reproduction
proves an underlying compiler defect. No merge.

## Baseline reproduction

The final comparison uses a persistent 32-car cohort near `(1754, 1574)`,
production `trafficVehicleArchetype`, native `safeFromTraffic` deferred spawn
separation, and the generated city packs. Only rendering/camera residency is
stubbed; routing, following, admission, body collisions and physical authority
are real. Distances are world units, not kilometres.

On `be60ec6`, after 120 simulated seconds, **29/32 cars have been stopped for
more than ten seconds**, the worst stop is 118.15 seconds, and some cars have
completed no junctions. There are zero contacts in this properly separated
baseline: orphaned/over-broad junction reservations alone can freeze traffic.
An earlier exploratory cohort lacked production spawn separation and also
exposed collision holds; its contact totals are not used for the comparison.

## Correction

- Preview the cursor's legal continuation across lane/connector seams. Drivers
  follow the physical leader beyond short compiler pieces using its speed and
  a reaction gap; physical forward guards use the same continuation.
- Maintain 16 recent lane IDs per stable token, prefer unvisited legal exits,
  and favour straight travel among equally suitable exits.
- Size stop lines from the whole body even on a 39-unit approach. Reserve the
  continuation through adjacent junctions where a 6-unit link cannot contain
  a waiting vehicle, including the first usable outgoing clearance corridor.
- Test swept vehicle bodies against requested movements. A materialized owner
  clearing a junction no longer freezes a disjoint safe movement. Normal
  unmaterialized ownership retains its conservative clearance contract.
- Release ownership after direct handoffs and when transferring to the next
  permitted movement; preserve actual body occupancy while the tail clears.
- Permit collision recovery to a legal position upstream of the stop line;
  remove the conflicting broad-circle veto on those same legal positions.
- Use gradual acceleration, predictive braking and curvature-based turn speed.
  Gunfire uses the full bounded speed; normal cruise varies by driver. Normal
  junction queues retain their lane. Bypass lateral travel follows steering
  and forward wheel movement, including stopping and rejoining.
- Cache immutable topology indexes, approach geometry and movement paths so
  these decisions do not repeatedly scan the generated city every frame.

## Sustained evidence

`tests/helpers/traffic-network-runtime.js` keeps every materialized car observable
throughout the city without replacing slots. The three-minute regression requires
all 32 cars to traverse at least 30 junction decisions and 25 distinct lane
segments, no stop of 15 seconds, no spontaneous collision and no identity change.
Separate native gunfire/side-impact coverage requires the same physical body to
hold its logical route during impact, recover its offset and resume driving.
Focused regressions cover direct-handoff reservation release, whole-body short
stop lines, journey history, following beyond seams and braking for tight turns.

## Acceptance

- Sustained network circulation measures each car's progress and worst stop,
  not just aggregate junction transitions from the few surviving cars.
- Queues see cars beyond a direct lane handoff; prevent ordinary rear impacts.
- Clear leaders restart; a held follower does not produce a reciprocal lock.
- Actual contact and displacement recover when a collision-free path opens.
- Legal route decisions avoid recent loops when alternatives exist.
- Vehicles decelerate before turns and accelerate afterwards; speed profiles
  and driver reactions remain bounded and deterministic.
- Player obstruction, gunfire and collision regressions remain covered.
- Fixed identity/pool and compiler geometry remain authoritative.
- Fast checks, affected plan/full semantic CI, and corrected Pages observations
  are reported separately. User gameplay approval remains the ready/merge gate.

## Validation

Run the sustained-network reproduction before/after and targeted regressions,
then `check:fast`, `check:affected:plan -- --base=origin/main`, and
`check:affected -- --base=origin/main`. The environment lacks local Playwright;
use the existing CI for browser coverage and Pages for available visual checks.


Local result: `check:fast` passes 873/873 unit tests plus suite ownership.
`check:affected -- --base=origin/main` repeats all 873 successfully, then reaches
browser boot and reports `playwright: not found`. Browser validation is delegated
to the existing GitHub Actions workflow, not replaced by the native fixture.
