# Roadmap

_Last updated: 2026-07-29_

This roadmap is ordered by dependency, not calendar date. A milestone is complete only when implementation, automated coverage, browser regression and documentation agree.

Read `PROJECT_BLUEPRINT.md` for the canonical architecture and production sequence.

## Status legend

- ✅ Complete
- 🟡 Implemented; manual tuning or a dependent extension remains
- 🔵 Active
- ⬜ Planned
- ◇ Deferred or optional
- ◈ Historical content retained as reference, not active production content

## Viceblood identity guardrails

- Viceblood is an urban predation, concealment and vampire-politics game built on a GTA2-like systemic city.
- Hunger, feeding, the Veil, hunting rights, evidence, favours, territory, the Beast, refuges and the approaching dawn provide the vampire identity.
- Blood is not an emotional-resonance system and does not grant emotion-derived builds, personalities or powers. That concept belongs outside Viceblood.
- Hunger remains the single player-facing feeding resource: feeding lowers it; powers, supernatural healing and losing control raise it. Stored blood may lower Hunger without creating a second permanent meter.
- Crime systems earn their place when they help the player hunt, conceal supernatural evidence, transport bodies or blood, manipulate institutions, or survive faction politics.
- The setting, terminology, factions, ranks, symbols and supernatural rules remain original rather than reproducing a licensed vampire property.

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

## Milestone 6 — Historical light and prop experiment

**Status: ◈ Streetlight/darkness mechanics retired**

The original destructible-light experiment informed combat-language props and perception reactions. Streetlight rendering, lamp damage and darkness-based visibility are no longer production systems.

## Milestone 7 — Weapon system and wheel inventory

**Status: 🟡 Prototype complete; campaign loadout replacement planned**

- Unarmed, Iron Pipe and Pistol;
- one-step wheel cycling;
- shared melee/hitscan contracts;
- ammo, empty rejection, tracer and HUD.

Milestone 16 replaces the all-owned prototype with slots, carried limits, refuge stash and paid resupply.

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
- vehicle interaction with bounded street furniture;
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

Delivered baseline: `4800 × 3600`, 14 districts, 80 chunks, site-first hospital/police/city-hall/cathedral/university sites and topology-aware vehicle migration. Road geometry v4 keeps the 107-node / 148-edge graph, compiles 147 clipped segments and 104 non-overlapping junction authorities, absorbs one remaining micro-approach and emits continuous obstacle-clipped road-edge bands.

### 14.1 Road/intersection authority — ✅ geometry v4

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
- street furniture anchored clear of roads, crossings and buildings;
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
- street furniture sits on valid sidewalk/frontage anchors;
- road/curb/sidewalk are readable at a glance;
- the entire old core can change;
- large landmarks are not restricted to rectangular leftovers;
- curved roads are supported;
- unit, boot, systems and city validation remain green.

## Milestone 15 — Original factions, territory and hunting law

**Status: 🔵 Active — territory and hunting law complete; feeding depth in PR #43**

The city becomes a vampire ecosystem only when territory controls access to prey, concealment services, safe routes and political consequences. Faction ownership must therefore affect how the player hunts, not merely recolour districts or alter a reputation number.

### 15.1 Territory foundation — ✅ Complete

- canonical original faction IDs/data for The First Estate and The Gutter Crown;
- independent Houses represented by separate stable records, never one simulation faction;
- migration-safe ownership and influence for all fourteen semantic districts;
- controlled, contested and independent district states;
- reputation-derived watched/restricted/hostile/welcome access policy;
- district-entry HUD feedback;
- influence, ownership-change and district-entry events;
- future links for sites, suppliers, vehicles, patrols and missions.

This phase deliberately excludes the full territory-war loop, faction campaigns, supplier changes, safehouse changes and new faction combat archetypes.

Reference: `MILESTONE_15_1_FACTIONS_TERRITORY.md`.

### 15.2 Blood ownership, hunting rights and poaching — ✅ Complete

