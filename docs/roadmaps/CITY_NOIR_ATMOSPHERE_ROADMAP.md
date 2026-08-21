# City noir atmosphere roadmap

This roadmap decomposes the ViceBlood city-atmosphere initiative into bounded tasks an agent can execute without the originating chat.

Canonical direction: [`../CITY_NOIR_ATMOSPHERE.md`](../CITY_NOIR_ATMOSPHERE.md)  
Agent contract: [`../agents/CITY_NOIR_ATMOSPHERE_AGENT.md`](../agents/CITY_NOIR_ATMOSPHERE_AGENT.md)  
Machine state: [`../progress/city-noir-atmosphere-status.json`](../progress/city-noir-atmosphere-status.json)

## Status vocabulary

- `planned`
- `waiting-on-dependency`
- `autonomous-in-progress`
- `implementation-complete / automated-validation-pending`
- `complete`
- `blocked`
- `final-validation-pending` (initiative/final gate)

## Initiative policy

- This is a **presentation-only atmosphere program**.
- Existing gameplay/city authorities remain unique.
- PR #69 owns the current street-surface upgrade and is a dependency, not work to duplicate.
- Default execution cadence is **one bounded task → validate → document → report → wait for user direction**.
- A generic user “continue” authorizes the next bounded task only.
- Explicit batch instructions may remove the wait step for the granted scope, but documentation remains mandatory between tasks.
- Do not merge automatically.

---

## M0 — Canonical direction, references and agent continuity

**Status: complete**

Purpose: make the task self-contained in the repository.

### M0.1 — Commit reference images

- [x] commit the mood north star supplied by the user;
- [x] commit a clean crop of the current gameplay baseline;
- [x] document that the north star is a mood/value/material target, not a literal asset-fidelity requirement.

### M0.2 — Canonical art-direction document

- [x] define target vibe;
- [x] define value hierarchy;
- [x] define light-island principle;
- [x] define wetness/reflection language;
- [x] define surface-detail language;
- [x] define environmental storytelling direction;
- [x] define colour discipline;
- [x] define technical/performance boundaries;
- [x] define final acceptance rubric.

### M0.3 — Agent continuity

- [x] create operational agent contract;
- [x] create machine-readable status;
- [x] create append-only progress log;
- [x] identify #69 as explicit dependency.

**Exit condition:** an agent can explain the target, boundaries, next task and dependency state using repository files only.

---

## M1 — Integrate the street-surface foundation

**Status: complete**

Dependency: PR #69 `City street visual pass` — merged as `f803c974817c92666b82a60fac808d54c2c4bc05` and integrated into this branch by `a408a1342989868ad62a09e0df12d0742830ee4a`.

Purpose: establish a single surface authority before atmosphere work begins to modify roads/sidewalks.

### M1.1 — Resolve dependency state

- [x] confirm whether #69 is merged;
- [x] if not merged, do not copy or duplicate its implementation;
- [x] when merged, synchronize `agent/city-noir-atmosphere` with post-#69 `main`;
- [x] record resulting authority paths and focused tests in the progress log.

### M1.2 — Baseline audit after #69

At normal gameplay zoom capture/review at least one intersection and one mixed street.

Classify remaining deficits under these categories only:

- value hierarchy;
- local lighting;
- wet material response;
- non-#69 surface grime/set dressing;
- grounding/depth;
- environmental storytelling.

Do **not** reopen curb/sidewalk topology, asphalt patches, drains, cracks, repairs or road paint unless the post-merge audit proves a specific defect in #69.

### M1 exit

- [x] #69 has one integrated authority;
- [x] atmosphere branch is synchronized to the post-#69 foundation;
- [x] post-#69 baseline captures/evidence exist;
- [x] no duplicated street renderer exists;
- [x] exact next M2 task is recorded.

---

## M2 — Global value hierarchy and night exposure

**Status: complete**

Purpose: stop the city reading as one evenly exposed blue-grey layer.

### M2.1 — Value palette audit

Identify current world values for:

- street base;
- road;
- sidewalk;
- roof/building base;
- building highlights/shadows;
- common props;
- characters/vehicles;
- UI-independent world accents.

Document desired relative ordering rather than hardcoding arbitrary colour changes across unrelated files.

### M2.2 — Presentation-only night hierarchy

Implement the smallest coherent mechanism that creates:

