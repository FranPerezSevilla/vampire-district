# Project snapshot

_Last updated: 2026-07-22_

Read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) first for the canonical project-wide map. This snapshot summarizes the playable state, accepted extensions and immediate priorities.

## Product vision

**Vampire District** is a pure top-down urban action, stealth and crime game with readable streets, vehicles, police pressure, short missions and systemic chaos, rebuilt around an original vampire setting.

> GTA2-like city structure; Vampire District consequences.

The project must not collapse into a conventional stealth game using a top-down camera. Streets, traffic, vehicles, weapons, factions, territory and cash remain core. Rooftops, sewers, Hunger, feeding, the Veil, powers, Retainers and supernatural politics differentiate it.

## Original-IP decision

The project does not use names, lore, ranks, symbols, factions or terminology from an existing licensed vampire property.

Working factions:

- **Blackglass Directorate**;
- **Red Assembly**;
- separate **Unaligned Houses**.

Working enhanced-mortal terms:

- neutral: **Retainer**;
- Directorate: **Proxy**;
- Assembly: **Marked**;
- Unaligned: **Hand**.

Commercial-facing names remain subject to trademark clearance.

## Current accepted foundation

```text
a424e0f6e1c2e52d9851bdbff129276c470478c6
```

The accepted foundation provides:

- Phaser 3 browser runtime and responsive quality presets;
- street, low-rooftop, high-rooftop and sewer layers;
- opening journalist mission and `Clean the Scene` contract;
- campaign entry, save/load, safe checkpoints and idempotent rewards;
- mouse combat, weapons, draining, Hunger and powers;
- witnesses, evidence, police escalation and helicopter pressure;
- damageable lights, dumpsters, bodies and blood evidence;
- `2400 × 1440` multi-ward district;
- arcade vehicles, health, trunks and persistent condition;
- sidewalk/crossing pedestrians;
- chunk streaming, district packs and dormant simulation;
- macro traffic/police and pooled local civilian traffic;
- soft contact and graduated high-speed traffic impacts;
- consolidated canonical project blueprint;
- unit, boot, systems and campaign Chromium validation.

## Accepted Milestone 12.1 extension

PR #30 adds the refuge vehicle garage:

- full repair for owned, parked vehicles at the garage;
- tow recovery for owned wrecks from anywhere;
- campaign cash and ledger charge;
- atomic debit plus condition update with rollback;
- immediate synchronization of persistent and live vehicle state;
- repeat-operation idempotence;
- no service while wanted, driving or away from the garage;
- accessible modal and diagnostic API.

The feature passed unit, boot, systems and campaign CI together. Detailed document: `VEHICLE_MAINTENANCE.md`.

## Missions

Opening mission:

1. intro establishes the inexperienced vampire;
2. the sire orders the journalist silenced;
3. rooftop traversal and the blocking thug are introduced;
4. the player downs and drains the thug;
5. Hunger and witnesses are explained;
6. the police informant reveals the journalist location;
7. full controls and weapon selection unlock;
8. the player handles the journalist;
9. the player returns to the rooftop refuge;
10. the sire acknowledges the result;
11. only after dismissing the dialogue does `REPORT ACCEPTED` open.

The refuge contract board also exposes `Clean the Scene` through campaign definitions rather than parallel scripted progression.

## Controls

```text
WASD / arrows   run or control vehicle
Shift           quiet movement on foot
Enter           vehicle enter / exit only
Space           traversal on foot; handbrake while driving
E               interaction, trunk or refuge garage
Mouse           aim and face
Left mouse      equipped attack
Right mouse     drain valid target
Wheel           cycle owned weapons
Q               Dash
R               Whisper
F               Blood Sense
M               mission panel
H               pause/help/accessibility
```

`InputSystem.beginFrame()` remains authoritative. Features do not read raw world-action keys independently.

## Combat and perception

Movement:

- run multiplier `1.55`;
- quiet multiplier `0.72`;
- ordinary run-hearing range `42`;
- enhanced listener range `120`;
- ordinary NPCs ignore quiet footsteps;
- hearing creates attention/`WTF`, never automatic pursuit/reporting;
- confirmed sight overrides heard-only investigation.

Prototype weapons:

| Weapon | Type | Damage | Range | Ammo |
|---|---|---:|---:|---:|
| Unarmed | melee | 1 | 32 | unlimited |
| Iron Pipe | melee | 2 | 42 | unlimited |
| Pistol | hitscan | 3 | 260 | 8 |

AI priority:

```text
inactive/dead → downed → being drained → staggered → attacking
→ chasing → fleeing/reporting → lured → investigating → searching → patrol/idle
```

Police use one stable attacker and deterministic containment. Police/hunters recover after type-specific delays; ordinary victims generally remain down.

## Campaign and persistence

`CampaignState` and `MissionRunner` own persistent truth:

- active/available/completed missions;
- latest safe checkpoint;
- player position/layer and Hunger;
- loadout and ammunition;
- cash and immutable ledger;
- reputation;
- authored vehicle condition/trunks;
- broken props, NPC outcomes, bodies and evidence;
- tutorial/informant state.

Vehicle maintenance composes `WalletSystem` and `CampaignVehicleSystem`. It performs silent intermediate mutations and emits one `vehicle:maintenance-completed` event for autosave. A failed update restores wallet, ledger, flags and sequences.

Campaign checkpoints do not restore authored vehicle condition, so an older checkpoint cannot undo maintenance.

## City and streaming

```text
viewport      960 × 640
world         2400 × 1440
area          3,456,000 units²
expansion     5.625× original
```

Wards: original quarter, Glasshouse, Foundry, Canal, Blackwater and Harbor.

Accepted streaming stack:

1. asynchronous chunks, activation budgets, LRU and local deltas;
2. district packs, road prefetch and dormant pedestrians;
3. macro graph, traffic tokens and dormant police;
4. ten pooled traffic proxies on authored lanes;
5. following, braking and deterministic junction priority;
6. soft physical contact and lane recovery;
7. hard/severe impact damage, heat, exposure and cooldown.

Detailed documents: `CITY_STREAMING.md` and `CITY_STREAMING_4A.md` through `CITY_STREAMING_4F.md`.

## Vehicles and maintenance

Persistent authored vehicles have:

- archetype and identity;
- ownership/status;
- hull and disabled state;
- position, heading and parked state;
- limited trunk;
- campaign persistence;
- maintenance eligibility.

Ambient traffic proxies remain separate:

- fixed pool of ten;
- stable token-to-slot identity while local;
- no entry, theft, ownership, trunk, health, repair or save data.

Impact tiers:

```text
soft      below 125
hard      125–209
severe    210+
```

Maintenance baseline:

```text
garage                 street 304, 326
repair radius          96
minimum repair         $25
compact repair         $3 per missing hull
compact recovery       $120
recovery condition     35% hull / 26 of 72
```

Full repair requires an owned, damaged, non-disabled, parked vehicle at the garage. Tow recovery requires an owned wreck and returns it to a deterministic refuge slot. Player-facing service is blocked while wanted.

## Runtime architecture

```text
GameScene.update
  → GameplayRuntime.update
```

Large-city order:

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
normal gameplay frame
```

Maintenance is event-driven, outside the frame loop. `VehicleSystem` listens for its final campaign event and synchronizes health, position, wreck visuals, HUD and `lastPersisted` state.

## Economy and Retainer direction

Locked direction:

- faction/contact reputation rather than one morality score;
- one melee, one sidearm and one long/special slot;
- paid ammunition with carried caps;
- separate carried inventory and refuge stash;
- finite supplier stock and authored caches;
- trunks provide limited mobile storage;
- Retainers have loyalty, dependence, condition, upkeep and possible loss.

Initial Retainer roles: Quartermaster, Driver, Cleaner, Mechanic, Fixer, Scout, Guard and Medic.

## Locked decisions

- original setting and terminology;
- pure top-down readability;
- streets, vehicles, traffic, factions and urban chaos remain core;
- sight and hearing stay separate;
- Enter owns vehicle entry/exit;
- Space owns traversal/handbrake;
- persistent authored vehicles and ambient traffic stay separate;
- large-city scale uses streaming/dormancy;
- mission progression has one campaign authority;
- maintenance uses existing wallet and vehicle-condition authorities;
- paid maintenance is idempotent and checkpoint-safe;
- ammunition is finite and refuge/safehouse-managed;
- Retainers have agency, upkeep and failure states;
- accessibility cannot alter hit geometry or gameplay state.

## Open decisions

- final commercial names and faction histories;
- final vehicle/traffic density tuning;
- final repair/recovery economy tuning;
- motorized police pursuit/interception behaviour;
- ammunition prices and detention losses;
- Retainer blood-cost model and maximum count;
- long-term perception visualization and camera accessibility.

## Active risks

1. Browser-system regression time is increasing.
2. Repair prices can be irrelevant or punitive without playtesting.
3. Motorized police must complement foot pursuit and vertical escape.
4. Traffic density must remain readable and bounded.
5. Future multiple garages need deterministic slots and ownership rules.
6. Economy/ammunition can become punitive without competing rewards.
7. Retainers can become menu-only bonuses.
8. Commercial names need trademark clearance.

## Immediate priority

Continue Milestone 13 with **motorized police pursuit, interception, roadblocks and officer dismount behaviour**.

The implementation must:

- reuse the macro/local road infrastructure;
- preserve existing foot pursuit and containment roles;
- retain rooftop/sewer escape routes;
- prevent roadblocks from hard-locking the player;
- define explicit police-cruiser authority and persistence boundaries;
- keep civilian traffic readable and pool-bounded;
- add focused unit and Chromium coverage;
- update the blueprint and detailed architecture in the same PR.
