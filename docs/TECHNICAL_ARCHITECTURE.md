# Technical architecture

_Last updated: 2026-07-24_

Read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) for the project-wide map. This document defines runtime ownership, boot composition, campaign/mission registration, persistence boundaries, city-topology policy and testing contracts.

## 1. Runtime and stack

- Phaser 3 browser runtime.
- Native ES modules.
- DOM/CSS overlays for HUD, garage, pause/help and result presentation.
- Data-driven campaign, combat, vehicle, maintenance, traffic and police systems.
- Node built-in test runner for pure/unit coverage.
- Playwright Chromium for boot, systems and campaign/free-roam regressions.
- No backend dependency.

Logical viewport: `960 × 640`. Current world: `4800 × 3600`. The game does not allocate a full-world render canvas.

## 1.1 City Topology V2 and road geometry

`city-road-graph-v1.js` is the authoritative road input. `generate-road-topology.js` compiles its 114 nodes and 158 edges into clipped straight segments, unique junction/transition surfaces, sidewalks, crosswalks, post-layout lights, pedestrian routes and navigation points.

`city-topology-v2.js` remains the generated runtime dataset for world dimensions, semantic anchors, landmark sites, road graph/output geometry, buildings, roofs, sewers, district zones and police topology. `ROAD_GEOMETRY_VERSION` versions the road compiler independently from campaign topology migration.

The renderer accepts rectangle road segments/junctions and polygon transition pieces. `roadCorridors` retains ordered semantic polyline points and future curve hints. Chunk compilation produces a `10 × 8` / 80-file grid.

Generation order:

```text
road graph
→ junction authority
→ clipped segments/transitions
→ segment and junction-owned sidewalks
→ crosswalks
→ prop-exclusion zones
→ building clearance
→ kerb lights and service furniture
→ pedestrian routes/navigation
→ chunks
```

See [`ROAD_GRAPH_GEOMETRY.md`](ROAD_GRAPH_GEOMETRY.md).

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
spawn                      1540, 1515
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
- `TerritorySystem`
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
- `HeatSystem`
- `ExposureSystem`
- `EvidenceSystem`

### World and authored vehicles

- `PropDamageSystem`
- `StreetFurnitureSystem`
- `TerritoryRuntimeSystem`
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
normal gameplay frame
TerritoryRuntimeSystem.update
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
- fourteen district territory records with bounded influence, derived ownership and change history;
- player position/layer, Hunger and loadout;
- authored vehicle ownership, position, angle, hull, parked state and trunk;
- broken props;
- static NPC outcomes, bodies and evidence;
- unlocked refuges and general world flags;
- mission records/checkpoints only for definitions registered by the current build.

Excluded:

- current district-entry presentation state; ownership/influence itself is persistent;
- civilian traffic token/local proxy state;
- motorized cruisers, routes, transient hull and suspect memory;
- temporary traffic/police contact cooldowns.

Authored vehicle condition is campaign state but not mission-checkpoint payload. A checkpoint rollback cannot revert later paid maintenance.


### Territory authority

`TerritorySystem` is the sole campaign authority for district influence, status and ownership. It emits influence and owner-change events; missions and future suppliers/patrols must call its public methods rather than editing `CampaignState.territory` directly.

`TerritoryRuntimeSystem` performs only semantic district lookup and HUD/event publication after the normal gameplay frame. It does not move the player, simulate autonomous territory pressure or duplicate persistent ownership.

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

`TrafficDriverRuntime` is the production civilian locomotion owner, selected by
`TrafficMultiAgentRouteRuntimePolicy` in the existing `GameplayRuntime` update.
Each stable token owns a physical vehicle state and a predefined broad city
circuit. `TrafficJourneyPlanner` joins a distant outbound shortest path to a
return path that avoids its directed lanes, except the closing lane. A one-time
entry leg permits departure from dead ends or approaches outside the cycle.
At the mid-block seam only measured navigation progress wraps: the itinerary,
vehicle identity and physical pose persist. An incomplete network with no broad
cycle retains a finite reachable leg and stops, without inventing a return road.

