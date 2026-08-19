# Building visual polish progress

This file is append-only. Newest entries go at the top. Do not rewrite historical entries; append a correction when necessary.

## 2026-08-19 — M0 canonical documentation complete; M1 opened

### Scope

- Active milestone: M0 → M1
- Task: commit the visual north star, baseline audit, agent contract, roadmap and machine-readable status
- Authoritative files: documentation and visual-reference assets
- Focused tests: documentation-only for M0
- Acceptance criteria: an agent can continue without chat history
- Explicit non-goals: no topology, collision, gameplay or profile-render changes in the M0 commit

### Completed

- committed the approved in-context overpaint as the primary north star;
- incorporated the supporting concept-board and modular-kit conclusions into the canonical text;
- documented the seven-profile runtime screenshot audit in durable written form;
- documented the consolidated cross-profile diagnosis;
- defined the visual acceptance rubric;
- defined mandatory read order, scope, validation, milestone and handoff protocols;
- created M0–M6 roadmap;
- created machine-readable milestone status;
- linked the initiative from agent-development and building-presentation documentation.

### Validation

- north-star reference asset verified locally;
- documentation paths and relative image link reviewed;
- PR remains draft.

### Risks

- the repository stores the approved north-star overpaint; the remaining runtime screenshot audit is preserved as detailed written findings rather than chat-dependent images;
- global CI already contains unrelated failures and must not be used to mask new building failures.

### Next

Start M1.1: shared layered world, roof and prop shadow primitives.

---

## 2026-08-19 — P3 multi-profile runtime audit

### Captures reviewed

- warehouse and industrial;
- hospital area;
- police station;
- untagged neutral building;
- church and chapel-like block;
- nightlife/club blocks;
- mixed street context.

### Consolidated findings

- the modular architecture and silhouettes are viable;
- parapets still resemble interface frames;
- shadows are too hard and rectangular;
- props remain icon-like;
- material surfaces are too flat;
- hospital has no dedicated profile;
- club identity relies too heavily on purple;
- church ridges read as diagram lines;
- police service rhythm is too repetitive;
- untagged neutral buildings lack intentional composition.

### Decision

Do not rewrite planner or topology. Continue with renderer-first polish, then prop, material and profile milestones.

---

## 2026-08-19 — P2 overpaint translation implemented

### Completed

- warehouse profile with cool corrugated surface, skylight and service strip;
- industrial profile with warm membrane surface, HVAC, service annex and light;
- opt-in world labels for buildings, vehicles and dumpsters;
- visual-profile layer separated from semantic archetypes;
- sparse standard detail policy.

### Validation

- focused building suite passed;
- Netlify preview deployed;
- runtime audit showed the direction is correct but not yet at approved overpaint finish.

---

## 2026-08-19 — P1 fused silhouette architecture implemented

### Completed

- logical roof cells fused into one orthogonal contour;
- visible internal grid and internal parapets removed;
- complete low service roof retained under irregular raised masses;
- modular layout recipes preserved;
- deterministic planner/renderer separation retained.

---

## 2026-08-19 — P0 modular building proof of concept

### Completed

- reusable layouts and module catalog;
- generic, police, club and church archetypes;
- deterministic rooftop prop composition;
- exact authored footprint preserved;
- focused containment and renderer tests.
