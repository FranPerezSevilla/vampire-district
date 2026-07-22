# Technical architecture

_Last updated: 2026-07-22_

Read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) for the project-wide map. This document defines current runtime ownership, update ordering, persistence boundaries and testing contracts.

## 1. Runtime and stack

- Phaser 3 browser runtime.
- Native ES modules.
- DOM/CSS overlay for HUD, dialogue, entry screens, mission drawer and result modals.
- Data-driven campaign, city, movement, combat, vehicles, traffic and AI definitions.
- Node built-in test runner for pure/unit coverage.
- Playwright Chromium for boot, systems and campaign regressions.
- No backend dependency for the current build.

The logical viewport is `960 × 640`; the world is `2400 × 1440`. The game does not allocate a full-world render canvas.

## 2. Top-level ownership

```text
GameScene.update
  → GameplayRuntime.update
```

`GameScene` owns scene objects and delegates frame coordination. `GameplayRuntime` owns specialist update ordering and temporary input/interaction adaptation.

No feature may introduce a second world frame loop or retain a parallel gameplay authority.

### `GameScene`

Coordinates:

- player/world rendering and layers;
- camera and current layer;
- one gameplay input-frame consumption point;
- specialist system composition;
- interaction collection;
- world/UI registry publication.

### `UIScene`

Owns:

- Hunger, exposure, powers, weapon/ammo and vehicle HUD;
- mission drawer and prompts;
- campaign entry, pause, failure and success presentation;
- UI-only keyboard handling while world input is locked.

### `GameplayRuntime`

Owns:

- deterministic specialist update order;
- input-frame adaptation for foot/vehicle modes;
- interaction filtering for Enter/Space/E;
- diagnostics system registration;
- reverse-order system destruction.

## 3. Current system map

### Campaign and state

- `CampaignState`
- `MissionRunner`
- `MissionSystem`
- campaign entry controller
- refuge contract board
- `StatePublisher`

### Player and combat

- `InputSystem`
- `WeaponSystem`
- `CombatSystem`
- `DrainSystem`
- `PlayerDamageSystem`
- `MovementNoiseSystem`
- `PowersSystem`
- `FeedingSystem`

### AI, perception and police

- `NpcSystem`
- `AiStateSystem`
- `PedestrianSystem`
- `WitnessSystem`
- `SensoryAwarenessSystem`
- `PoliceSystem`
- `PoliceViolenceSystem`
- `HunterSystem`
- `ExposureSystem`
- `EvidenceSystem`

### World and vehicles

- `PropDamageSystem`
- `StreetFurnitureSystem`
- `VehicleSystem`
- `VehicleModel`
- `VehicleDriving`

### City streaming and traffic

- `ChunkStreamSystem`
- `DistrictPackSystem`
- `EntityStreamSystem`
- `DistantSimulationSystem`
- `MacroTrafficPoliceSystem`
- `TrafficMaterializationSystem`
- `TrafficLocalAssignmentPolicy`
- `TrafficLocalBehaviorSystem`
- `TrafficPhysicalConsequencesSystem`
- `TrafficImpactConsequencesSystem`

### Guidance and presentation helpers

- `TutorialDirector`
- `TaskRevealSystem`
- `ObjectiveMarkerSystem`
- `OutskirtsSystem`
- `UxGuidanceSystem`
- interaction and transition systems

## 4. Authoritative frame order

The large-city pre-frame order is:

```text
ChunkStreamSystem.update
DistrictPackSystem.update
EntityStreamSystem.update
DistantSimulationSystem.update
MacroTrafficPoliceSystem.update
TrafficMaterializationSystem.update
TrafficLocalBehaviorSystem.update
TrafficPhysicalConsequencesSystem.update
TrafficImpactConsequencesSystem.update
PedestrianSystem.update
```

The normal gameplay frame then runs:

```text
InputSystem.beginFrame
→ mode/world-lock gating
→ vehicle-aware input adaptation
→ WeaponSystem selection
→ AiStateSystem pre-resolution
→ movement / traversal / interactions / powers
→ VehicleSystem.updateDriving when occupied
→ CombatSystem attack resolution
→ DrainSystem channel resolution
→ NPC / witness / police / hunter specialists
→ PlayerDamageSystem enemy attacks
→ MovementNoiseSystem actual displacement
→ AiStateSystem final resolution
→ UI/state publication
```

The ordering guarantees:

1. city resources are resident before local queries;
2. dormant state progresses before local activation;
3. macro traffic is authoritative before visual materialization;
4. local traffic behaviour samples the latest lane state;
5. physical offsets exist before player collision checks;
6. impact consequences observe a completed 4E contact once;
7. the normal frame consumes final local positions.

