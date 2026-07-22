# Technical architecture

_Last updated: 2026-07-22_

Read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) for the project-wide map. This document defines runtime ownership, event-driven campaign services, update ordering, persistence boundaries and testing contracts.

## 1. Runtime and stack

- Phaser 3 browser runtime.
- Native ES modules.
- DOM/CSS overlays for HUD, dialogue, campaign entry, mission board, garage and result modals.
- Data-driven campaign, city, movement, combat, vehicle, maintenance, traffic and AI definitions.
- Node built-in test runner for pure/unit coverage.
- Playwright Chromium for boot, systems and campaign regressions.
- No backend dependency.

Logical viewport: `960 × 640`. World: `2400 × 1440`. No full-world render canvas is allocated.

## 2. Top-level ownership

```text
GameScene.update
  → GameplayRuntime.update
```

`GameScene` owns scene objects and delegates frame coordination. `GameplayRuntime` owns deterministic specialist ordering and temporary foot/vehicle input adaptation.

No feature may add a second world frame loop or parallel gameplay authority.

### `UIScene`

Owns HUD and modal presentation. World input remains locked while campaign entry, mission board, garage, pause, failure or success UI is open.

### Event-driven campaign services

Campaign mutations that do not need per-frame simulation live outside `GameplayRuntime`:

- mission activation/rewards;
- cash wallet and ledger;
- reputation;
- authored vehicle condition/trunks;
- vehicle repair/recovery.

These services emit plain campaign events. The campaign wildcard listener touches and autosaves state.

## 3. Current system map

### Campaign and state

- `CampaignState`
- `CampaignEventBus`
- `CampaignSystem`
- `MissionRunner`
- `MissionSystem`
- `WalletSystem`
- `CampaignVehicleSystem`
- `VehicleMaintenanceService`
- campaign entry controller
- refuge contract board
- `VehicleMaintenanceUiSystem`
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

Large-city pre-frame:

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

Normal gameplay frame:

```text
InputSystem.beginFrame
→ mode/world-lock gating
→ vehicle-aware adaptation
→ WeaponSystem selection
→ AiStateSystem pre-resolution
→ movement / traversal / interactions / powers
→ VehicleSystem.updateDriving when occupied
→ CombatSystem
→ DrainSystem
→ NPC / witness / police / hunter specialists
→ PlayerDamageSystem
→ MovementNoiseSystem
→ AiStateSystem final resolution
→ state/UI publication
```

Ordering guarantees:

1. city resources are resident before local queries;
2. dormant state advances before activation;
3. macro traffic precedes visual materialization;
4. local behaviour samples current lane state;
5. physical offsets exist before collision checks;
6. impact consequences observe one completed contact;
7. the normal frame consumes final positions.

Vehicle maintenance is event-driven and deliberately absent from this frame order.

## 5. Input architecture

Authoritative files:

- `phaser/src/input/actions.js`
- `phaser/src/input/InputSystem.js`
- adapters under `phaser/src/input/`

Important frame fields:

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
- E: non-traversal interaction, trunk or garage;
- Shift: quiet movement on foot;
- wheel: weapon selection while gameplay is active.

No active gameplay feature reads raw world-action keys independently.

## 6. Campaign and persistence architecture

`CampaignState` is versioned and serializable. `MissionRunner` is the single objective authority.

Persistent domains:

- mission records and checkpoint;
- cash and transaction ledger;
- reputation;
- player position/layer, Hunger and loadout;
- authored vehicle position, angle, hull, parked state and trunk;
- broken props;
- static NPC outcomes, bodies and evidence;
- tutorial/informant state.

Checkpoint rules:

- objective definitions author safety policy;
- unsafe progress rolls back to latest safe checkpoint;
- failed retry preserves the latest safe checkpoint;
- completion requires a completion checkpoint;
- rewards remain idempotent.

Authored vehicle condition is campaign state but not checkpoint payload. A checkpoint rollback cannot revert a later paid repair/recovery.

