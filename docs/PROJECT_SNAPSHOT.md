# Project snapshot

_Last updated: 2026-07-22_

For the canonical project-wide map, read [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) first. This snapshot summarizes the current playable state and immediate decisions; detailed implementation and acceptance records live in the linked subsystem documents.

## Product vision

**Vampire District** is a pure top-down urban action, stealth and crime game with readable streets, vehicles, police pressure, short missions and systemic chaos, rebuilt around an original vampire setting.

> GTA2-like city structure; Vampire District consequences.

The project must not collapse into a conventional stealth game using a top-down camera. Streets, traffic, vehicles, weapons, factions, territory and money remain core. Rooftops, sewers, Hunger, feeding, the Veil, powers, Retainers and supernatural politics differentiate it.

## Original-IP decision

The project does not use names, lore, ranks, symbols, factions or mechanical terminology from an existing licensed vampire property.

Working faction structure:

- **Blackglass Directorate** — institutional and secretive;
- **Red Assembly** — violent and territorial;
- **Unaligned Houses** — independent operators, tracked separately.

Working enhanced-mortal terminology:

- neutral: **Retainer**;
- Directorate: **Proxy**;
- Assembly: **Marked**;
- Unaligned: **Hand**.

These names remain subject to commercial trademark clearance. The detailed design is in `ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md`.

## Current accepted baseline

Current accepted main baseline after City Streaming 4F:

```text
a8fc076ac46d5da86bd80d3c09be1a8a8bbfcedc
```

The build currently provides:

- Phaser 3 browser runtime with responsive rendering and quality presets;
- street, low-rooftop, high-rooftop and sewer layers;
- opening journalist mission and `Clean the Scene` contract;
- data-driven campaign state, objective definitions, rewards and checkpoints;
- New Game, Continue, retry and Explore District entry flows;
- mouse-directed combat, weapons, draining, Hunger and powers;
- witnesses, evidence, police escalation and helicopter pressure;
- damageable lights, dumpsters, bodies and persistent blood evidence;
- a `2400 × 1440` multi-ward district;
- arcade vehicles, health, trunks and persistent condition;
- pedestrians and authored sidewalk/crossing loops;
- chunk streaming, district packs and dormant simulation;
- macro traffic and police travel;
- pooled local traffic with behaviour and collision consequences;
- unit, boot, system and campaign Chromium validation.

## Current mission flow

Opening mission:

1. intro establishes the inexperienced vampire;
2. the sire orders the journalist silenced;
3. rooftop traversal and the blocking thug are introduced;
4. the player downs and drains the thug;
5. Hunger and witness rules are explained;
6. the police informant reveals the journalist location;
7. full controls and weapon selection unlock;
8. the player handles the journalist;
9. the player returns to the rooftop refuge;
10. the sire acknowledges the result;
11. only after dismissing the dialogue does `REPORT ACCEPTED` open.

The refuge contract board also exposes the replayable `Clean the Scene` mission through campaign definitions rather than a parallel scripted progression.

## Controls

```text
WASD / arrows   run or control vehicle
Shift           quiet movement on foot
Enter           vehicle enter / exit only
Space           contextual traversal on foot; handbrake while driving
E               non-traversal interaction / trunk inspection
Mouse           aim and face
Left mouse      use equipped weapon
Right mouse     drain valid target
Wheel           cycle owned weapons
Q               Dash
R               Whisper
F               Blood Sense
M               mission panel
H               pause/help/accessibility
```

`InputSystem.beginFrame()` remains authoritative. Gameplay systems do not read raw keys independently.

## Player, combat and perception snapshot

Movement:

- run multiplier `1.55`;
- quiet multiplier `0.72`;
- ordinary NPC run-hearing range `42`;
- enhanced listener run radius `120`;
- ordinary NPCs ignore quiet footsteps;
- hearing creates attention/`WTF`, never automatic pursuit or reporting;
- confirmed sight overrides heard-only investigation.

Prototype weapons:

| Weapon | Type | Damage | Range | Ammo |
|---|---|---:|---:|---:|
| Unarmed | melee | 1 | 32 | unlimited |
| Iron Pipe | melee | 2 | 42 | unlimited |
| Pistol | hitscan | 3 | 260 | 8 |

Player pressure:

- police baton: `Hunger +12`;
- hunter heavy strike: `Hunger +20`;
- rooftop thug swing: `Hunger +8`;
- hit stun: `260 ms`;
- invulnerability: `720 ms`;
- critical Hunger: `85`;
- frenzy failure: `100`.

Resolved AI priority:

```text
inactive/dead → downed → being drained → staggered → attacking
→ chasing → fleeing/reporting → lured → investigating → searching → patrol/idle
```

Police use one stable attacker and deterministic containment roles. Police and hunters recover after type-specific delays; ordinary victims generally remain down.

## Campaign and persistence snapshot

`CampaignState` and `MissionRunner` own persistent truth:

