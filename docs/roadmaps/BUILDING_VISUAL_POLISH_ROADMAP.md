# Building visual polish roadmap

Status values:

- `complete`
- `implementation-complete / automated-validation-pending`
- `autonomous-in-progress`
- `final-validation-pending`
- `blocked`
- `planned`

The machine-readable mirror is [`../progress/building-visual-polish-status.json`](../progress/building-visual-polish-status.json).

## Final-gate policy

**Approved 2026-08-19; reconciled 2026-08-20.**

- Intermediate subjective approval was not required between M1 and M5.
- Authored `x`, `y`, `w`, `h` remain the sole collision/navigation authority.
- Building-polish work never owns gameplay, AI, missions, roads, sidewalks, topology or generated-city geometry.
- Focused tests and a green Netlify preview are required for visual changes.
- The single user visual validation occurs after M6 assembles the final gameplay-scale review package.
- PR #63 remains draft and unmerged until that approval.
- No further visual changes are allowed while state is `final-validation-pending` unless the user rejects the final package and explicitly requests another pass.

Tracking issue: #64.  
Final M6 evidence: [`../progress/BUILDING_VISUAL_POLISH_FINAL_REVIEW.md`](../progress/BUILDING_VISUAL_POLISH_FINAL_REVIEW.md).

## Historical foundation

| Stage | Status | Result |
|---|---|---|
| P0 — modular proof of concept | complete | reusable footprints, modules and archetypes |
| P1 — fused silhouette pass | complete | internal grid hidden behind one architectural mass |
| P2 — approved overpaint translation | complete | approved dark pure-overhead direction translated into runtime grammar |
| P3 — multi-profile screenshot audit | complete | representative profile weaknesses documented |
| M0 — canonical direction and continuity | complete | north star, agent contract, roadmap, progress and machine state established |

## M1 — Architectural depth and legacy-frame removal

**Status: complete**

- [x] shared layered cast/contact shadows;
- [x] architectural parapet cap, wall face, occlusion and restrained highlight;
- [x] runtime audit of the first parapet pass;
- [x] legacy full-footprint UI-like frame removed;
- [x] authored collision/navigation footprint preserved exactly.

## M2 — Physical rooftop props

**Status: complete**

- [x] shared raised-rectangle and cylindrical physical-volume primitives;
- [x] physical skylights with curb, glazing and directional depth;
- [x] HVAC casing and fan housings;
- [x] hatch hinges and handle;
- [x] vent throat/collar refinement;
- [x] antenna pedestal, mast and braces;
- [x] raised annex and service grille;
- [x] architectural church marker;
- [x] reusable family-neutral marker geometry;
- [x] planned prop/marker bounds remain immutable.

## M3 — Surface material language

**Status: complete**

- [x] M3.1 grouped low-contrast warehouse corrugation;
- [x] M3.2 broad membrane seams with restrained deterministic tonal variation;
- [x] M3.3 civic surface order without decorative repetition;
- [x] M3.4 pitched-roof ridge shading;
- [x] M3.5 night-roof tonal modulation;
- [x] M3.6 deterministic low-frequency material variation;
- [x] M3.7 material passes preserve character/aim/interaction readability.

### M3 exit result

Roof surfaces now read through broad material hierarchy rather than uniform vector lines or high-frequency texture noise. Planner-owned material coordinates remain unchanged.

## M4 — Family grammar expansion

**Status: complete**

- [x] dedicated hospital/medical visual profile;
- [x] police physical entrance/civic refinement;
- [x] church monumental frontage and pitched-roof refinement;
- [x] club/nightlife physical vestibule and local neon identity;
- [x] generic/residential/commercial differentiation;
- [x] ambiguous untagged buildings stay deliberately neutral;
- [x] profile classification remains whole-word and conservative;
- [x] visual profile classification does not become gameplay/mission authority.

### M4 exit result

Family identity comes from massing, material, entrance/service organisation and local physical features rather than world labels or full-perimeter colour.

## M5 — Composition and controlled variation

**Status: complete**

- [x] M5.1 main mass → secondary volume → hero prop → support grammar;
- [x] M5.2 deterministic hero/support prop grouping;
- [x] M5.3 irregular but controlled service-slot rhythm;
- [x] M5.4 avoidance zones around entrances, annexes and identity elements;
- [x] M5.5 small-roof austerity and large-roof hero/support rules;
- [x] M5.6 mixed-street repetition audit;
- [x] M5.7 sparse gameplay readability and bounded prop coverage.

### M5 exit result

The system generates deliberate low-frequency compositions rather than uniform roof clutter. Mixed-family streets retain meaningful differences without introducing random visual noise.

## M6 — Final polish and merge readiness

**Status: final-validation-pending**

- [x] representative gameplay-scale captures for warehouse, industrial, police, medical, church, nightlife and generic;
- [x] mixed-street gameplay-scale capture;
- [x] reproducible manifest with building IDs, authored bounds, viewport and gameplay zoom;
- [x] comparison against the approved north-star direction;
- [x] first review converted visible deficits into bounded renderer-only corrections;
- [x] church broad pitched-roof planes;
- [x] nightlife asymmetric service deck with local neon only;
- [x] generic neutral service court for large roofs;
- [x] industrial mechanical plant deck grouping annex + HVAC;
- [x] police communications court grouping HVAC + antenna;
- [x] full acceptance-rubric scorecard;
- [x] every representative family averages at least `1.6`;
- [x] no zero in silhouette, parapet, shadow or gameplay clarity;
- [x] exact final visual head unit suite green;
- [x] dedicated `browser-building-review` job green and artifact published;
- [x] browser campaign green;
- [x] Netlify preview green on the exact final visual head;
- [x] final review report committed;
- [x] machine state set to `final-validation-pending`;
- [x] autonomous/scheduled building-polish work paused;
- [x] stop further visual changes;
- [ ] single final user validation;
- [ ] after approval, add final merge-readiness/progress evidence;
- [ ] mark PR ready only if the user wants review state changed;
- [ ] merge only after explicit user approval.

### M6 exact evidence

- final visual implementation/test head: `bd263451386ca89a0a6f942056bd135bc03c98f7`;
- workflow: `32355086754`;
- review artifact: `building-visual-review` / artifact `9401382945`;
- gameplay zoom: `1.847062190599483`;
- unit tests: success;
- browser campaign: success;
- browser building review: success;
- browser systems shard 1/3: success at bounded final observation;
- browser boot and system shards 2/3–3/3 were still running at the final bounded observation, with no recorded building-focused failure;
- Netlify: success — `https://deploy-preview-63--vampire-district.netlify.app`;
- representative-family mean: `1.90`;
- lowest representative profile: generic at `1.71`;
- blocking zeroes: `0`.

See [`../progress/BUILDING_VISUAL_POLISH_FINAL_REVIEW.md`](../progress/BUILDING_VISUAL_POLISH_FINAL_REVIEW.md) for the full table and correction history.

## Branch synchronization checkpoint

Current-main runtime changes were integrated into the feature branch before the later M2–M6 work. Building presentation remains attached at the existing presentation boundary and does not own generated-city or gameplay authority.

## Current exact next action

**User final validation only.** Review the Netlify gameplay preview and/or the M6 `building-visual-review` artifact. Do not implement further building visual polish, mark PR #63 ready or merge it before explicit approval.