`TrafficDriverController` issues throttle, brake, reverse and steering controls to
`VehicleModel.stepVehicleKinematics`, the same pure model used by the player's
car. Route samples guide steering and measure progress; they never overwrite a
spawned car's position or heading. Emergency manoeuvres search reachable poses
using the same controls and validate the whole body against pavement, buildings,
vehicles and the player. Blocked steps stop without axis-aligned slides or
rotation in place. Normal queues yield; road width can be used when a safe
emergency manoeuvre exists, including the opposing half of the road. When a
complete bypass is unavailable, the driver can reverse a safe 5–18 units, stop
and reassess, with a cumulative 48-unit retreat limit for the same obstruction.
Existing penetration may decrease only while moving away from the contact;
new contacts and deeper penetration remain forbidden. Wrecks stay disabled.
Queue decisions trace stationary leaders and junction permissions to distinguish
an obstruction or cyclic wait from ordinary right of way.

`TrafficDriverJunctions` grants movement permission and downstream clearance.
Whole-body stop lines account for the widest adjoining road, including short
compiler links whose endpoints lie inside the conflict area. Reservations span
compound crossings until the rear has cleared. Compatible movements may proceed together when their buffered paths do not
intersect; priority uses arrival at the current crossing, without carrying
waiting credit from previous junctions. Recovery is allowed inside crossings:
its swept path is reserved by this same owner. Moving permit holders keep their
priority, stalled future paths can yield, and vehicles clearing the crossing
precede new arrivals. Cleared portions of a compound crossing are released as
the buffered rear moves past. Manoeuvre controls are planned at the current
bounded integration interval and each executed movement is rechecked.

`TrafficMaterializationSystem` owns a fixed pool of 64 local traffic proxies, their
visuals, residency and conversion into a transient player vehicle on theft.
Dormant tokens can appear only on a clear approach, outside the camera and
reserved crossing. Theft retires the driver's materialization token. Proxies are
not campaign vehicles and have no campaign save ownership.

`TrafficPhysicalConsequencesSystem` and the mass/rigid-body policies keep native
push, collision, damage and disablement consequences. A driver consumes a real
impact into its actual pose once. Physics does not decay that position back to a
route, and local presentation does not interpolate a separate catch-up path.
The previous cursor/FSM/offset policies remain explicit controlled regression
harnesses (`driving: false`), with no production movement ownership.

The compiler emits **two lanes per direction on avenues at least 100 units wide**
(120 in this city), and one per direction on narrower roads: **660 directed
lanes**. Through traffic and turns retain their lane index; actual capacity
changes split or merge through validated compiler connectors. A fragment beside
a chunk seam allocates its available trim to the adjacent junction, preventing
curb-lane turns from folding backwards. Impossible forward turning arcs are not
advertised. The driver's whole-body reservations protect these movements; an
exit-blocked request cannot deny traffic that would free its exit. Only a car
with a clear approach can reserve entry: a rear car cannot hold a different
turn over the head of its own queue. Denial
dependencies include waiting approaches and downstream bodies. The bounded
manoeuvre search budget serves the least recently attempted eligible driver,
so early population IDs cannot starve later cars of recovery attempts. Avenue
presentation adds dashed dividers between the parallel lanes.

`MacroTrafficPoliceSystem` apportions exactly **1,000 civilian cars** using
road length and district density with a largest-remainder allocation. The
circuit allocator weights all actual directed lanes, so wide avenues carry
more demand. The **six scheduled buses** are additional service identities;
macro civilian conservation still counts only the 1,000 cars. The fixed 64-slot
local pool is a capacity, not a target number on camera. Eligible buses receive
priority for free slots without overriding visibility or collision guards.

`TrafficPopulationPolicy` allocates their broad circuits once at bootstrap.
Eight deterministic alternatives per driver compete against road and district
capacity; alternatives can originate in underserved districts. Recurring car
routes exclude cul-de-sacs, which otherwise become lane-switch shortcuts;
drivers initially seeded there can still leave. Prescribed bus terminal routes
explicitly allow them. Initial phases spread cars along clear lane interiors
with body separation. If coarse samples are full, a finer body-scale search
finds a clear phase on the same itinerary. The allocator never accepts an
overlapping entry fallback. Compiler geometry,
the original off-camera spawn guard, active/resident chunks and local clearance
still determine physical appearances. No running car is relocated, no circuit
is replaced, and manual legacy populations retain their supplied bootstrap.
Diagnostics distinguish circuit-length-weighted planned occupancy from actual
camera counts. The planned district shares and measured camera density remain separate metrics.

Materialization copies the pose/navigation fields it consumes; gearbox and
other physical internals stay in driver state. Physical drivers publish their
committed slot pose directly, avoiding a duplicate full-city presentation pass.
Route projection searches only the nearby ordered segment range, and bootstrap
return legs skip unused destination selection. An ordered Dijkstra heap
preserves deterministic path ties. A 660-origin audit of the heap substitution,
before the separate cul-de-sac policy change, matched the former linear scan.
Scalar throttle control
uses one shared-model torque sample with the same pressure resolution, and a
per-tick civilian census avoids repeated macro projections.

