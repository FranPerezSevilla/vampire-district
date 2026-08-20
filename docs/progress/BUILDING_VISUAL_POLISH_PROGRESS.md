# Building visual polish progress

This file is append-only. Newest entries go at the top. Do not rewrite historical entries; append a correction when necessary.

## 2026-08-20 — M2 physical rooftop props complete; M3 opened

### Scope

- Active milestone: M2.4 → M3
- Task: validate and close the family-neutral architectural-marker increment on its exact implementation/test head, then advance the machine state to the first M3 material task without implementing M3 in this run
- Authoritative files: `BuildingPresentationMarkerGeometry.js`, `BuildingPresentationDetailRenderer.js`, `tests/building-marker-geometry.test.js`, roadmap, machine status and this append-only log
- Acceptance criteria: reusable geometry remains family-neutral, authored bounds remain immutable, deterministic contracts pass, full workflow green, Netlify green, M2 exit criteria satisfied and PR #63 remains draft/unmerged
- Explicit non-goals: no hospital classifier/profile, no warehouse material change yet, no membrane/civic/pitched/night material work, no gameplay/collision/topology/navigation/AI/mission/generated-city edits

### Completed

- confirmed `createOrthogonalMarkerGeometry(...)` provides deterministic joined orthogonal marker geometry with configurable proportions but no church/medical semantic classification;
- confirmed the church marker consumes that shared geometry rather than retaining a private cross-segment geometry implementation;
- confirmed `tests/building-marker-geometry.test.js` covers centered/default geometry, unchanged authored bounds, joined/contained segments, deterministic alternate proportions and safe omission for undersized regions;
- confirmed the existing physical church-marker contracts remain part of the green building suite;
- confirmed no hospital classifier or medical profile was introduced before M4;
- marked the reusable-marker and focused-contract M2.4 tasks complete;
- recorded gameplay-scale prop/marker judgement as intentionally deferred to the single M6 normal-gameplay review rather than an intermediate user gate;
- closed M2 and opened M3 with `M3.1-corrugated-warehouse-rhythm` as the exact next bounded task.

### Validation

- family-neutral geometry commit: `38eb9c2682edaab7926afd797b97b229cd36413e`;
- church renderer integration commit: `b0ad6403685789a2714c834d37d66caeb274ccea`;
- exact implementation/test head: `6dae004310fe18d02a627852337059106b26b8be`;
- GitHub workflow `32339748152`: **success**;
- unit tests: **success**;
- browser campaign: **success**;
- browser boot: **success**;
- browser systems shards 1/3, 2/3 and 3/3: **success**;
- Netlify deploy preview: **success** — `https://deploy-preview-63--vampire-district.netlify.app`;
- authored marker/building bounds, gameplay and collision authority: **unchanged**;
- PR #63 remained open, draft and mergeable at the M2 exit checkpoint.

### Visual risk

Automated geometry and renderer contracts prove physical integration, containment and deterministic reuse, not final apparent prop scale. That judgement remains intentionally deferred to M6. M3 should now improve material readability without increasing high-frequency roof noise or obscuring gameplay cues.

### Next

Begin M3.1 with one renderer-only warehouse corrugation increment: reduce rib contrast and group the rhythm so the roof reads as corrugated material rather than evenly repeated interface lines. Preserve authored geometry and deterministic output, add focused contracts and keep Netlify green before advancing to membrane seams.

---

## 2026-08-20 — M2.4 church marker automated validation closed

### Scope

- Active milestone: M2.4
- Task: close the already implemented church architectural marker after the exact implementation/test head finished automated validation
- Authoritative files: roadmap, machine status and this append-only progress log
- Focused evidence: workflow `32335254118` for head `366ac2f90da5483c844ce28822425429615de5d2` and the Netlify commit status for that same head
- Acceptance criteria: unit job green, Netlify green, no new building-focused failure, PR #63 remains open/draft/mergeable, and the next task advances without implementing it in this run
- Explicit non-goals: no renderer changes, no reusable family-neutral marker implementation, no hospital classifier/profile, no M3 material work, no gameplay/collision/topology/navigation/AI/mission/generated-city changes

