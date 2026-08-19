# Building visual polish progress

This file is append-only. Newest entries go at the top. Do not rewrite historical entries; append a correction when necessary.

## 2026-08-19 — M1 automated validation complete; visual gate remains

### Completed

- fixed the final focused-test regression by muting the legacy parapet line state before the architectural parapet compositor draws it;
- confirmed the public renderer no longer exposes the old six-pixel bright neutral frame recipe;
- confirmed Netlify deploy preview is green for the implementation commit;
- kept PR #63 in draft because M1.3 still requires normal-gameplay visual approval.

### Validation

- all building-presentation and building-shadow tests pass;
- global unit result: **403 passed / 410 total**;
- the seven failures are the same known unrelated expectations:
  - two in `tests/urban-witness-network.test.js`;
  - five in `tests/vehicle-exit-and-impact-buffer.test.js`;
- no new building-focused failure remains;
- Netlify preview: `https://deploy-preview-63--vampire-district.netlify.app`.

### Risks

- automated tests prove layering and regression contracts, not final aesthetic quality;
- M1 must not be marked complete until representative gameplay captures are reviewed against the rubric.

### Next

Complete M1.3 with warehouse, industrial, police, church and mixed-context captures at normal gameplay zoom; approve M1 or perform one bounded correction pass.

---

## 2026-08-19 — M1.1 and M1.2 implementation complete; M1.3 opened

### Scope

- Active milestone: M1
- Task: replace hard one-pass shadows and luminous parapet frames with shared renderer-level polish
- Authoritative files: public building facade, base module painter, new polish compositor and focused shadow tests
- Acceptance criteria: multiple cast/contact shadow layers; directional parapet wall/cap/occlusion; no planner or collision changes
- Explicit non-goals: prop redesign, material pass, hospital profile and composition grammar remain M2–M5

### Completed

- introduced `BuildingPresentationPolishRenderer.js` as the public renderer compositor while retaining the existing renderer as the stable module painter;
- added soft multi-pass rectangular, polygon and circular shadow treatments;
- applied layered shadows to world casts, raised roof masses, annexes, frontages and rooftop props;
- replaced the legacy six-pixel bright parapet recipe with muted top caps, inner occlusion and darker south/east wall faces;
- reduced neutral highlight intensity without weakening explicit club/police identity accents;
- preserved deterministic planning, module geometry, collision footprint and public facade API;
- added focused tests for external shadow layering, polygon contact shadows, parapet regression and prop contact shadows.

### Validation

- new JavaScript modules pass `node --check`;
- focused test file passes syntax validation;
- GitHub/Netlify validation pending on the branch commit.

### Risks

- the polish compositor deliberately wraps the stable base module painter; future agents must keep the facade as the only public renderer authority;
- final alpha and wall-depth values require gameplay-zoom visual review;
- props remain partly symbolic until M2 even though their contact shadows are improved.

### Next

Run CI and Netlify, then complete M1.3 visual validation with warehouse, industrial, police, church and mixed-context captures.

---

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
