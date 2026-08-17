# Playtest escalation, damage and recovery plan

_Last updated: 2026-08-17_

This is the ordered implementation contract for the combat, police, death and recovery feedback captured during PR #55. Work through one independently testable slice at a time. Do not combine the police overhaul, player death and hospital recovery into one opaque change.

## Design principles

- **One slice at a time.** Each slice must have its own acceptance criteria and regression coverage before the next begins.
- **Heat remains authoritative.** New police tactics react to existing wanted/Heat state rather than creating a second escalation system.
- **Readable danger, not unavoidable punishment.** Ramming, barricades and gunfire require telegraphing and counterplay.
- **Hunger is not health.** Hunger modifies vulnerability and recovery; player vitality owns actual lethal damage.
- **Runtime reset is not save deletion.** Death resets the active city response while preserving durable campaign progression.

## Slice 1 — vehicle audio rebalance

**State: implemented on PR #55; ready for in-game validation.**

- Lower `vehicleSkidLoop` catalogue gain from **0.60 to 0.50**.
- Raise the real engine sample gain by roughly 14–16% for compact, sedan, van and police profiles.
- Do not reprocess the source recordings or alter RPM, gearbox, distance attenuation or pan.
- Acceptance: the engine remains clearly present underneath a drift; the skid communicates loss of grip without masking the motor; nearby traffic and police engines remain subordinate to the player's car.

## Slice 2 — visible projectile and complete moving-vehicle collision

**State: implemented on PR #55; pending in-game validation.**

The implementation uses a fast frame-updated projectile with swept segment collision. Materialized civilian traffic and motorized police expose immutable collider snapshots instead of leaking render containers into combat. Civilian traffic absorbs the shot and emits a traffic impact event; motorized police cruisers absorb the shot and lose cruiser health through `MotorizedPoliceSystem.damageUnit()`.

### Confirmed defect

The current firearm collision query receives `scene.vehicleSystem.vehicles`. Ambient moving traffic is materialized separately by `TrafficLocalBehaviorSystem`, so a moving traffic car can be visually present yet absent from the bullet collision candidates. This explains a shot passing through a moving car and reaching the police officer behind it.

### Implementation

- Replace the full-length instantaneous line with a short, bright ballistic particle/tracer.
- Use a fast projectile with swept segment collision so it cannot tunnel through thin or fast-moving targets.
- Query all relevant collision authorities: buildings, authored/parked vehicles, player-driveable vehicles, motorized police and currently materialized traffic slots.
- `TrafficLocalBehaviorSystem` must expose stable collidable snapshots; combat must not depend directly on rendering internals.
- Resolve only the first collision along each movement segment.
- Trigger damage, impact particle and `bulletHitBody` / `bulletHitWorld` when the projectile reaches the collision, not at trigger pull.
- Open-space shots expire at range without inventing an impact.
- Remove the persistent full-range debug-like shot line.

### Acceptance

- A moving civilian car blocks a shot aimed at an NPC behind it.
- A moving police cruiser blocks the same shot and receives vehicle damage.
- The projectile visibly travels, but remains fast enough to feel like a handgun round.
- Rotated vehicles, walls and close-range shots cannot be tunneled through.

## Slice 3 — police vehicle tactics

**State: implemented on PR #55; pending grouped in-game validation.**

Pursuit cruisers now switch from district routing to local tactical states when they become visible. From wanted level 2, the lead cruiser can visibly telegraph a committed ram against an on-foot target and a controlled PIT against a driving target, while the second cruiser pressures the opposite rear quarter. Wanted level 3 adds the third route-informed roadblock cruiser, which leaves a risky escape gap. No unit may materialize inside the player's immediate safety radius.

### Player on foot

- Pursuit cruisers use an intercept point rather than simply driving toward the player's current position.
- From wanted level 2, a cruiser may attempt a telegraphed ram/run-over attack.
- The attack must include approach visibility, a steering commitment window and an escape lane; no vehicle may spawn directly on top of the player.
- A blocked or disabled cruiser can deploy officers rather than endlessly pushing geometry.

### Player driving

- From wanted level 2, pursuit cruisers use rear-quarter pressure and controlled PIT-like contact to turn or slow the player.
- Coordinated units may form route-informed barricades at major junctions only at wanted level 3.
- Barricades must be placed ahead of the predicted route, leave a risky but possible escape option, and never materialize inside the player's collision footprint.
- Police contact damages both vehicles according to relative speed and angle.

### Acceptance

- Police tactics differ clearly between an on-foot target and a vehicle target.
- A single unit pursues; multiple units may coordinate without stacking into one tile.
- Tactics remain recoverable through driving skill and do not create unavoidable chain collisions.

### Grouped playtest checks