Ambient traffic state is excluded from campaign persistence.

## 7. Wallet architecture

`WalletSystem` owns cash and immutable ledger entries.

Default public operations emit `wallet:changed` and therefore autosave through `CampaignSystem`.

Milestone 12.1 adds an explicit `{ emit: false }` option to `credit`, `debit` and `record`. It is used only when a higher-level transaction owns final commit/rollback.

A silent wallet mutation still:

- validates amount/funds;
- changes cash;
- increments transaction sequence;
- writes the complete ledger row.

It simply defers the campaign event until the composing service has also updated its other authority.

## 8. Persistent vehicle architecture

`VehicleSystem.vehicles` contains authored/campaign vehicles.

Persistent state:

- ID and archetype;
- ownership/status;
- position, angle and parked state;
- hull and disabled state;
- limited trunk contents.

`VehicleModel` owns pure kinematics and impact damage. `VehicleDriving` owns occupancy checks, furthest-safe contact search, sliding and world-collision consequences.

`VehicleSystem.damageVehicle()` is the public runtime hull-damage route. `VehicleSystem.persistVehicle()` commits live condition through `CampaignVehicleSystem`.

### Silent condition updates

`CampaignVehicleSystem.updateCondition()` defaults to normal emitting behaviour. Milestone 12.1 adds:

```js
{ emit: false, dirty: false }
```

This lets `VehicleMaintenanceService` update condition without an intermediate autosave.

### Runtime synchronization

`VehicleSystem` listens for `vehicle:maintenance-completed` and runs `syncFromCampaign(vehicleId)`.

It updates:

- position and body/travel angle;
- zero speed, velocity and drift;
- hull and disabled state;
- parked/handbrake state;
- normal/wreck alpha and hood colour;
- label rotation, visibility, HUD and browser snapshot;
- `lastPersisted` so normal persistence cannot overwrite the result.

## 9. Vehicle maintenance transaction

Authority:

```text
VehicleMaintenanceService
  → WalletSystem silent debit
  → CampaignVehicleSystem silent condition update
  → vehicle:maintenance-completed
  → CampaignSystem wildcard save
  → VehicleSystem live synchronization
```

Before mutation the service snapshots:

- cash and ledger;
- world flags;
- event log;
- transaction/event sequences;
- revision and timestamp.

On failure it restores these values and persists rollback.

### Repair

Requires:

- owned vehicle;
- positive but incomplete hull;
- parked state;
- condition position inside refuge-garage service radius;
- sufficient cash.

Restores full hull without moving the vehicle.

### Recovery

Requires:

- owned disabled vehicle;
- sufficient cash;
- player-facing request from the refuge garage;
- no wanted level.

Moves the wreck to a deterministic garage slot and restores `35%` hull.

### UI boundary

`VehicleMaintenanceUiSystem` wraps `scene.collectInteractions` without adding a frame loop. Near the garage it adds one E interaction. Its dialog pauses the scene, owns keyboard focus and calls only the campaign maintenance service.

It blocks service while:

- driving;
- away from garage or not on street;
- wanted;
- campaign entry unresolved;
- another operation active.

## 10. Ambient traffic architecture

Traffic proxies are not authored vehicles:

- absent from `VehicleSystem.vehicles`;
- not enterable, searchable, repairable or recoverable;
- no ownership, trunk, hull or save state;
- fixed pooled presentation only.

This boundary is enforced by maintenance ownership/definition checks.

## 11. Chunk and district streaming

### `ChunkStreamSystem`

Owns asynchronous load, retry/cancel, activation budget, resident/active state, LRU retention, static spatial queries, deltas and diagnostics.

### `DistrictPackSystem`

Owns district resources and road-aware prefetch.

### `EntityStreamSystem`

Switches persistent entities between active and dormant simulation without deleting campaign truth.

### `DistantSimulationSystem`