### Completed

- confirmed the unit-test job in workflow `32335254118` completed successfully, including the focused church-marker contracts;
- confirmed Netlify deploy preview remains green on exact church-marker implementation/test head `366ac2f90da5483c844ce28822425429615de5d2`;
- classified the cancelled browser jobs in that workflow as superseded continuity noise after the branch head advanced, not a renderer regression; the bounded church-marker contract does not require those browser jobs;
- marked the religious architectural marker checkbox complete in the roadmap;
- advanced machine state from `M2.4c-church-marker-automated-validation-pending` to `M2.4d-family-neutral-marker-geometry`;
- preserved the one-task-per-run boundary by not beginning the reusable marker geometry in this validation-closure run;
- rechecked PR #63: open, draft and mergeable.

### Validation

- church-marker implementation commit: `5a89a4f3ef16c404209468ac1ba5e919338ff885`;
- church-marker implementation/test head: `366ac2f90da5483c844ce28822425429615de5d2`;
- GitHub workflow `32335254118` unit job: **success**;
- Netlify deploy preview on exact implementation/test head: **success** — `https://deploy-preview-63--vampire-district.netlify.app`;
- browser jobs on the old workflow: cancelled after later continuity/documentation heads superseded the run; no building-focused failure recorded;
- PR #63: **open, draft, mergeable**;
- authored bounds, gameplay and collision authority: **unchanged**.

### Visual risk

The church marker is now mechanically validated as physical roof architecture. Its apparent scale and warm-highlight readability remain intentionally deferred to M6 normal-gameplay review; no additional symbol emphasis is justified here.

### Next

Continue M2.4 with one bounded implementation of reusable, family-neutral architectural marker geometry suitable for the later medical profile. Reuse the physical-volume language, preserve authored bounds/determinism and add focused contracts. Do not introduce hospital classification or a medical profile before M4.

---

## 2026-08-20 — M2.4 church marker architectural integration implemented; validation pending

### Scope

- Active milestone: M2.4
- Task: replace the stamped church cross marker with restrained architectural roof geometry integrated into the existing church massing
- Authoritative files: `BuildingPresentationDetailRenderer.js`, `tests/building-church-marker-physical.test.js`, roadmap and machine status
- Focused tests: `tests/building-church-marker-physical.test.js` plus the repository unit job that includes the building suite
- Acceptance criteria: no legacy flat accent-stamp route for church markers, joined raised stem/arm with top/south/east separation, unchanged authored marker bounds, deterministic rendering, Netlify green and focused unit validation green before the task is closed
- Explicit non-goals: reusable medical/family-neutral marker geometry, hospital classification/profile work, church ridge/material redesign, M4 church monumentality, gameplay, collision, topology, navigation, AI, missions or generated-city edits

### Completed

- intercepted only `CROSS_MARKER` modules with `variant: "church"` in `BuildingPresentationDetailRenderer.js` so they no longer reach the legacy flat base-renderer cross painter;
- retained the planner-owned cross-marker module and its authored bounds rather than changing catalog, planner or semantic classification;
- converted the marker into two joined low raised roof fins: a nave-aligned vertical stem and a shorter transverse arm;
- reused the existing raised-volume language for contact shadow, top plane and south/east faces, while keeping the top material neutral and limiting religious warmth to restrained north/west highlights;
- omitted the architectural marker safely when a future/tiny marker is too small to support physical geometry instead of forcing malformed shapes outside its planned bounds;
- added `tests/building-church-marker-physical.test.js` proving the old flat accent rectangles are absent, the two raised top faces form one joined cross, every structural face stays within authored marker bounds and identical planned input renders deterministically;
- left the reusable family-neutral/medical marker treatment for the next bounded increment, as required by the one-task-per-run contract.

### Validation

