# Vampire District — project blueprint

_Last updated: 2026-07-22_

## Purpose

This is the canonical high-level blueprint for the project. It explains the playable product, campaign authority, runtime architecture, vehicles, city streaming, traffic and current production priorities.

Detailed subsystem documents remain authoritative for tuning values and acceptance records. This is the first document an AI, developer or reviewer should read before changing the project.

## Product identity

**Vampire District** is a pure top-down urban action, stealth and crime game with readable streets, vehicles, police pressure, short missions and systemic chaos, rebuilt around an original vampire setting.

> GTA2-like city structure; Vampire District consequences.

Streets, traffic, vehicles, weapons, factions, territory, cash and rapid navigation remain core pillars. Rooftops, sewers, Hunger, feeding, the Veil, powers, Retainers and supernatural politics create the project identity.

The project does not use licensed vampire factions, terminology, lore, symbols or ranks.

## Current production baseline

The accepted `main` baseline before Milestone 12.1 is:

```text
a424e0f6e1c2e52d9851bdbff129276c470478c6
```

It includes:

- Phaser 3 browser runtime using native ES modules;
- street, low-rooftop, high-rooftop and sewer layers;
- opening journalist mission and `Clean the Scene` contract;
- data-driven campaign state, objectives, rewards, checkpoints and save/load;
- mouse-directed combat, draining, Hunger and powers;
- witnesses, evidence, police search, wanted escalation and helicopter pressure;
- an expanded `2400 × 1440` multi-ward district;
- arcade vehicles with Enter entry/exit and Space handbrake;
- persistent hull condition, trunks, pedestrian impacts and destructible street furniture;
- chunk streaming, district packs, dormancy and macro traffic;
- pooled local traffic with following, junction priority and impact consequences;
- canonical project documentation consolidated in `PROJECT_BLUEPRINT.md`;
- unit, boot, systems and campaign Chromium validation.

### Active implementation candidate — Milestone 12.1

PR #30 adds:

- a costed refuge vehicle garage;
- full repair for owned, parked vehicles at the garage;
- tow recovery for owned wrecks from anywhere in the district;
- atomic wallet debit plus vehicle-condition update;
- immediate synchronization of campaign and live Phaser vehicle state;
- idempotent repeat operations and rollback on transaction failure;
- wanted-level and location safety gates;
- accessible dialog and browser diagnostics.

Detailed record: `VEHICLE_MAINTENANCE.md`.

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

Vehicles, garages and local traffic exist on the street layer. The player can abandon a vehicle and escape through rooftops or sewers.

## Campaign authority

`CampaignState` and `MissionRunner` own persistent campaign truth.

Campaign state includes:

- mission availability, active mission and completion;
- latest safe checkpoint;
- cash and immutable transaction ledger;
- faction/contact reputation;
- player loadout and ammunition;
- persistent authored vehicle condition and trunks;
- broken world props;
- static NPC outcomes, bodies and evidence;
- tutorial/informant state.

`MissionSystem` presents the active definition but does not maintain a second objective index. Rewards and completion checkpoints are idempotent.

Current playable missions:

1. opening journalist contract;
2. `Clean the Scene` refuge-board contract.

### Vehicle maintenance authority

`VehicleMaintenanceService` belongs to the campaign service graph. It composes existing authorities rather than adding a new condition model:

```text
VehicleMaintenanceService
  → WalletSystem
  → CampaignVehicleSystem
  → vehicle:maintenance-completed
  → CampaignSystem touch/save
```

The operation uses silent wallet and condition mutations followed by one final event. If any step fails, cash, ledger, sequences, world flags and event log are restored.

Campaign checkpoints do not own authored vehicle condition, so restoring an older safe checkpoint cannot undo a paid repair or tow recovery.

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
→ accumulate hull damage / evidence / police pressure
→ repair at the refuge garage or tow a wreck
→ use trunk or abandon vehicle
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

`GameplayRuntime` owns system ordering and temporary input adaptation. Specialist systems own their domain state and public operations; no feature may add a second frame loop.

### Campaign and presentation

- `CampaignState`
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
- `HunterSystem`
- `ExposureSystem`
- `EvidenceSystem`

### World and vehicles

