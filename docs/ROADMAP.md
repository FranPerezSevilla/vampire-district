# Roadmap

_Last updated: 2026-07-22_

This roadmap is ordered by dependency, not calendar date. A milestone is complete only when implementation, automated coverage, browser regression and documentation agree.

Read `PROJECT_BLUEPRINT.md` for the canonical current architecture and production sequence.

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

**Status: 🟡 Automated implementation complete; remaining manual input/accessibility checks**

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
- Space handbrake with actual body/travel-angle drift;
- speed-sensitive camera;
- persistent hull health and disabled/wreck state;
- explicit occupied-wreck exit;
- authored ownership/status and archetypes;
- limited trunks integrated with campaign persistence;
- pedestrian impacts and directional blood evidence;
- destructible streetlights and dumpsters;
- corpse exposure from ruptured containers;
- expanded `2400 × 1440` district with multiple wards;
- sidewalk/crossing pedestrians and sparse distributed police;
- Explore/scenario boot profiles and focused systems regression.

Reference: `MILESTONE_12_STATUS.md`.

## Milestone 12.1 — Vehicle repair and recovery

**Status: 🔵 Active next phase**

Purpose: close the damage loop introduced by vehicle/world collisions and Traffic 4F.

Planned implementation:

- inspect current hull condition and repair quote;
- refuge/garage repair service;
- cash charge through the existing wallet and ledger;
- partial/full repair rules;
- recover, relocate or replace disabled campaign-critical vehicles;
- no repair if funds are insufficient;
- idempotent persistence through save/load/checkpoints;
- diagnostic/browser API and focused tests.

Acceptance:

- hull damage is reversible through an explicit costed action;
- repair cannot duplicate charges or health on repeated activation;
- a disabled vehicle cannot permanently soft-lock campaign progression;
- ambient traffic proxies remain outside repair/persistence;
- unit, boot, systems and campaign domains remain green.

## Milestone 13 — Traffic and motorized police

**Status: 🟡 Civilian traffic foundation complete; motorized police remains**

### 13.1 Large-city streaming foundation — ✅ Complete

- asynchronous chunks, retry/cancel and activation budgets;
- LRU resident retention and chunk-local deltas;
- spatial static queries;
- district resource packs and road-aware prefetch;
- dormant entity simulation.

### 13.2 Macro traffic and police — ✅ Complete

- district macro graph;
- abstract traffic tokens;
- dormant police travel;
- district-local patrol recovery.

### 13.3 Local traffic materialization — ✅ Complete

- fixed pool of ten local traffic containers;
- explicit forward/reverse lane polylines;
- smooth macro interpolation;
- stable token-to-slot identity;
- street/chunk eligibility and hysteresis.

### 13.4 Local traffic behaviour — ✅ Complete

- following distance and queues;
- braking for player/authored vehicles;
- bounded local catch-up;
- deterministic junction priority.

### 13.5 Physical contact and impact consequences — ✅ Complete

- bounded soft push and blocked contact;
- safe lane-offset recovery;
- soft contacts without damage;
- hard/severe hull damage, exposure and local heat;
- severe temporary traffic stall;
- cooldown preventing frame-stacked damage.

Detailed records: `CITY_STREAMING.md` and `CITY_STREAMING_4A.md` through `CITY_STREAMING_4F.md`.

### 13.6 Motorized police — ⬜ Planned after repair/recovery

- police cruisers use macro/local road infrastructure;
- pursuit and interception;
- deterministic roadblocks;
- officers exit blocked or disabled vehicles;
- abandoned stolen-car search memory;
- player can abandon a car and escape by rooftops/sewers;
- motorized response complements rather than replaces foot pursuit.

Acceptance:

- wanted levels 2–3 can deploy vehicles without invalidating existing foot AI;
- local traffic remains readable and pool-bounded;
- roadblocks have escape routes and cannot hard-lock the player;
- police vehicle state uses an explicit persistence/authority boundary.

## Milestone 14 — Original factions and territory

**Status: ⬜ Planned**

- Blackglass Directorate, Red Assembly and separate Unaligned Houses;
- faction/contact reputation;
- territory and safehouse ownership;
- faction vehicles, suppliers and mission pools;
- hostility, debts, betrayal flags and alternate buyers;
- original symbols, ranks, history and visual identities.

Acceptance:

- factions differ mechanically;
- Unaligned reputation is stored per House/contact;
- decisions can improve one relationship and damage another.

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

- Retainers are named characters with agency and loss states;
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
- enemy and faction loadouts.

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
- interiors and garages;
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
8. `PROJECT_BLUEPRINT.md` and the relevant subsystem document agree.
9. Commercial-facing names receive trademark clearance before release.
