# Building visual polish roadmap

Status values:

- `complete`
- `implementation-complete / visual-validation-pending`
- `in-progress`
- `blocked`
- `planned`

The machine-readable mirror is [`../progress/building-visual-polish-status.json`](../progress/building-visual-polish-status.json).

## Historical foundation

| Stage | Status | Evidence |
|---|---|---|
| P0 — modular proof of concept | complete | reusable footprints, modules and archetypes exist |
| P1 — fused silhouette pass | complete | internal grid is hidden; one roof mass is rendered |
| P2 — approved overpaint translation | complete | warehouse and industrial profiles, sparse props and opt-in labels |
| P3 — multi-profile screenshot audit | complete | hospital, police, generic, church, nightlife and mixed-context captures reviewed |

These stages are prerequisites, not substitutes for final polish.

## M0 — Canonical direction and agent continuity

**Status: complete**

### Deliverables

- [x] canonical art-direction document;
- [x] approved overpaint committed to the repository;
- [x] concept and modular-kit conclusions canonized in text;
- [x] baseline screenshot audit canonized in text;
- [x] operational agent contract;
- [x] roadmap;
- [x] append-only progress log;
- [x] machine-readable status file;
- [x] agent-development index links to this initiative.

### Acceptance

A new agent can identify the target, active task, authoritative files, validation steps and stop conditions without reading chat history.

## M1 — Architectural parapets and layered shadow language

**Status: in-progress**

### Goal

Replace the current bright vector-frame treatment and hard rectangular shadows with one shared architectural depth language.

### M1.1 — Shared shadow primitives

**Status: in-progress**

- [ ] layered world cast shadow;
- [ ] layered roof-mass contact shadow;
- [ ] shared rectangular contact-shadow helper for annexes/frontages/props;
- [ ] shadows remain renderer-only and may extend outside the footprint;
- [ ] focused tests cover multiple shadow layers and external rendering.

### M1.2 — Architectural parapet primitive

**Status: planned**

- [ ] muted top cap;
- [ ] inner occlusion line;
- [ ] south/east wall face;
- [ ] restrained north/west highlight;
- [ ] consistent corner behaviour;
- [ ] no luminous double-outline on neutral profiles.

### M1.3 — M1 visual validation

**Status: planned**

- [ ] warehouse capture;
- [ ] industrial capture;
- [ ] police capture;
- [ ] church capture;
- [ ] mixed context capture;
- [ ] rubric average at least 1.4 for M1 categories;
- [ ] user approval before M2.

### Exit criteria

- no representative neutral building reads as a HUD frame;
- cast shadow, wall depth and contact shadow are distinguishable;
- no collision or planner geometry changes;
- focused tests pass;
- visual validation recorded.

## M2 — Physical rooftop props

**Status: planned**

### Goal

Make skylights, HVAC, hatches, vents, annexes and markers read as objects rather than icons.

### Tasks

- [ ] shared two-level prop contact shadow;
- [ ] skylight frame, glazing depth and directional highlight;
- [ ] HVAC casing, fan housing and side face;
- [ ] hatch frame and hinge/handle cue;
- [ ] antenna base and support geometry;
- [ ] annex top, walls and service detail;
- [ ] religious/medical markers integrated into architecture;
- [ ] prop scale validation at gameplay zoom.

### Exit criteria

Representative props score at least 1.6 for physical integration and gameplay clarity.

## M3 — Surface material language

**Status: planned**

### Goal

Add subtle material depth without procedural noise.

### Tasks

- [ ] corrugated warehouse ribs with lower contrast and grouped rhythm;
- [ ] membrane seams with broad spacing and tonal variation;
- [ ] civic surface order without decorative repetition;
- [ ] pitched-roof ridge shading;
- [ ] night-roof tonal modulation;
- [ ] deterministic low-frequency variation;
- [ ] no material pass obscures characters, aim or interaction cues.

## M4 — Family grammar expansion

**Status: planned**

### Goal

Make major building families readable without text labels.

### Tasks

- [ ] dedicated hospital/medical profile;
- [ ] police profile refinement;
- [ ] church monumental refinement;
- [ ] club/nightlife composition refinement;
- [ ] generic/residential/commercial differentiation;
- [ ] explicit policy for ambiguous untagged buildings;
- [ ] profile classification remains whole-word and conservative.

### Exit criteria

Representative family identity scores at least 1.6 without labels.

## M5 — Composition and controlled variation

**Status: planned**

### Goal

Eliminate blank roofs, token props and repetitive service patterns.

### Tasks

- [ ] composition grammar: main mass → secondary volume → hero prop → support;
- [ ] deterministic prop grouping;
- [ ] irregular but controlled service-slot rhythm;
- [ ] avoidance zones around entrances, annexes and identity elements;
- [ ] large-roof and small-roof composition rules;
- [ ] mixed-street review for repetition.

## M6 — Final polish and merge readiness

**Status: planned**

### Tasks

- [ ] final representative screenshot set;
- [ ] full acceptance-rubric scoring;
- [ ] focused and affected validation;
- [ ] document known unrelated test failures;
- [ ] clean PR description and final progress entry;
- [ ] mark PR ready for review;
- [ ] merge only after user approval.

## Current exact next action

Implement **M1.1 shared shadow primitives** in `BuildingPresentationRenderer.js`, add focused renderer assertions, update progress/status, deploy and request visual review.