- darker unlit roof/background mass;
- dark but distinguishable road/sidewalk midtones;
- preserved player/NPC/vehicle readability;
- enough headroom for practical lights to become the brightest local values.

Candidate implementation shapes include palette refinement and/or a bounded presentation overlay. The agent must first inspect the current render composition and choose the existing-authority-compatible approach.

Forbidden shortcut: one heavy fullscreen rectangle that crushes all local contrast equally.

### M2.3 — Readability guard

Add focused assertions/helpers where feasible for deterministic palette/opacity policy. Add browser capture evidence showing:

- an intentionally dark block;
- a road edge still readable;
- player and one threat/NPC still clear.

### M2 exit

- [x] thumbnail/blurred frame no longer reads as a flat blue field;
- [x] darkness dominates area without hiding navigation;
- [x] saturated accents are not globally boosted;
- [x] no gameplay visibility rule changed;
- [x] affected checks green.

---

## M3 — Practical-light islands

**Status: complete**

Purpose: create the core visual rhythm `darkness → local light → darkness`.

### M3.1 — Light-source model for presentation

Create/reuse a presentation-only descriptor for visible practical lights. It may derive from existing semantic geometry/events, but must not become gameplay lighting authority.

Each visible light should have bounded fields such as:

- stable source ID;
- world position / receiving orientation;
- family (`warm-street`, `window`, `civic`, `nightlife`, `vehicle`, `police`, `industrial`);
- radius/extent;
- intensity/alpha;
- optional reflection contribution;
- optional flicker/pulse only when semantically justified.

Do not create all families at once. Start with one simple static family and prove composition/culling.

### M3.2 — Warm street/practical pools

Implement sparse warm practical-light pools at plausible existing anchors. If no canonical lamp definitions exist, prefer deterministic presentation anchors near suitable street/frontage geometry rather than inventing a second gameplay street-furniture system.

Acceptance:

- pools are sparse;
- pool edges are soft/graded enough to avoid vector spotlight circles;
- pools do not overlap into blanket illumination;
- ordinary warm light becomes a recognizable city motif.

### M3.3 — Building/window/door spill

Add a restrained family for selected lit windows/entrances or frontage spill, using existing building semantics where possible.

Rules:

- not every building is lit;
- lit-window distribution is deterministic;
- building identity remains owned by building presentation;
- spill may extend onto nearby receiving ground but not become collision/interaction data.

### M3.4 — Accent families

Add only after warm light works:

- cool civic/institutional;
- local nightlife red/magenta;
- industrial/service warm/dirty light.

District/building family semantics may choose palette and density, never gameplay behaviour.

### M3.5 — Vehicle/emergency contribution

Where existing vehicle/police presentation exposes stable nearby state, add bounded light/reflection contribution for:

- headlights;
- tail/brake lights;
- police red/blue pulses.

Do not rewrite vehicle simulation to support lighting.

### M3 exit

- [x] at least three distinct practical-light contexts exist;
- [x] a representative street has real dark gaps between lights;
- [x] red/blue/magenta remain rare accents;
- [x] dynamic lights are culled to visible/nearby sources;
- [x] no gameplay lighting authority was introduced;
- [x] affected checks green.

Evidence is recorded in the progress/machine state, including contextual-family artifact `9441823514` and vehicle/emergency artifact `9442522378`.

---

## M4 — Wet asphalt and local reflection language

**Status: complete**

Purpose: make the city feel recently wet without a general-purpose reflection renderer.

Execution was refined into the dedicated task [`../agent-tasks/2026-08-21-city-noir-m4-wet-street-reflections.md`](../agent-tasks/2026-08-21-city-noir-m4-wet-street-reflections.md). That task is authoritative for the delivered M4 substep numbering and validation evidence.

### M4.1 — Reflection geometry primitive

Implement a deterministic cheap primitive for light response on receiving surfaces.

Preferred character:

- elongated/offset smear;
- irregular segmented mask;
- low alpha;
- stronger on asphalt;
- reduced/broken on concrete/sidewalk;
- clipped to receiving surface bounds when practical.

Unit-test geometry determinism independently of Phaser drawing where possible.

### M4.2 — Warm-light asphalt response

Tie reflection primitive to M3 warm practical lights.

Acceptance:

- reflections reinforce the brightest local lights;
- no mirrored lamp image;
- no uniform wet coating;
- road remains dark between reflections.

### M4.3 — Vehicle/emergency response

Add small moving/local reflection contribution for tail/head/police lights only if performance/culling remains bounded.