Every completed feeding action records its district, current owner, permission state, victim protection state and resulting evidence. The implementation shipped through PR #42.

- legal feeding: covered by an explicit right, service or faction permission;
- tolerated feeding: not formally permitted, but below the owner's enforcement threshold;
- poaching: feeding without permission in claimed territory;
- protected prey: named contacts, staff, informants, donors or community members who may not be touched;
- political violation: feeding that harms a faction's institutional or territorial interests even when the Veil remains intact.

Faction distinction:

- **The First Estate** regulates who may be fed upon, favours selected donors and institutional blood sources, and demands clean scenes with no public scandal;
- **The Gutter Crown** regulates where the player may hunt, demands tribute and loyalty, protects local people and informants, and forbids bringing police pressure into its routes and tunnels.

The owner is not omniscient. Poaching is discovered through witnesses, cameras, marked/protected victims, recovered bodies, repeated patterns or informants.

PR #42 also delivered the paused **Night Ledger**: one player-facing panel for faction relations, controlled districts, hunting rights, hidden/known violations, police pursuit, witnesses, evidence and recent incidents. It opens from a dedicated HUD icon or `L` and pauses the game while visible.

District hunting pressure progresses through low, medium, high and critical states. Excessive predation reduces lone pedestrians, closes nightlife, increases escorts/patrols and can create a temporary curfew or investigation. The player must not be able to farm one neighbourhood forever without changing it.

### 15.3 Favours, blood debt and vampire services — ⬜ Planned

Faction rewards and penalties extend beyond cash and generic reputation.

Services may include:

- temporary hunting rights;
- access to a selected donor or stored blood;
- removal of a body;
- deletion of a recording;
- reduction of ordinary police Heat;
- use of a sewer route, hidden garage or emergency refuge;
- protection for a victim, Retainer, vehicle or property;
- false paperwork, a mundane cover story or access to a restricted site.

A faction service may create a persistent favour owed by the player. A completed contract may also make a contact or faction owe the player. Debts are concrete callable obligations with authored consequences, not only `+10/-10` reputation changes.

### 15.4 Vampire city infrastructure — ⬜ Planned

Semantic businesses and institutions become part of the feeding and concealment network:

| Site | Vampire function |
|---|---|
| Nightclub | concentrates possible prey and social access |
| Hospital / blood bank | stored blood, patients, staff and records |
| Motel | isolated rooms and temporary shelter |
| Funeral home / morgue | bodies, paperwork and discreet transport |
| Garage | plates, vehicle cleaning, trunks and recovery |
| Police station | Heat, evidence and compromised officers |
| Power utility | blackouts and camera disruption |
| Newspaper / broadcaster | public explanation of impossible events |
| Cold storage / warehouse | reserves and refrigerated transport |
| Back-room bar | information, anonymous prey and faction contact |

The First Estate controls clean institutional versions of this network. The Gutter Crown controls clandestine, improvised and street-level alternatives.

## Milestone 15.5 — Predator feeding and Hunger economy

**Status: ✅ Complete — merged through PR #43**

Feeding becomes the central predatory decision rather than a health pickup.

### Feeding depth

The existing held right-click action has clear thresholds while preserving direct control:

- **Quick bite**: small Hunger reduction, short exposure window, living victim, partial memory;
- **Full feed**: substantial Hunger reduction, unconscious victim, visible marks and a scene that must be handled;
- **Drain**: maximum Hunger reduction, dead victim, severe body evidence and political consequences.

The player chooses when to release. Viceblood does not add a separate rhythm minigame or remove control merely to make feeding feel dramatic.

### Consequences and follow-up actions

After feeding, context may allow:

- leave the victim;
- drag or hide the victim;
- place a body or unconscious victim in a compatible trunk;
- use Whisper to calm, redirect or blur the immediate memory;
- create a mundane crime scene or transport the evidence elsewhere;
- continue feeding and accept the greater risk.

