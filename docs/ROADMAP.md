# Roadmap

_Last updated: 2026-07-23_

This roadmap is ordered by dependency, not calendar date. A milestone is complete only when implementation, automated coverage, browser regression and documentation agree.

Read `PROJECT_BLUEPRINT.md` for the canonical architecture and production sequence.

## Status legend

- ✅ Complete
- 🟡 Implemented; manual tuning or a dependent extension remains
- 🔵 Active
- ⬜ Planned
- ◇ Deferred or optional

## Milestone 0 — Vertical slice foundation

**Status: ✅ Complete / ongoing polish**

Phaser district with street, rooftop and sewer layers; narrative tutorial; Hunger, feeding, powers, witnesses, police escalation, informant/journalist mission and responsive presentation.

## Milestone 1 — Architecture stabilization

**Status: 🟡 Automated implementation complete; manual input/accessibility checks remain**

- central action-based `InputSystem`;
- one keyboard/pointer/aim/wheel frame;
- tutorial/focus/reset protection;
- pure geometry/input coverage;
- browser lock and dialogue-input coverage.

## Milestone 2 — Mouse aim and unarmed combat

**Status: 🟡 Implemented; final tuning pending**

- mouse facing and aim dead zone;
- timed left-click attacks;
- directional melee, resilience, stagger and downed state;
- rooftop blocker tutorial.

## Milestone 3 — Player damage and Hunger combat loop

**Status: 🟡 Implemented; final tuning pending**

- police, hunter and thug attack telegraphs;
- incoming damage becomes Hunger;
- hit stun, invulnerability and frenzy failure;
- attack/drain interruption.

## Milestone 4 — Contextual right-click drain

**Status: 🟡 Implemented; final tuning pending**

- held right-click drain;
- downed targets from any side;
- standing targets from unaware rear approaches;
- range, aim, awareness, geometry and cancellation rules.

## Milestone 5 — Traversal-only Space and quiet movement

**Status: ✅ Complete**

- WASD/arrows run by default;
- Shift moves quietly;
- Space traverses on foot;
- deterministic routes and actual-displacement footsteps.

## Milestone 6 — Damageable streetlights and world props

**Status: ✅ Complete**

- combat-language prop destruction;
- broken lights remove illumination and persist;
- sight/hearing reactions and prop events.

## Milestone 7 — Weapon system and wheel inventory

**Status: 🟡 Prototype complete; campaign loadout replacement planned**

- Unarmed, Iron Pipe and Pistol;
- one-step wheel cycling;
- shared melee/hitscan contracts;
- ammo, empty rejection, tracer and HUD.

Milestone 15 replaces the all-owned prototype with slots, carried limits, refuge stash and paid resupply.

## Milestone 8 — AI combat behaviours

**Status: 🟡 Implemented; final tuning pending**

```text
inactive/dead → downed → being drained → staggered → attacking
→ chasing → fleeing/reporting → lured → investigating → searching → patrol/idle
```

- one police attacker plus containment roles;
- witness interruption;
- thug retaliation;
- hunter prediction/memory;
- police/hunter recovery.

## Milestone 9 — Tutorial, UX and accessibility

**Status: 🟡 Automated coverage green; manual assistive-technology validation pending**

- first-use weapon teaching;
- recovery countdowns;
- separated HUD regions;
- high-contrast aim;
- ARIA state, keyboard activation, narrow layouts and reduced-motion treatment.

## Milestone 10 — Runtime consolidation and testing

**Status: ✅ Core consolidation complete; limited manual RC checks remain**

Delivered:

- one `GameplayRuntime` update owner;
- direct scene composition;
- first-class tutorial/task/perception/guidance systems;
- runtime ownership diagnostics;
- spatial NPC queries and culling;
- change-aware state publication;
- deterministic pinned Phaser;
- parallel unit/boot/systems/campaign CI;
- physical deletion of retired patch files.

## Milestone 10.1 — Vertical Slice Release Candidate

**Status: 🟡 Automated RC green; release tag/manual hardware checks pending**

Remaining:

- complete normal-speed mission on both routes;
- physical wheel/trackpad validation;
- longer wanted-level-three memory inspection;
- one screen-reader/browser verification;
- create `v0.1.0-rc.1` after those checks.

## Milestone 11 — Campaign foundation

**Status: ✅ Complete**

Delivered:

