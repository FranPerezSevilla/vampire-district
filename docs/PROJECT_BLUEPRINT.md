# Vampire District — project blueprint

_Last updated: 2026-07-23_

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

Accepted `main` baseline before the city-topology reset:

```text
b2307569d742f927a403de605ad8fe9abe1f0a9c
```

It contains:

- Phaser 3 browser runtime using native ES modules;
- street, low-rooftop, high-rooftop and sewer layers;
- mouse-directed combat, draining, Hunger and powers;
- witnesses, evidence, police search, wanted escalation and helicopter pressure;
- arcade vehicles with persistent hull condition and trunks;
- refuge garage repair and owned-wreck recovery;
- a `2400 × 1440` imported multi-ward district;
- asynchronous chunks, dormancy, macro traffic and ten pooled civilian traffic proxies;
- local traffic following, junction priority, physical contact and impact consequences;
- motorized police pursuit, one partial roadblock and officer transfer to foot AI;
- unit, boot, systems and campaign Chromium validation.

### City-topology reset candidate

PR #32 removes authored mission registrations and their authority over city layout:

- zero production mission definitions;
- old mission saves pruned while unrelated campaign state survives;
- normal boot enters persistent street free roam;
- campaign entry, mission board and authored tutorial are not booted;
- retired mission actors are inactive;
- `old-quarter` is no longer protected;
- the current City Compiler baseline has no fixed landmarks;
- future landmarks use a site-first policy;
- city topology/readability becomes the active production phase.

Detailed record: `CITY_TOPOLOGY_RESET.md`.

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
normal spawn             street 438, 326
```

Archived mission definitions remain source-controlled examples and can be passed explicitly to `CampaignSystem` in tests. They are not production content.

## World structure

Current imported runtime dimensions:

```text
logical viewport     960 × 640
world                 2400 × 1440
world area            3,456,000 units²
```

Current layers:

```text
street
low rooftop
high rooftop
sewer
```

The imported geometry is now a comparison baseline, not a protected target. The entire Old Quarter may be regenerated, moved or removed.

## City topology policy

The next city cannot be generated as independent horizontal/vertical road strips with sidewalk bands painted on top of one another.

The authoritative model must become:

```text
terrain / district constraints
→ landmark sites
→ road graph and unique intersection geometry
→ carriageway, curb and connected sidewalk geometry
→ ordinary blocks and polygonal parcels
→ ordinary buildings
→ crossings and street furniture from semantic anchors
→ validation
```

### Intersection authority

Each intersection is one unique topological object. Straight-road sidewalk/curb bands stop at its boundary; they are not overdrawn through the crossing.

Supported topology must eventually include:

- straight segment;
- curve/polyline;
- T junction;
- cross junction;
- non-orthogonal junction;
- service access;
- dead end or turning area;
- plaza/campus approach.

### Pedestrian authority

Sidewalks form an explicit graph. Crosswalks only exist when they connect two valid pedestrian nodes across a real carriageway.

No crosswalk may terminate:

- inside a road;
- against a building footprint;
- in an empty parcel without pedestrian continuation;
- inside duplicated intersection sidewalk geometry.

### Parcel and building authority

Ordinary buildings occupy validated polygonal parcels with setbacks from:

- carriageway;
- curb/sidewalk;
- intersection clearance;
- service/fire access where required.

The model must not assume all parcels, blocks or buildings are rectangles.

### Site-first landmarks

Important buildings reserve a complete urban site before local roads and ordinary blocks are finalized.

Examples:

- police station and secure yard;
- hospital campus and emergency access;
- church with plaza/garden/cemetery;
- industrial plant and loading yard;
- civic complex, station, large club or mansion.

A landmark site may contain compound/polygonal footprints, forecourts, parking, service space and pedestrian approaches. Roads may curve around or toward it.

This guarantees that large landmarks are not squeezed into rectangular leftovers between parallel streets.

### Street furniture authority

Lamps, bins and similar props attach to semantic anchors:

- sidewalk corners;
- valid straight sidewalk furniture bands;
- building/site frontage points;
- authored plazas or medians where defined.

They do not spawn from arbitrary road-strip intervals inside intersections.

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
garage                 street 304, 326
repair radius          96
minimum repair         $25
compact repair         $3 per missing hull
compact recovery       $120
recovery condition     35% hull
```

Maintenance composes wallet and persistent vehicle condition as one atomic transaction. It remains usable in missionless persistent free roam.

The garage position is part of the imported baseline and may move during topology redesign; the service must eventually bind to a semantic garage site rather than a permanent raw coordinate.

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

1. Current imported road/building/crosswalk geometry visibly contains overlap debt.
2. Rebuilding topology can invalidate vehicle lanes, pedestrian routes, streaming chunks and police response together.
3. Curved roads require robust offset geometry for lanes, curbs and sidewalks.
4. Site-first landmarks need enough urban space without producing empty campuses.
5. Freeing the Old Quarter may temporarily reduce authored narrative content to zero.
6. Browser-system regression time continues to grow.
7. Economy and factions must wait until the city has stable semantic sites.
8. Commercial-facing names still require trademark clearance.

## Active production sequence

### Complete/candidate: narrative constraint retirement

- zero production contracts;
- persistent free-roam boot;
- old-save pruning;
- retired mission actors inactive;
- no protected district/fixed compiler landmark;
- archived definitions remain explicit test/reference content.

### Next: city topology and readability

1. authoritative road graph and unique intersections;
2. explicit carriageway/curb/sidewalk bands;
3. connected pedestrian network and valid crosswalks;
4. building and landmark-site setbacks;
5. semantic lamp/furniture anchors;
6. polygonal/compound landmark sites;
7. curved/polyline roads;
8. compiler rejection of overlap/dead pedestrian geometry;
9. regenerate or replace the Old Quarter without compatibility constraints;
10. retune traffic/police/pedestrian routes against the accepted topology.

### After topology stabilizes

- original factions and territory;
- safehouses, stash and ammunition economy;
- Retainers;
- expanded arsenal and vehicle combat;
- new district campaign authored against semantic city sites.

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
