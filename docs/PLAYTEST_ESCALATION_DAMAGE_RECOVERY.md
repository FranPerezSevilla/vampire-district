# Playtest escalation, damage and recovery plan

_Last updated: 2026-08-18_

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

**State: implemented on PR #55; pending grouped in-game validation.**

### Implemented increment — player Vitality authority

- `PlayerDamageSystem` now owns **Vitality 100/100** as the lethal player resource. Enemy melee and police bullets reduce Vitality and no longer increase Hunger.
- Existing hit-stun and short invulnerability remain the overlap-protection rules for incoming damage.
- Police firearm damage is amplified by **1.5× at exactly 100% Hunger**. Reaching 100% Hunger alone never changes Vitality or kills the player.
- Passive Vitality recovery begins only after a **3.5 s damage-free delay**, at **4 Vitality/s**, and is disabled while Hunger is 100%.
- Reaching zero Vitality creates one authoritative `dead` state, emits `player:died` once, cancels active enemy attacks and locks world input through the central input frame. Slice 6 owns the visible death beat and recovery transition rather than creating a second death authority.
- Runtime state publishes a Vitality summary for HUD/recovery integration.

### Implemented increment — vehicle critical damage and explosion

- Ordinary damage that reaches zero hull now leaves a **critical wreck** first instead of exploding on the same minor hit.
- Any destructive follow-up hit on that critical wreck explodes it; a severe world impact at **92+ impact speed** may explode immediately when it destroys the remaining hull.
- An occupied vehicle explosion clears vehicle occupancy, restores the player entity to the street and applies lethal explosion damage through the existing authoritative `PlayerDamageSystem`, bypassing only the short overlap-invulnerability window required to guarantee occupant death.
- On-foot players and nearby NPCs receive distance-based radial blast damage inside a **112-unit radius**. The blast publishes one `vehicle:exploded` event with affected-entity metadata for later presentation/audio work.
- Persistent zero-hull vehicles restore as critical wrecks after campaign synchronization; active exploded presentation remains transient runtime state.

### Acceptance

- Hunger can reach 100% without directly reducing Vitality or killing the player.
- The same police bullet removes more Vitality at 100% Hunger than below 100% Hunger.
- Vitality recovers after the damage-free delay below 100% Hunger and does not recover at 100% Hunger.
- Lethal damage produces exactly one dead state and locks movement, weapons, feeding and vehicle input.
- Ordinary zero-hull damage produces a critical wreck; follow-up destructive damage or a severe final collision produces one explosion.
- An occupant dies through the same Vitality authority, while nearby player/NPC damage falls off with distance.

## Slice 6 — master death beat and hospital recovery

**State: implemented on PR #55; pending grouped in-game validation.**

### Implemented increment — attenuated death blackout with Sire above black

- The authoritative `player:died` event starts one idempotent death sequence; repeated death events cannot restart or duplicate it.
- Conflicting interaction/feeding/combat actions are closed or cancelled immediately, while the existing dead-state input lock remains authoritative.
- On death, the existing close camera move begins immediately while the **world audio bus** ramps down to roughly **28% of its current level over 460 ms**. The separate narrative bus is deliberately left untouched.
- Only after that readable audio dip are transient drain/skid/vehicle-engine loops stopped. World audio then continues to near-silence while the visual blackout grows over **780 ms**.
- The blackout uses both the Phaser canvas cover and a full DOM cover above the ordinary HUD. The conventional tutorial dialogue is temporarily raised above that DOM cover, so at full black the **Sire message is the only intended visible game presentation**.
- The Sire appears **after full black**, using the normal in-game thought-dialogue presentation: **“Pathetic. You are supposed to be the predator, not the prey.”** There is no bespoke death text panel.
- Only after the player completes that dialogue does the death sequence expose its single terminal black edge and emit `death:fade-complete`; hospital recovery then consumes that edge exactly once.
- Hospital recovery restores the pre-death camera zoom/follow framing and both audio-bus snapshots before control returns.
- The death presentation continues updating even after `worldEnabled` is false, so the lethal input lock cannot freeze the transition itself.

### Implemented increment — hospital reset and recovery