### Hunger economy

- Hunger remains the single visible resource;
- feeding lowers Hunger;
- powers and supernatural recovery raise Hunger;
- ordinary medicine may stabilise a situation but does not replace feeding as the vampire's recovery loop;
- stored blood is safer and less effective than fresh feeding, represented as a consumable supply rather than a second permanent bar;
- contaminated or vampire blood remains an optional later extension, not an MVP requirement.

Acceptance:

- the player can intentionally stop at each feeding depth;
- each depth has a distinct victim outcome, evidence profile and Hunger value;
- interruption, movement, awareness and geometry rules remain deterministic;
- no emotion, mood or resonance statistics are attached to blood;
- feeding is useful for survival, powers, investigation pressure and politics rather than only restoring a meter.

## Milestone 15.6 — Heat, Exposure and concrete evidence

**Status: ✅ Complete — PR #45**

Viceblood now separates ordinary criminal attention from proof of the supernatural.

```text
Heat      → police believe the player committed human crime
Exposure  → people or institutions possess evidence that something impossible exists
```

Delivered:

- district-local, persistent Heat is the sole authority for search, pursuit, cruisers and air support;
- Exposure is calculated from serializable witness, bite-mark, drained-body, unconscious-victim, blood-pattern and visible-power records;
- evidence moves through latent, reported, institutional and resolved knowledge states;
- latent clues do not grant police, factions or hunters omniscient knowledge;
- physical cleanup resolves only latent proof, not knowledge already reported or retained;
- crime-as-an-alibi can deliberately exchange Exposure for ordinary Heat;
- campaign schema v5 and checkpoint v3 persist both domains independently;
- the Night Ledger explains Police/Heat and Veil/Evidence in separate panels.

Reference: `MILESTONE_15_6_HEAT_EXPOSURE_EVIDENCE.md`.

## Milestone 15.7 — Blood Sense, Whisper and the Beast

**Status: 🔵 Active next phase**

### Blood Sense

Blood Sense becomes the primary predator-reading mode:

- directional heartbeats and living bodies behind thin cover;
- wounded targets and fresh blood trails;
- recently fed-upon victims and drained bodies;
- other vampires recognised by the absence of a heartbeat;
- faction-protected or marked targets only when the player has learned that information through the world.

Blood Sense does not reveal emotions, personalities or emotion-derived buffs.

### Contextual Whisper

Whisper gains small, systemic commands selected from context rather than a large dialogue tree:

- **Come here**;
- **Walk away**;
- **Stay calm**;
- **Forget this**;
- **Open it**;
- **Get in**;
- **Call them off**, when the target and alert state permit it.

Every command has a Hunger cost, range, resistance and witness consequence. Alerted, trained or resistant targets cannot be treated as unlimited puppets.

### The Beast

High Hunger creates temptation and loss of subtlety rather than arbitrary random failure:

- heartbeats become louder and vulnerable prey easier to identify;
- physical actions and feeding become faster or cheaper;
- the safe release window during feeding narrows;
- subtle Whisper and controlled cleanup become harder;
- the player may voluntarily **Give In** for a short burst of speed, strength and recovery at the cost of precision, witnesses and evidence.

The game does not seize input without a readable cause. The Beast offers useful power at exactly the moment using it is most dangerous.

## Milestone 15.8 — Persistent hunter investigation

**Status: ⬜ Planned**

Viceblood uses one named, persistent hunter before considering generic hunter populations.

The hunter maintains a migration-safe case containing:

- collected testimony;
- recovered recordings;
- examined bodies;
- recognised vehicles and plates;
- repeated districts, feeding sites and escape routes;
- suspected faction protection, contacts and refuges;
- confidence in the player's identity and habits.

Escalation:

1. examines scenes after police activity;
2. installs cameras, trackers or traps;
3. watches recurring hunting grounds;
4. follows a vehicle, victim or contact;
5. intercepts a blood delivery or faction service;
6. blocks a known escape route with specialised light or equipment;
7. searches for the player's refuge before dawn.