Police red/blue should read strongly on nearby wet road but should not tint half the district.

### M4.4 — Puddle/specular accents

The delivered broken reflection fragments provide the sparse specular/puddle-like breakup required by the visual target. A second generic puddle field was intentionally **not** added because it would create repeated texture and overlap the accepted M4 receiver language.

### M4 exit

- [x] wetness is visible in lit areas and subdued in dark areas;
- [x] reflections are irregular and material-aware;
- [x] no mirror/shader overengineering was introduced;
- [x] deterministic geometry tests exist;
- [x] performance remains inside budget.

Validated implementation head: `62e2eb4fd4aade64e1f4e6393996e09d4e7db4f9`; Tests `32475694164` success; atmosphere review `32475694166` success; artifact `9444326985`.

---

## M5 — Low-frequency grime and urban surface dressing

**Status: autonomous-in-progress — checkpoint after M5.2**

Purpose: remove sterile large surfaces without undoing #69.

Dedicated task contract: [`../agent-tasks/2026-08-21-city-noir-m5-grime-dressing.md`](../agent-tasks/2026-08-21-city-noir-m5-grime-dressing.md).

### M5.1 — Responsibility audit

- [x] audit the merged #69 street-surface implementation before adding any M5 runtime geometry;
- [x] explicitly exclude #69-owned open-ground scuffs/panels, repairs, cracks, gutters/stains, drains/manholes, worn paint, sidewalks/curbs/junction pavement and crosswalk/tactile geometry;
- [x] exclude M4 light-coupled wet response from generic grime;
- [x] confirm gameplay dumpsters remain owned by `StreetFurnitureSystem` and may only be read later as contextual presentation input;
- [x] defer readable posters/graffiti/signage to M7 environmental storytelling.

Audit result: generic world/road grime fields would overlap existing authorities. M5 is therefore constrained to **contextual service/frontage dressing**.

### M5.2 — `service-frontage-grime`

- [x] derive from existing building/frontage semantics rather than a world grid;
- [x] prefer service/industrial/warehouse/commercial contexts;
- [x] deterministic stable placement;
- [x] hard descriptor/fragment caps and compact geometry;
- [x] low-contrast neutral dirt language;
- [x] reject road and crosswalk receiving points;
- [x] visible-window culling;
- [x] remain non-interactive and non-collidable;
- [x] focused deterministic/no-mutation/culling/receiver tests;
- [x] gameplay-scale service/mixed/dark evidence.

Validated implementation head: `485ad7074f1ddfcbb1ab8e8f70d33125cd4a0aa4`; Tests `32488128735` success; atmosphere review `32488128814` success; artifact `9448812773`.

The first visual version was too subtle and was corrected inside the same bounded family. The accepted version is visible at gameplay scale while remaining contextual and subordinate.

### M5.3 — Service-corner composition

**Status: planned / awaiting user direction.**

Under the default checkpoint cadence, do not start M5.3 until the user indicates to continue.

When authorized, use exactly one bounded read-only contextual family first, based on existing service semantics and/or existing gameplay dumpster positions:

- tiny litter group; or
- compact service-corner grime accumulation; or
- small mechanical residue.

Do not add readable posters/graffiti/signage here; that belongs to M7.

### M5 exit

- [ ] large surfaces no longer feel sterile;
- [x] no delivered detail family duplicates #69 or M4;
- [x] delivered clutter remains low-frequency;
- [x] delivered decorative items remain non-interactive/non-collidable;
- [x] M5.2 affected checks green;
- [ ] M5.3 decision/implementation completed or explicitly skipped before milestone closure.

---

## M6 — Grounding and shadow consistency

**Status: planned**

Purpose: stop mobile/placed objects reading as flat symbols floating above the map.

### M6.1 — Shadow language audit

Audit building, vehicle, character and street-prop grounding at gameplay scale.

Do not rewrite building shadows already established by PR #63. Identify only missing/inconsistent layers.

### M6.2 — Contact shadows for moving entities

Where needed, add cheap presentation-only contact shadows beneath:

- vehicles;
- player/NPC character cores;
- selected street props.

Rules:

- small and soft/low-contrast;
- consistent source/directional bias;
- no gameplay collision dependence;
- must not make characters unreadable in dark zones.

### M6.3 — Local occlusion refinement

Only if visually necessary, refine contact/occlusion at curb or prop-ground junctions without changing geometry authority.

### M6 exit