- versioned `CampaignState`;
- data-driven `MissionDefinition` and `MissionRunner`;
- one mission/objective authority;
- cash and immutable transaction ledger;
- faction/contact reputation;
- safe checkpoints and conservative rollback;
- save/load/import/export/reset;
- campaign entry decisions;
- refuge contract board;
- opening journalist mission and `Clean the Scene`;
- idempotent rewards and completion checkpoints;
- full unit and Chromium campaign coverage.

## Milestone 12 — Vehicle core and expanded district

**Status: ✅ Complete**

Delivered:

- Enter-only vehicle entry/exit;
- arcade acceleration, braking, reverse and steering;
- Space handbrake with body/travel-angle drift;
- speed-sensitive camera;
- persistent hull health and disabled/wreck state;
- explicit occupied-wreck exit;
- authored ownership/status and archetypes;
- limited trunks integrated with campaign persistence;
- pedestrian impacts and directional blood evidence;
- destructible streetlights and dumpsters;
- corpse exposure from ruptured containers;
- expanded `2400 × 1440` district;
- sidewalk/crossing pedestrians and distributed police;
- Explore/scenario boot profiles and focused regression.

Reference: `MILESTONE_12_STATUS.md`.

## Milestone 12.1 — Vehicle repair and recovery

**Status: ✅ Complete**

Delivered:

- refuge-garage interaction and accessible dialog;
- owned-vehicle hull quotes;
- full repair for damaged parked vehicles at the garage;
- campaign cash debit and immutable ledger entry;
- atomic wallet/condition transaction with rollback;
- repeated no-op without second charge;
- insufficient-funds/non-owned rejection;
- remote tow recovery for owned wrecks;
- deterministic parking slots and `35%` recovery hull;
- wanted/driving/location/layer safety gates;
- immediate campaign/live synchronization;
- checkpoint-safe persistence without schema change;
- unit and Chromium coverage.

Accepted compact baseline:

```text
minimum repair charge  $25
repair rate             $3 per missing hull
recovery fee            $120
recovery hull           26 / 72
```

Reference: `VEHICLE_MAINTENANCE.md`.

## Milestone 13 — Large-city traffic and motorized police

**Status: ✅ Complete**

### 13.1 Large-city streaming foundation — ✅ Complete

- asynchronous chunks, retry/cancel and activation budgets;
- LRU resident retention and chunk-local deltas;
- spatial static queries;
- district resource packs and road-aware prefetch;
- dormant entity simulation.

### 13.2 Macro traffic and dormant police — ✅ Complete

- district macro graph;
- abstract civilian traffic tokens;
- dormant foot-police travel;
- district-local patrol recovery.

### 13.3 Local civilian traffic materialization — ✅ Complete

- fixed pool of ten local traffic containers;
- explicit forward/reverse lane polylines;
- smooth macro interpolation;
- stable token-to-slot identity;
- street/chunk eligibility and hysteresis.

### 13.4 Local traffic behaviour — ✅ Complete

- following distance and queues;
- braking for player/authored vehicles;
- bounded catch-up;
- deterministic junction priority.

### 13.5 Physical contact and impact consequences — ✅ Complete

- bounded soft push and blocked contact;
- safe lane-offset recovery;
- soft contacts without damage;
- hard/severe hull damage, exposure and local heat;
- severe temporary traffic stall;
- cooldown preventing frame-stacked damage.

Detailed records: `CITY_STREAMING.md` and `CITY_STREAMING_4A.md` through `CITY_STREAMING_4F.md`.

### 13.6 Motorized police — ✅ Complete

Delivered:

- one pursuit cruiser at wanted level 2;
- pursuit plus one partial roadblock at wanted level 3;
- deterministic district paths on authored lane polylines;
- fixed local pool of two police cruisers;
- public 5/7 police totals preserved;
- `footDesiredCount()` subtracting crews reserved inside cruisers;
- exact-once transfer into existing foot police AI;
- local blocker boundary separating macro and materialized movement;
- cross-lane roadblock at `72%` of its final leg;
- trapped/disabled cruiser dismount;
- player/cruiser collision consequences;
- four-second abandoned suspect-car memory;
- rooftop/sewer hiding without deleting macro response state;
- effective stress diagnostics for foot plus reserved officers;
- pure routing/reservation tests and focused Chromium regression.

Accepted response baseline:

```text
wanted 2                  1 pursuit cruiser · 2 reserved officers
wanted 3                  pursuit + partial roadblock · 4 reserved officers
materialize radius        920
pursuit dismount          150
roadblock trigger         210
roadblock final phase     0.72
trapped dismount          1.15 s
abandoned-car memory      4 s
```

Reference: `MOTORIZED_POLICE.md`.

## Milestone 14 — Original factions and territory foundation

**Status: 🔵 Active next phase**

### 14.1 Canonical faction and territory data — 🔵 Active

Planned first cut:

- canonical original faction IDs and definitions;
- Blackglass Directorate and Red Assembly as mechanically distinct factions;
- separate Unaligned House/contact records rather than one combined faction score;
- district/territory ownership stored in migration-safe campaign state;
- stable ownership defaults for current wards;
- faction links for safehouses, suppliers, authored vehicles and patrol profiles;
- reputation/access/hostility gates exposed as pure services;
- mission-definition conditions/effects for territory changes;
- browser diagnostics and export/import coverage;
- no parallel territory state in rendering or mission UI.

Acceptance:

- old saves migrate without losing missions, cash, checkpoints or vehicles;
- every district has one explicit owner or neutral state;
- faction/contact reputation remains separate;
- access and hostility differ mechanically by faction/territory;
- mission definitions can read/change territory without hard-coded scene progression;
- ownership survives save/load/import/export;
- unit, boot, systems and campaign domains remain green.

### 14.2 Territory consequences — ⬜ Planned after 14.1

- patrol composition and local hostility;
- supplier/safehouse access;
- faction vehicle availability;
- debts, betrayal flags and alternate buyers;
- visible but readable territory presentation.

### 14.3 Original faction identity — ⬜ Planned

- original symbols, ranks and histories;
- art/audio language per faction;
- commercial trademark review.

## Milestone 15 — Safehouses, stash and ammunition economy

**Status: ⬜ Planned**

Locked direction:

- no floating street-ammunition pickups;
- one melee, one sidearm and one long/special slot;
- carried ammunition caps;
- separate carried loadout and refuge stash;
- finite supplier stock;
- paid resupply and authored mission caches;
- trunks provide limited mobile storage, never the complete stash.

Acceptance:

- ammunition is not infinite or free;
- cash has meaningful competing uses;
- stash/loadout persist correctly.

## Milestone 16 — Retainers

**Status: ⬜ Planned**

First roles:

- Quartermaster;
- Driver;
- Cleaner;
- Mechanic;
- Fixer;
- Scout;
- Guard;
- Medic.

Tracked state includes loyalty, dependence, exposure, condition, competence, upkeep, dose due and assignments.

Acceptance:

- Retainers are named characters with agency/loss states;
- they require money and blood maintenance;
- capture/exposure creates missions and refuge risk;
- services integrate with vehicles, ammunition, evidence and police pressure.

## Milestone 17 — Expanded arsenal and vehicle combat

**Status: ⬜ Planned**

- shotgun, SMG and specialist weapons;
- limited thrown/distraction items;
- drive-by compatible weapons;
- firearm damage to vehicles;
- authored weapon/mission loot;
- enemy/faction loadouts.

## Milestone 18 — District campaign

**Status: ⬜ Planned**

- opening Directorate contract;
- vehicle pursuit mission;
- Red Assembly mission;
- Unaligned multi-buyer contract;
- territory consequences;
- Retainer recruitment/rescue;
- safehouse/supplier progression.

Acceptance:

- missions support multiple solutions and persistent consequences;
- vehicles, factions, economy and vampiric systems interact;
- city structure feels like a systemic top-down crime game with original vampire consequences.

## Later expansion candidates

- second district;
- interiors and additional garages;
- player-facing key remapping;
- larger vehicle/weapon catalogues;
- additional original supernatural rivals;
- art/audio production pass;
- full gamepad support;
- multiplayer/networking remains deferred.

## Definition of done

1. Feature works in the playable build.
2. Existing tutorial and mission flows pass regression.
3. Relevant render/layout profiles pass.
4. Input/UI conflicts are covered.
5. Pure logic has automated coverage.
6. Browser regression exists where appropriate.
7. Documentation records ownership, tuning and limitations.
8. `PROJECT_BLUEPRINT.md` and the detailed subsystem document agree.
9. Commercial-facing names receive trademark clearance before release.
