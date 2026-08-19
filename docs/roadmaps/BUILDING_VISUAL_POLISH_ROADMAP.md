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
- Autonomous runs stop on a new focused-test failure, collision/topology/gameplay impact, unresolved art-direction ambiguity, missing execution credentials, or final validation readiness.

Tracking issue: [#64 — Hourly autonomous agent: building visual polish roadmap](https://github.com/FranPerezSevilla/vampire-district/issues/64).

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
- [x] agent-development index links to this initiative;
- [x] autonomous final-gate execution policy;
- [x] tracking issue for hourly execution.

### Acceptance

A new agent can identify the target, active task, authoritative files, validation steps, autonomous continuation rules and stop conditions without reading chat history.

## M1 — Architectural depth and removal of the legacy frame

**Status: complete**

### Goal

Replace bright vector frames and hard rectangular shadows with one shared architectural depth language while keeping the exact authored collider rectangle invisible as gameplay authority.

### M1.1 — Shared shadow primitives

**Status: complete**

- [x] layered world cast shadow;
- [x] layered roof-mass contact shadow;
- [x] shared rectangular/circular contact-shadow treatment for annexes, frontages and props;
- [x] shadows remain renderer-only and may extend outside the footprint;
- [x] focused tests cover multiple shadow layers and external rendering.

### M1.2 — Architectural parapet primitive

**Status: complete**

- [x] muted top cap;
- [x] inner occlusion line;
- [x] south/east wall face;
- [x] restrained north/west highlight;
- [x] consistent directional treatment;
- [x] old six-pixel luminous neutral recipe removed from the public renderer.

### M1.3 — Runtime audit of the first parapet pass

**Status: complete**

- [x] club/nightlife captures reviewed;
- [x] church capture reviewed;
- [x] hospital/medical-context capture reviewed;
- [x] generic and mixed-context captures reviewed;
- [x] user confirmed modest improvement;
- [x] audit identified the remaining full-footprint rectangular border as the principal blocker.

### M1.4 — Kill the legacy footprint frame

**Status: complete**

The authored `x`, `y`, `w`, and `h` rectangle remains the exact collider and navigation authority, but is no longer painted as a complete visible frame.

- [x] suppress the foundation's full-perimeter stroke;
- [x] suppress foundation top/left highlight rails;
- [x] retain a low, subdued footprint slab beneath irregular raised masses;
- [x] retain renderer-only cast shadow and subtle south/east low-wall depth;
- [x] reduce neutral raised-roof parapet caps to architectural material cues;
- [x] omit the wide dark parapet pass from north/west sides;
- [x] preserve local police/club identity accents instead of coloring whole perimeters;
- [x] add focused regression coverage proving collider geometry remains while the visible full frame is gone;
- [x] focused building contracts pass in CI;
- [x] Netlify deploy preview is green.

### M1 exit evidence

- the complete authored rectangle remains present in the planner and tests as collision authority;
- the foundation still renders as a subdued low slab and casts a world shadow;
- the foundation emits no full-perimeter stroke or top/left rails;
- all 25 building-focused contracts pass inside the global run;
- global result is 404/411, with only the same seven unrelated witness/vehicle expectations failing;
- Netlify preview is green;
- no collision, planner, topology, navigation or gameplay geometry changed.

## M2 — Physical rooftop props

**Status: autonomous-in-progress**

### Goal

Make skylights, HVAC, hatches, vents, annexes and markers read as objects rather than icons.

### M2.1 — Shared physical volume primitives

**Status: complete**

- [x] define a shared raised-rect volume primitive with top, south/east side faces and contact shadow;
- [x] define a shared circular/cylindrical volume primitive;
- [x] keep every planned bound unchanged and apply depth only in the renderer;
- [x] add focused tests for top/side/contact separation and input immutability;
- [x] migrate only minimal proving fixtures: hatch for raised rectangles and vent for cylinders;
- [x] focused building validation green on the implementation head;
- [x] Netlify deploy preview green on the implementation head.

### M2.1 evidence

- all new raised-rectangle, cylindrical and hatch-integration contracts pass;
- the complete global run reports **407 passed / 414 total**;
- the seven failures are exactly the previously documented witness/vehicle expectations;
- the scheduler integration assertion was updated to recognize the canonical hourly workflow;
- no planned module bounds, collider geometry or gameplay authority changed.

The shared primitives are family-neutral. Skylight glass, HVAC fans, hatch hardware, antenna supports and family-specific finishes remain in M2.2–M2.4.

### M2.2 — Skylights

**Status: active**

- [ ] route skylights through the shared raised-rectangle primitive;
- [ ] add a physical outer curb/frame with top and side separation;
- [ ] add inset glazing with directional highlight and restrained internal mullions;
- [ ] keep dominant warehouse/club skylights readable at gameplay zoom;
- [ ] ensure glass no longer reads as a flat colored rectangle;
- [ ] preserve authored skylight bounds and deterministic composition;
- [ ] add focused physical-skylight contracts.

### M2.3 — Mechanical equipment

- [ ] HVAC casing, fan housing and visible side face;
- [ ] hatch frame and hinge/handle cue;
- [ ] vent/cylinder treatment;
- [ ] antenna base and support geometry.

### M2.4 — Architectural annexes and markers

- [ ] annex top, walls and service detail;
- [ ] religious/medical markers integrated into architecture instead of stamped symbols;
- [ ] prop scale validation at gameplay zoom;
- [ ] focused renderer contracts for physical integration.

### Exit criteria

Representative props have clear top, side/contact and shadow separation at normal gameplay scale, without changing planned bounds.

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

Family identity comes from massing, materials and local architectural features rather than a full-perimeter color or world-space tag.

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
- [ ] mixed-street review for repetition;
- [ ] preserve sparse gameplay readability.

## M6 — Final polish and merge readiness

**Status: planned**

### Tasks

- [ ] final representative screenshot set: warehouse, industrial, police, medical, church, nightlife, generic and mixed street;
- [ ] side-by-side comparison with the approved north-star overpaint;
- [ ] full acceptance-rubric scoring;
- [ ] focused and affected validation;
- [ ] document known unrelated test failures;
- [ ] clean PR description and final progress entry;
- [ ] set status to `final-validation-pending`;
- [ ] pause hourly automation automatically;
- [ ] request the single final user validation;
- [ ] mark PR ready for review only after approval;
- [ ] merge only after explicit user approval.

## Hourly automation contract

The scheduled workflow must:

1. run once per hour with concurrency protection;
2. target `agent/building-visual-poc` only;
3. read the status JSON before doing any work;
4. stop when state is `blocked`, `paused`, `final-validation-pending` or `complete`;
5. use the canonical agent contract and advance exactly one bounded task;
6. run focused building tests before committing;
7. restrict changes to building rendering, focused tests and canonical documentation;
8. push a validated commit to the feature branch;
9. comment issue #64 with the result, commit and next action;
10. never merge PR #63.

The workflow requires the repository Actions secret `OPENAI_API_KEY` because GitHub-hosted autonomous Codex execution cannot use the interactive ChatGPT subscription.

## Current exact next action

At the next hourly run, begin M2.2 by routing skylights through the shared raised-rectangle volume primitive, adding a physical curb and inset glazing, preserving authored bounds, and adding focused contracts. Do not request intermediate user review.
