# Project snapshot

_Last updated: 2026-07-24_

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

The current foundation provides:

- Phaser 3 browser runtime and responsive quality presets;
- street, low-rooftop, high-rooftop and sewer layers;
- combat, draining, Hunger and powers;
- witnesses, evidence, wanted escalation and helicopter pressure;
- authored persistent vehicles with arcade driving, hull and trunks;
- semantic refuge-garage repair and remote owned-wreck recovery;
- `4800 × 3600` City Topology V2 with fourteen unprotected districts;
- a 107-node / 148-edge road graph compiled into 144 clipped segments and 103 junction authorities;
- zero road-piece or building/road overlap;
- 776 sidewalk surfaces: 309 continuous road-edge bands from 288 sources plus 467 junction-owned surfaces, 137 valid crossings, 128 post-layout lights, 28 post-layout dumpsters and 11 regenerated pedestrian loops;
- `10 × 8` asynchronous chunk streaming, district packs and dormant simulation;
- macro traffic and ten pooled civilian traffic proxies;
- motorized police pursuit, partial roadblock and crew transfer to foot AI;
- 276 passing unit tests plus browser boot/systems/campaign domains.

Production remains persistent missionless free roam. Archived mission definitions are explicit framework fixtures only.

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

Current runtime:

```text
viewport             960 × 640
world                4800 × 3600
area                 17,280,000 units²
road graph           107 nodes / 148 edges
road output          147 segments / 104 junction authorities
road overlaps        0
sidewalks            776 (309 edge bands / 467 junction-owned)
crosswalks           137
post-layout lights   126
chunks               10 × 8 / 80
```

Every district, including `old-quarter`, is unprotected. Intersections no longer consist of full road rectangles painted through one another.

## Locked topology direction

Implemented and locked:

- road connectivity comes from an explicit graph;
- each node owns exactly one junction or transition authority;
- straight road segments are clipped at junction boundaries;
- mixed-width collinear roads use a taper polygon;
- sidewalks derive from final road segments and each junction owns its closure/corner surfaces;
- crossings sit outside junction centres and connect two sidewalks;
- lights and dumpsters are placed after roads, crossings, buildings and junction exclusion zones;
- landmarks remain site-first;
- missions reference semantic sites rather than protecting raw coordinates.

Road geometry v4 is axis-aligned. Arbitrary-angle/curved offsets and polygonal ordinary parcels remain later extensions.

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
garage                 street 1540, 1575
repair radius          96
minimum repair         $25
compact repair         $3 per missing hull
compact recovery       $120
recovery condition     35% hull / 26 of 72
```

The garage uses the semantic City Topology V2 garage anchor.

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
- city geometry is compiler-generated from semantic sites and a road graph;
- intersections have one geometry authority;
- sidewalks form a connected pedestrian graph;
- landmarks are site-first and may shape curved roads;
- parcels/buildings may be polygonal or compound;
- authored vehicles, civilian traffic and police cruisers remain separate authorities;
- maintenance remains idempotent and checkpoint-safe;
- accessibility cannot alter gameplay geometry/state.

## Active risks

1. Road graph changes affect traffic lanes, pedestrians, chunks and police response together and must be regenerated atomically.
2. True curved streets require robust arbitrary-angle offset geometry for lanes, curbs and sidewalks.
3. Future polygonal ordinary parcels need collision and streaming support beyond rectangular bounds.
4. Landmark campuses must remain dense and urban rather than empty.
5. The playable build has no authored narrative content while the new city foundation stabilizes.
6. Browser-system regression time is increasing.
7. Commercial-facing names still require trademark clearance.

## Immediate priority

With road graph geometry accepted, proceed to **original factions and territory** while keeping city changes semantic and compiler-driven.

Future geometry work may add arbitrary-angle curves and polygonal ordinary parcels, but must preserve graph IDs, landmark sites, traffic/police integration and the hard no-overlap contracts.
