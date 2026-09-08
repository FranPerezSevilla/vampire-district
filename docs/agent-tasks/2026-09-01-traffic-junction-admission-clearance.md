# PR 73 corrective cycle — junction admission and exit clearance

Date: 2026-09-01
Branch: `codex/traffic-junction-topology`
Pull request: #73
State at start: user gameplay rejection; corrective work authorised

## Observed production failure

The final gameplay pass showed a multi-car pile inside a normal four-way junction. One civilian could use the bounded road bypass in open road, but several approaches still compressed into the crossing and became a rigid collision cluster.

The failure is not primarily a depenetration-axis problem. The route runtime requested junction ownership only after an agent reached lane progress `1`, so waiting vehicle bodies could already overlap the conflict area. Ownership was then released as soon as the route centre crossed from connector to outgoing lane, before the rear of the car and the physical presentation had fully cleared. Entry also had no explicit outgoing-clearance gate.

## Authority

- Compiler-owned directed lanes and activation-safe connectors remain the only civilian route geometry.
- `TrafficMultiAgentRouteRuntimePolicy` remains the movement/runtime authority.
- `TrafficJunctionReservationRegistry` remains the exclusive junction owner record.
- New `TrafficJunctionFlowPolicy` derives stop lines, conflict occupancy and exit-clearance corridors only from compiler topology and vehicle dimensions.
- Physical collision code may resolve contacts, but cannot push an unpermitted waiter across its stop line or push a permitted vehicle outside its compiler route corridor.
- Macro traffic remains bootstrap/accounting compatibility only; police macro travel is untouched.

## Corrective implementation

1. Stop-line admission occurs before the lane endpoint. The stop point leaves the whole oriented vehicle outside the compiler junction envelope.
2. Production seed normalization spaces same-approach vehicles upstream instead of placing several tokens on the old lane-end wait point.
3. A same-lane follower cannot request admission ahead of the route agent physically in front.
4. The junction admits only a waiting movement whose conflict area and outgoing clearance corridor are free. Arrival order is preserved among currently admissible movements; a permanently blocked exit does not freeze unrelated clear movements.
5. The reservation phase is retained through approach, connector traversal and outgoing clearance. Connector exit no longer releases ownership by itself.
6. Route progression is capped while a materialized vehicle has an active physical-contact hold, preventing its compiler base from tunnelling through a pile.
7. Bypass planning must leave enough lane distance to complete and rejoin before the next stop line.
8. Physical depenetration is guarded by the stop line and by the admitted connector/outgoing corridor.

## Acceptance

- No unpermitted civilian centre or body enters the junction conflict area.
- No car enters when its outgoing clearance corridor is occupied by traffic, a persistent vehicle, the player vehicle or the player on foot.
- At most one conflicting connector movement owns the junction.
- Ownership is released only after route progress and the materialized body both clear the exit.
- Queues grow upstream with stable spacing and no same-lane overtaking at admission.
- Removing an obstruction allows an admissible movement to resume without teleport, slot replacement or free-form steering.
- Open-road bypass remains available, but cannot begin too close to a junction.
- Existing macro accounting, police continuity, fixed materialization pool and compiler geometry invariants remain unchanged.

## Focused regression coverage

- `tests/traffic-junction-flow-policy.test.js`
- `tests/traffic-junction-runtime-integration.test.js`

The dense integration fixture uses four route agents across conflicting approaches, holds them with a player obstruction, then removes the obstruction and soaks the runtime while asserting one reservation/connector occupant maximum, upstream stop-line waiting and full clearance releases.

## Final gate

This corrective cycle does not authorise merge. PR #73 remains draft. After full CI succeeds, a new user gameplay pass must reproduce the previously failing junction scenario and explicitly approve it.