## 5. Input architecture

Authoritative files:

- `phaser/src/input/actions.js`
- `phaser/src/input/InputSystem.js`
- input adapters under `phaser/src/input/`

Important frame fields include:

```js
{
  move,
  hasMovementIntent,
  quietHeld,
  aimWorld,
  primaryPressed,
  primaryHeld,
  drainPressed,
  drainHeld,
  traversePressed,
  interactPressed,
  vehicleActionPressed,
  handbrakeHeld,
  weaponStep,
  dashPressed,
  whisperPressed,
  bloodSensePressed
}
```

Control ownership:

- Enter: vehicle entry/exit only;
- Space: traversal on foot, handbrake while driving;
- E: non-traversal interaction and trunk inspection;
- Shift: quiet movement on foot;
- wheel: weapon selection while gameplay is active.

No active gameplay feature reads raw world-action keys independently of `InputSystem`.

## 6. Campaign and persistence architecture

`CampaignState` is versioned and serializable. `MissionRunner` is the single mission/objective authority.

Persistent domains:

- active, available and completed missions;
- latest safe checkpoint;
- cash and transaction ledger;
- faction/contact reputation;
- player position/layer, Hunger and loadout;
- authored vehicle position, heading, health, parked/disabled state and trunk;
- broken world props;
- static NPC outcomes, corpses and evidence;
- tutorial and informant state.

Checkpoint rules:

- definitions author checkpoint policy;
- unsafe progress rolls back to latest safe objective checkpoint;
- failed retry preserves the latest safe checkpoint;
- completion requires a completion checkpoint;
- rewards remain idempotent;
- starting another mission clears stale mission checkpoint authority.

Ambient traffic state is deliberately excluded from campaign persistence.

## 7. Combat and AI contracts

### Attack lifecycle

```text
primaryPressed
→ snapshot weapon and aim
→ validate/consume ammunition
→ windup
→ active resolution
→ recovery
```

Combat and props share attack geometry where appropriate. A valid target/prop can be hit once per active window.

### Damage-to-Hunger

`PlayerDamageSystem` owns enemy attack timing, confirmation, hit stun, invulnerability and Hunger damage. Specialist AI only decides whether an attack may begin.

### AI priority

```text
inactive/dead
→ downed
→ being drained
→ staggered
→ attacking
→ chasing
→ fleeing/reporting
→ lured
→ investigating
→ searching
→ patrol
→ idle
```

A higher state suppresses contradictory lower-state effects.

### Perception

- confirmed sight promotes type-specific action;
- sight overrides heard-only state;
- hearing alone produces orientation/`WTF`;
- hearing alone does not automatically pursue or report.

## 8. Vehicle architecture

### Persistent vehicle model

`VehicleSystem.vehicles` contains authored/campaign vehicles.

Persistent state includes:

- vehicle ID and archetype;
- ownership/status;
- position, body angle and parked state;
- hull health and disabled state;
- limited trunk contents.

`VehicleModel` owns pure kinematics:

- acceleration and launch boost;
- braking/reverse;
- body angle and travel angle;
- grip and handbrake drift;
- velocity and drag;
- impact-damage helper.

`VehicleDriving` owns:

- world occupancy checks;
- furthest-safe contact search;
- wall/corner slide candidates;
- rotation-at-contact recovery;
- world-collision consequences.

`VehicleSystem.damageVehicle()` is the public hull-damage/persistence route.

### Ambient traffic model

Traffic proxies are not authored vehicles:

- not present in `VehicleSystem.vehicles`;
- not enterable, stealable or searchable;
- no ownership, trunk, health or save state;
- fixed pooled presentation only.

This separation must remain explicit.

## 9. Chunk and district streaming

### `ChunkStreamSystem`

Owns:

- asynchronous chunk loading;
- retry and cancellation;
- activation budget;
- resident/active states;
- LRU retention;
- spatial static queries;
- chunk-local deltas and diagnostics.

### `DistrictPackSystem`

Owns district resource profiles and road-aware prefetch.

### `EntityStreamSystem`

Moves persistent entities between active and dormant simulation without deleting campaign authority.

### `DistantSimulationSystem`

Advances dormant pedestrians and other low-frequency state.

### `MacroTrafficPoliceSystem`

Owns:

- district macro graph;
- abstract traffic token count and phase;
- completed trips;
- dormant police travel;
- district-local patrol recovery.

## 10. Local traffic architecture

### 4C — materialization

`TrafficMaterializationSystem`:

