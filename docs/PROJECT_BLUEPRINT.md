# Vampire District — project blueprint

_Last updated: 2026-07-24_

## Purpose

This is the canonical high-level blueprint for the project. It defines the playable product, campaign authority, runtime architecture, vehicle/city/traffic boundaries, city-generation policy and current production sequence.

Detailed subsystem documents remain authoritative for tuning values and acceptance records. This is the first document an AI, developer or reviewer should read before changing the project.

## Current city foundation

City Topology V2 replaces the former protected core:

- world: `4800 × 3600`;
- area: exactly five times the previous `2400 × 1440` world;
- streaming grid: `10 × 8`, 80 asynchronous chunk files;
- fourteen unprotected districts;
- site-first hospital, police headquarters, city hall, cathedral and university;
- connected road graph with bend/curve-ready corridor metadata;
- future missions consume semantic sites only after topology acceptance.

## Product identity

**Vampire District** is a pure top-down urban action, stealth and crime game with readable streets, vehicles, police pressure and systemic chaos, rebuilt around an original vampire setting.

> GTA2-like city structure; Vampire District consequences.

Streets, traffic, vehicles, weapons, factions, territory, cash and rapid navigation remain core pillars. Rooftops, sewers, Hunger, feeding, the Veil, powers, Retainers and supernatural politics create the project identity.

The project does not use licensed vampire factions, terminology, lore, symbols or ranks.

## Current baseline

The accepted City Topology V2 foundation contains:

- Phaser 3 browser runtime using native ES modules;
- street, low-rooftop, high-rooftop and sewer layers;
- mouse-directed combat, draining, Hunger and powers;
- witnesses, evidence, police search, wanted escalation and helicopter pressure;
- arcade vehicles with persistent hull condition and trunks;
- refuge garage repair and owned-wreck recovery;
- a `4800 × 3600`, fourteen-district site-first city;
- a 114-node / 158-edge authoritative road graph;
- 153 clipped straight road pieces and 111 junction authorities with zero overlap;
- generated sidewalks, crossings, post-layout lights and pedestrian loops;
- asynchronous `10 × 8` chunks, dormancy, macro traffic and ten pooled civilian traffic proxies;
- motorized police pursuit, one partial roadblock and officer transfer to foot AI;
- unit, browser boot, systems and campaign validation.

The production mission registry remains empty so missions cannot regain authority over city geometry.

## Current playable mode

The public build is currently a persistent urban sandbox used to validate the core systems and redesign the city.

```text
registered contracts    0
active contract          none
campaign persistence     enabled
wallet/reputation        enabled
owned vehicles           enabled
vehicle maintenance      enabled
police/traffic           enabled
entry modal              disabled
mission board            disabled
authored tutorial        disabled
normal spawn             street 1540, 1515
```

Archived mission definitions remain source-controlled examples and can be passed explicitly to `CampaignSystem` in tests. They are not production content.

## World structure

Current runtime dimensions:

```text
logical viewport     960 × 640
world                4800 × 3600
world area           17,280,000 units²
streaming grid       10 × 8 / 80 chunks
```

Current layers:

```text
street
low rooftop
high rooftop
sewer
```

Every district, including `old-quarter`, is unprotected and may change through the city compiler.

## City topology policy

The implemented authority order is:

```text
terrain / district constraints
→ site-first landmarks and buildings
→ authoritative road graph
→ unique junction/transition geometry
→ clipped carriageway segments
→ segment and junction-owned sidewalks
→ crosswalks and prop-exclusion zones
→ post-layout kerb lights and service furniture
→ pedestrian routes/navigation
→ validation and streamed chunks
```

### Road and intersection authority

`tools/city-compiler/city-road-graph-v1.js` owns road connectivity and widths. Every graph node owns exactly one junction or transition surface. Straight segments stop at those surfaces instead of being overdrawn through them.

Current geometry v2 supports ends, straight continuations, corners, T junctions, crossroads, complex clusters and collinear width-transition polygons. It is axis-aligned; true arbitrary-angle/curved offset geometry remains a future version.

### Pedestrian authority

Sidewalks are derived from final clipped segments, then junction-owned closures and corner surfaces complete the local pedestrian envelope without drawing internal end-cap seams. Crosswalks are generated only outside junction centres and only when both ends continue onto valid sidewalks. Semantic pedestrian route IDs are regenerated onto those surfaces.

### Street furniture authority

Streetlights and dumpsters are generated after roads, junctions, sidewalks, crossings and building clearances. They snap to semantic kerb/service anchors and may not overlap roads, crossings, buildings, junction approaches or another nearby prop.

