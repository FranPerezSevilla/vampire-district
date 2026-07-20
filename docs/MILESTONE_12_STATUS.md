# Milestone 12 — Vehicle core

_Last updated: 2026-07-20_

## Status

**🟡 Milestone 12.1 vehicle-runtime slice implemented; repository CI and browser acceptance pending.**

This slice establishes one first-class vehicle runtime without introducing traffic, motorized police or vehicle combat. It is intentionally built on the accepted campaign, input and runtime owners from Milestone 11.

## Delivered in 12.1

- Four baseline archetypes: compact, sedan, van and police cruiser.
- Four authored parked vehicles in the existing district.
- Player-owned, parked civilian, faction and police ownership metadata.
- Contextual Space entry and exit through the existing traversal contract.
- Arcade acceleration, braking, reverse and steering from the central input frame.
- Vehicle occupant state with the player attached invisibly to the active car.
- Speed-sensitive camera zoom and vehicle-follow camera ownership.
- Vehicle health, streetscape collision damage and disabled state.
- Pedestrian impacts with stun/lethal thresholds, witnesses, Exposure and police heat.
- Theft persistence, witness reports and stronger police consequences for a cruiser.
- Limited per-vehicle trunk storage that never exposes the refuge stash.
- Runtime persistence for ownership, health, parked position and trunk contents.
- On-foot-only safe checkpoint policy while a vehicle is occupied.
- Canvas vehicle HUD with speed, hull condition, trunk use and exit hint.
- Browser diagnostics through `window.NBD_VEHICLES`.

## Ownership model

```text
vehicle definitions         ← archetype balance and authored parked metadata
VehicleModel                ← pure kinematics, damage, camera and geometry helpers
CampaignVehicleSystem       ← ownership, condition and trunk persistence
VehicleSystem               ← world objects, entry/exit, collisions and consequences
GameScene                   ← scene-facing composition and camera/movement routing
GameplayRuntime             ← one central frame owner and driving input filtering
InteractionSystem           ← traversal classification for vehicle entry/exit
```

No prototype patch or second input loop is introduced. `GameplayRuntime` still owns the frame. While occupied, it filters combat, drain, powers and weapon cycling, then routes movement to `VehicleSystem.updateDriving`.

## Controls

```text
Space    enter the nearest vehicle / exit when nearly stopped
W        accelerate forward
S        brake, then reverse
A / D    steer
E        inspect a nearby trunk
```

Vehicle entry is unavailable during combat commitment, hit stun, feeding or body dragging. Exit is rejected above the low-speed threshold or when every authored side/rear exit point is obstructed.

## Campaign persistence

Milestone 12.1 uses the existing schema-compatible world fields:

```text
world.ownedVehicles
world.flags[vehicle.<id>.status]
world.flags[vehicle.<id>.health]
world.flags[vehicle.<id>.x / y / angle / parked]
world.flags[vehicle.<id>.trunk]
```

The trunk is a bounded list encoded as JSON inside a primitive campaign flag. It exposes only its own item ids and capacity; it cannot read refuge weapons, ammunition, blood bags or equipment.

## Theft consequences

Entering a vehicle that is not owned or already stolen:

1. marks it stolen in campaign state;
2. emits the typed `vehicle:stolen` mission event;
3. alarms nearby civilian witnesses;
4. raises Exposure and local police heat;
5. applies larger consequences to faction and police vehicles.

The first owned compact proves normal entry without theft. The market sedan, Directorate van and police cruiser prove distinct metadata and escalation paths.

## Checkpoint boundary

The current campaign checkpoint schema restores the player on foot. While a vehicle is occupied, `CampaignCheckpointSystem` treats the world as transition-active and keeps an objective checkpoint pending. This prevents a save from restoring an invisible player without its vehicle.

A later Milestone 12 slice may extend checkpoint payloads with an occupied vehicle snapshot. Until then, on-foot objective boundaries remain the accepted safe-save contract.

## Automated coverage

Pure unit coverage includes:

- forward acceleration and maximum speed;
- braking before reverse;
- steering direction;
- impact damage thresholds;
- speed-sensitive camera bounds;
- exit and footprint geometry;
- authored starter ownership;
- stolen status persistence;
- condition persistence;
- bounded trunk storage and overflow rejection;
- source ownership and absence of prototype patches.

Chromium coverage includes:

- `/` and `/phaser/` vehicle runtime boot;
- contextual Space entry and exit;
- real keyboard acceleration;
- occupant visibility and checkpoint safety;
- speed-sensitive camera response;
- theft persistence, witnesses and Exposure;
- bounded trunk storage isolated from the refuge stash.

## Remaining Milestone 12 work

- Tune driving feel against physical keyboard input and normal frame timing.
- Add authored repair/refuel or recovery rules for disabled vehicles.
- Decide whether vehicle position should become a dedicated schema collection rather than primitive flags.
- Add player-facing trunk transfer UI once carried inventory slots are introduced.
- Validate body/player collision feel across all parked archetypes.
- Run full browser regression and manual acceptance before marking Milestone 12 complete.

Traffic, civilian drivers, motorized police pursuit, roadblocks and officers exiting vehicles remain Milestone 13.