- implementation commit: `5a89a4f3ef16c404209468ac1ba5e919338ff885`;
- focused-contract head: `366ac2f90da5483c844ce28822425429615de5d2`;
- Netlify deploy preview on that implementation/test head: **success** — `https://deploy-preview-63--vampire-district.netlify.app`;
- GitHub workflow: `32335254118`;
- unit job state at the repository-mandated bounded observation point: **in progress**; the religious-marker roadmap checkbox therefore remains open rather than claiming unverified completion;
- no planner, authored `x`/`y`/`w`/`h`, collider, navigation, topology, AI, mission or generated-city authority changed;
- PR #63 was open, draft and mergeable at the pre-implementation checkpoint and was not merged or marked ready for review.

### Visual risk

The marker now reads as roof construction rather than a bright decal, but its final apparent scale and whether the warm edge cue survives normal gameplay zoom remain subjective M6 review items. Do not enlarge it or add a stronger icon treatment before that evidence exists; M3/M4 will separately improve pitched-roof structure and church monumentality.

### Next

First validate workflow `32335254118` for exact implementation/test head `366ac2f90da5483c844ce28822425429615de5d2`. If the unit job is green, mark the religious architectural marker complete and advance to the separate reusable family-neutral marker-geometry treatment suitable for the later medical profile, without introducing hospital classification before M4. If a new building-focused failure appears, fix only that regression before advancing.

---

## 2026-08-20 — M2.4 annex service grille validated

### Scope

- Active milestone: M2.4
- Task: add exactly one restrained service cue to the newly physical raised annex
- Authoritative files: `BuildingPresentationDetailRenderer.js`, `tests/building-annex-physical.test.js`, roadmap and machine status
- Acceptance criteria: one low-contrast recessed detail, unchanged authored annex bounds, deterministic rendering, focused unit validation green and Netlify green
- Explicit non-goals: religious/medical marker redesign, hospital classification/profile work, gameplay, collision, topology, navigation, AI, missions or generated-city edits

### Completed

- added one recessed service grille to the top surface of physical `ROOF_ANNEX` modules with `variant: "raised"`;
- limited the grille proportionally so it remains subordinate to the annex mass at gameplay scale;
- used one dark recessed plate and two restrained louver lines rather than adding another raised prop or icon;
- omitted the detail automatically on undersized top surfaces instead of forcing geometry outside safe space;
- preserved the planner-owned annex bounds, module ordering and deterministic presentation;
- extended `tests/building-annex-physical.test.js` to require exactly one grille, prove its proportions/endpoints remain within authored bounds and retain deterministic rendering;
- kept the legacy stamped circle and outline absent from the physical route.

### Validation

- implementation commit: `83013eeee64726d51c08062102cd415c779a0220`;
- focused-contract head: `342e6a7b01793913eefcec426e8cb71c31f254df`;
- GitHub unit job: **success** in workflow `32334149530`;
- Netlify deploy preview: **success** — `https://deploy-preview-63--vampire-district.netlify.app`;
- broader browser jobs: queued/running independently at the bounded checkpoint and not required to prove this renderer-only annex contract;
- authored annex/building bounds and gameplay/collision authority: **unchanged**;
- PR #63 remains open, draft and mergeable.

### Visual risk

The annex now has enough local service character to avoid feeling empty without becoming a miniature equipment cluster. Do not add pipes, fans, warning stripes or extra grilles unless M6 gameplay-scale evidence proves this single cue unreadable.

### Next

Continue M2.4 by replacing the stamped church cross marker with restrained architectural roof geometry integrated into the church massing, preserving authored bounds and determinism. Do not introduce the reusable medical marker classifier/profile until its family-neutral geometry is addressed in the following bounded increment, and do not create a hospital classifier before M4.

---

## 2026-08-20 — M2.4 raised annex routed through physical grammar

### Scope

