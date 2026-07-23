# Vampire District — project blueprint

_Last updated: 2026-07-23_

## Purpose

This is the canonical high-level blueprint for the project. It defines the playable product, campaign authority, runtime architecture, vehicle/city/traffic boundaries and current production sequence.

Detailed subsystem documents remain authoritative for tuning values and acceptance records. This is the first document an AI, developer or reviewer should read before changing the project.

## Product identity

**Vampire District** is a pure top-down urban action, stealth and crime game with readable streets, vehicles, police pressure, short missions and systemic chaos, rebuilt around an original vampire setting.

> GTA2-like city structure; Vampire District consequences.

Streets, traffic, vehicles, weapons, factions, territory, cash and rapid navigation remain core pillars. Rooftops, sewers, Hunger, feeding, the Veil, powers, Retainers and supernatural politics create the project identity.

The project does not use licensed vampire factions, terminology, lore, symbols or ranks.

## Current accepted baseline

Accepted `main` before Milestone 13.6:

```text
4ebece7045e173093d5e00d76362fe9610aa4596
```

That baseline includes:

- Phaser 3 browser runtime using native ES modules;
- street, low-rooftop, high-rooftop and sewer layers;
- opening journalist mission and `Clean the Scene` contract;
- data-driven campaign state, rewards, checkpoints and save/load;
- combat, draining, Hunger, powers, witnesses, evidence and police escalation;
- an expanded `2400 × 1440` multi-ward district;
- persistent authored vehicles with arcade driving, hull, trunks and repair/recovery;
- chunk streaming, district packs, dormancy and macro traffic;
- ten pooled civilian traffic proxies with following, junction priority and impact consequences;
- consolidated blueprint, snapshot, architecture and roadmap;
- unit, boot, systems and campaign Chromium validation.

### Accepted extension — Milestone 13.6

PR #31 adds bounded motorized police response:

- one pursuit cruiser at wanted level 2;
- a second partial roadblock cruiser at wanted level 3;
- deterministic district routing on authored lane polylines;
- fixed local pool of two cruiser containers;
- officer reservation while crews remain inside cruisers;
- exact-once transfer into the existing foot `PoliceSystem`;
- local collision, cruiser disablement and forced dismount;
- four-second abandoned suspect-car memory;
- rooftop/sewer hiding without deleting macro response state;
- effective stress diagnostics that preserve total 5/7 police pressure.

Implementation head `f657785d234330311d7aa198a2f566471acff267` passed unit, boot, systems and campaign CI together. Detailed record: `MOTORIZED_POLICE.md`.

## World structure

```text
logical viewport     960 × 640
world                 2400 × 1440
world area            3,456,000 units²
original area ratio   5.625×
```

The original mission quarter retains authored coordinates. Glasshouse, Foundry, Canal, Blackwater and Harbor are connected by avenues, boulevards, alleys, sidewalks, crossings, sewer arteries and rooftop routes.

Layer contract:

```text
street
low rooftop
high rooftop
sewer
```

Vehicles, garages, civilian traffic and local police cruisers exist only on the street layer. The player can abandon a vehicle and escape vertically or through sewers.

## Campaign authority

`CampaignState` and `MissionRunner` own persistent campaign truth.

Persistent campaign state includes:

- mission availability, active mission and completion;
- latest safe checkpoint;
- cash and immutable transaction ledger;
- faction/contact reputation;
- loadout and ammunition;
- persistent authored vehicle condition and trunks;
- broken props, static NPC outcomes, bodies and evidence;
- tutorial/informant state.

`MissionSystem` presents the active definition but does not maintain a second objective index. Rewards and completion checkpoints are idempotent.

Current playable missions:

1. opening journalist contract;
2. `Clean the Scene` refuge-board contract.

### Vehicle maintenance authority

```text
VehicleMaintenanceService
  → WalletSystem
  → CampaignVehicleSystem
  → vehicle:maintenance-completed
  → CampaignSystem touch/save
  → VehicleSystem live synchronization
```

Silent intermediate mutations plus one final event prevent a saved debit without its vehicle result. Campaign checkpoints do not own authored vehicle condition, so an older checkpoint cannot undo a paid repair or tow recovery.

### Motorized police persistence boundary