- maps nearby macro tokens to a fixed pool of ten containers;
- samples explicit lane polylines;
- interpolates between macro ticks;
- applies street/chunk eligibility and despawn hysteresis;
- keeps stable token-to-slot identity while local;
- adds occupancy blocking without adding proxies to `VehicleSystem.vehicles`.

### Assignment policy

`TrafficLocalAssignmentPolicy` separates safe appearance checks from already-assigned retention. A queued or physically displaced proxy must not disappear merely because it is temporarily close to another local vehicle.

### 4D — behaviour

`TrafficLocalBehaviorSystem` owns:

- local lane phase;
- following distance and queues;
- braking for player/authored vehicles;
- deterministic junction priority;
- bounded lag and catch-up;
- no macro phase advancement.

### 4E — physical contact

`TrafficPhysicalConsequencesSystem` wraps the public driving operation after 4D:

- predicts the player vehicle candidate;
- detects contact with local proxies;
- applies a bounded safe proxy offset when possible;
- blocks both vehicles when no safe displacement exists;
- damps player speed;
- recovers the proxy offset toward its lane;
- applies no damage, exposure or police heat for soft contact.

### 4F — graduated impacts

`TrafficImpactConsequencesSystem` wraps the 4E driving wrapper:

```text
soft      < 125
hard      125–209
severe    ≥ 210
```

Hard/severe impacts:

- damage the persistent player vehicle through `VehicleSystem`;
- add crash audio, exposure and local police heat;
- apply additional speed loss;
- hold or severely stall the proxy;
- use a per-token cooldown to prevent repeated frame damage.

Local cooldown/stall state is discarded on dematerialization.

## 11. Authority table

| Domain | Authoritative owner | Explicitly not authoritative |
|---|---|---|
| mission progress | `MissionRunner` | UI compatibility step |
| campaign save | `CampaignState` services | runtime proxy objects |
| player input | `InputSystem` | feature raw-key reads |
| authored vehicle health | `VehicleSystem` | traffic proxies |
| macro traffic phase | `MacroTrafficPoliceSystem` | local behaviour/physics |
| traffic slot assignment | `TrafficMaterializationSystem` | macro system |
| traffic lane behaviour | `TrafficLocalBehaviorSystem` | persistent vehicle model |
| temporary traffic offset | `TrafficPhysicalConsequencesSystem` | macro token |
| impact damage/alerts | `TrafficImpactConsequencesSystem` | 4E geometry |
| police local heat | `PoliceSystem` | traffic system storage |
| evidence | `EvidenceSystem` | rendering-only effects |

## 12. Events and diagnostics

Events carry plain identifiers/values rather than system instances. Existing event families include weapon, combat, player damage, AI state, Hunger/feeding, movement/noise, props and vehicle disablement.

Browser diagnostics include:

```js
window.NBD_CAMPAIGN
window.NBD_VEHICLES
window.NBD_CITY_STREAM
window.NBD_TRAFFIC
window.NBD_TRAFFIC_BEHAVIOR
window.NBD_TRAFFIC_PHYSICS
window.NBD_TRAFFIC_IMPACTS
```

These APIs are diagnostic/test surfaces, not additional state authorities.

## 13. Testing architecture

PR domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Golden narrative paths may run on main/nightly/manual workflows.

Pure/unit coverage includes:

- input and geometry;
- combat, drain and AI priority;
- campaign definitions/checkpoints/rewards;
- vehicle kinematics and damage;
- prop/evidence consequences;
- chunk state, macro graph and dormant simulation;
- lane sampling, traffic assignment, behaviour and junctions;
- contact impulse/recovery;
- impact tiers, damage and cooldown.

Chromium systems coverage includes:

- both boot routes and quality/layout profiles;
- vehicle entry/exit, driving and drift;
- wreck exit and persistent vehicle damage;
- pedestrians, police and street damage;
- city streaming and entity dormancy;
- traffic materialization and behaviour;
- soft contact with no damage;
- hard impact with damage/heat/exposure;
- cooldown suppression and stable slot identity.

A feature is complete only when code, tests and documentation agree.

## 14. Current constraints and next extension

Current constraints:

- traffic remains bounded to ten local containers;
- ambient proxies have no persistent damage or driver identity;
- no motorized police pursuit/roadblocks yet;
- no repair economy or disabled-vehicle recovery service yet;
- no rigid-body traffic spin/debris trajectory;
- browser systems suite duration is increasing.

Next architectural extension: a first-class vehicle repair/recovery service using existing campaign cash, ledger and vehicle persistence. It must not store repair truth in UI state or create a second vehicle-condition model.