- Active milestone: M2.4
- Task: replace the legacy raised-annex painter with the shared renderer-only physical-volume grammar
- Authoritative files: `BuildingPresentationDetailRenderer.js`, `tests/building-annex-physical.test.js`, roadmap and machine status
- Acceptance criteria: physical top/south/east separation, deterministic rendering, unchanged authored bounds, no legacy icon-like annex circle/rectangle treatment, focused unit validation green and Netlify green
- Explicit non-goals: annex service-detail refinement, marker redesign, hospital classification/profile work, gameplay, collision, topology, navigation, AI, missions or generated-city edits

### Completed

- routed only `ROOF_ANNEX` modules with `variant: "raised"` through the shared `drawRaisedRectVolume` grammar;
- preserved planner-owned module ordering and authored annex bounds;
- replaced the old stamped annex path rather than layering a second treatment over it;
- removed the old icon-like circular annex detail from this physical route so the next bounded task can add one restrained architectural service cue deliberately;
- added `tests/building-annex-physical.test.js` covering top/south/east physical faces, bounds immutability, deterministic output and absence of the legacy circle/rectangle treatment;
- updated roadmap, machine state, PR #63 description and issue #64 continuity to point at the annex service-detail increment next.

### Validation

- implementation commit: `92ddeb1a5d72f967ce339e908c366f1ff0c88171`;
- focused-contract head: `4413d768616fc4a3f4f0c371797ad0e174a78271`;
- GitHub unit job: **success** in workflow `32333532286`;
- browser campaign on that workflow: **success**; remaining browser jobs were superseded/cancelled after continuity commits moved the branch head;
- current continuity head retained a green unit job while its broader browser jobs continued independently;
- Netlify deploy preview: **success** — `https://deploy-preview-63--vampire-district.netlify.app`;
- authored annex/building bounds and gameplay/collision authority: **unchanged**;
- PR #63 remains open, draft and mergeable.

### Visual risk

The annex now reads as a real raised roof volume instead of a stamped module, but it is intentionally sparse. Do not reintroduce the old circular symbol or dense rooftop decoration. The next increment should add exactly one restrained service cue that remains subordinate at gameplay zoom.

### Next

Continue M2.4 with one restrained service detail on the physical raised annex, preserving bounds and determinism. After that, integrate religious and reusable medical-style marker geometry architecturally without introducing a hospital classifier/profile before M4.

---

## 2026-08-20 — M2.3 mechanical equipment closed; M2.4 opened

### Scope

- Active milestone: M2
- Task: finish the mechanical-prop family by anchoring the police antenna physically, while reconciling the already implemented hatch and vent increments
- Authoritative files: `BuildingPresentationDetailRenderer.js`, focused hatch/vent/antenna tests, roadmap and machine status
- Acceptance criteria: physical base/mast/support relationship, deterministic rendering, unchanged authored bounds, focused unit validation green, Netlify green
- Explicit non-goals: no annex implementation in this increment, no hospital classifier/profile, no gameplay/collision/topology/navigation/AI/mission/generated-city changes

### Completed

- confirmed M2.3b hatch hardware remains covered by green unit tests on later consolidated heads and Netlify is green;
- confirmed M2.3c vent refinement passes inside workflow `32332620515` and Netlify remains green;
- added a physical raised pedestal for `ANTENNA` modules inside their existing planned bounds;
- attached the mast directly to that pedestal rather than leaving a floating symbol;
- added two restrained diagonal braces, a short crossarm and mast cap without introducing radio-tower clutter;
- added `tests/building-antenna-support.test.js` covering pedestal/mast/braces, authored-bound preservation and determinism;
- confirmed the latest unit-test job in workflow `32332620515` is green with the antenna contracts included;
- confirmed Netlify is green on antenna implementation head `1aca46a2b651ff38873d8215d2937b33a7491a1f`;
- closed M2.3 and opened M2.4 architectural annexes and markers.

### Validation

