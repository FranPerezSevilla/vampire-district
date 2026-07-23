# Technical architecture

_Last updated: 2026-07-23_

Read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) for the project-wide map. This document defines runtime ownership, update ordering, event-driven services, persistence boundaries and testing contracts.

## 1. Runtime and stack

- Phaser 3 browser runtime.
- Native ES modules.
- DOM/CSS overlays for HUD, dialogue, campaign entry, mission board, garage and result modals.
- Data-driven campaign, city, combat, vehicle, maintenance, traffic and police definitions.
- Node built-in test runner for pure/unit coverage.
- Playwright Chromium for boot, systems and campaign regressions.
- No backend dependency.

Logical viewport: `960 × 640`. World: `2400 × 1440`. The game does not allocate a full-world render canvas.

## 2. Top-level ownership

```text
GameScene.update
  → GameplayRuntime.update
```

`GameScene` owns scene objects and delegates frame coordination. `GameplayRuntime` owns deterministic specialist order and temporary input adaptation.

No feature may add a second world frame loop or parallel gameplay authority.

### `UIScene`

Owns HUD/modal presentation. World input is locked while campaign entry, mission board, garage, pause, failure or success UI is open.

### Event-driven campaign services

Campaign mutations that do not require per-frame simulation live outside `GameplayRuntime`:

- mission activation/rewards;
- cash and ledger;
- reputation;
- authored vehicle condition/trunks;
- vehicle repair/recovery.

These services emit plain events. The campaign wildcard listener touches and autosaves state.

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
- `MotorizedPoliceSystem`
- `MotorizedPoliceLocalPolicy`
- `HunterSystem`
- `ExposureSystem`
- `EvidenceSystem`

### World and authored vehicles

- `PropDamageSystem`
- `StreetFurnitureSystem`
- `VehicleSystem`
- `VehicleModel`
- `VehicleDriving`

### City streaming and civilian traffic

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

### Guidance/presentation helpers

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
MotorizedPoliceSystem.update
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

1. chunks/resources are resident before local queries;
2. dormant state advances before local activation;
3. macro traffic/police graph state is current before presentation;
4. civilian lane behaviour and physical consequences resolve before cruisers sample the road;
5. motorized police can create foot officers before the normal police/NPC frame;
6. player and AI consume final positions once.

Vehicle maintenance is event-driven and deliberately absent from the frame order.

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

No gameplay feature reads raw world-action keys independently.

## 6. Campaign and persistence

`CampaignState` is versioned/serializable. `MissionRunner` is the single objective authority.

Persistent domains:

- mission records and latest safe checkpoint;
- cash and transaction ledger;
- reputation;
- player position/layer, Hunger and loadout;
- authored vehicle position, angle, hull, parked state and trunk;
- broken props;
- static NPC outcomes, bodies and evidence;
- tutorial/informant state.

Checkpoint rules:

- definitions author safety policy;
- unsafe progress rolls back to the latest safe checkpoint;
- failed retry preserves that checkpoint;
- completion requires a completion checkpoint;
- rewards remain idempotent.

Authored vehicle condition is campaign state but not checkpoint payload. A checkpoint rollback cannot revert later paid maintenance.

Excluded from campaign persistence:

- civilian traffic tokens/local proxy state;
- motorized response cruisers, routes, transient hull and suspect memory;
- temporary traffic/police contact cooldowns.

## 7. Wallet and maintenance transaction

`WalletSystem` owns cash and immutable ledger entries.

Normal operations emit `wallet:changed`. Milestone 12.1 adds an explicit silent option used only when a higher-level transaction owns final commit/rollback.

Maintenance authority:

```text
VehicleMaintenanceService
  → WalletSystem silent debit
  → CampaignVehicleSystem silent condition update
  → vehicle:maintenance-completed
  → CampaignSystem wildcard save
  → VehicleSystem live synchronization
```

Before mutation, the service snapshots cash, ledger, world flags, event log, sequences, revision and timestamp. Failure restores all values and persists rollback.

Repair requires an owned, damaged, parked vehicle inside the garage radius. Recovery requires an owned wreck, sufficient cash and no wanted level; it returns the vehicle to a deterministic garage slot with `35%` hull.

`VehicleMaintenanceUiSystem` is presentation only. It adds an E interaction, pauses the scene, owns keyboard focus and calls the campaign service.

## 8. Persistent authored vehicles

`VehicleSystem.vehicles` contains authored/campaign vehicles.

Persistent state:

- ID/archetype;
- ownership/status;
- position, angle and parked state;
- hull/disabled state;
- limited trunk contents.

`VehicleModel` owns pure kinematics/impact helpers. `VehicleDriving` owns occupancy checks, safe contact search, sliding and world collision consequences.

`VehicleSystem.damageVehicle()` is the public runtime hull route. `persistVehicle()` commits live condition through `CampaignVehicleSystem`.

After maintenance, `syncFromCampaign()` updates position, angles, zeroed velocity/drift, hull, wreck visuals, visibility, HUD/browser state and `lastPersisted`.

## 9. Civilian traffic architecture

Civilian proxies are not authored vehicles:

- absent from `VehicleSystem.vehicles`;
- fixed pool of ten;
- not enterable, searchable, repairable or persistent;
- no ownership, trunk or hull.

### Streaming/macro

- `ChunkStreamSystem`: async load, retry/cancel, activation budget, LRU, queries and deltas.
- `DistrictPackSystem`: district resources and road-aware prefetch.
- `EntityStreamSystem`: active/dormant state without deleting campaign truth.
- `DistantSimulationSystem`: low-frequency dormant progression.
- `MacroTrafficPoliceSystem`: district graph, civilian traffic phases/trips and dormant foot-police travel.