Counterplay includes destroying evidence, feeding false information, framing another vampire, compromising a source, changing habits, using faction influence or forcing the hunter into hostile territory.

Acceptance:

- the hunter's actions are traceable to case evidence;
- repeated player habits make the hunter measurably more effective;
- changing habits and destroying evidence reduce or redirect the investigation;
- the system does not become endless combat waves;
- killing, discrediting or politically neutralising the hunter are distinct long-term outcomes.

## Milestone 16 — Safehouses, stash, blood supply and night pressure

**Status: ⬜ Planned**

### Loadout and supplies

- no floating street-ammunition pickups;
- one melee, one sidearm and one long/special slot;
- carried ammunition caps;
- separate carried loadout and refuge stash;
- finite supplier stock;
- paid resupply and authored caches;
- trunks provide limited mobile storage;
- stored blood is kept in refuges, selected vehicles or faction-controlled sites.

### Refuge identity

A refuge may provide:

- sealed windows and daylight protection;
- blood, weapon and evidence storage;
- garage access and a clean vehicle;
- alternate roof, street or sewer exits;
- a place for a Retainer or contact to operate;
- upgrades that improve security, concealment or emergency escape rather than generic decoration.

### Night and dawn

The first implementation uses event-driven night phases rather than a permanently aggressive real-time clock:

```text
Dusk → Midnight → Dead Hours → Approaching Dawn → Dawn
```

Contracts, major travel, deep feeding, arrests and selected services may advance the phase. As dawn approaches, clubs close, prey thins out, police cleanup increases, vampires withdraw and safe routes become more important.

Emergency shelter may include a compatible vehicle trunk, basement, motel room, sewer chamber or faction refuge. Surviving outside the primary refuge can cost blood, equipment, a favour or a compromised location rather than always causing instant death.

## Milestone 17 — Retainers

**Status: ⬜ Planned**

The MVP supports one active named Retainer before any larger organisation-management layer.

Initial roles:

- Quartermaster;
- Driver;
- Cleaner;
- Mechanic;
- Fixer;
- Scout;
- Guard;
- Medic.

A Retainer may be called to bring a vehicle, move a body, store blood, create a co-alibi, access a building, warn about a raid or perform one role-specific service.

Tracked state includes loyalty, dependence, exposure, condition, competence, upkeep, dose due and assignments. Maintaining the bond requires blood and creates vulnerability: enemies can identify, follow, capture, turn or threaten the Retainer.

Retainers are persistent people with limits and consequences, not disposable summonable units or a private army.

## Milestone 18 — Expanded arsenal, vehicle combat and vampire logistics

**Status: ⬜ Planned**

### Arsenal and combat

- shotgun, SMG and specialist weapons;
- limited thrown/distraction items;
- drive-by compatible weapons;
- firearm damage to vehicles;
- authored weapon/mission loot;
- enemy/faction loadouts.

### Vehicle logistics

Vehicles support vampire problems as well as pursuit:

- move a body or unconscious victim in a compatible trunk;
- transport stored blood, evidence or a sleeping vampire;
- feed discreetly inside a parked vehicle when geometry and witnesses allow it;
- use vehicle identity, damage, blood and plates as evidence;
- clean, abandon, burn, disguise or swap a compromised vehicle through services.

Useful authored archetypes may include:

- ambulance for hospitals and body access;
- hearse for discreet transport;
- refrigerated van for blood supply;
- tinted vehicle for limited dawn protection;
- maintenance van for utilities, cameras and restricted service access.

### Layer identity

- **Street**: abundant prey, vehicles, police, cameras and rapid escape;
- **Rooftops**: stalking, observation, private entry, Shadow Dash and fewer ordinary witnesses;
- **Sewers**: body movement, concealed travel, emergency shelter and Gutter Crown control.

