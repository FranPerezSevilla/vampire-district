# Vampire District — project blueprint

_Last updated: 2026-07-22_

## Purpose

This is the canonical high-level blueprint for the project. It explains the current playable product, the authoritative runtime architecture, the completed city/vehicle/traffic foundation and the next production priorities.

Detailed subsystem documents remain authoritative for tuning values and implementation records. This blueprint is the first document an AI, developer or reviewer should read before changing the project.

## Product identity

**Vampire District** is a pure top-down urban action, stealth and crime game with the readable city structure, vehicles, police pressure, short missions and systemic chaos associated with early top-down crime games, rebuilt around an original vampire setting.

The design rule is:

> GTA2-like city structure; Vampire District consequences.

The game must retain streets, traffic, vehicles, weapons, factions, territory, money and rapid navigation as core pillars. Rooftops, sewers, Hunger, feeding, the Veil, supernatural powers, retainers and vampire politics create the project identity.

The project does not use licensed vampire factions, terminology, lore, symbols or ranks.

## Current production baseline

The current playable build includes:

- Phaser 3 browser runtime using native ES modules;
- street, low-rooftop, high-rooftop and sewer layers;
- the opening journalist mission and the playable `Clean the Scene` contract;
- data-driven campaign state, objectives, rewards, checkpoints, save/load and mission selection;
- mouse-directed melee/hitscan combat, draining, Hunger and powers;
- witnesses, evidence, police search, wanted escalation and helicopter pressure;
- an expanded `2400 × 1440` district with multiple wards;
- first-class arcade vehicles with Enter entry/exit and Space handbrake;
- vehicle health, persistent condition, trunks, pedestrian impacts and destructible street furniture;
- chunk streaming, district packs, dormant simulation and macro traffic;
- pooled local traffic with following, junction priority, soft contact and graduated high-speed consequences;
- focused unit, boot, system and campaign Chromium validation.

Current accepted main baseline after traffic phase 4F:

```text
a8fc076ac46d5da86bd80d3c09be1a8a8bbfcedc
```

## World structure

### District scale

```text
logical viewport     960 × 640
world                 2400 × 1440
world area            3,456,000 units²
original area ratio   5.625×
```

The original mission quarter retains its authored coordinates. The expanded city adds Glasshouse, Foundry, Canal, Blackwater and Harbor wards, connected by avenues, boulevards, alleys, sidewalks, crossings, sewer arteries and rooftop routes.

### Layer contract

```text
street
low rooftop
high rooftop
sewer
```

Vehicles and local traffic exist only on the street layer. The player can abandon a vehicle and transition back to foot, rooftop or sewer traversal.

## Campaign authority

`CampaignState` and `MissionRunner` own persistent campaign truth.

Campaign state includes:

- mission availability, active mission and completed missions;
- latest safe checkpoint;
- cash and transaction ledger;
- faction and contact reputation;
- player loadout and ammunition;
- persistent vehicle condition;
- broken world props;
- static NPC outcomes, bodies and evidence;
- tutorial/informant completion state.

`MissionSystem` presents the active definition but does not maintain a second objective index. Rewards are idempotent and checkpoints are objective-authored.

Current playable missions:

1. opening journalist contract;
2. `Clean the Scene` refuge-board contract.

## Core gameplay systems

### On-foot loop

```text
move / aim
→ traverse or interact
→ attack, power or drain
→ manage Hunger and exposure
→ evade witnesses and police
→ complete objective
→ return/report/checkpoint
```

### Vehicle loop

```text
find vehicle
→ enter with Enter
→ accelerate, brake, reverse and steer
→ drift with Space
→ collide, damage props or hit pedestrians
→ accumulate hull damage / evidence / police pressure
→ use trunk or abandon vehicle
→ continue on foot, rooftops or sewers
```

### Control contract