- [ ] major mobile entities feel grounded;
- [ ] building shadow grammar remains intact;
- [ ] pure top-down language is preserved;
- [ ] no fake isometric façades introduced;
- [ ] affected checks green.

---

## M7 — Environmental storytelling and atmospheric set dressing

**Status: planned**

Purpose: create small specific stories instead of generic density.

### M7.1 — Decorative sign/neon grammar

Add/reuse sparse signage presentation appropriate to existing building/district semantics.

Possible motifs:

- HOTEL;
- BAR;
- LIQUOR;
- DINER;
- CLUB;
- civic/medical service markers;
- worldbuilding posters/graffiti.

Rules:

- not every building has a sign;
- signage must not become a gameplay interaction unless separately authored;
- saturated signs are local accents, not perimeter outlines.

### M7.2 — Steam/smoke service effects

Add a very small capped presentation family at plausible industrial/service anchors.

Requirements:

- hard active-particle/source cap;
- local culling;
- no opaque clouds over gameplay;
- deterministic anchor selection.

### M7.3 — Contextual micro-scenes

Use existing simulation state where practical to enhance scenes visually, not to create parallel NPC logic.

Examples:

- club queue already provided by pedestrian systems under a local sign/light;
- existing police vehicle under emergency reflections;
- existing parked/ambient vehicle under a practical light;
- service dumpster corner with grime/steam.

Do not spawn new gameplay actors solely for decoration in this milestone.

### M7 exit

- [ ] at least three representative micro-scenes read as specific urban stories;
- [ ] no density spam;
- [ ] no new gameplay actor authority;
- [ ] decorative effects are bounded/capped;
- [ ] affected checks green.

---

## M8 — District colour/material identity

**Status: planned**

Purpose: make different parts of the same city feel distinct while preserving one ViceBlood visual language.

Use existing district/building semantics only as presentation inputs.

Candidate restrained biases:

- ordinary residential/commercial: warm amber practical lights + neutral asphalt;
- nightlife: darker base + rare red/magenta accents;
- civic/medical: cooler clean practical accents;
- industrial/service: dirty amber/greenish service accents + more grime/steam;
- police presence: red/blue only when semantically active, not as permanent district decoration.

### M8.1 — District presentation profile

Implement a small read-only profile mapping controlling only presentation density/palette ranges.

### M8.2 — Mixed-city repetition audit

Verify adjacent districts differ at scene level without looking like separate games or colour filters.

### M8 exit

- [ ] at least three areas have distinguishable atmosphere;
- [ ] differences come from sparse accent/material rules, not fullscreen filters;
- [ ] district profiles remain presentation-only;
- [ ] unknown districts fall back to neutral-safe defaults;
- [ ] affected checks green.

---

## M9 — Final gameplay-scale review and bounded corrections

**Status: planned**

Purpose: evaluate the finished atmosphere against the committed north star and current-game constraints.

### M9.1 — Reproducible review package

Capture at least the seven representative situations listed in `CITY_NOIR_ATMOSPHERE.md`.

For each capture record where practical:

- location/district;
- nearby building/road IDs;
- gameplay zoom/resolution preset;
- relevant light/material context.

### M9.2 — Acceptance rubric

Score every representative capture from 0 to 2 on:

- value hierarchy;
- light islands;
- wet material response;
- surface breakup;
- depth/grounding;
- environmental storytelling;
- colour discipline;
- gameplay clarity;
- determinism/performance.

Threshold:

- representative mean >= `1.6`;
- no zero in value hierarchy;
- no zero in gameplay clarity;
- no zero in determinism/performance.

### M9.3 — Bounded correction loop

If the rubric exposes a deficit, create small named corrections against specific categories. Do not restart the art direction or add unrelated gameplay polish.

### M9.4 — Final automated validation

Run the affected checks and any justified final cross-cutting suite. Record exact workflow/head evidence.

### M9.5 — User gate

When automated and rubric criteria pass:

- [ ] set initiative state to `final-validation-pending`;
- [ ] stop autonomous visual changes;
- [ ] provide preview/review artifact to the user;
- [ ] wait for explicit visual approval;
- [ ] after approval, record closure evidence;
- [ ] merge only on explicit user instruction.

---

## Exact next action

Checkpoint after completed M5.2. Report the documented result and wait for user direction. If the user says to continue, execute **only M5.3 service-corner composition** as the next bounded task unless the user explicitly grants batch execution for a broader scope.