Advances low-frequency dormant state.

### `MacroTrafficPoliceSystem`

Owns district graph, traffic token count/phase, trips, dormant police travel and patrol recovery.

## 12. Local traffic architecture

### 4C

`TrafficMaterializationSystem` maps nearby macro tokens to ten pooled containers, samples explicit lane polylines, interpolates macro ticks and applies eligibility/hysteresis.

### 4D

`TrafficLocalBehaviorSystem` owns local lane phase, following, queues, braking, junction priority and bounded catch-up.

### 4E

`TrafficPhysicalConsequencesSystem` owns soft push/block geometry, player damping and temporary lane offsets/recovery.

### 4F

`TrafficImpactConsequencesSystem` owns hard/severe player-vehicle damage, crash audio, exposure, local heat, severe stalls and per-token cooldown.

Local traffic never gains campaign hull or maintenance eligibility.

## 13. Authority table

| Domain | Authoritative owner | Not authoritative |
|---|---|---|
| mission progress | `MissionRunner` | UI step |
| campaign save | campaign services | runtime proxies |
| player input | `InputSystem` | raw-key feature reads |
| cash/ledger | `WalletSystem` | garage UI |
| authored vehicle condition | `CampaignVehicleSystem` / live `VehicleSystem` | traffic proxies |
| maintenance composition | `VehicleMaintenanceService` | wallet or UI alone |
| maintenance presentation | `VehicleMaintenanceUiSystem` | campaign truth |
| macro traffic phase | `MacroTrafficPoliceSystem` | local traffic systems |
| traffic slot | `TrafficMaterializationSystem` | macro system |
| lane behaviour | `TrafficLocalBehaviorSystem` | persistent vehicle model |
| temporary offset | `TrafficPhysicalConsequencesSystem` | macro token |
| impact alerts | `TrafficImpactConsequencesSystem` | 4E geometry |
| police heat | `PoliceSystem` | traffic/garage storage |
| evidence | `EvidenceSystem` | rendering effects |

## 14. Events and diagnostics

Events carry identifiers and primitive values, never service instances.

Maintenance event:

```text
vehicle:maintenance-completed
```

Payload includes vehicle, action, cost, health before/after, balances, transaction ID, garage and timestamp.

Browser diagnostics:

```js
window.NBD_CAMPAIGN
window.NBD_VEHICLES
window.NBD_VEHICLE_MAINTENANCE
window.NBD_CITY_STREAM
window.NBD_TRAFFIC
window.NBD_TRAFFIC_BEHAVIOR
window.NBD_TRAFFIC_PHYSICS
window.NBD_TRAFFIC_IMPACTS
```

These are test/diagnostic surfaces, not additional authorities.

## 15. Testing architecture

PR domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Pure/unit coverage includes:

- input and geometry;
- combat, drain and AI priority;
- campaign definitions/checkpoints/rewards;
- wallet and vehicle condition;
- vehicle kinematics/damage;
- maintenance quote, ownership, pricing and idempotence;
- atomic rollback after condition failure;
- chunk/macro/dormant simulation;
- traffic lane/assignment/behaviour/contact/impact.

Chromium systems coverage includes:

- vehicle entry, driving, drift and wreck exit;
- city/traffic regressions;
- refuge-garage interaction and dialog;
- full repair and exact ledger debit;
- repeated repair without second charge;
- wanted recovery block without mutation;
- remote wreck recovery and live/campaign synchronization.

A feature is complete only when code, tests and documentation agree.

## 16. Current constraints and next extension

Current constraints:

- one refuge garage;
- full repair only, no partial slider;
- owned authored vehicles only;
- no insurance, impound or mechanic discount;
- no motorized police pursuit/roadblocks;
- traffic remains bounded to ten local containers;
- browser systems duration is increasing.

Next extension after Milestone 12.1 acceptance: motorized police using existing macro/local roads without replacing foot pursuit or vertical escape routes.