- `PropDamageSystem`
- `StreetFurnitureSystem`
- `VehicleSystem`
- `VehicleModel`
- `VehicleDriving`

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
PedestrianSystem
normal GameplayRuntime frame
```

This means resources and dormant state update before macro traffic; materialization follows macro authority; local behaviour precedes physical contact; high-speed consequences observe completed contact; the normal player/NPC frame consumes final local state.

Vehicle maintenance is event-driven and not part of the frame loop. Its dialog pauses the world and commits one explicit campaign transaction.

## City streaming phases

### Base

- asynchronous chunk files;
- retry/cancellation and activation budgets;
- LRU retention;
- spatial static queries;
- chunk-local deltas.

### 4A

- district resource packs;
- road-aware prefetch;
- low-frequency dormant pedestrians.

### 4B

- district macro graph;
- abstract traffic tokens;
- dormant police travel;
- district-local patrol recovery.

### 4C

- fixed pool of ten traffic containers;
- explicit forward/reverse lane polylines;
- stable token-to-slot identity;
- smooth macro interpolation and hysteresis.

### 4D

- following distance and queues;
- braking for player/authored vehicles;
- bounded catch-up;
- deterministic junction priority.

### 4E

- bounded soft proxy push;
- blocked contact when displacement is unsafe;
- temporary physical offsets and lane recovery;
- no damage or police response for soft contact.

### 4F

```text
soft      < 125 speed units
hard      125–209
severe    ≥ 210
```

- hard/severe player-vehicle hull damage;
- persistent condition;
- crash audio, exposure and local heat;
- severe `impact-stalled` traffic state;
- per-token cooldown preventing frame-stacked damage;
- ambient traffic remains non-persistent and has no health.

Detailed records: `CITY_STREAMING.md` and `CITY_STREAMING_4A.md` through `CITY_STREAMING_4F.md`.

## Vehicle persistence boundaries

### Persistent authored vehicles

Own:

- identity and archetype;
- ownership/status;
- health and disabled state;
- position and heading;
- parked state and trunk;
- campaign persistence;
- repair/recovery eligibility.

`VehicleSystem.syncFromCampaign()` updates the live container, velocity, health, wreck visuals, HUD and last-persisted state after a maintenance event.

### Ambient traffic proxies

- are absent from `VehicleSystem.vehicles`;
- cannot be entered, stolen, repaired or recovered;
- have no health, trunk, ownership or save data;
- retain only temporary token/slot/behaviour/contact state.

### Refuge garage rules

```text
location             304, 326 on street
repair radius        96
minimum repair       $25
compact repair       $3 per missing hull
compact recovery     $120
recovery condition   35% hull
```

Repair requires an owned, damaged, non-disabled, parked vehicle inside the garage radius. Recovery requires an owned disabled vehicle and returns it to a deterministic refuge slot.

The player-facing service is blocked while driving, away from the garage or wanted.

## Testing strategy

PR validation domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Automated coverage includes:

- source ownership and removed legacy files;
- input gating and UI locks;
- campaign entry, checkpoints and rewards;
- vehicle acceleration, drift, collision and wreck exit;
- streetlight, dumpster, body and blood consequences;
- expanded-city streaming and dormant simulation;
- traffic materialization, following and junction priority;
- soft contact and hard-impact cooldown;
- repair quote and ownership rules;
- atomic debit/condition commit and rollback;
- repeated-operation idempotence;
- wanted-level service blocking;
- live/campaign repair and wreck-recovery synchronization.

A feature is complete only when implementation, tests and documentation agree.

## Locked design decisions

- pure top-down readability;
- original setting and terminology;
- streets, vehicles, traffic, factions and urban chaos remain core;
- vision and hearing remain separate;
- Enter owns vehicle entry/exit;
- Space owns traversal on foot and handbrake while driving;
- Hunger is combat attrition and feeding is recovery;
- campaign state has one objective authority;
- persistent vehicles and ambient traffic remain separate;
- large-city scale uses streaming/dormancy;
- vehicle maintenance uses existing wallet and vehicle-condition authorities;
- paid maintenance is idempotent and cannot be reverted by a mission checkpoint;
- accessibility presentation cannot alter gameplay geometry;
- ammunition is finite, paid and refuge/safehouse-managed;
- Retainers have agency, upkeep and failure states.

## Active risks

1. Browser-system regression time grows as city systems accumulate.
2. Repair/recovery pricing must matter without making ordinary traffic damage punitive.
3. Motorized police must complement foot pursuit and vertical escapes.
4. Traffic density must remain readable and fixed-pool bounded.
5. Multiple future garages need deterministic parking and ownership rules.
6. Economy and ammunition can become punitive without competing rewards.
7. Faction and Retainer systems risk becoming menu-only bonuses.
8. Commercial-facing names require trademark clearance.

## Active production sequence

### Active: vehicle repair and recovery

PR #30 must satisfy:

- one costed repair/recovery transaction;
- no duplicate charge on repeated activation;
- rollback on partial failure;
- owned-vehicle-only service;
- wanted/location safety gates;
- live and persistent condition agreement;
- unit, boot, systems and campaign validation.

### Next: motorized police and traffic escalation

- police cruisers use macro/local road infrastructure;
- pursuit, interception and roadblocks;
- officers exit blocked/disabled vehicles;
- abandoned-car search memory;
- player can leave the car and escape vertically or through sewers.

### Later

- original factions and territory;
- safehouses, stash and ammunition economy;
- Retainers and Mechanic service modifiers;
- expanded arsenal and vehicle combat;
- district campaign content.

## Maintenance rule

Update this blueprint and the relevant detailed document in the same PR when changing:

- runtime ownership or update order;
- campaign/save authority;
- controls;
- city dimensions or streaming policy;
- vehicle/traffic persistence boundaries;
- impact, maintenance, police or exposure consequences;
- active production priority;
- locked design decisions.