- Full black clears Heat, temporary foot/motorized response, active firearm/combat projectiles and transient NPC alarm state while durable campaign progression is preserved.
- The player respawns at a valid Hospital Ward street candidate with **35 Vitality**. Hospital arrival deliberately remains control-locked during the recovery beat.
- A lackey appears beside the player and, after a short settle, delivers the recovery line through the **same conventional spoken-dialogue presentation** used elsewhere in the game:

  **“You made quite a mess. We pulled you out of the morgue. Drink this blood bag. The car outside is yours.”**

- After the player dismisses the line, the lackey visibly walks away and fades out. **Only when that departure completes** does the recovery authority explicitly restore `worldEnabled`, full control mode, keyboard focus and fresh input edges. The release lives in a fail-safe finalizer so a dialogue/presentation error cannot strand movement in the locked state.
- The **7-second police reacquisition grace** is refreshed at that control handoff, so it is not consumed while the player is still forced to listen to the lackey.
- The blood bag is not interactable until the lackey recovery beat has completed. It then restores **30 Vitality** and relieves up to **35 Hunger**; it deliberately does not reset Hunger to zero.
- An **owned transient compact** is placed on the hospital emergency approach as a usable replacement vehicle.

### Acceptance

- The death sequence cannot trigger twice or leave input/audio loops running.
- Death audibly drops the world first, then fades the whole game presentation to black; the Sire thought dialogue remains visible above the completed blackout.
- The Sire does not appear before full black, and hospital recovery cannot begin until that dialogue is completed.
- The narrative bus is not faded together with world SFX during the death attenuation.
- The player always reaches a valid hospital spawn.
- The lackey speaks using the conventional dialogue style, leaves before control returns, and no movement/world-input lock survives the recovery beat.
- The blood bag and replacement vehicle are present and usable only after the recovery introduction is complete.
- Active police do not immediately kill the player again; the 7-second grace begins when control is actually returned.

## Delivery order

1. Vehicle audio rebalance.
2. Visible projectile + moving traffic collision fix.
3. Police vehicle tactics.
4. Armed foot police.
5. Vehicle explosion + player vitality/death.
6. Sire blackout + hospital reset/recovery.

## Follow-up — citywide pedestrian-route expansion

**State: implemented on PR #55; pending in-game validation.**

- Pedestrian route count grows from **11 to 18** without raising `AMBIENT_PEDESTRIANS_PER_ROUTE`.
- Seven distinct loops extend pedestrian coverage through Hospital Ward, West Market, Old Quarter, University, Canal West, North Harbor and South Harbor instead of concentrating extra NPCs on the existing loops.
- Every added route publishes its points into `streetNavigationPoints`, so the new route origins/destinations join the existing navigation authority rather than existing only as population decoration.
- Authored routed civilians reserve their route start before ambient population is placed. The result is **72 routed civilians across 72 distinct initial route points**, with no route-point spawn stacking and no increase in per-route point density.
- Pedestrian route geometry now reaches all **14 semantic districts** while remaining on valid pedestrian surfaces.

### Acceptance

- Newly covered districts visibly carry pedestrian movement instead of concentrating extra NPCs on old loops.
- No two routed civilians begin on the same tile.
- Existing routes do not gain extra occupants beyond their available route points.
- Performance must be observed before any further population increase; the dedicated performance slice still owns profiling and optimization.


## Follow-up — accidental civilian-traffic player impacts

**State: implemented on PR #55; pending in-game validation.**

- Civilian traffic keeps the existing on-foot player look-ahead blocker, so normal drivers try to brake rather than target or pursue the player.
- A real geometric overlap is now resolved after local traffic movement. Contacts below **18 px/s** remain harmless stopping contact; faster fortuitous impacts produce bounded Vitality damage and a forward shove scaled by measured traffic speed.
- Damage is routed exclusively through `PlayerDamageSystem`, so invulnerability, death authority and later hospital recovery remain single-owner systems.
- The shove uses `GameScene.canStandAt()` independently on each axis to avoid pushing the player through buildings or world bounds.
- The striking traffic proxy immediately sheds speed and owns a short per-vehicle impact cooldown, preventing one overlap from stacking damage every traffic tick.
- A stable `traffic:player-impact` event exposes speed, attempted/applied damage and displacement for future telemetry and tuning.

### Acceptance

- Standing in front of an approaching civilian car normally makes it brake to a stop.
- Stepping into a moving car, or otherwise causing an unavoidable fortuitous contact, can knock the player aside and reduce Vitality.
- Civilian traffic never begins chasing the player after contact.
- Low-speed nudges do not chip Vitality, and one collision cannot apply damage every frame.