### Parcel and landmark authority

Important buildings reserve complete sites before roads and ordinary parcels. Buildings remain validated against all generated road surfaces. Polygonal ordinary parcels and truly curved roads are still future compiler work; neither is required to repair the current intersection/furniture failures.

Detailed contract: [`ROAD_GRAPH_GEOMETRY.md`](ROAD_GRAPH_GEOMETRY.md).

## Campaign authority

`CampaignState`, `CampaignSystem` and `MissionRunner` retain persistent campaign infrastructure.

Persistent campaign state includes:

- cash and immutable transaction ledger;
- faction/contact reputation;
- player loadout and ammunition;
- authored vehicle condition and trunks;
- broken world props;
- static NPC outcomes, bodies and evidence;
- unlocked refuges and general world flags;
- mission records/checkpoints only for definitions registered by the current build.

### Production registry

```text
CampaignSystem DEFAULT_DEFINITIONS = []
```

No authored contract is automatically started.

When a save contains mission IDs absent from the current definition registry, the campaign prunes:

- stale active mission ID;
- unregistered mission records;
- unregistered completed/failed IDs;
- checkpoint belonging to an unregistered mission.

Cash, reputation, inventory, vehicles and unrelated world state remain intact.

### Generic future mission boundary

Future missions must:

- be registered explicitly;
- refer to stable semantic sites/roads/districts rather than legacy raw coordinates where possible;
- use `MissionRunner` as the only objective authority;
- declare checkpoint safety and completion policy;
- never cause a district or road arrangement to become permanently protected by accident.

## Core gameplay loops

### Current free roam

```text
move / drive / traverse
→ fight, feed, use powers or interact
→ create witnesses, evidence and police pressure
→ evade on streets, rooftops or sewers
→ manage Hunger, vehicle hull and cash
→ repair/recover owned vehicles
→ continue systemic exploration
```

### Future contract loop

```text
accept explicitly registered contract
→ solve through city systems
→ produce persistent consequences
→ report/complete/checkpoint
→ unlock faction, territory or economy changes
```

## Controls

```text
WASD / arrows   movement or vehicle control
Shift           quiet movement on foot
Enter           vehicle enter / exit only
Space           traversal on foot; handbrake while driving
E               non-traversal interaction, trunk or garage
Mouse           aim and facing
Left mouse      equipped attack
Right mouse     drain valid target
Wheel           cycle owned weapons
Q               Dash
R               Whisper
F               Blood Sense
M               mission panel (empty when no contract)
H               pause/help/accessibility
```

`InputSystem.beginFrame()` is the only authoritative browser/world input boundary.

## Runtime ownership

```text
GameScene.update
  → GameplayRuntime.update
```

No feature may add a second world frame loop or duplicate gameplay authority.

### Campaign and state

- `CampaignState`
- `CampaignEventBus`
- `CampaignSystem`
- `MissionRunner`
- generic `MissionSystem`
- `WalletSystem`
- `ReputationSystem`
- `CampaignVehicleSystem`
- `VehicleMaintenanceService`
- `CampaignCheckpointSystem`
- `StatePublisher`

Production does not instantiate campaign-entry or mission-board systems while the registry is empty.

### Player and combat

- `InputSystem`
- `WeaponSystem`
- `CombatSystem`
- `DrainSystem`
- `PlayerDamageSystem`
- `MovementNoiseSystem`
- `PowersSystem`
- `FeedingSystem`

### NPC, perception and police

- `NpcSystem`
- `AiStateSystem`
- `PedestrianSystem`
- `WitnessSystem`
- `SensoryAwarenessSystem`
- `PoliceSystem`
- `PoliceViolenceSystem`
- `MotorizedPoliceSystem`
- `HunterSystem`
- `ExposureSystem`
- `EvidenceSystem`

### World and vehicles

- `PropDamageSystem`
- `StreetFurnitureSystem`
- `VehicleSystem`
- `VehicleModel`
- `VehicleDriving`
- `VehicleMaintenanceUiSystem`

### Large-city streaming and traffic

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

## Authoritative frame order

```text
ChunkStreamSystem
DistrictPackSystem
EntityStreamSystem
DistantSimulationSystem
MacroTrafficPoliceSystem
TrafficMaterializationSystem
TrafficLocalBehaviorSystem
TrafficPhysicalConsequencesSystem
TrafficImpactConsequencesSystem
MotorizedPoliceSystem
PedestrianSystem
normal GameplayRuntime frame
```

Motorized police samples current macro/local road state, then any dismounted officers enter the existing normal NPC/police frame.

