# Roadmap

_Last updated: 2026-07-24_

This roadmap is ordered by dependency, not calendar date. A milestone is complete only when implementation, automated coverage, browser regression and documentation agree.

Read `PROJECT_BLUEPRINT.md` for the canonical architecture and production sequence.

## Status legend

- ✅ Complete
- 🟡 Implemented; manual tuning or a dependent extension remains
- 🔵 Active
- ⬜ Planned
- ◇ Deferred or optional
- ◈ Historical content retained as reference, not active production content

## Milestone 0 — Vertical slice foundation

**Status: ✅ Technical foundation complete · ◈ authored narrative retired**

Delivered the original Phaser district, street/rooftop/sewer traversal, Hunger, feeding, powers, witnesses, police escalation and journalist vertical slice.

The journalist mission, informant flow and related map constraints are no longer registered in production. Their source records remain historical examples.

## Milestone 1 — Architecture stabilization

**Status: 🟡 Automated implementation complete; manual input/accessibility checks remain**

- central action-based `InputSystem`;
- one keyboard/pointer/aim/wheel frame;
- focus/reset protection;
- pure geometry/input coverage;
- browser input-lock coverage.

## Milestone 2 — Mouse aim and unarmed combat

**Status: 🟡 Implemented; final tuning pending**

- mouse facing and aim dead zone;
- timed left-click attacks;
- directional melee, resilience, stagger and downed state.

The old rooftop blocker teaching sequence is historical and no longer production-booted.

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

## Milestone 9 — UX and accessibility

**Status: 🟡 Automated coverage green; manual assistive-technology validation pending**

- recovery countdowns;
- separated HUD regions;
- high-contrast aim;
- ARIA state, keyboard activation, narrow layouts and reduced motion.

The old authored tutorial text/sequence is historical and skipped in the current production sandbox.

## Milestone 10 — Runtime consolidation and testing

**Status: ✅ Core consolidation complete**

- one `GameplayRuntime` update owner;
- direct scene composition;
- first-class task/perception/guidance systems;
- runtime ownership diagnostics;
- spatial NPC queries/culling;
- change-aware state publication;
- deterministic pinned Phaser;
- parallel unit/boot/systems/campaign CI;
- deletion of retired patch files.

## Milestone 10.1 — Vertical Slice Release Candidate

**Status: ◈ Historical RC boundary**

The old mission-focused RC automation is retained as an implementation record. The associated browser golden paths were removed when those missions ceased being production content.

Manual hardware/accessibility validation still applies to the reusable gameplay systems.

## Milestone 11 — Campaign foundation

**Status: ✅ Framework complete · ◈ authored contracts unregistered**

Reusable foundation:

- versioned `CampaignState`;
- data-driven `MissionDefinition` and `MissionRunner`;
- one mission/objective authority;
- cash and immutable ledger;
- faction/contact reputation;
- safe checkpoints and rollback;
- save/load/import/export/reset;
- idempotent rewards.

Historical content:

- opening journalist contract;
- campaign entry flow;
- refuge mission board;
- `Clean the Scene`.

These definitions remain explicit fixtures/reference content but are no longer registered or booted by production.

## Milestone 12 — Vehicle core and expanded district

**Status: ✅ Complete**

- Enter-only vehicle entry/exit;
- arcade acceleration, braking, reverse and steering;
- Space handbrake with body/travel-angle drift;
- speed-sensitive camera;
- persistent hull health and disabled/wreck state;
- explicit occupied-wreck exit;
- authored ownership/status and archetypes;
- limited trunks integrated with campaign persistence;
- pedestrian impacts and blood evidence;
- destructible streetlights/dumpsters;
- expanded `2400 × 1440` imported district;
- pedestrians and distributed police;
- explore/scenario profiles and focused regression.

Reference: `MILESTONE_12_STATUS.md`.

## Milestone 12.1 — Vehicle repair and recovery

**Status: ✅ Complete**

