# Technical architecture

_Last updated: 2026-07-23_

Read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) for the project-wide map. This document defines runtime ownership, boot composition, campaign/mission registration, persistence boundaries, city-topology policy and testing contracts.

## 1. Runtime and stack

- Phaser 3 browser runtime.
- Native ES modules.
- DOM/CSS overlays for HUD, garage, pause/help and result presentation.
- Data-driven campaign, combat, vehicle, maintenance, traffic and police systems.
- Node built-in test runner for pure/unit coverage.
- Playwright Chromium for boot, systems and campaign/free-roam regressions.
- No backend dependency.

Logical viewport: `960 × 640`. Current imported world: `2400 × 1440`. The game does not allocate a full-world render canvas.

## 1.1 City Topology V2

`city-topology-v2.js` is the authoritative static geometry dataset. It exports world dimensions, semantic anchors, landmark sites, road corridors, roads, pedestrian surfaces, buildings, roofs, sewers, district zones and police topology.

The runtime still renders rectangle segments, while `roadCorridors` retains ordered polyline points and curve hints. Chunk compilation produces a `10 × 8` / 80-file grid.

## 2. Top-level ownership

```text
GameScene.update
  → GameplayRuntime.update
```

`GameScene` owns scene objects and delegates frame coordination. `GameplayRuntime` owns deterministic specialist order and temporary foot/vehicle input adaptation.

No feature may add a second world frame loop or parallel gameplay authority.

## 3. Production boot composition

Normal production boot is a persistent missionless sandbox.

```text
BootProfile
→ campaign/preload
→ Phaser game composition
→ campaign/bootstrap
→ tutorial/bootstrap (immediate completion/free-roam setup)
→ vehicle maintenance bootstrap
```

Not production-booted while the registry is empty:

- campaign entry system;
- refuge mission board;
- authored journalist tutorial flow;
- mission-specific browser golden paths.

Normal boot profile:

```text
mode                       normal
persistent campaign        true
auto load/save             true
show campaign entry        false
auto-start mission         false
skip authored tutorial     true
start layer                street
spawn                      438, 326
```

Explore/scenario profiles remain isolated and non-persistent.

## 4. Current system map

### Campaign and state

- `CampaignState`
- `CampaignEventBus`
- `CampaignSystem`
- `MissionRunner`
- generic `MissionSystem`
- `CampaignCheckpointSystem`
- `WalletSystem`
- `ReputationSystem`
- `CampaignVehicleSystem`
- `VehicleMaintenanceService`
- `VehicleMaintenanceUiSystem`
- `StatePublisher`

Campaign-entry and mission-board source modules remain available for future explicit content, but are not instantiated by the production bootstrap.

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

- completed `TutorialDirector` shell for compatibility/accessibility UI;
- `TaskRevealSystem`;
- `ObjectiveMarkerSystem`;
- `OutskirtsSystem`;
- `UxGuidanceSystem`;
- interaction and transition systems.

With no active mission, the objective marker has no target and `MissionSystem` publishes no mission interaction.

## 5. Authoritative frame order

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
2. dormant state advances before activation;
3. macro traffic/police graph state is current before presentation;
4. civilian lane behaviour/contact resolves before cruisers sample roads;
5. motorized police can create foot officers before normal police/NPC AI;
6. player and AI consume final positions once.

Vehicle maintenance and campaign transactions are event-driven outside the frame order.

## 6. Input architecture

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
- E: interaction, trunk or garage;
- Shift: quiet movement on foot;
- wheel: weapon selection while gameplay is active.

No gameplay feature reads raw world-action keys independently.

## 7. Campaign persistence

`CampaignState` is versioned and serializable.

Persistent domains:

- cash and transaction ledger;
- faction/contact reputation;
- player position/layer, Hunger and loadout;
- authored vehicle ownership, position, angle, hull, parked state and trunk;
- broken props;
- static NPC outcomes, bodies and evidence;
- unlocked refuges and general world flags;
- mission records/checkpoints only for definitions registered by the current build.

Excluded:

- civilian traffic token/local proxy state;
- motorized cruisers, routes, transient hull and suspect memory;
- temporary traffic/police contact cooldowns.

Authored vehicle condition is campaign state but not mission-checkpoint payload. A checkpoint rollback cannot revert later paid maintenance.

