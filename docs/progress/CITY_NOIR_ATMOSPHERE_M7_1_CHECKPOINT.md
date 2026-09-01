# City noir atmosphere — M7.1 decorative sign/neon checkpoint

Date: 2026-08-22  
Branch: `agent/city-noir-atmosphere`  
PR: #72  
Milestone state: **M7 in progress; M7.1 complete**

## Purpose

M7.1 adds a sparse decorative sign grammar that makes authored urban functions legible at gameplay scale without turning the city into a neon field and without creating a second practical-light authority.

This bounded slice does **not** include M7.2 steam/smoke or M7.3 contextual micro-scenes.

## Delivered presentation authority

`phaser/src/policies/BuildingDecorativeSignPresentationPolicy.js` is presentation-only and composes after the existing `GameScene.drawBuilding()` path.

It reads existing building semantics (`id`, `sign`, `label`, `name`, `kind`, plus the existing resolved visual profile) and produces a plaque only when an authored semantic family matches. It never invents a building name.

Four restrained families are currently defined:

- `nightlife-band` → existing M3 `nightlife-accent` palette;
- `motel-marquee` → existing M3 `warm-frontage` palette;
- `medical-panel` → existing M3 `cool-civic` palette;
- `service-panel` → existing M3 `industrial-dirty` palette.

The policy imports the M3 presentation constants directly. It does not duplicate palette values and it does not append to `lightSpots`, create a light radius, add spill descriptors or introduce another emitter model.

Rendering is deliberately cheap and local: one dark plaque, a one-pixel family border/accent, a very low-alpha rectangular halo and the existing map-label text object. Plaques remain inside the authored building footprint.

Labels are only created for nearby signs (`< 520` world units), reuse `GameScene.addMapLabel()` and receive the M3 numeric `coreColor`. This last detail matters: the first visual pass exposed that passing a CSS string into the numeric label API produced an invalid `##rrggbb` value and black text. Commit `fbdebe0d0f1f1a19bd509dddae721ed77b99ea12` corrects the contract and the focused test now locks it.

## Selectivity and gameplay boundaries

The implementation is intentionally sparse:

- unrelated generic signs do not receive the new family treatment;
- unnamed buildings do not receive invented text;
- small footprints are rejected;
- the descriptor is deterministic/frozen and does not mutate building data;
- street layer only;
- no collision, navigation, AI, Heat, Exposure, police, traffic, mission or interaction changes;
- signage remains decorative and non-interactive.

## Focused tests

`tests/building-decorative-sign-presentation-policy.test.js` verifies:

- all four semantic families map to the existing M3 light palettes;
- generic/unnamed buildings remain untreated;
- descriptors are deterministic, frozen and footprint-bounded;
- the presentation uses plaque primitives and no light-emitter ellipse/spill contract;
- the installer is idempotent and composes after normal building drawing;
- at most one nearby label is added;
- the label API receives the numeric M3 `coreColor`.

## Gameplay-scale evidence

`tests/browser/city-sign-neon-review.spec.js` discovers real authored buildings at runtime and captures at most one representative target per family plus an unsigned/dark control.

Evidence names:

- `m7-sign-01-medical-panel.png`;
- `m7-sign-02-nightlife-band.png`;
- `m7-sign-03-motel-marquee.png`;
- `m7-sign-04-service-panel.png`;
- `m7-sign-control-dark.png`;
- `m7-sign-neon-manifest.json`.

The validated manifest on implementation head `fbdebe0d0f1f1a19bd509dddae721ed77b99ea12` found 29 eligible authored candidates and all four families. Representative targets were the hospital, club, hotel and a Foundry machine-shop/service building.

The dedicated medical target is much larger than the other examples. The checkpoint harness therefore biases the review camera toward the plaque while retaining the legal street review point; this is evidence framing only and does not affect runtime presentation.

## Validation

Validated implementation head:

`fbdebe0d0f1f1a19bd509dddae721ed77b99ea12`

- GitHub `Tests` run `32585402509`: **success**.
- GitHub `City atmosphere review` run `32585402507`: **success**.
- City atmosphere artifact `9478965549`.

An earlier atmosphere attempt (`32584590918`) was interrupted after five passing tests because the workflow had an inner hard `8m` Playwright timeout. The suite had grown from five to six serial evidence tests. The workflow now allows `10m` for Playwright inside a `15m` job; no game behavior was changed by that CI correction.

## Visual assessment

Accepted for the M7.1 gate.

The corrected evidence shows the intended hierarchy:

- nightlife text reads as a local pink/magenta accent without lighting the full block;
- hotel/motel text reads warm and restrained;
- service/industrial signs remain dirtier and lower-energy than nightlife;
- unsigned/dark areas remain dark rather than inheriting a generic neon treatment.

The grammar adds specific urban identity while leaving building massing, roads, vehicles, pedestrians and gameplay cues dominant.

## M7.1 closure

M7.1 is complete:

- four reusable semantic sign families exist;
- M3 remains sole contextual palette/light authority;
- signs are sparse and authored-semantic-driven;
- no gameplay interaction authority was created;
- focused tests and gameplay-scale evidence are green;
- the CI review budget now fits the six-test atmosphere package.

## Next task

Per the bounded-task cadence, autonomous work stops here.

Next planned task, only after new user direction:

`M7.2-steam-smoke-service-effects`

Do not combine M7.2 with M7.3 contextual micro-scenes unless the user explicitly changes the batching rule.