- active/available/completed missions;
- latest safe checkpoint;
- player position/layer and Hunger;
- selected weapon, inventory and ammunition;
- cash and immutable ledger;
- faction/contact reputation;
- persistent authored vehicle condition and trunks;
- broken props, static NPC outcomes, bodies and evidence;
- tutorial and informant completion state.

Unsafe progress rolls back to the latest safe objective checkpoint. Rewards and completion checkpoints are idempotent.

## City and streaming snapshot

```text
viewport      960 × 640 logical units
world         2400 × 1440
area          3,456,000 units²
expansion     5.625× original area
```

Wards include the original quarter, Glasshouse, Foundry, Canal, Blackwater and Harbor.

Accepted streaming stack:

1. asynchronous chunks, activation budgets, LRU retention and local deltas;
2. district packs, road-aware prefetch and dormant pedestrians;
3. macro district graph, traffic tokens and dormant police travel;
4. ten pooled nearby traffic proxies on authored lane polylines;
5. local following, braking and deterministic junction priority;
6. soft physical pushes, blocking and lane-offset recovery;
7. hard/severe impact damage, exposure, police heat and cooldown protection.

Detailed documents: `CITY_STREAMING.md` and `CITY_STREAMING_4A.md` through `CITY_STREAMING_4F.md`.

## Vehicle and traffic snapshot

Vehicle controls:

```text
Enter      enter / exit
W          accelerate
S          brake, then reverse
A / D      steer
Space      handbrake / drift
E          inspect nearby trunk while on foot
```

Persistent authored vehicles have:

- archetype and identity;
- ownership/status;
- health and disabled state;
- position and heading;
- limited trunk storage;
- campaign persistence.

Ambient traffic proxies remain separate:

- fixed pool of ten;
- stable macro token-to-slot identity while local;
- following and junction behaviour;
- temporary physical offset and recovery;
- no entry, theft, ownership, trunk, health or save data.

Impact tiers:

```text
soft      below 125 speed units
hard      125–209
severe    210+
```

Soft contact stays damage-free. Hard and severe impacts damage the persistent player vehicle, create exposure/local heat and use a per-token cooldown to prevent frame-stacked consequences. Severe impacts temporarily stall the ambient proxy.

## Runtime architecture snapshot

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

The complete ownership map is in `PROJECT_BLUEPRINT.md` and `TECHNICAL_ARCHITECTURE.md`.

## Faction, economy and Retainer direction

Locked campaign direction:

- faction and contact reputation, not one morality score;
- one melee, one sidearm and one long/special slot;
- paid ammunition with carried caps;
- separate carried inventory and refuge stash;
- finite supplier stock and authored caches;
- trunks provide limited mobile storage, never the full stash;
- Retainers are named characters with loyalty, dependence, condition, upkeep and possible loss.

Initial Retainer roles:

- Quartermaster;
- Driver;
- Cleaner;
- Mechanic;
- Fixer;
- Scout;
- Guard;
- Medic.

## Locked design decisions

- original setting and terminology;
- pure top-down readability;
- GTA2-like streets, vehicles, traffic, factions and urban chaos remain core;
- sight and hearing remain separate;
- hearing alone does not pursue or report;
- Enter owns vehicle entry/exit;
- Space owns traversal on foot and handbrake while driving;
- Hunger is combat attrition and feeding is recovery;
- NPC resilience leads to downed state;
- persistent authored vehicles and ambient traffic are separate models;
- large-city scale uses streaming and dormancy;
- mission progression has one campaign authority;
- ammunition is finite, paid and refuge/safehouse-managed;
- Retainers have agency, upkeep and failure states;
- accessibility presentation cannot change hit geometry or gameplay state.

## Open design decisions

- final commercial names and faction histories;
- final vehicle/traffic tuning and density;
- exact repair pricing and disabled-vehicle recovery rules;
- motorized police pursuit/interception behaviour;
- ammunition prices, restock cadence and detention losses;
- Retainer blood-cost model and maximum active count;
- long-term perception visualization and reduced-camera-shake options.

## Active risks

1. Traffic wrapper ownership must remain explicit as behaviour grows.
2. Browser-system regression time is increasing with the city feature stack.
3. Vehicle damage currently needs a complete repair/recovery loop.
4. Motorized police must complement, not invalidate, foot pursuit and vertical escapes.
5. Traffic density must remain readable and bounded.
6. Economy can become irrelevant or punitive without careful tuning.
7. Retainers can become menu-only bonuses unless missions expose their risks.
8. Commercial-facing names need trademark clearance.

## Immediate project priority

Implement the **vehicle repair and recovery loop**:

- inspect condition;
- repair through a refuge/garage service;
- charge cash through the existing wallet/ledger;
- recover or replace disabled vehicles without campaign soft-locks;
- preserve idempotence across save/load;
- add focused unit and Chromium coverage.

After that, continue Milestone 13 with motorized police pursuit, interception, roadblocks and officer dismount behaviour.