- M2.3b focused unit contracts: **pass on consolidated later run**;
- M2.3c focused unit contracts: **pass**;
- M2.3d antenna-support contracts: **pass**;
- GitHub unit job: **success** in workflow `32332620515`;
- broader browser jobs: still running independently at the bounded check and not required to prove renderer-only detail contracts;
- Netlify: **success** — `https://deploy-preview-63--vampire-district.netlify.app`;
- authored prop bounds and gameplay/collision authority: **unchanged**.

### Visual risk

The antenna is intentionally modest: pedestal, mast, braces and one crossarm. Do not add cables, arrays or extra bars unless final M6 gameplay-scale evidence shows the structure is unreadable. The next quality bottleneck is now architectural annex/marker integration rather than mechanical props.

### Next

M2.4: route raised annexes through the shared physical-volume grammar, preserve planned bounds, add one restrained service detail and focused contracts. Then integrate church/medical-style markers into architecture rather than stamping symbols. Do not introduce a hospital classifier/profile before M4.

---

## 2026-08-20 — M2.3b unit validation green; M2.3c vent refinement implemented

### Scope

- Active milestone: M2
- Task: continue from M2.3b hatch hardware into the next bounded mechanical increment while CI finishes independently
- Authoritative files: `BuildingPresentationDetailRenderer.js`, hatch/vent focused tests, roadmap and machine status
- Acceptance criteria: hatch contracts stay green; vent reads as a physical exhaust opening rather than a solid circle; authored bounds remain immutable; Netlify remains green
- Explicit non-goals: antenna work, annexes/markers, material pass, family-profile changes, gameplay, collision, topology, navigation, AI, missions or generated-city edits

### Completed

- confirmed the M2.3b unit-test job is green on workflow `32332122399`;
- confirmed M2.3b Netlify is green on head `acf55a5d927333ca1ca4312a389e5642d8dd2cca`;
- kept M2.3b formally validation-pending because its browser jobs were still running at the bounded check;
- advanced independent work into M2.3c instead of waiting passively;
- extended `BuildingPresentationDetailRenderer.js` with deterministic vent-top detail built from the same cylindrical geometry as the physical vent body;
- added a restrained metal collar, recessed exhaust throat, internal occlusion and one directional rim highlight;
- avoided concentric decorative noise and preserved the existing cylindrical body/contact-shadow language;
- preserved authored vent bounds and deterministic rendering;
- added `tests/building-vent-refinement.test.js` covering bounds immutability, collar/throat/occlusion separation, rim treatment and determinism;
- confirmed Netlify is green on M2.3c implementation head `693e4b3bd9e494560d797306fa400a347f2763ee`.

### Validation

- M2.3b unit contracts: **pass**;
- M2.3b browser workflow: **in progress at bounded check**;
- M2.3b Netlify: **success**;
- M2.3c focused unit contracts: **pending on new implementation head**;
- M2.3c Netlify: **success**;
- PR #63 remains open, draft and mergeable;
- no gameplay/collision authority changed.

### Visual risk

The vent now has a readable duct body plus a recessed opening, but final apparent scale at normal gameplay zoom remains part of the M6 review. Do not add extra rings, blades or decorative slits unless later evidence shows the current collar is unreadable.

### Next

The next autonomous execution must first close the pending browser validation for M2.3b and the new unit validation for M2.3c. If both remain green, mark M2.3b and M2.3c complete and begin M2.3d: physical antenna base and attached mast/support geometry.

---

## 2026-08-20 — M2.3a physical HVAC validated; M2.3b hatch hardware opened

### Scope

- Active milestone: M2
- Task: validate the already implemented M2.3a physical HVAC increment on the branch synchronized with current `main`
- Authoritative files: `phaser/src/rendering/buildings/BuildingPresentationPolishRenderer.js`, `tests/building-mechanical-polish.test.js`, roadmap and machine status
- Focused evidence: physical HVAC bounds/casing/fan-housing contracts inside GitHub workflow run `32329806831`
- Acceptance criteria: no new building-focused failure, synchronized branch remains compatible, Netlify green, PR #63 remains draft/mergeable
- Explicit non-goals: no M2.3b hatch code in this run; no vent/antenna work; no gameplay, collision, topology, navigation, AI, mission or generated-city changes