- refuge-garage interaction and accessible dialog;
- full repair for owned parked vehicles;
- atomic cash/condition transaction with rollback;
- repeated no-op without second charge;
- remote tow recovery for owned wrecks;
- deterministic parking slots and `35%` recovery hull;
- wanted/driving/location/layer gates;
- immediate campaign/live synchronization;
- checkpoint-safe persistence.

Accepted compact baseline:

```text
minimum repair charge  $25
repair rate             $3 per missing hull
recovery fee            $120
recovery hull           26 / 72
```

Reference: `VEHICLE_MAINTENANCE.md`.

## Milestone 13 — Large-city traffic and motorized police

**Status: ✅ Core streaming/traffic/response complete**

### 13.1 Streaming foundation — ✅

- async chunks, retry/cancel and activation budgets;
- LRU retention and chunk-local deltas;
- spatial queries;
- district packs/road prefetch;
- dormant entity simulation.

### 13.2 Macro traffic and dormant police — ✅

- district macro graph;
- abstract civilian traffic tokens;
- dormant foot-police travel;
- district-local patrol recovery.

### 13.3 Local traffic materialization — ✅

- fixed pool of ten traffic containers;
- explicit lane polylines;
- smooth macro interpolation;
- stable token-to-slot identity;
- eligibility/hysteresis.

### 13.4 Local traffic behaviour — ✅

- following/queues;
- braking for player/authored vehicles;
- bounded catch-up;
- deterministic junction priority.

### 13.5 Contact and impact consequences — ✅

- soft push/block and lane recovery;
- hard/severe hull damage, exposure and heat;
- severe temporary stalls;
- contact cooldown.

Detailed records: `CITY_STREAMING.md` and `CITY_STREAMING_4A.md` through `CITY_STREAMING_4F.md`.

### 13.6 Motorized police — ✅

- one pursuit cruiser at wanted level 2;
- pursuit plus partial roadblock at level 3;
- deterministic macro/lane routing;
- pool of two cruisers;
- public 5/7 police totals preserved;
- reserved crews subtracted from foot spawn target;
- exact-once transfer to foot AI;
- local collision/disablement;
- four-second abandoned-car memory;
- rooftop/sewer hiding without deleting response state.

Reference: `MOTORIZED_POLICE.md`.

### 13.7 Narrative constraint retirement — 🔵 Implementation candidate

PR #32 scope:

- production mission registry becomes empty;
- normal boot becomes persistent street free roam;
- legacy mission state/checkpoint pruned without losing cash, reputation or vehicles;
- campaign-entry, board and authored tutorial not booted;
- journalist, exposed body and rooftop thug inactive;
- mission-only actors no longer pin streaming;
- `old-quarter` no longer protected;
- City Compiler fixed landmarks removed;
- archived mission definitions remain explicit framework fixtures;
- mission-specific browser golden paths removed;
- site-first future landmark policy recorded.

Acceptance:

- public build starts without contract, entry modal, board or objective marker;
- old mission saves migrate safely;
- persistent economy/vehicles/maintenance remain available;
- no district/landmark is protected by retired content;
- generic MissionRunner still works with explicit definitions;
- unit, boot, systems and campaign domains are green.

Reference: `CITY_TOPOLOGY_RESET.md`.

## Milestone 14 — City topology and readability

**Status: ✅ Complete — City Topology V2**

Delivered baseline: `4800 × 3600`, 14 districts, 80 chunks, site-first hospital/police/city-hall/cathedral/university sites and topology-aware vehicle migration. Road geometry v2 adds a 114-node / 158-edge graph, 153 clipped segments and 111 non-overlapping junction authorities.

### 14.1 Road/intersection authority — ✅ geometry v2

- one explicit road graph;
- stable edges with width/class semantics;
- unique end/corner/T/cross/complex junction objects;
- supported collinear width-transition polygons;
- straight road bands terminate at junction boundaries;
- zero road-piece overlap.

Arbitrary-angle/curved offsets remain a later geometry version.

### 14.2 Pedestrian and visual language — ✅

