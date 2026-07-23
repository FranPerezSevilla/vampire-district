# Project snapshot

_Last updated: 2026-07-23_

Read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) first for the canonical project-wide map. This snapshot summarizes the current playable state, persistence boundaries and immediate priority.

## Product vision

**Vampire District** is a pure top-down urban action, stealth and crime game with readable streets, vehicles, police pressure and systemic chaos, rebuilt around an original vampire setting.

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

## Accepted foundation

Accepted `main` before the topology reset:

```text
b2307569d742f927a403de605ad8fe9abe1f0a9c
```

It provides:

- Phaser 3 browser runtime and responsive quality presets;
- street, low-rooftop, high-rooftop and sewer layers;
- combat, draining, Hunger and powers;
- witnesses, evidence, wanted escalation and helicopter pressure;
- authored persistent vehicles with arcade driving, hull and trunks;
- refuge-garage repair and remote owned-wreck recovery;
- `2400 × 1440` imported multi-ward city;
- chunk streaming, district packs and dormant simulation;
- macro traffic and ten pooled civilian traffic proxies;
- following, junction priority, physical contact and impact consequences;
- motorized police pursuit, partial roadblock and crew transfer to foot AI;
- unit, boot, systems and campaign Chromium validation.

## City-topology reset candidate

PR #32 removes the authored missions currently registered in production so their raw coordinates no longer protect the original city core.

Current production contract:

```text
registered missions     0
active mission          none
campaign persistence    enabled
campaign entry modal    disabled
mission board           disabled
authored tutorial       disabled
normal spawn            street 438, 326
```

The archived `silenceTheJournalistMission` and `cleanTheSceneMission` definitions remain available as explicit framework examples and unit-test fixtures. They are not production content.

## Current playable mode

Normal boot opens persistent free roam directly on the street.

Available systems include:

- walking, aiming, combat and feeding;
- rooftop/sewer traversal;
- vehicles, trunks and maintenance;
- civilian traffic and pedestrians;
- foot and motorized police;
- evidence, witnesses and exposure;
- campaign wallet, reputation and save state.

The mission panel reports that no contract is active and publishes no objective marker.

## Save migration

A save containing mission IDs absent from the current production registry is cleaned on load.

Pruned:

- stale active mission ID;
- unregistered mission records;
- unregistered completed/failed IDs;
- checkpoint owned by a retired mission.

Preserved:

- cash and ledger;
- reputation;
- inventory;
- authored vehicle ownership/condition/trunks;
- unlocked refuges;
- unrelated world flags and persistent world state.

The cleaned state is saved immediately in persistent normal mode.

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
M               mission panel (empty without a contract)
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

Motorized response:

```text
wanted 0–1   no response cruiser
wanted 2     one pursuit cruiser · two reserved officers
wanted 3     pursuit cruiser + partial roadblock · four reserved officers
```

Total police pressure remains `2 / 3 / 5 / 7`. Reserved crews become ordinary foot-police NPCs after dismount.

## Campaign and mission authority

`CampaignState`, `CampaignSystem` and `MissionRunner` remain the campaign framework.

Production default:

```text
CampaignSystem DEFAULT_DEFINITIONS = []
```

`MissionSystem` is now a generic presentation/event facade:

- no automatic opening mission;
- no journalist-specific interaction bridge;
- no sire finale;
- no marker or interactions without an active registered definition;
- future explicit definitions still use `MissionRunner` as the single objective authority.

Mission coordinates are no longer allowed to protect roads, districts or landmarks.

## City and topology status

Current imported runtime:

```text
viewport      960 × 640
world         2400 × 1440
area          3,456,000 units²
```

The imported wards and geometry still render for comparison, but:

```text
protected compiler zones  []
fixed compiler landmarks  []
```

Every district, including `old-quarter`, is replaceable.

Visual playtesting has identified:

- buildings overlapping or crowding road corridors;
- road and sidewalk strips superposed at intersections;
- orphan or meaningless crosswalks;
- unclear carriageway/curb/sidewalk language;
- lamps placed from arbitrary road intervals;
- rectangular-grid bias around important buildings.

## Locked topology direction

The next city model must provide:

- one authoritative road graph;
- unique intersection geometry instead of overlapping road strips;
- explicit carriageway, curb and connected sidewalk bands;
- crosswalks only between valid pedestrian nodes;
- validated setbacks for ordinary parcels/buildings;
- semantic anchors for lamps and street furniture;
- polygonal/compound parcels and building footprints;
- curved/polyline streets;
- site-first landmark campuses.

Important sites such as a police station, hospital, church or industrial plant may reserve large irregular grounds first. Roads and ordinary blocks then adapt around those sites, rather than squeezing landmarks into rectangular leftovers between parallel roads.

## Vehicles and traffic boundaries

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
- hide off-street without deleting macro response state.

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

The garage coordinate belongs to the replaceable imported city. A later topology pass must bind the service to a semantic garage site.

## Runtime order

```text
GameScene.update
  → GameplayRuntime.update
```

Large-city pre-frame:

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

Vehicle maintenance and campaign transactions remain event-driven outside the frame loop.

## Testing state

PR domains:

```text
unit-tests
browser-boot
browser-systems
browser-campaign
```

The reset adds coverage for:

- zero production definitions;
- archived definitions working only when explicitly supplied;
- old-save mission pruning without cash loss;
- persistent street free-roam boot;
- no campaign-entry modal, mission board or authored tutorial;
- no objective marker;
- retired mission actors inactive and unpinned;
- no protected Old Quarter or fixed compiler landmarks.

Mission-specific browser golden paths are removed because those contracts are no longer production content.

## Locked decisions

- original setting and terminology;
- pure top-down readability;
- streets, vehicles, traffic, factions and urban chaos remain core;
- sight and hearing remain separate;
- Enter owns vehicle entry/exit;
- Space owns traversal/handbrake;
- campaign persistence remains active with zero missions;
- mission definitions are explicit content, not hidden defaults;
- missions cannot permanently constrain city topology;
- current imported city geometry is replaceable;
- intersections have one geometry authority;
- sidewalks form a connected pedestrian graph;
- landmarks are site-first and may shape curved roads;
- parcels/buildings may be polygonal or compound;
- authored vehicles, civilian traffic and police cruisers remain separate authorities;
- maintenance remains idempotent and checkpoint-safe;
- accessibility cannot alter gameplay geometry/state.

## Active risks

1. Current city geometry contains visible topology/readability debt.
2. Rebuilding roads affects lanes, pedestrians, chunks and police response together.
3. Curved streets require robust lane/curb/sidewalk offset geometry.
4. Landmark campuses must feel urban rather than empty.
5. The playable build temporarily has no authored narrative content.
6. Browser-system regression time is increasing.
7. Factions and missions should wait for stable semantic city sites.
8. Commercial-facing names need trademark clearance.

## Immediate priority

Complete the reset, then begin **City Topology & Readability**:

1. authoritative road graph and unique intersections;
2. visually distinct carriageway, curb and sidewalk;
3. connected pedestrian graph and valid crosswalks;
4. building/site setbacks;
5. semantic lamp/furniture anchors;
6. site-first large landmarks;
7. curved/polyline road support;
8. compiler rejection of overlap and dead pedestrian geometry;
9. regeneration/replacement of the Old Quarter;
10. retuning traffic, pedestrians and police against the accepted topology.

Original factions and territory move behind this topology pass.
