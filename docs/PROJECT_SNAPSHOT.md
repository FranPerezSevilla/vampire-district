# Project snapshot

_Last updated: 2026-07-23_

Read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) first for the canonical project-wide map. This snapshot summarizes the playable state, accepted extensions and immediate priority.

## Product vision

**Vampire District** is a pure top-down urban action, stealth and crime game with readable streets, vehicles, police pressure, short missions and systemic chaos, rebuilt around an original vampire setting.

> GTA2-like city structure; Vampire District consequences.

Streets, traffic, vehicles, weapons, factions, territory and cash remain core. Rooftops, sewers, Hunger, feeding, the Veil, powers, Retainers and supernatural politics differentiate it.

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

Accepted `main` before Milestone 13.6:

```text
4ebece7045e173093d5e00d76362fe9610aa4596
```

The playable build provides:

- Phaser 3 browser runtime and responsive quality presets;
- street, low-rooftop, high-rooftop and sewer layers;
- opening journalist mission and `Clean the Scene` contract;
- campaign entry, save/load, safe checkpoints and idempotent rewards;
- combat, draining, Hunger and powers;
- witnesses, evidence, police escalation and helicopter pressure;
- damageable lights, dumpsters, bodies and blood evidence;
- `2400 × 1440` multi-ward district;
- authored vehicles with arcade driving, hull, trunks and repair/recovery;
- sidewalk/crossing pedestrians;
- chunk streaming, district packs and dormant simulation;
- macro traffic/police and ten pooled civilian traffic proxies;
- following, junction priority, soft contact and graduated impacts;
- consolidated project blueprint, snapshot, architecture and roadmap;
- unit, boot, systems and campaign Chromium validation.

## Accepted vehicle-maintenance extension

Milestone 12.1 adds:

- refuge-garage full repair for owned parked vehicles;
- tow recovery for owned wrecks;
- campaign cash and ledger charge;
- atomic debit plus condition update with rollback;
- immediate campaign/live vehicle synchronization;
- repeat-operation idempotence;
- no service while wanted, driving or away from the garage.

Detailed document: `VEHICLE_MAINTENANCE.md`.

## Accepted motorized-police extension

Milestone 13.6 adds:

```text
wanted 0–1   no response cruiser
wanted 2     one pursuit cruiser · two reserved officers
wanted 3     pursuit cruiser + partial roadblock · four reserved officers
```

Public police totals remain:

```text
wanted 0  → 2
wanted 1  → 3
wanted 2  → 5
wanted 3  → 7
```

The extension provides:

- deterministic macro routing over authored lanes;
- fixed local pool of two response cruisers;
- pursuit interception and one partial cross-lane roadblock;
- officer reservation while crews remain inside vehicles;
- exact-once transfer into normal foot-police AI;
- local cruiser collision and disablement;
- rooftop/sewer hiding while response state remains active;
- four-second memory of an abandoned suspect vehicle;
- effective stress diagnostics counting foot plus reserved officers.

Response cruisers are transient wanted-response state, not campaign-owned vehicles or civilian traffic tokens. Detailed document: `MOTORIZED_POLICE.md`.

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
11. only after dismissing dialogue does `REPORT ACCEPTED` open.

The refuge board exposes `Clean the Scene` through campaign definitions rather than parallel scripted progression.

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

## Combat, perception and police

Movement/perception:

- run multiplier `1.55`;
- quiet multiplier `0.72`;
- ordinary run-hearing range `42`;
- enhanced listener range `120`;
- quiet footsteps ignored by ordinary NPCs;
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

Police use one stable attacker and deterministic containment. Motorized crews become ordinary police NPCs after dismount and use the same search, pursuit, attack and recovery rules.

## Campaign and persistence

`CampaignState` and `MissionRunner` own persistent truth:

- active/available/completed missions;
- latest safe checkpoint;
- player position/layer, Hunger and loadout;
- cash and immutable ledger;
- reputation;
- authored vehicle condition/trunks;
- broken props, NPC outcomes, bodies and evidence;
- tutorial/informant state.