- generated sidewalk strips and corner pads;
- crosswalks outside junction centres with two sidewalk continuations;
- junction-owned closure/corner surfaces without internal sidewalk end-cap seams;
- explicit no-prop envelopes for junction centres, approaches and crosswalks;
- kerb/service snapping for lights and dumpsters after final layout;
- regenerated pedestrian routes/navigation;
- post-layout streetlights clear of roads, crossings and buildings;
- runtime/compiler renderers share polygon-aware road surfaces.

### 14.3 Parcels and site-first landmarks

- polygonal ordinary parcels;
- road/intersection/building setbacks;
- compound/polygonal building footprints;
- large landmark sites reserved before local roads/ordinary blocks;
- police station, hospital, church, plant and similar campuses may shape curved roads.

### 14.4 Regeneration and integration — ✅

- regenerate or replace the Old Quarter;
- update traffic lanes and macro edges;
- update pedestrian routes/crossings;
- update streaming chunks/prefetch;
- update police response and garage/site bindings;
- compiler hard errors for overlap and dead pedestrian geometry.

Acceptance:

- no building intersects or visually crowds a road corridor;
- no crosswalk ends without pedestrian continuation;
- intersections have no duplicated sidewalk bands;
- lamps sit on valid sidewalk/frontage anchors;
- road/curb/sidewalk are readable at a glance;
- the entire old core can change;
- large landmarks are not restricted to rectangular leftovers;
- curved roads are supported;
- unit, boot, systems and city validation remain green.

## Milestone 15 — Original factions and territory

**Status: 🔵 Active next phase**

- canonical original faction IDs/data;
- Blackglass Directorate and Red Assembly with distinct mechanics;
- separate Unaligned House/contact records;
- district ownership in migration-safe campaign state;
- faction links for sites, suppliers, vehicles and patrols;
- access/hostility gates;
- mission hooks for territory changes;
- original symbols, ranks and histories.

Factions wait until the city exposes stable semantic districts/sites rather than temporary raw coordinates.

## Milestone 16 — Safehouses, stash and ammunition economy

**Status: ⬜ Planned**

- no floating street-ammunition pickups;
- one melee, one sidearm and one long/special slot;
- carried ammunition caps;
- separate carried loadout and refuge stash;
- finite supplier stock;
- paid resupply and authored caches;
- trunks provide limited mobile storage.

## Milestone 17 — Retainers

**Status: ⬜ Planned**

Initial roles:

- Quartermaster;
- Driver;
- Cleaner;
- Mechanic;
- Fixer;
- Scout;
- Guard;
- Medic.

Tracked state includes loyalty, dependence, exposure, condition, competence, upkeep, dose due and assignments.

## Milestone 18 — Expanded arsenal and vehicle combat

**Status: ⬜ Planned**

- shotgun, SMG and specialist weapons;
- limited thrown/distraction items;
- drive-by compatible weapons;
- firearm damage to vehicles;
- authored weapon/mission loot;
- enemy/faction loadouts.

## Milestone 19 — New district campaign

**Status: ⬜ Planned after city/factions/economy**

- new opening contract authored against semantic sites;
- vehicle pursuit contract;
- Directorate/Assembly/Unaligned alternatives;
- territory consequences;
- Retainer recruitment/rescue;
- safehouse/supplier progression.

Acceptance:

- missions support multiple solutions and persistent consequences;
- no mission protects raw city geometry;
- vehicles, factions, economy and vampire systems interact;
- city feels like a systemic top-down crime game with original vampire consequences.

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
2. Existing reusable gameplay flows pass regression.
3. Relevant render/layout profiles pass.
4. Input/UI conflicts are covered.
5. Pure logic has automated coverage.
6. Browser regression exists where appropriate.
7. Documentation records ownership, tuning and limitations.
8. `PROJECT_BLUEPRINT.md` and detailed subsystem docs agree.
9. Mission content references semantic sites rather than accidentally protecting raw geometry.
10. Commercial-facing names receive trademark clearance before release.