## 8. Mission registration authority

Production default:

```js
CampaignSystem.DEFAULT_DEFINITIONS = [];
```

No mission is implicitly registered or started.

Archived definitions remain source-controlled examples:

- `silenceTheJournalistMission`;
- `cleanTheSceneMission`.

Tests or future content modules must pass definitions explicitly:

```js
new CampaignSystem({ definitions: [definition] });
```

This keeps the generic framework testable while preventing retired content from constraining production geometry.

### Generic MissionSystem facade

With no active mission, `MissionSystem`:

- returns `null` current objective and marker;
- provides no mission-specific interactions;
- reports free-roam task/objective text;
- forwards no objective progress because no registered runner exists.

With an explicitly supplied active definition, it still:

- reads objective state from `MissionRunner`;
- forwards typed neutralization events;
- presents generic labels/markers;
- publishes failure/completion results;
- preserves one objective authority.

Retired journalist-specific logic is removed:

- automatic opening start;
- rooftop-jump/informant adapter;
- journalist visibility bridge;
- return-to-refuge sire finale.

## 9. Retired mission save pruning

During `CampaignSystem` service construction, stored mission state is compared with the definitions registered for the current build.

Pruned when unregistered:

- `activeMissionId`;
- mission records;
- completed IDs;
- failed IDs;
- latest checkpoint belonging to that mission.

Preserved:

- wallet/ledger;
- reputation;
- inventory;
- authored vehicles;
- unlocked refuges;
- unrelated world flags/state.

When normal autosave is enabled, the cleaned state is persisted immediately.

## 10. Retired actor and streaming boundary

Retained inactive archetypes:

- journalist;
- exposed body;
- rooftop thug.

They are source-controlled for explicit future content/tests but are inactive in free roam. The tutorial-created informant is hidden when the tutorial shell completes immediately.

`EntityStreamPolicy` only pins mission targets/informants/intercepts when an active mission exists. Therefore retired actors cannot keep the Old Quarter resident or shape streaming behaviour.

## 11. Wallet and maintenance transaction

`WalletSystem` owns cash and immutable ledger entries.

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

Repair requires an owned damaged parked vehicle inside the garage radius. Recovery requires an owned wreck, sufficient cash and no wanted level; it returns the vehicle to a deterministic garage slot with `35%` hull.

The service remains available in missionless persistent free roam.

## 12. Persistent authored vehicles

`VehicleSystem.vehicles` contains authored/campaign vehicles.

Persistent state:

- ID/archetype;
- ownership/status;
- position, angle and parked state;
- hull/disabled state;
- limited trunk contents.

`VehicleModel` owns pure kinematics/impact helpers. `VehicleDriving` owns occupancy checks, safe contact search, sliding and world collision consequences.

After maintenance, `syncFromCampaign()` updates position, velocity/drift, hull, wreck visuals, visibility, HUD/browser state and `lastPersisted`.

## 13. Civilian traffic architecture

Civilian proxies are not authored vehicles:

- absent from `VehicleSystem.vehicles`;
- fixed pool of ten;
- not enterable, searchable, repairable or persistent;
- no ownership, trunk or hull.

Streaming/macro:

- `ChunkStreamSystem`: async load, activation budget, LRU, queries/deltas;
- `DistrictPackSystem`: district resources and road-aware prefetch;
- `EntityStreamSystem`: active/dormant state;
- `DistantSimulationSystem`: low-frequency dormant progression;
- `MacroTrafficPoliceSystem`: district graph, civilian traffic trips and dormant police travel.

Local 4C–4F:

- `TrafficMaterializationSystem`: ten pooled containers and lane sampling;
- `TrafficLocalBehaviorSystem`: following, queues, braking and junction priority;
- `TrafficPhysicalConsequencesSystem`: soft push/block and lane offsets;
- `TrafficImpactConsequencesSystem`: hard/severe damage, exposure, heat, stalls and cooldown.

## 14. Motorized police architecture

Wanted response:

```text
wanted 2   one pursuit cruiser
wanted 3   pursuit + one partial roadblock
```

`MotorizedPolicePolicy` owns routing/roles/progression/reservation. `MotorizedPoliceSystem` owns transient units, two containers, local visibility, collision, hull, dismount decisions and abandoned-car memory.