The three layers solve different vampire problems rather than serving as interchangeable shortcuts.

## Milestone 19 — New district campaign

**Status: ⬜ Planned after city/factions/predation/economy**

- new opening contract authored against semantic sites;
- vehicle pursuit contract;
- First Estate/Gutter Crown/Unaligned alternatives;
- territory and hunting-right consequences;
- Retainer recruitment/rescue;
- safehouse/supplier progression;
- persistent hunter pressure;
- multiple solutions that deliberately trade Heat, Exposure, debt and faction standing.

Candidate systemic contracts:

- steal a blood-bank van before it reaches the hospital;
- recover a drained body before a forensic examination;
- capture a witness alive for interrogation or memory removal;
- move a sleeping or wounded vampire before dawn;
- identify a vampire poaching in protected territory;
- destroy or replace traffic-camera recordings;
- create a blackout to open a temporary hunting window;
- transport blood through rival-controlled districts;
- infiltrate a protected club where powers and feeding are forbidden;
- recover a car whose trunk contains protected prey or evidence;
- make a supernatural death look like a gang crime, robbery or crash;
- follow an investigator to discover what the police or hunter knows;
- sabotage a rival refuge without exposing vampires;
- rescue a captured Retainer or compromised contact;
- choose between delivering a blood reserve to a faction and consuming it to survive.

Other vampires remain scarce, named and persistent. A vampire has a territory, hunting habits, contacts, debts and a nightly routine. Killing one can leave a district leaderless, trigger an investigation or open a political conflict rather than merely removing another enemy sprite.

Acceptance:

- missions support multiple solutions and persistent consequences;
- no mission protects raw city geometry;
- vehicles, feeding, evidence, factions, economy, the hunter and vampire powers interact;
- campaign rewards include rights, services, debts and access as well as cash;
- the city feels like a systemic top-down crime game whose consequences are unmistakably vampiric.

## Cross-cutting presentation targets

These details are not substitutes for the systemic milestones, but they must reinforce them:

- feeding suppresses city audio and foregrounds heartbeat, breath and interruption cues;
- drained bodies appear pale, still and abnormal without requiring graphic gore;
- vampires appear as silence or absence inside Blood Sense;
- recordings may show distortion rather than convenient invisibility;
- radio and news react to disappearances, blood thefts, blackouts, attacks and implausible official explanations;
- The First Estate discusses prey and cleanup through controlled institutional language;
- The Gutter Crown marks routes, protected people and territory physically;
- refuges visibly communicate sealed daylight protection, emergency exits and hidden reserves;
- repeated overhunting changes pedestrian behaviour and nightlife presentation;
- strong powers may create readable audiovisual anomalies that become evidence when witnessed or recorded.

## First vampire-identity release cut

The smallest coherent sequence that materially changes how Viceblood feels is:

1. ✅ use the completed Milestone 15.1 territory foundation;
2. ✅ complete hunting rights, protected prey and discoverable poaching;
3. ✅ add Quick Bite / Full Feed / Drain outcomes;
4. ✅ separate Heat from evidence-driven Exposure and establish crime-as-an-alibi cleanup;
5. expand Blood Sense and contextual Whisper without emotion systems;
6. make the single hunter investigate concrete evidence and repeated habits;
7. connect safehouses, stored blood and approaching dawn.

This cut deliberately precedes broad weapon, vehicle and mission-content expansion. A new gun does not add as much vampire identity as changing what it means to hunt, feed and conceal the result.

## Later expansion candidates

- second city or major outer district;
- interiors and additional garages;
- player-facing key remapping;
- larger vehicle/weapon catalogues;
- additional original supernatural rivals;
- deeper contaminated-blood or vampire-blood rules only after the core Hunger loop works;
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
11. Vampire-facing systems do not introduce emotion/resonance blood mechanics.
12. Heat, Exposure, hunting rights, evidence and hunter knowledge remain explainable from concrete world state.
