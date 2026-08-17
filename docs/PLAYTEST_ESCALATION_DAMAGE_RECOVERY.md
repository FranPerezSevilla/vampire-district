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

**State: documented backlog.**

### Player on foot

- Pursuit cruisers use an intercept point rather than simply driving toward the player's current position.
- At high wanted level, a cruiser may attempt a telegraphed ram/run-over attack.
- The attack must include approach visibility, a steering commitment window and an escape lane; no vehicle may spawn directly on top of the player.
- A blocked or disabled cruiser can deploy officers rather than endlessly pushing geometry.

### Player driving

- Pursuit cruisers use rear-quarter pressure and controlled PIT-like contact to turn or slow the player.
- Coordinated units may form route-informed barricades at major junctions at the highest wanted level.
- Barricades must be placed ahead of the predicted route, leave a risky but possible escape option, and never materialize inside the player's collision footprint.
- Police contact damages both vehicles according to relative speed and angle.

### Acceptance

- Police tactics differ clearly between an on-foot target and a vehicle target.
- A single unit pursues; multiple units may coordinate without stacking into one tile.
- Tactics remain recoverable through driving skill and do not create unavoidable chain collisions.

## Slice 4 — armed police on foot

**State: documented backlog.**

- Officers acquire line of sight, aim, fire in controlled bursts and respect cooldown/reload windows.
- On-foot officers shoot the player when legally escalated by wanted state.
- When the player occupies a vehicle, officers target the occupied vehicle first; bullets damage its hull and produce the same visible projectile/collision feedback as player gunfire.
- Friendly fire and shots through cars/buildings are prohibited by the shared projectile collision authority.
- Initial version may omit cover behavior, but must include range, line of sight and readable muzzle feedback.

## Slice 5 — vehicle destruction, player vitality and death

**State: documented backlog.**

- Add player vitality as the lethal resource, separate from Hunger.
- Bullet hits reduce vitality. At **100% Hunger**, passive recovery is disabled and incoming firearm damage is more dangerous, so sustained police fire can kill the player.
- Reaching 100% Hunger alone does not instantly kill the player.
- A vehicle at zero hull becomes critically damaged; destructive follow-up damage or a severe final impact triggers an explosion rather than every minor zero-health contact exploding immediately.
- An occupant caught in their vehicle's explosion dies; nearby entities receive distance-based damage.
- Death is a single authoritative state that locks movement, weapons, feeding and vehicle input.

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
