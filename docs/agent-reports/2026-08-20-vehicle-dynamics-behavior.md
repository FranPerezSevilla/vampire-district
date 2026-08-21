# Vehicle dynamics and traffic behavior slice

## Integration base

This clean integration is based directly on `main` after PR #70 (`Vehicle roster foundation: 15 civilian types + police escalation`) landed as commit `7a5ffde6f8834231bc829d8b43a971abd7a8414f`.

## Current goal

Make vehicles feel driven rather than translated, and make police pursuit read as deliberate containment rather than generic chasing.

## Ambient traffic

Visible NPC traffic now uses the same `stepVehicleKinematics` model as the player vehicle. Lane following, obstacle avoidance and recovery remain high-level intentions; translation, heading, speed, grip and steering are produced by the shared vehicle model.

This specifically removes the old presentation-only lateral correction that could make NPC cars appear to slide sideways while nominally steering.

## Police pursuit doctrine

Motorized police now follow a containment-first doctrine:

1. acquire and close;
2. keep multiple pursuit cars committed to the suspect;
3. pressure from behind or PIT where appropriate;
4. when a cruiser meets/crosses the suspect, immediately choose a cutoff or rapid turnaround/re-engagement instead of continuing past;
5. secondary pursuit cars predict an ahead-of-suspect intercept and attempt to occupy/cross that space;
6. keep officers inside while the suspect vehicle is materially moving;
7. once the vehicle remains nearly stopped for the containment hold window, dismount and transition to the existing armed on-foot police behavior.

### Fleet sizing

The pursuit count is deliberately separate from roadblock/support count:

- Wanted 2: **3 pursuit cruisers**.
- Wanted 3: **3 pursuit cruisers + 1 roadblock unit** (4 motorized units total).

A roadblock therefore no longer consumes one of the active pursuit slots.

### Encounter/re-engagement behavior

`MotorizedPoliceContainmentPolicy` detects nearby pursuit encounters relative to the suspect's travel vector.

- A cruiser ahead of or crossing the suspect is assigned a predictive cutoff point rather than blindly following its prior route.
- A cruiser that has just passed the suspect or is facing substantially away from its new intercept target enters `turning-to-reengage` and receives stronger turn authority to reverse course quickly.
- Pursuit units that are already behind the suspect continue to use rear-quarter/PIT pressure or planned ahead-of-suspect cutoff behavior.
- Distant units remain under normal routing authority; the local encounter override is intentionally bounded.

## Dismount rule

Motorized officers should not abandon a functioning cruiser simply because they are close to a moving player vehicle. Dismount is suppressed while the suspect is above the near-stop threshold, except when a police vehicle is disabled. The stop state must persist briefly before deployment.

## Existing ownership preserved

The following remain owned by their existing systems:

- Heat/Wanted thresholds;
- collision and vehicle damage;
- officer spawning and armed on-foot behavior;
- traffic lane authority and city routing;
- roadblock physical authority;
- street-furniture collision authority.

## Validation focus

Automated coverage now includes fleet sizing and local encounter re-engagement. Manual validation should focus on play feel:

1. drive head-on past a responding cruiser and confirm it immediately tries to cut across the escape path or turns back to pursue;
2. at Wanted 2, keep moving long enough to confirm three pursuit units can remain active rather than treating three as the entire motorized budget;
3. at Wanted 3, confirm three pursuers remain active while the fourth unit performs the roadblock role;
4. drive slowly but continuously and confirm officers remain mounted;
5. stop almost completely for the hold window and confirm officers deploy and engage on foot;
6. verify NPC civilian cars still rotate/accelerate/brake naturally through lane recovery and obstacle avoidance.