- On foot at wanted level 2, the lead cruiser may show **RAM!**, commit to a short fixed line, shove on contact and then deploy officers; changing direction during the telegraph should open an escape lane.
- In a vehicle at wanted level 2, two cruisers settle on opposite rear quarters and the lead unit may show **PIT!**, make one controlled contact that slows and yaws the player, then wait through its cooldown.
- Wanted level 3 retains those active vehicle tactics and adds the third roadblock cruiser ahead on its route. It sits across the road with a visible **BLOCK** marker and leaves a narrow but usable side gap.
- No cruiser materializes directly on top of the player, and trapped/disabled cruisers deploy officers rather than pushing indefinitely.

## Slice 4 — armed police on foot

**State: implemented on PR #55; pending grouped in-game validation.**

At wanted level 2, one eligible chasing officer may visibly aim and fire controlled two-shot bursts; wanted level 3 allows up to two coordinated shooters. Firearms use finite magazines, reload pauses and shared ballistic collision. Buildings, traffic, cruisers and other officers block shots. While the player occupies a vehicle, officers target and damage that vehicle first.

- Officers acquire line of sight, aim, fire in controlled bursts and respect cooldown/reload windows.
- On-foot officers shoot the player when legally escalated by wanted state.
- When the player occupies a vehicle, officers target the occupied vehicle first; bullets damage its hull and produce the same visible projectile/collision feedback as player gunfire.
- Friendly fire and shots through cars/buildings are prohibited by the shared projectile collision authority.
- Initial version may omit cover behavior, but must include range, line of sight and readable muzzle feedback.

## Slice 5 — vehicle destruction, player vitality and death

**State: in progress on PR #55. Player Vitality foundation is implemented; vehicle critical-damage/explosion remains next.**

### Implemented increment — player Vitality authority

- `PlayerDamageSystem` now owns **Vitality 100/100** as the lethal player resource. Enemy melee and police bullets reduce Vitality and no longer increase Hunger.
- Existing hit-stun and short invulnerability remain the overlap-protection rules for incoming damage.
- Police firearm damage is amplified by **1.5× at exactly 100% Hunger**. Reaching 100% Hunger alone never changes Vitality or kills the player.
- Passive Vitality recovery begins only after a **3.5 s damage-free delay**, at **4 Vitality/s**, and is disabled while Hunger is 100%.
- Reaching zero Vitality creates one authoritative `dead` state, emits `player:died` once, cancels active enemy attacks and locks world input through the central input frame. Slice 6 will own the visible death beat and recovery transition rather than creating a second death authority.
- Runtime state publishes a Vitality summary for HUD/recovery integration.

### Remaining Slice 5 work

- A vehicle at zero hull becomes critically damaged; destructive follow-up damage or a severe final impact triggers an explosion rather than every minor zero-health contact exploding immediately.
- An occupant caught in their vehicle's explosion dies; nearby entities receive distance-based damage.
- Route vehicle explosion and later civilian run-over damage through the same authoritative player Vitality state.

### Acceptance

- Hunger can reach 100% without directly reducing Vitality or killing the player.
- The same police bullet removes more Vitality at 100% Hunger than below 100% Hunger.
- Vitality recovers after the damage-free delay below 100% Hunger and does not recover at 100% Hunger.
- Lethal damage produces exactly one dead state and locks movement, weapons, feeding and vehicle input.
- Vehicle explosion behaviour is required before Slice 5 is complete.

## Slice 6 — master death beat and hospital recovery

**State: documented backlog; dialogue copy provisional.**

1. Freeze active gameplay and close conflicting UI.
2. Show a master dialogue popup. Initial concise line: **“Pathetic.”**
3. Fade the scene and audio to black.
4. Reset the active city runtime: clear Heat and active police response, rebuild transient traffic/NPC alarm state and remove temporary combat debris. Preserve durable campaign progression.
5. Respawn the player at the hospital with a brief police reacquisition grace period.
6. Place a lackey beside the player with the initial English line:

   **“You made quite a mess. We pulled you out of the morgue. Drink this blood bag. The car outside is yours.”**

7. Grant one blood bag and place a usable replacement car immediately outside/in front of the hospital.
8. The blood bag restores the player to a recoverable state but does not erase every consequence or fully satisfy Hunger by default.

### Acceptance

- The death sequence cannot trigger twice or leave input/audio loops running.
- The player always reaches a valid hospital spawn.
- The lackey, blood bag and replacement vehicle are present and usable.
- Active police do not immediately kill the player again during the recovery beat.

## Delivery order

1. Vehicle audio rebalance.
2. Visible projectile + moving traffic collision fix.
3. Police vehicle tactics.
4. Armed foot police.
5. Vehicle explosion + player vitality/death.
6. Master popup + hospital reset/recovery.