Vehicle maintenance and campaign transactions remain event-driven outside the frame loop.

## Vehicle and traffic boundaries

### Persistent authored vehicles

Own:

- identity/archetype;
- ownership/status;
- hull/disabled state;
- position/heading/parked state;
- trunk;
- campaign persistence;
- maintenance eligibility.

### Civilian traffic proxies

- fixed pool of ten;
- macro token plus local presentation/behaviour state;
- no entry, theft, ownership, hull, trunk, repair or save data.

### Motorized police cruisers

- fixed transient pool of two;
- no campaign ownership or save data;
- wanted level 2: one pursuit unit;
- wanted level 3: pursuit plus one partial roadblock;
- crews count toward the existing 5/7 total while reserved;
- after dismount, `PoliceSystem` owns the officers;
- cruisers hide on non-street layers but macro response remains.

## Vehicle maintenance

```text
garage                 street 1540, 1575
repair radius          96
minimum repair         $25
compact repair         $3 per missing hull
compact recovery       $120
recovery condition     35% hull
```

Maintenance composes wallet and persistent vehicle condition as one atomic transaction. It remains usable in missionless persistent free roam.

The garage uses the semantic City Topology V2 garage anchor and can move with a future topology version.

## Testing strategy

PR validation domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Current coverage includes:

- empty production mission registry;
- explicit archived definitions still exercising generic `MissionRunner` behaviour;
- old-save mission pruning without cash loss;
- direct persistent free-roam boot;
- no entry modal, board, objective or authored tutorial;
- no protected Old Quarter/fixed compiler landmarks;
- vehicles, maintenance, traffic and police regressions;
- city compiler validation and legacy-overlap diagnostics;
- motorized pursuit, roadblock and crew transfer.

Mission-specific browser golden paths were removed because the contracts are no longer production content.

## Locked decisions

- pure top-down readability;
- original setting and terminology;
- streets, vehicles, traffic, factions and urban chaos remain core;
- sight and hearing stay separate;
- Enter owns vehicle entry/exit;
- Space owns traversal/handbrake;
- campaign persistence remains active even with zero missions;
- mission definitions are explicit content, not hidden defaults;
- mission coordinates cannot protect city topology;
- current imported geometry is replaceable;
- intersections have one geometry authority;
- sidewalks form a connected pedestrian graph;
- landmarks are site-first and may shape curved roads;
- parcels/buildings may be polygonal or compound;
- persistent vehicles, civilian traffic and police cruisers remain separate authorities;
- large-city scale uses streaming/dormancy;
- paid maintenance remains idempotent and checkpoint-safe;
- ammunition is finite and safehouse-managed when that economy is implemented;
- accessibility cannot alter hit geometry or gameplay state.

## Active risks

1. Road graph changes can invalidate traffic lanes, pedestrian routes, streaming chunks and police response together, so regeneration must remain atomic.
2. Curved roads require robust offset geometry for lanes, curbs and sidewalks.
3. Future polygonal parcels need collision and streaming support beyond rectangular bounds.
4. Site-first landmarks need enough urban space without producing empty campuses.
5. Freeing the Old Quarter may temporarily reduce authored narrative content to zero.
6. Browser-system regression time continues to grow.
7. Economy and factions must wait until the city has stable semantic sites.
8. Commercial-facing names still require trademark clearance.

## Active production sequence

### Complete: narrative constraint retirement

- zero production contracts;
- persistent free-roam boot;
- old-save pruning;
- no protected district or mission-coordinate landmark authority.

### Complete: City Topology V2 and road geometry v2

- `4800 × 3600`, fourteen districts and 80 chunks;
- site-first civic/landmark campuses;
- authoritative road graph;
- unique corners, T junctions and crossroads;
- clipped segments and supported tapered width transitions;
- generated segment and junction-owned sidewalks/crosswalks;
- explicit junction/crosswalk prop-exclusion zones;
- post-layout kerb lights and service dumpsters;
- compiler/browser regression coverage.

### Next

- original factions and territory;
- safehouses, stash and ammunition economy;
- Retainers;
- expanded arsenal and vehicle combat;
- new district campaign authored against semantic city sites.

True arbitrary-angle/curved road geometry and polygonal ordinary parcels remain later compiler extensions, not blockers for the current production sequence.

## Maintenance rule

Update this blueprint and the relevant detailed document in the same PR when changing:

- runtime ownership or update order;
- campaign/save or mission registration authority;
- controls;
- city dimensions, topology or streaming policy;
- landmark/site/parcel policy;
- vehicle/traffic/police persistence boundaries;
- active production priority;
- locked design decisions.