Vehicle maintenance composes `WalletSystem` and `CampaignVehicleSystem`. Campaign checkpoints do not restore authored vehicle condition, so an older checkpoint cannot undo paid maintenance.

Excluded from campaign persistence:

- civilian traffic tokens/proxies;
- motorized response cruisers and transient cruiser hull;
- temporary wanted-response routes and suspect-car memory.

## City and streaming

```text
viewport      960 × 640
world         2400 × 1440
area          3,456,000 units²
expansion     5.625× original
```

Wards: original quarter, Glasshouse, Foundry, Canal, Blackwater and Harbor.

Accepted stack:

1. asynchronous chunks, activation budgets, LRU and local deltas;
2. district packs, road prefetch and dormant pedestrians;
3. macro graph, civilian traffic tokens and dormant police;
4. ten pooled civilian traffic proxies on authored lanes;
5. following, braking and junction priority;
6. soft physical contact and lane recovery;
7. hard/severe impact damage, exposure, heat and cooldown;
8. two pooled motorized police cruisers using the same graph/lane assets but separate authority.

## Vehicle and response boundaries

### Authored persistent vehicles

- identity/archetype and ownership;
- hull/disabled state;
- position, angle and parked state;
- limited trunk;
- campaign persistence and maintenance eligibility.

### Civilian traffic proxies

- fixed pool of ten;
- no entry, theft, ownership, trunk, hull, repair or save data;
- temporary macro/local traffic state only.

### Motorized police cruisers

- fixed pool of two;
- transient route, role, health and obstacle state;
- no campaign ownership/trunk/maintenance;
- deploy normal police NPCs exactly once;
- hide off-street without deleting the response;
- disappear when wanted response retires.

Traffic impact tiers:

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
MotorizedPoliceSystem
PedestrianSystem
normal gameplay frame
```

Maintenance remains event-driven outside the frame loop. Motorized response runs after civilian traffic consequences and before normal police/NPC AI so dismounted officers join the ordinary frame immediately.

## Economy, factions and Retainer direction

Locked direction:

- faction/contact reputation rather than one morality score;
- district/territory ownership with gameplay consequences;
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
- sight and hearing remain separate;
- Enter owns vehicle entry/exit;
- Space owns traversal/handbrake;
- persistent authored vehicles, civilian traffic and police cruisers remain separate;
- large-city scale uses streaming/dormancy;
- mission progression has one campaign authority;
- maintenance is idempotent and checkpoint-safe;
- motorized response preserves total 5/7 police pressure;
- roadblocks are partial and preserve street/vertical/sewer escape;
- dismounted crews use existing police AI;
- ammunition is finite and refuge/safehouse-managed;
- Retainers have agency, upkeep and failure states;
- accessibility cannot alter gameplay geometry/state.

## Open decisions

- final commercial names and faction histories;
- exact territory capture/decay rules;
- final vehicle/traffic/police-response tuning;
- full intra-district cruiser lane selection;
- ammunition prices and detention losses;
- Retainer blood-cost model and maximum count;
- long-term perception visualization and camera accessibility.

## Active risks

1. Browser-system regression time is increasing.
2. Cruiser timing and roadblock placement need playtesting.
3. Current motorized units deliver pressure at district boundaries; full freeform pursuit remains deferred.
4. Faction/territory systems can become cosmetic unless they change patrols, suppliers, safehouses and missions.
5. Traffic and police density must remain readable and bounded.
6. Economy/ammunition can become punitive without competing rewards.
7. Retainers can become menu-only bonuses.
8. Commercial names need trademark clearance.

## Immediate priority

Begin **Milestone 14: original factions and territory foundation**.

The first implementation should:

- define canonical original faction IDs/data;
- store district/territory ownership without a parallel campaign authority;
- connect faction/contact reputation to access and hostility gates;
- associate safehouses, suppliers, vehicles and patrol profiles with factions;
- expose mission-definition hooks for territory consequences;
- migrate existing campaign state safely;
- add browser diagnostics and focused unit/Chromium coverage;
- update the blueprint and detailed faction document in the same PR.
