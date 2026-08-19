# Building visual polish progress

This file is append-only. Newest entries go at the top. Do not rewrite historical entries; append a correction when necessary.

## 2026-08-19 — Hourly autonomous scheduler installed on main

### Completed

- merged infrastructure PR #65 into `main` as commit `b0bca65a20e3aa177f6d05f8165a51b2a7315583`;
- installed `.github/workflows/building-visual-polish-hourly.yml` on the default branch, which is required for GitHub scheduled workflows;
- configured an hourly run at minute 17 with single-run concurrency protection;
- configured the workflow to check out and modify only `agent/building-visual-poc`;
- configured terminal states, strict allowed paths, focused building tests, branch-movement protection and issue #64 reporting;
- configured the workflow never to merge or mark PR #63 ready for review;
- updated machine state to show M2.1 as the active autonomous task.

### Activation dependency

The scheduler is installed. GitHub-hosted Codex execution requires repository Actions secret `OPENAI_API_KEY`. The workflow performs a safe no-op and comments issue #64 when that secret is unavailable, so missing credentials cannot produce uncontrolled changes.

### Next

At the next hourly minute-17 slot, preflight the machine state and credentials. When ready, advance exactly one bounded M2.1 task and push it only after focused building validation succeeds.

---

## 2026-08-19 — M1 complete; autonomous work advances to M2.1

### Completed

- confirmed all M1.4 building-focused contracts pass in the GitHub unit run;
- confirmed the new collider-only footprint regression passes;
- confirmed the old complete foundation frame is no longer emitted by the public renderer;
- confirmed Netlify deploy preview is green for the M1.4 head;
- closed M1 without changing planner, collision, topology, navigation or gameplay authority;
- opened M2.1 for shared physical rooftop-prop volume primitives.

### Validation

- global unit result: **404 passed / 411 total**;
- all building presentation and building shadow contracts pass, including:
  - exact collider/visual footprint preservation;
  - fused roof silhouettes;
  - layered world/contact shadows;
  - restrained parapets;
  - low foundation slab with no visible complete outline;
- seven failures remain exactly the known unrelated expectations:
  - two in `tests/urban-witness-network.test.js`;
  - five in `tests/vehicle-exit-and-impact-buffer.test.js`;
- Netlify preview: `https://deploy-preview-63--vampire-district.netlify.app`.

### M1 conclusion

The authored rectangle remains the gameplay authority but no longer needs to read as the visible building. The raised/fused roof mass, wall depth and shadows now own the architectural silhouette. Any remaining icon-like quality belongs to M2 props rather than the collider frame.

### Next

M2.1: add shared renderer-only raised-rect and cylindrical volume primitives, prove top/side/contact separation in focused tests, and migrate only a minimal fixture before applying the primitives to skylights, HVAC and other prop families.

---

## 2026-08-19 — M1.4 implemented; autonomous final-gate mode approved

### Scope

- Active milestone: M1
- Task: remove the remaining visible full-footprint legacy frame while retaining the exact authored rectangle as invisible collider/navigation authority
- Authoritative files: public polish compositor, focused shadow tests, roadmap, agent contract and machine status
- Focused tests: `tests/building-presentation.test.js` and `tests/building-visual-shadow.test.js`
- Acceptance criteria: low footprint slab remains; complete outer frame disappears; raised roof mass becomes the visible architectural silhouette; no geometry authority changes
- Explicit non-goals: physical prop redesign, material pass, hospital profile, composition grammar and unrelated global CI failures

### Runtime evidence reviewed

The user supplied a second normal-gameplay capture set covering:

- multiple nightlife/club blocks;
- hospital/medical-context blocks;
- church and chapel-like masses;
- generic and irregular buildings;
- mixed street context.

The first M1 pass was judged improved but incomplete. The persistent blocker was the old full rectangular footprint outline: it still exposed the logical collider as a bounding box around the newer raised roof language.

### Decision

- keep authored `x`, `y`, `w`, and `h` unchanged for collision and navigation;
- stop painting that rectangle as a complete perimeter;
- retain only a subdued low slab, renderer-only cast shadow and subtle south/east low-wall depth;
- make the inset/fused raised roof mass the visible building silhouette;
- keep police/club color identity local rather than applying it to a whole perimeter.

### Implemented

- suppressed the foundation full-perimeter `strokeRect` in the public polish compositor;
- suppressed foundation top/left highlight rails and wall-highlight lines;
- reduced foundation fill and wall opacity so the low slab anchors irregular footprints without becoming a second building frame;
- reduced neutral parapet caps to a restrained material cue;
- removed the wide dark parapet pass from north/west sides;
- reduced south/east wall-face width and opacity while preserving directional depth;
- retained layered cast and contact shadows;
- added focused coverage proving the foundation still matches the collider footprint, remains filled and casts shadow, but emits no full-frame stroke or line rails.

### Autonomous execution mandate

The user approved independent progression through the remaining roadmap with one final validation at M6.

- intermediate subjective gates are removed;
- each hourly run advances one bounded task;
- focused validation, allowed-path enforcement and Netlify remain mandatory;
- PR #63 stays draft and cannot merge autonomously;
- GitHub issue #64 tracks hourly execution;
- scheduled workflow requires repository secret `OPENAI_API_KEY`.

### Validation

- implementation and focused tests are committed;
- GitHub focused CI and Netlify are pending for the M1.4 head;
- known unrelated global failures remain out of scope.

### Risks

- the low slab may still need further opacity tuning, but it no longer owns a complete visible outline;
- props remain symbolic until M2;
- GitHub-hosted hourly Codex execution cannot use the interactive ChatGPT subscription and therefore needs the repository Actions secret.

### Next

When focused CI and Netlify are green, close M1 and begin M2.1: shared physical prop-volume primitives. Do not request user review until M6.

---

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