```text
WASD / arrows   movement or vehicle control
Shift           quiet movement on foot
Enter           vehicle enter / exit only
Space           traversal on foot; handbrake while driving
E               non-traversal interaction / trunk inspection
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

`GameplayRuntime` owns system ordering and temporary input adaptation. Specialist systems own their domain state and expose public operations; feature patches must not add another frame loop.

Major system groups:

### Campaign and presentation

- `CampaignState`
- `MissionRunner`
- `MissionSystem`
- campaign entry and refuge contract board
- `StatePublisher`
- `TutorialDirector`
- `TaskRevealSystem`
- `ObjectiveMarkerSystem`
- `UxGuidanceSystem`

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

The accepted street simulation order is:

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

This order means:

1. chunks and district resources become resident;
2. persistent entities switch between active and dormant simulation;
3. macro traffic/police progress independently of rendering;
4. nearby traffic tokens receive fixed pooled visual proxies;
5. local traffic applies following and junction rules;
6. physical offsets and player contact are resolved;
7. high-speed damage, exposure and police heat are applied;
8. the normal player/NPC frame consumes the final local state.

## City streaming phases

### Base city streaming

- asynchronous chunk resources;
- retry and cancellation;
- activation budget;
- LRU retention;
- spatial static queries;
- chunk-local deltas;
- deterministic diagnostics.

### 4A — district resources and dormant pedestrians

- district resource packs;
- road-aware prefetch;
- low-frequency dormant pedestrian progression.

### 4B — macro traffic and police

- district macro graph;
- abstract traffic tokens;
- dormant police travel;
- district-local patrol recovery.

### 4C — local traffic materialization

- fixed pool of ten traffic containers;
- explicit forward/reverse lane polylines;
- stable token-to-slot identity;
- smooth interpolation between macro ticks;
- street/chunk eligibility and hysteresis.

### 4D — local traffic behaviour

- following distance and queues;
- braking for the player and authored vehicles;
- bounded local lag/catch-up;
- deterministic junction yielding.

### 4E — physical contact

- bounded soft push of a clear proxy;
- blocked contact when no safe displacement exists;
- temporary physical offsets;
- safe recovery toward the authored lane;
- no damage or police response for soft contact.

### 4F — graduated impact consequences

```text
soft      < 125 speed units
hard      125–209
severe    ≥ 210
```

- hard/severe player-vehicle hull damage;
- persistent player-vehicle condition;
- crash audio, exposure and local police heat;
- stronger speed loss;
- severe `impact-stalled` traffic state;
- per-token cooldown preventing frame-stacked damage;
- ambient traffic remains non-persistent and has no health.

Detailed records:

- `CITY_STREAMING.md`
- `CITY_STREAMING_4A.md`
- `CITY_STREAMING_4B.md`
- `CITY_STREAMING_4C.md`
- `CITY_STREAMING_4D.md`
- `CITY_STREAMING_4E.md`
- `CITY_STREAMING_4F.md`

## Authority boundaries

### Macro versus local traffic

Macro traffic owns:

- token count;
- district route;
- global phase;
- completed trips.

Local systems own only temporary presentation and behaviour:

- pooled slot;
- visible lane phase;
- braking/catch-up;
- physical offset;
- contact cooldown/stall.

Dematerialization discards local contact state and restores from macro authority.

### Persistent versus ambient vehicles

Persistent authored vehicles own:

- identity and archetype;
- ownership/status;
- health and disabled state;
- position and heading;
- trunk contents;
- campaign persistence.

Ambient traffic proxies:

- are not in `VehicleSystem.vehicles`;
- cannot be entered, stolen, damaged permanently or searched;
- have no trunk, ownership or save data;
- retain only temporary token/slot presentation state.

## Testing strategy

PR validation domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

Narrative golden paths are reserved for main/nightly/manual execution where appropriate.

Automated coverage includes:

- source ownership and removed legacy files;
- input gating and UI locks;
- campaign entry, checkpoints and rewards;
- vehicle acceleration, braking, drift and collision recovery;
- streetlight, dumpster, body and blood consequences;
- expanded-city boot and streaming residency;
- dormant pedestrians and macro police/traffic;
- local traffic materialization, following and junction priority;
- soft traffic contact and offset recovery;
- hard impact damage, exposure, local heat and cooldown suppression.

A feature is not complete until implementation, automated regression and documentation agree.

## Locked design decisions

- pure top-down readability;
- original vampire setting and terminology;
- streets, vehicles, traffic, factions and urban chaos remain core;
- vision and hearing stay separate;
- hearing alone does not automatically pursue or report;
- Enter owns vehicle entry/exit;
- Space owns traversal on foot and handbrake while driving;
- Hunger is combat attrition and feeding is recovery;
- police/hunters can recover; ordinary victims generally do not;
- campaign state has one objective authority;
- persistent vehicles and ambient traffic remain separate models;
- city scale is handled with streaming/dormancy rather than one always-active simulation;
- accessibility presentation cannot change gameplay geometry;
- ammunition is finite, paid and primarily refuge/safehouse-managed;
- Retainers have agency, upkeep and failure states.

## Active risks

1. The number of traffic/runtime wrappers can become difficult to reason about unless authority boundaries stay explicit.
2. Browser-system regression time is growing as new city phases accumulate.
3. High-speed vehicle damage needs a complete repair/recovery loop to avoid becoming a one-way resource sink.
4. Motorized police must integrate with existing foot pursuit rather than replace it.
5. Traffic density must remain readable and bounded by the fixed local pool.
6. Economy and ammunition tuning can become punitive without competing rewards and reliable suppliers.
7. Faction and Retainer systems risk becoming menu-only unless missions expose their consequences.
8. Final commercial names still require trademark clearance.

## Active production sequence

### Next: vehicle repair and recovery

Complete the consequence loop introduced by 4F:

- inspect vehicle condition;
- repair at a refuge/garage or through a defined service;
- charge cash using the existing wallet/ledger;
- recover or replace disabled vehicles without soft-locking campaign progress;
- keep damage and repair idempotent across save/load;
- add focused unit and Chromium coverage.

### Then: motorized police and traffic escalation

- police cruisers use macro and local traffic infrastructure;
- pursuit, interception and roadblocks;
- officers exit blocked/disabled vehicles;
- player can abandon a car and escape vertically or through sewers.

### Later production pillars

- original factions and territory;
- safehouses, stash and ammunition economy;
- Retainers;
- expanded arsenal and vehicle combat;
- district campaign content.

## Maintenance rule

When implementation changes any of the following, update this blueprint and the relevant detailed document in the same PR:

- runtime ownership or update order;
- campaign/save authority;
- controls;
- city dimensions or streaming policy;
- vehicle/traffic persistence boundaries;
- impact, police or exposure consequences;
- active production priority;
- locked design decisions.