### Completed

- confirmed workflow run `32329806831` completed successfully on `48cddadcb1b7a89d171d1577a28ffbf7798c6fd1`;
- confirmed the unit-test job is green, which includes the dedicated HVAC contracts in `tests/building-mechanical-polish.test.js`;
- confirmed city analysis/Foundry steps, browser campaign, browser boot and all three browser-system shards are green on the synchronized branch;
- confirmed the Netlify deploy preview is green;
- confirmed PR #63 remains open, draft and mergeable;
- marked M2.3a complete and opened M2.3b hatch hardware as the next bounded task.

### Validation

- GitHub workflow: **success** (`32329806831`);
- unit tests: **success**;
- browser campaign: **success**;
- browser boot: **success**;
- browser systems: **3/3 shards success**;
- Netlify: **success** — `https://deploy-preview-63--vampire-district.netlify.app`;
- main-synchronization compatibility: **pass**;
- no unrelated failure baseline remains on this validated head.

### Visual risk

The HVAC contracts prove physical top/side/contact separation, unchanged authored bounds and fan-housing integration. Final aesthetic judgement at normal gameplay zoom remains intentionally deferred until M6; no family-specific tuning is justified during this validation-only increment.

### Next

M2.3b: add restrained hinge and handle hardware on top of the existing physical hatch volume, keep the cues subordinate at gameplay zoom, preserve authored bounds/determinism, add focused contracts, then validate CI and Netlify before advancing to vent refinement.

---

## 2026-08-20 — M2.2 physical skylights implemented; validation pending

### Scope

- Active milestone: M2
- Task: replace the legacy flat skylight treatment with the shared physical-volume language
- Authoritative files: public polish compositor and focused building-shadow tests
- Focused tests: `tests/building-presentation.test.js` and `tests/building-visual-shadow.test.js`
- Acceptance criteria: raised curb, inset glazing, directional highlight/shade, restrained mullions, layered contact shadow, unchanged planned bounds and shared warehouse/club treatment
- Explicit non-goals: HVAC/mechanical redesign, hatch hardware, antenna supports, annex/marker redesign, material-surface pass, family-profile changes and unrelated gameplay/test failures

### Implemented

- routed `SKYLIGHT` modules through the shared `drawRaisedRectVolume` path in the public polish compositor;
- gave skylights a renderer-only raised curb with distinct top, south and east faces;
- added a recessed shadow well before glazing so the glass no longer sits as a flat colored rectangle;
- inset the glass inside the physical curb while keeping the authored skylight bounds untouched;
- added restrained south/east glass shade, north/west directional highlight and a small glint rather than uniform brightness;
- added deterministic mullions only when the glass is large enough to support them at gameplay scale;
- kept warehouse and club skylights on one shared renderer path rather than adding family-specific geometry;
- added focused contracts proving authored-bound immutability, curb/glass/side separation, layered contact shadow, directional glass highlights and warehouse/club reuse.

### Validation

- implementation head: `1c25100fda1f6d80b4483ec739c6220eb5ff0b43`;
- GitHub unit validation was still running at the bounded handoff check;
- Netlify deploy preview was still pending at the bounded handoff check;
- status is intentionally `M2.2-automated-validation-pending` so the hourly ChatGPT task validates this exact increment before beginning M2.3;
- no planner, collider, topology, navigation, AI, mission or gameplay geometry changed.

### Visual risk

Automated contracts can prove physical layering and shared geometry but not final aesthetic quality at gameplay zoom. Intermediate subjective review remains intentionally deferred until M6. The main M2.2 risk is whether curb/glint intensity needs later global tuning once M3 materials are present; it must not be patched per family now.

### Next