Motorized response cruisers are **transient wanted-response state**:

- not in `CampaignState`;
- not in `VehicleSystem.vehicles`;
- not civilian traffic tokens;
- no trunk, ownership or campaign repair eligibility;
- discarded when the wanted response retires.

Once officers dismount, they become normal police NPCs owned by `NpcSystem`/`PoliceSystem` for the remainder of that runtime response.

## Core gameplay loops

### On foot

```text
move / aim
→ traverse or interact
→ attack, power or drain
→ manage Hunger and exposure
→ evade witnesses and police
→ complete objective
→ return/report/checkpoint
```

### Vehicle

```text
find vehicle
→ enter with Enter
→ accelerate, brake, reverse and steer
→ drift with Space
→ collide, damage props or hit pedestrians
→ trigger civilian traffic and police response
→ abandon the car or evade road interception
→ repair at the refuge garage or tow a wreck
→ continue on foot, rooftops or sewers
```

### Controls

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
M               mission panel
H               pause/help/accessibility
```

`InputSystem.beginFrame()` remains the only authoritative browser/world input boundary.

## Runtime ownership

```text
GameScene.update
  → GameplayRuntime.update
```

`GameplayRuntime` owns deterministic system ordering and temporary input adaptation. Specialist systems own their domain state and public operations; no feature may add a second world frame loop.

### Campaign and presentation

- `CampaignState`
- `CampaignEventBus`
- `CampaignSystem`
- `MissionRunner`
- `MissionSystem`
- `WalletSystem`
- `CampaignVehicleSystem`
- `VehicleMaintenanceService`
- campaign entry and refuge contract board
- `VehicleMaintenanceUiSystem`
- `StatePublisher`
- tutorial/task/objective/UX systems

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

### Large-city streaming and civilian traffic

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

## Large-city update order

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

This order guarantees:

1. city resources and dormancy are current;
2. macro traffic/police graph state advances before local presentation;
3. civilian proxies receive current lane state;
4. local traffic behaviour and impacts resolve first;
5. motorized police sample the final local road occupancy;
6. newly dismounted officers enter the normal police/NPC frame;
7. player and AI consume final positions only once.

Vehicle maintenance remains event-driven outside the frame loop.

## City streaming and traffic phases

### Base streaming

- asynchronous chunk files;
- retry/cancellation and activation budgets;
- LRU retention;
- spatial static queries;
- chunk-local deltas.

### 4A–4B

- district resource packs and road-aware prefetch;
- low-frequency dormant pedestrians;
- district macro graph;
- abstract civilian traffic tokens;
- dormant police travel and patrol recovery.

### 4C–4F

- fixed pool of ten civilian traffic containers;
- explicit forward/reverse lane polylines;
- stable token-to-slot identity and interpolation;
- following, queues, braking and junction priority;
- bounded soft contact and lane recovery;
- hard/severe impact damage, exposure, local heat and cooldown.

Detailed records: `CITY_STREAMING.md` and `CITY_STREAMING_4A.md` through `CITY_STREAMING_4F.md`.

## Motorized police rules

### Wanted-level deployment

```text
wanted 0–1   no cruisers
wanted 2     pursuit cruiser · 2 reserved officers
wanted 3     pursuit + partial roadblock · 4 reserved officers
```

Public total targets remain:

```text
wanted 0  → 2
wanted 1  → 3
wanted 2  → 5
wanted 3  → 7
```

`PoliceSystem.desiredCount()` returns the total. `footDesiredCount()` subtracts crews still inside cruisers. Release-candidate diagnostics expose `footPolice`, `reservedPolice` and effective `police` pressure.

### Macro/local split

- distant cruiser travel is abstract and follows graph/lane routes;
- local blockers apply when the candidate position enters the 920-unit materialization window;
- one pursuit cruiser intercepts/dismounts;
- one level-three cruiser stops at 72% of its final leg and rotates across one lane;
- only one partial roadblock is allowed;
- locally trapped or disabled cruisers deploy their crews;
- rooftop/sewer transitions hide cruisers while retaining macro state.

### Officer transfer

`PoliceSystem.spawnMotorizedOfficers()` creates stable unit-derived police NPCs exactly once. After transfer, ordinary police search, containment, attack, recovery and patrol authority applies.

## Vehicle authority boundaries

### Persistent authored vehicles

Own identity, archetype, ownership, hull, disabled state, position, angle, parked state, trunk, campaign persistence and maintenance eligibility.

### Civilian traffic proxies

- fixed pool of ten;
- not enterable, stealable, repairable or persistent;
- no health, trunk or ownership;
- temporary macro/local traffic state only.

### Motorized police cruisers

- fixed pool of two;
- transient wanted-response identity, route, health and local obstacle state;
- not campaign vehicles and not civilian tokens;
- can be damaged locally and force officer dismount;
- disappear when the wanted response retires.

### Refuge garage baseline

```text
location             304, 326 on street
repair radius        96
minimum repair       $25
compact repair       $3 per missing hull
compact recovery     $120
recovery condition   35% hull
```

## Testing strategy

PR validation domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Automated coverage includes:

- input/UI ownership;
- campaign entry, checkpoints and rewards;
- authored vehicle driving, damage, maintenance and recovery;
- city streaming and civilian traffic 4A–4F;
- motorized wanted-level counts and roles;
- graph/lane routing and partial roadblock stop;
- local blocker boundary;
- officer reservation and exact-once dismount;
- cruiser collision/disablement;
- rooftop hiding and abandoned-car memory;
- effective level-three police stress;
- no runtime ownership conflicts.

A feature is complete only when implementation, tests and documentation agree.

## Locked design decisions

- pure top-down readability;
- original setting and terminology;
- streets, vehicles, traffic, factions and urban chaos remain core;
- sight and hearing remain separate;
- Enter owns vehicle entry/exit;
- Space owns traversal on foot and handbrake while driving;
- campaign state has one objective authority;
- persistent vehicles, civilian traffic and police cruisers remain separate models;
- large-city scale uses streaming/dormancy;
- maintenance uses existing wallet/vehicle-condition authorities;
- paid maintenance is idempotent and checkpoint-safe;
- motorized police preserve total 5/7 officer pressure;
- roadblocks remain partial and preserve vertical/sewer escape;
- dismounted officers use existing police AI;
- accessibility cannot alter gameplay geometry;
- ammunition is finite and refuge/safehouse-managed;
- Retainers have agency, upkeep and failure states.

## Active risks

1. Browser-system regression time continues to grow.
2. Cruiser speed, dismount distance and roadblock placement need playtesting.
3. Full intra-district vehicle pursuit remains deferred; current units deliver pressure at district boundaries.
4. Traffic density and police response must remain readable and bounded.
5. Repair/economy tuning may become irrelevant or punitive.
6. Faction/territory design can become cosmetic unless it changes missions, patrols, suppliers and safehouses.
7. Retainers can become menu-only bonuses.
8. Commercial-facing names require trademark clearance.

## Active production sequence

### Complete: vehicle repair and recovery

Milestone 12.1 delivered atomic costed repair, tow recovery, idempotence, rollback and checkpoint-safe vehicle synchronization.

### Complete: civilian traffic and motorized police

Milestone 13 delivered:

- large-city streaming and dormancy;
- macro/local civilian traffic;
- soft and hard traffic consequences;
- pursuit cruiser at wanted 2;
- partial roadblock at wanted 3;
- bounded officer reservations and foot-AI transfer;
- collision, disablement and vertical escape compatibility.

### Next: original factions and territory foundation

Milestone 14 should establish:

- canonical original faction definitions and IDs;
- district/territory ownership data;
- faction/contact reputation gates;
- safehouse, supplier and vehicle associations;
- patrol/hostility consequences;
- mission-definition hooks without hard-coded parallel progression;
- browser diagnostics and migration-safe campaign state.

### Later

- stash and ammunition economy;
- Retainers and role-specific services;
- expanded arsenal and vehicle combat;
- district campaign content.

## Maintenance rule

Update this blueprint and the relevant detailed document in the same PR when changing:

- runtime ownership or update order;
- campaign/save authority;
- controls;
- city dimensions or streaming policy;
- vehicle/traffic/police persistence boundaries;
- impact, maintenance, police or exposure consequences;
- faction/territory authority;
- active production priority;
- locked design decisions.