Macro traffic receives output-only route accounting; legacy civilian phases
do not advance while the driver owns traffic. Police travel, streaming,
campaign vehicles and input retain their existing owners.

`TransitRoutes` selects major curb lanes from that compiler network, then the
same journey planner builds three prescribed itineraries: **C Circular**, **N
Norte–Sur** with a return trip, and **E Este–Oeste** with a return trip. Two buses
per line start at separated stops. `TransitSystem` owns their stop index, lap,
seven-second dwell and capacity of 24 passengers; `TrafficDriverRuntime` remains
their sole mover. A missed stop after a physical bypass advances the schedule
without omitting the remaining stops for an entire lap. A bus displaced beside
an unreachable stop likewise continues to the next one instead of retaining an
impossible zero-speed arrival condition.

Waiting commuters are real NpcSystem entities. NpcSystem executes their walk to
the bus door and away from it, while EntityStreamSystem pins boarding, riding
and alighting actors. Onboard actors are hidden/inactive; later stops restore
those same identities. Transfers into/from dormant buses are allowed only off
screen, preventing visible passengers entering an invisible vehicle. Bus theft
uses the existing transient VehicleSystem transfer, ejects the driver and actual
passengers, and retires that service token.

Enter near a bus opens the existing InteractionSystem chooser with **Subir como
pasajero** and **Robar autobús**. Boarding requires a stopped materialized bus
and space. Passenger input suppresses walking, weapons and powers; the hidden
player and camera follow the real bus. Enter requests a safe exit when stopped.
On-foot impact/crowd/noise paths exclude the rider, checkpoints defer while
occupied, and hospital recovery or layer changes release the passenger state.
There is no new input reader, gameplay loop or campaign persistence owner.

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

The current city is generated and hard-valid:

```text
protectedZones        []
road graph nodes      114
road graph edges      158
road piece overlaps     0
building/road overlaps  0
validation warnings     0
```

`city-road-graph-v1.js` owns road input. `city-topology-v2.js` and the 80 chunk files are generated output. Manual fixes to generated road rectangles are not authoritative.

## 16. Road/pedestrian/furniture authority

### Roads

Edges own centreline connectivity and width. Nodes own intersection classification. Compiled junction/transition surfaces own the centre; clipped edge segments own approaches.

### Pedestrian network

Sidewalk strips/pads derive from final road surfaces. Crosswalks must avoid junction authority and connect two sidewalks. Pedestrian routes and navigation points regenerate afterward.

### Street furniture

Lights are post-layout objects generated only after road, pedestrian and building geometry is final. Semantic light IDs may snap to a nearby valid sidewalk location.

### Remaining geometry extension

Geometry v4 is axis-aligned. A future version may add arbitrary polyline offsets, rounded joins and polygonal ordinary parcels while retaining stable graph/site identities.

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
| police wanted/search authority | `HeatSystem` | `ExposureSystem` / HUD scalar |
| supernatural proof authority | `ExposureSystem` evidence registry | `HeatSystem` / physical scene alone |
| physical evidence interaction | `EvidenceSystem` | global Exposure mutation |
| road input | `city-road-graph-v1.js` nodes/edges | generated rectangle patches |
| road output | clipped segments + junction/transition surfaces | overlapping render strips |
| pedestrian network | generated sidewalks/crosswalks/routes | decorative crossings |
| streetlights | post-layout graph compiler | raw road-interval placement |
| landmark footprint | semantic landmark site | leftover rectangular parcel |

## 18. Diagnostics and testing

Browser diagnostics include campaign, vehicles, maintenance, streaming, civilian traffic, impacts, motorized police and runtime ownership surfaces.

PR domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Current coverage verifies:

- road graph connectivity, junction authority and zero overlap;
- valid crosswalk continuations and post-layout light clearances;
- deterministic 80-chunk regeneration;
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

- geometry v4 accepts axis-aligned edges only;
- arbitrary curved offsets and rounded carriageway joins are not implemented;
- ordinary parcel/building bounds remain rectangular at runtime;
- graph changes require atomic regeneration of pedestrian routes and chunks;
- no production missions are registered.

Next product phase: **original factions and territory**. Future geometry versions must preserve semantic sites, graph identities and the hard overlap/continuation/furniture validation introduced here.