The next hourly ChatGPT execution must inspect M2.2 CI and Netlify. If both are green and there is no new building-focused failure, mark M2.2 complete and begin M2.3 with HVAC casing/fan housing as the first bounded mechanical-equipment increment. If M2.2 introduced a focused failure, fix only that regression first.

---

## 2026-08-19 — M2.1 validated; M2.2 physical skylights opened

### Completed

- verified the shared raised-rectangle and cylindrical geometry/painter contracts in GitHub CI;
- verified the hatch proving fixture keeps its authored bounds while gaining separate top, side and layered contact-shadow treatment;
- verified the vent proving fixture uses the cylindrical volume path without planner changes;
- updated the branding-cleanup workflow inventory so the canonical hourly scheduler is treated as active infrastructure rather than retired one-off patching;
- confirmed Netlify is green on the validated implementation head;
- marked M2.1 complete and opened M2.2 physical skylights.

### Validation

- global unit result: **407 passed / 414 total**;
- all new and existing building-focused contracts pass;
- the seven failures are exactly the documented unrelated expectations:
  - two in `tests/urban-witness-network.test.js`;
  - five in `tests/vehicle-exit-and-impact-buffer.test.js`;
- no collision, topology, navigation, AI, mission or gameplay authority changed;
- Netlify preview: `https://deploy-preview-63--vampire-district.netlify.app`.

### Residual risk

The shared primitives prove the physical language, but current skylights still use the older flat-glass renderer. M2.2 must add a curb/frame, inset glazing and directional highlight while preserving the same planned bounds and gameplay-scale readability.

### Next

At the next hourly autonomous run, route skylights through the shared raised-rectangle primitive and add focused physical-skylight contracts. Intermediate user review remains deferred until M6.

---

## 2026-08-19 — M2.1 shared physical volume primitives implemented

### Scope

- Active milestone: M2
- Task: establish family-neutral renderer-only physical volume primitives before redesigning individual rooftop prop families
- Authoritative files: shared volume primitive module, public polish compositor and focused building-shadow tests
- Focused tests: `tests/building-presentation.test.js` and `tests/building-visual-shadow.test.js`
- Acceptance criteria: distinct top, south/east or lower-body face, and contact shadow; planned module bounds remain unchanged
- Explicit non-goals: skylight glazing, HVAC fans, hatch hardware, antenna supports, annex detail, medical/religious marker redesign and surface materials

### Implemented

- added `BuildingPresentationVolumePrimitives.js` with no Phaser globals;
- added a shared raised-rectangle geometry and painter:
  - unchanged planned bounds;
  - renderer-only offset contact shadow;
  - top plane;
  - south face;
  - east face;
  - restrained north/west highlight and top/side seam;
- added a shared cylindrical geometry and painter:
  - unchanged planned bounds;
  - lower-body offset that creates a readable south-facing crescent;
  - top circle;
  - contact shadow;
  - restrained highlight and rim;
- kept material colors supplied by the caller so profiles remain data-driven;
- routed the hatch and vent through the shared primitives as minimal proving fixtures;
- retained the public polish proxy so their contact shadows still receive the existing layered M1 treatment;
- added direct geometry/painter contracts for immutability and top/side/contact separation;
- added an integration contract proving the hatch keeps its authored bounds while gaining layered shadow and distinct physical faces.

### Validation

- implementation and focused contracts are committed;
- GitHub focused/global unit validation is pending on the consolidated documentation head;
- Netlify deploy preview is pending on the consolidated documentation head;
- status remains `M2.1-automated-validation-pending`, preventing the hourly agent from reimplementing the same task.

### Risks

- hatch and vent are only proving fixtures; their family-specific hardware/detail remains intentionally deferred to M2.3;
- the shared primitive depth may need later profile-scale tuning, but geometry remains renderer-only and cannot affect collision;
- skylights remain visually flat until M2.2.

### Next

If focused validation and Netlify are green, close M2.1 and begin M2.2: physical skylight frame, glazing depth and directional highlight. Do not request intermediate user review.

---

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

- committed the approved north-star overpaint as the primary north star;
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
