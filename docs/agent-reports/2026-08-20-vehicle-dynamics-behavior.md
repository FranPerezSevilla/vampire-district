# Vehicle dynamics and traffic behavior slice

## Integration base

This clean integration is based directly on `main` after PR #70 (`Vehicle roster foundation: 15 civilian types + police escalation`) landed as commit `7a5ffde6f8834231bc829d8b43a971abd7a8414f`.

## Current goal

Make vehicles feel driven rather than translated, and make police pursuit read as deliberate containment rather than generic chasing.

## Ambient traffic

Visible NPC traffic now uses the same `stepVehicleKinematics` model as the player vehicle. Lane following, obstacle avoidance and recovery remain high-level intentions; translation, heading, speed, grip and steering are produced by the shared vehicle model.

## Police pursuit state machine

Motorized pursuit is now governed by an explicit persistent state machine instead of independent per-frame tactical conditions.

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
- traffic lane authority and city routing;
- roadblock physical authority;
- street-furniture collision authority.

## Validation focus

Automated coverage explicitly checks the state transitions and fleet invariants. Manual validation should focus on play feel:

1. drive head-on past a cruiser and confirm it enters `REENGAGE` rather than continuing away;
2. approach a cruiser already ahead and confirm it transitions to `BLOCK`;
3. confirm the primary close follower uses `PRESSURE`, while secondary cars use `INTERCEPT`/`BLOCK` rather than stacking in one line;
4. Wanted 2 must maintain three pursuit slots;
5. Wanted 3 must maintain three pursuers plus a separate roadblock unit;
6. drive slowly but continuously and confirm officers remain mounted;
7. stop almost completely for the hold window and confirm transition `CONTAINED` -> `DEPLOYED`;
8. verify NPC civilian cars still rotate/accelerate/brake naturally through lane recovery and obstacle avoidance.
