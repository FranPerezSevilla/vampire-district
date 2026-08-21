# Vehicle dynamics and traffic behavior slice

## Integration base

This clean integration is based directly on `main` after PR #70 (`Vehicle roster foundation: 15 civilian types + police escalation`) landed as commit `7a5ffde6f8834231bc829d8b43a971abd7a8414f`.

## Current goal

Make vehicles feel driven rather than translated, remove visible civilian traffic popping at junctions, and make police pursuit read as deliberate containment rather than generic chasing.

## Ambient traffic driving

Visible NPC traffic uses the same `stepVehicleKinematics` model as the player vehicle. Lane following, obstacle avoidance and recovery remain high-level intentions; translation, heading, speed, grip and steering are produced by the shared vehicle model.

### Continuous macro routes

Civilian macro traffic now keeps a stable vehicle identity across streets. Completing an edge no longer wraps the same token from phase `1` back to phase `0` on the same street.

Each traffic agent instead:

1. reaches the destination junction of its current edge;
2. deterministically chooses a connected next street while avoiding an immediate U-turn when alternatives exist;
3. keeps the same `tokenId`;
4. enters the next edge with the correct forward/reverse lane direction;
5. consumes any leftover simulation time on that new edge.

The local intent-driving layer detects this `edgeId` handoff, resets lane-authority phase to the new street, but preserves the car's physical x/y, heading and momentum. The car therefore drives into the new lane rather than teleporting to a new lane sample.

### Civilian lifecycle state machine

Materialized civilian traffic now has an explicit lifecycle:

1. `SPAWNING` — materialized off-camera and protected while local systems settle.
2. `CRUISING` — ordinary visible local driving.
3. `APPROACH_JUNCTION` — near the end of an edge; protected from despawn.
4. `CROSSING_JUNCTION` — edge handoff is in progress; identity/slot are retained.
5. `FOLLOWING` — reacting to traffic/junction yield; protected from churn.
6. `AVOIDING` — performing an obstacle/stopped-vehicle maneuver; protected.
7. `BLOCKED` — physical traffic constraint; protected.
8. `RECENTLY_VISIBLE` — outside the viewport but remembered for 2.6 seconds so camera motion cannot make it pop.
9. `LEAVING_VIEW` — genuinely offscreen and no longer protected; only here is normal despawn eligible.

Existing spawn geometry still prevents new traffic from materializing inside the camera. The lifecycle adds temporal continuity on top: a visible, recently visible, manoeuvring or junction-crossing car cannot be recycled merely because chunk/focus conditions changed for a frame.

Forced releases such as hijacking remain legal and bypass lifecycle retention.

## Police pursuit state machine

Motorized pursuit is governed by an explicit persistent state machine instead of independent per-frame tactical conditions.

States:

1. `ACQUIRE` — route toward and reacquire the suspect when outside local tactical range.
2. `INTERCEPT` — predict the suspect's future position and close on an offset intercept point.
3. `PRESSURE` — primary pursuit unit stays on the rear quarter and maintains close pressure.
4. `BLOCK` — a cruiser already ahead/in the escape corridor aims for a predictive blocking point instead of passing through.
5. `REENGAGE` — a nearby cruiser whose nose is facing away from the suspect performs a high-authority turn and targets a point ahead of the suspect.
6. `CONTAINED` — suspect vehicle has remained below the near-stop threshold for the hold window; motorized movement stops and dismount becomes legal.
7. `DEPLOYED` — officers have exited and the existing armed on-foot police system owns the encounter.
8. `ROADBLOCK` — dedicated Wanted 3 roadblock unit remains outside the pursuit-state competition.

The important distinction is geometric: being behind the suspect is not itself a reason to turn around. `REENGAGE` is entered when the cruiser is close but substantially facing away from the suspect; this covers the head-on crossing/pass-by failure without confusing a legitimate rear-quarter pursuer.

### Fleet sizing

Pursuit count is independent from roadblock/support count:

- Wanted 2: **3 pursuit cruisers**.
- Wanted 3: **3 pursuit cruisers + 1 roadblock unit** (4 motorized units total).

### Dismount rule

Motorized officers remain inside a functioning cruiser while the suspect vehicle is materially moving. Dismount is permitted only from `CONTAINED` (or when the cruiser itself is disabled), then control passes to the existing armed on-foot behavior.

## Existing ownership preserved

The following remain owned by their existing systems:

- Heat/Wanted thresholds;
- collision and vehicle damage;
- officer spawning and armed on-foot behavior;
- roadblock physical authority;
- street-furniture collision authority;
- local vehicle collision/occupancy authority.

## Validation focus

Automated coverage checks traffic route continuation, lifecycle despawn protection, intent-driven junction handoff, police state transitions and fleet invariants. Manual validation should focus on play feel:

1. follow a civilian car through several junctions and confirm it keeps identity and drives onto the next street instead of disappearing/reappearing;
2. rotate/move the camera around a busy junction and confirm recently visible traffic does not churn;
3. confirm a car crossing, yielding, avoiding or physically blocked cannot despawn mid-action;
4. confirm new civilian vehicles still enter from outside the viewport rather than popping into view;
5. drive head-on past a cruiser and confirm it enters `REENGAGE` rather than continuing away;
6. approach a cruiser already ahead and confirm it transitions to `BLOCK`;
7. Wanted 2 must maintain three pursuit slots;
8. Wanted 3 must maintain three pursuers plus a separate roadblock unit;
9. drive slowly but continuously and confirm officers remain mounted;
10. stop almost completely for the hold window and confirm transition `CONTAINED` -> `DEPLOYED`.
