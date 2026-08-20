# Building visual polish roadmap

Status values:

- `complete`
- `implementation-complete / automated-validation-pending`
- `autonomous-in-progress`
- `final-validation-pending`
- `blocked`
- `planned`

The machine-readable mirror is [`../progress/building-visual-polish-status.json`](../progress/building-visual-polish-status.json).

## Autonomous execution policy

**Approved 2026-08-19.** The initiative runs in autonomous final-gate mode.

- Intermediate subjective approval is not required between M1 and M5.
- Each implementation session advances exactly one bounded unchecked task.
- Focused automated validation, repository safety checks and a green Netlify preview remain mandatory.
- The agent updates this roadmap, the append-only progress log and the status JSON after every meaningful advance.
- The agent may continue to the next milestone when the current milestone's objective, tests and safety criteria are satisfied.
- User validation happens once, after M6 assembles the final representative review package.
- PR #63 remains draft and must not merge before that final user approval.
- Autonomous runs stop on a new focused-test failure, collision/topology/gameplay impact, unresolved art-direction ambiguity, connector permission failure or final validation readiness.

Tracking issue: [#64 — Hourly autonomous agent: building visual polish roadmap](https://github.com/FranPerezSevilla/vampire-district/issues/64).

## Historical foundation

| Stage | Status | Evidence |
|---|---|---|
| P0 — modular proof of concept | complete | reusable footprints, modules and archetypes exist |
| P1 — fused silhouette pass | complete | internal grid is hidden; one roof mass is rendered |
| P2 — approved overpaint translation | complete | warehouse and industrial profiles, sparse props and opt-in labels |
| P3 — multi-profile screenshot audit | complete | hospital, police, generic, church, nightlife and mixed-context captures reviewed |

## M0 — Canonical direction and agent continuity

**Status: complete**

- [x] canonical art-direction document;
- [x] approved overpaint committed to the repository;
- [x] baseline screenshot audit canonized in text;
- [x] operational agent contract, roadmap, append-only progress log and machine state;
- [x] ChatGPT scheduled task configured to execute hourly through the GitHub connector;
- [x] obsolete GitHub-hosted scheduler removed from `main`.

## M1 — Architectural depth and removal of the legacy frame

**Status: complete**

### M1.1 — Shared shadow primitives

- [x] layered world cast shadow;
- [x] layered roof-mass contact shadow;
- [x] shared rectangular/circular contact-shadow treatment;
- [x] shadows remain renderer-only.

### M1.2 — Architectural parapet primitive

- [x] muted top cap;
- [x] inner occlusion;
- [x] south/east wall face;
- [x] restrained north/west highlight;
- [x] old luminous neutral frame recipe removed.

### M1.3 — Runtime audit

- [x] warehouse/industrial, police, medical-context, church, nightlife and mixed-context captures reviewed;
- [x] residual full-footprint border identified as the principal blocker.

### M1.4 — Kill the legacy footprint frame

- [x] authored `x`, `y`, `w`, `h` remain exact collision/navigation authority;
- [x] foundation full-perimeter stroke and highlight rails suppressed;
- [x] low subdued slab retained;
- [x] raised roof mass owns visible silhouette;
- [x] focused regression coverage and Netlify validation complete.

## M2 — Physical rooftop props

**Status: autonomous-in-progress**

### Goal

Make skylights, HVAC, hatches, vents, annexes and markers read as physical roof objects rather than icons, without changing their planned bounds.

### M2.1 — Shared physical volume primitives

**Status: complete**

- [x] shared raised-rectangle primitive with top, south/east side faces and renderer-only contact shadow;
- [x] shared cylindrical primitive;
- [x] planned bounds remain immutable;
- [x] hatch and vent proving fixtures;
- [x] focused building validation and Netlify green.

### M2.2 — Physical skylights

**Status: complete**

- [x] route skylights through the shared raised-rectangle primitive;
- [x] physical outer curb/frame with top and side separation;
- [x] inset glazing with directional highlight and restrained mullions;
- [x] warehouse and club use the same physical glazing grammar;
- [x] glass no longer relies on a flat colored rectangle;
- [x] authored skylight bounds and deterministic composition preserved;
- [x] focused physical-skylight contracts pass;
- [x] Netlify deploy preview green on the M2.2 implementation head.

### M2.2 evidence

- physical skylight bounds contract passes;
- warehouse/club shared-grammar contract passes;
- the M2.2 unit run reached **408/416**, with every building test green; its eighth failure was an obsolete scheduler-inventory expectation that disappeared when current `main` was synchronized into the feature branch;
- M2.2 Netlify preview is green.

### M2.3 — Mechanical equipment

**Status: complete**

#### M2.3a — HVAC casing and fan housings

**Status: complete**

- [x] route HVAC through the shared raised-rectangle volume primitive;
- [x] give the casing distinct top, south and east faces;
- [x] retain layered renderer-only contact shadow;
- [x] add raised fan housings, recessed fan wells, rims and restrained blade cues;
- [x] support one or two fan housings from equipment proportions without planner-specific geometry;
- [x] preserve authored HVAC bounds;
- [x] add focused mechanical-rendering contracts;
- [x] focused validation green on the main-synchronized implementation head;
- [x] Netlify deploy preview green on the main-synchronized implementation head.

### M2.3a evidence

- GitHub workflow run `32329806831` completed successfully on head `48cddadcb1b7a89d171d1577a28ffbf7798c6fd1`;
- unit tests, city analysis/Foundry steps, browser campaign, browser boot and all three browser-system shards were green;
- Netlify deploy preview is green;
- no gameplay, collision, topology, navigation, AI, mission or generated-city authority changed.

#### M2.3b — Hatch hardware

**Status: complete**

- [x] add paired hinge cue on top of the already physical hatch volume;
- [x] add a restrained raised U-handle;
- [x] keep hardware readable but subordinate at gameplay zoom;
- [x] preserve bounds and deterministic rendering;
- [x] add focused hatch-hardware contracts;
- [x] focused unit contracts pass on later consolidated runs;
- [x] Netlify green.

#### M2.3c — Vent refinement

**Status: complete**

- [x] retain cylindrical cap/body separation from the shared volume primitive;
- [x] add a recessed exhaust throat, restrained metal collar and internal occlusion;
- [x] add one directional rim highlight rather than concentric decorative noise;
- [x] preserve authored bounds and deterministic rendering;
- [x] add focused vent-refinement contracts;
- [x] focused vent contracts pass in consolidated unit run `32332620515`;
- [x] Netlify green.

#### M2.3d — Antenna base and support geometry

**Status: complete**

- [x] physical raised antenna pedestal inside the planned module bounds;
- [x] mast attached directly to the pedestal instead of floating;
- [x] restrained diagonal braces connect base and mast;
- [x] short crossarm and mast cap avoid radio-tower clutter;
- [x] preserve bounds and deterministic rendering;
- [x] add focused antenna-support contracts;
- [x] unit tests pass on workflow `32332620515`;
- [x] Netlify deploy preview green on head `1aca46a2b651ff38873d8215d2937b33a7491a1f`.

### M2.3 exit evidence

- hatch, vent and antenna detail live in `BuildingPresentationDetailRenderer.js`, separate from the stable physical-volume compositor;
- latest unit validation is green with all focused building contracts;
- Netlify remains green;
- broader browser jobs continue independently and are not required to prove renderer-only prop contracts;
- no planned prop bounds, collider, navigation or gameplay authority changed.

### M2.4 — Architectural annexes and markers

**Status: active**

- [x] route raised annex presentation through shared physical-volume language where appropriate;
- [x] give annexes explicit top, south/east wall depth and one restrained service detail;
- [ ] integrate religious marker into roof architecture instead of a stamped symbol;
- [ ] define reusable architectural marker treatment suitable for the later medical profile without prematurely classifying hospital buildings;
- [ ] prop/marker scale validation at gameplay zoom remains deferred to M6;
- [ ] add focused renderer contracts for physical integration and unchanged authored bounds.

### M2.4 interim evidence

- raised `ROOF_ANNEX` modules bypass the legacy stamped annex painter and use the shared raised-rectangle physical-volume primitive;
- planned annex bounds and module ordering remain authoritative and unchanged;
- the physical annex now carries exactly one low-contrast recessed service grille with two restrained louvers on the top surface;
- the service grille is renderer-only, deterministic, proportionally limited and remains inside the authored annex bounds;
- focused annex contracts prove physical top/south/east faces, unchanged authored bounds, deterministic rendering, absence of the old icon-like circle/rectangle treatment and exactly one restrained service grille;
- GitHub unit job is green in workflow `32334149530` on implementation/test head `342e6a7b01793913eefcec426e8cb71c31f254df`;
- Netlify deploy preview is green on the same head;
- broader browser jobs continue independently at this bounded checkpoint.

### M2 exit criteria

Representative props have clear top, side/contact and shadow separation at normal gameplay scale, without changing planned bounds.

## M3 — Surface material language

**Status: planned**

- [ ] corrugated warehouse ribs with lower contrast and grouped rhythm;
- [ ] membrane seams with broad spacing and tonal variation;
- [ ] civic surface order without decorative repetition;
- [ ] pitched-roof ridge shading;
- [ ] night-roof tonal modulation;
- [ ] deterministic low-frequency variation;
- [ ] no material pass obscures characters, aim or interaction cues.

## M4 — Family grammar expansion

**Status: planned**

- [ ] dedicated hospital/medical profile;
- [ ] police profile refinement;
- [ ] church monumental refinement;
- [ ] club/nightlife composition refinement;
- [ ] generic/residential/commercial differentiation;
- [ ] explicit policy for ambiguous untagged buildings;
- [ ] profile classification remains whole-word and conservative.

### M4 exit criteria

Family identity comes from massing, materials and local architectural features rather than a full-perimeter color or world-space tag.

## M5 — Composition and controlled variation

**Status: planned**

- [ ] composition grammar: main mass → secondary volume → hero prop → support;
- [ ] deterministic prop grouping;
- [ ] irregular but controlled service-slot rhythm;
- [ ] avoidance zones around entrances, annexes and identity elements;
- [ ] large-roof and small-roof composition rules;
- [ ] mixed-street review for repetition;
- [ ] preserve sparse gameplay readability.

## M6 — Final polish and merge readiness

**Status: planned**

- [ ] final representative screenshot set: warehouse, industrial, police, medical, church, nightlife, generic and mixed street;
- [ ] side-by-side comparison with the approved north-star overpaint;
- [ ] full acceptance-rubric scoring;
- [ ] focused and affected validation;
- [ ] document known unrelated test failures if any remain;
- [ ] clean PR description and final progress entry;
- [ ] set status to `final-validation-pending`;
- [ ] stop autonomous visual changes;
- [ ] request the single final user validation;
- [ ] mark PR ready for review only after approval;
- [ ] merge only after explicit user approval.

## Branch synchronization checkpoint — 2026-08-20

`main` advanced substantially while the building branch was open. Before M2.3 work:

- `main` head `112bf924eac246ceb1adb95a06cd58bf36918356` was integrated into `agent/building-visual-poc`;
- the feature branch moved from 572 commits behind to 0 behind;
- current-main gameplay/runtime changes were preserved;
- building presentation was reattached only at the existing `GameScene.drawBuilding` presentation boundary;
- PR #63 returned to mergeable state;
- no generated city, collision, navigation, AI or gameplay authority was changed for the art initiative.

## Hourly ChatGPT automation contract

Each hourly execution must:

1. target `agent/building-visual-poc`, PR #63 and issue #64 only;
2. read status JSON and canonical agent/roadmap docs first;
3. advance exactly one bounded unchecked roadmap task;
4. use the GitHub connector directly to read, edit and commit;
5. run or inspect focused validation before declaring an increment complete;
6. restrict changes to building presentation, focused tests and canonical continuity documentation;
7. confirm Netlify after visual changes;
8. update roadmap, progress and status after meaningful work;
9. comment issue #64 with commit, evidence and exact next task;
10. never merge PR #63 or mark it ready for review autonomously;
11. stop visual work at `final-validation-pending`, `blocked`, `paused` or `complete`.

## Current exact next action

Continue **M2.4 — architectural annexes and markers** by replacing the stamped church cross marker with restrained architectural roof geometry integrated into the church massing, while preserving authored bounds and deterministic rendering. Then define reusable family-neutral marker geometry suitable for the later medical profile without introducing a hospital classifier/profile before M4. Do not request intermediate user review.