`MotorizedPoliceLocalPolicy` separates abstract distant travel from local blockers and prevents roadblock crews deploying before the cruiser reaches its cross-lane stop.

`PoliceSystem.desiredCount(level)` remains the public total `2 / 3 / 5 / 7`. `footDesiredCount()` subtracts reserved crews. After dismount, officers are ordinary police NPCs and the motorized layer no longer owns their AI.

## 15. Current City Compiler boundary

The current runtime city is an imported comparison baseline, not protected output.

```text
protectedZones  []
landmarks       []
```

Every district, including `old-quarter`, has `protected: false`.

Existing building/road overlaps remain declared diagnostic debt for the imported baseline. They are not valid for generated candidates.

The compiler metadata records:

```text
compilerStage       mission-constraints-retired
future landmark     site-first
```

## 16. Future city-topology authority

The next generator/refactor must establish one geometry authority.

### Road graph

Roads are graph edges represented by lines/polylines/curves with width and lane metadata.

### Intersections

Each junction is one unique object. Straight-road curb/sidewalk bands terminate at its boundary rather than being overdrawn through it.

### Pedestrian network

Sidewalks are connected graph edges. A crosswalk is valid only when it connects two pedestrian nodes across a real carriageway.

### Parcels/buildings

Ordinary buildings occupy validated polygonal parcels with setbacks from carriageway, sidewalk and intersection clearances. Rectangle-only assumptions are forbidden.

### Site-first landmarks

Important places reserve complete compound/polygonal sites before local roads and ordinary blocks are finalized.

Examples:

- police station with secure yard/parking;
- hospital campus with emergency/service approaches;
- church with plaza/garden/cemetery;
- industrial plant with loading perimeter.

Roads may curve around or approach these sites.

### Street furniture

Lamps/bins attach to semantic sidewalk corners, furniture bands, frontages, plazas or explicit medians. They do not spawn from arbitrary road-strip intervals inside intersections.

## 17. Authority table

| Domain | Authoritative owner | Not authoritative |
|---|---|---|
| registered mission content | explicit `CampaignSystem.definitions` | archived files/default boot |
| mission progress | `MissionRunner` | UI step/raw coordinate script |
| campaign save | campaign services | runtime proxies |
| player input | `InputSystem` | raw-key feature reads |
| cash/ledger | `WalletSystem` | garage UI |
| authored vehicle condition | `CampaignVehicleSystem` / live `VehicleSystem` | traffic/police proxies |
| maintenance composition | `VehicleMaintenanceService` | wallet/UI alone |
| macro civilian traffic | `MacroTrafficPoliceSystem` | local proxy systems |
| civilian slot | `TrafficMaterializationSystem` | campaign vehicles |
| motorized response unit | `MotorizedPoliceSystem` | civilian traffic/campaign |
| dismounted officer AI | `PoliceSystem` / `NpcSystem` | cruiser state |
| imported city comparison | current district data/compiler manifest | future topology authority |
| future roads/intersections | topology graph + junction objects | overlapping render strips |
| future pedestrian network | connected sidewalk graph | decorative crosswalks |
| future landmark footprint | semantic landmark site | leftover rectangular parcel |

## 18. Diagnostics and testing

Browser diagnostics include campaign, vehicles, maintenance, streaming, civilian traffic, impacts, motorized police and runtime ownership surfaces.

PR domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Reset coverage verifies:

- zero production definitions;
- explicit archived definitions still exercise the generic runner;
- old-save mission pruning without cash loss;
- persistent street free-roam boot;
- no campaign entry, mission board, objective or authored tutorial;
- retired actors inactive/unpinned;
- no protected Old Quarter/fixed landmarks.

Mission-specific Chromium golden paths were deleted because the contracts are no longer production content.

## 19. Current constraints and next extension

Current constraints:

- imported city still contains overlap/readability debt;
- lanes, pedestrian routes and chunks depend on current authored geometry;
- garage and other services still use raw coordinates;
- curved-road offset geometry does not exist yet;
- no production missions are registered.

Next extension: **City Topology & Readability**.

It must introduce unique intersections, explicit road/curb/sidewalk geometry, connected pedestrian routes, valid crosswalks, setbacks, semantic furniture anchors, site-first landmarks and curved/polyline streets before factions or new missions are authored.