### Local 4C–4F

- `TrafficMaterializationSystem`: maps nearby macro tokens to ten containers and explicit lanes.
- `TrafficLocalBehaviorSystem`: lane phase, following, queues, braking and junction priority.
- `TrafficPhysicalConsequencesSystem`: soft push/block, damping and temporary lane offsets.
- `TrafficImpactConsequencesSystem`: hard/severe hull damage, audio, exposure, heat, stalls and cooldown.

## 10. Motorized police architecture

### Pure policy

`MotorizedPolicePolicy.js` owns:

- wanted-level cruiser count;
- pursuit/roadblock role assignment;
- breadth-first district routing;
- graph edge/lane direction lookup;
- route-leg construction;
- bounded route advancement;
- `72%` final-leg roadblock stop;
- officer reservation count.

### Response authority

`MotorizedPoliceSystem` owns:

- transient unit identity and role;
- origin/target district and route progress;
- fixed pool of two cruiser containers;
- local visibility and siren presentation;
- transient cruiser health/disabled state;
- collision blocking/consequences;
- dismount decision;
- abandoned suspect-car memory.

Defaults:

```text
wanted 2                  one pursuit cruiser
wanted 3                  pursuit + one partial roadblock
materialize radius        920
pursuit dismount          150
roadblock trigger         210
roadblock final phase     0.72
impact cooldown           0.9 s
abandoned-car memory      4 s
crew                      2 officers per cruiser
```

### Macro/local safety policy

`MotorizedPoliceLocalPolicy` separates distant abstract travel from local occupancy:

- before a candidate enters the local window, authored cars/civilian proxies do not freeze macro travel;
- once local, normal blockers apply;
- roadblock crews cannot deploy merely on entering trigger radius before reaching the cross-lane stop;
- a cruiser trapped locally for `1.15 s` may deploy its crew and continue pressure on foot.

### Officer totals and transfer

`PoliceSystem.desiredCount(level)` remains the public total:

```text
0 → 2
1 → 3
2 → 5
3 → 7
```

`footDesiredCount()` subtracts officers reserved inside active cruisers. `spawnForExposure()` uses the foot target.

`spawnMotorizedOfficers()` creates stable unit-derived NPC IDs, metadata and current investigation target. It is idempotent: repeated calls return existing IDs.

After dismount, officers are normal police NPCs; `MotorizedPoliceSystem` no longer owns their AI.

### Vertical escape and retirement

Cruiser containers hide off-street, but macro response state remains. When wanted response retires, transient units are discarded. No campaign migration is needed.

## 11. Authority table

| Domain | Authoritative owner | Not authoritative |
|---|---|---|
| mission progress | `MissionRunner` | UI step |
| campaign save | campaign services | runtime proxies |
| player input | `InputSystem` | raw-key feature reads |
| cash/ledger | `WalletSystem` | garage UI |
| authored vehicle condition | `CampaignVehicleSystem` / live `VehicleSystem` | traffic/police proxies |
| maintenance composition | `VehicleMaintenanceService` | wallet or UI alone |
| macro civilian traffic | `MacroTrafficPoliceSystem` | local proxy systems |
| civilian slot | `TrafficMaterializationSystem` | campaign/authored vehicles |
| civilian behaviour/contact | 4D/4E/4F systems | macro persistence |
| total police target | `PoliceSystem.desiredCount` | motorized system |
| foot police target | `PoliceSystem.footDesiredCount` | release harness |
| motorized response unit | `MotorizedPoliceSystem` | civilian traffic/campaign |
| local motorized safety | `MotorizedPoliceLocalPolicy` | macro routing policy |
| dismounted officer AI | `PoliceSystem` / `NpcSystem` | motorized cruiser state |
| police heat | `PoliceSystem` | traffic/cruiser storage |
| evidence | `EvidenceSystem` | rendering effects |

## 12. Events and diagnostics

Events carry identifiers and primitive values, never service instances.

Relevant events:

```text
vehicle:maintenance-completed
police:motorized-officers-deployed
```

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
window.NBD_MOTORIZED_POLICE
```

These are test/diagnostic surfaces, not additional authorities.

The release-candidate stress harness exposes:

```text
footPolice      physical police NPCs
reservedPolice  officers inside active cruisers
police          effective pressure total
```

## 13. Testing architecture

PR domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Pure/unit coverage includes:

- input, geometry, combat, drain and AI priority;
- campaign definitions/checkpoints/rewards;
- wallet, vehicle condition and maintenance rollback;
- chunk/macro/dormant simulation;
- civilian traffic lane/assignment/behaviour/contact/impact;
- motorized wanted counts, roles and reservation;
- graph/lane routing and route advancement;
- roadblock stop and local safety policy.

Chromium systems coverage includes:

- authored vehicle driving, maintenance and recovery;
- expanded city/civilian traffic regression;
- level-two pursuit cruiser and exact-once crew deployment;
- level-three partial roadblock angle/blocking;
- cruiser disablement;
- rooftop hiding and suspect-car memory;
- historic police stress using effective pressure;
- no page errors or runtime ownership conflicts.

A feature is complete only when code, tests and documentation agree.

## 14. Current constraints and next extension

Current constraints:

- motorized response uses macro lanes to deliver pressure to district boundaries;
- no freeform intra-district cruiser path selection;
- one partial roadblock, no spike strips or drive-by fire;
- response cruisers are transient and not campaign persistent;
- civilian traffic remains bounded to ten local containers;
- one refuge garage, full repair only;
- browser-systems duration is increasing.

Next extension: **Milestone 14 original factions and territory foundation** using migration-safe campaign data, district ownership, reputation/access gates and mission-definition hooks without adding another campaign authority.
