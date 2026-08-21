# M5 — Low-frequency grime and urban surface dressing

Branch: `agent/city-noir-atmosphere`  
Initiative: `city-noir-atmosphere`  
Depends on: merged PR #69 street-surface authority, M4 wet-road response.

## Goal

Remove the remaining sterile large-surface feeling with sparse contextual dirt and service-corner dressing **without reopening or duplicating PR #69 street-surface geometry**.

M5 is presentation-only. It does not create walkability, collision, interaction, street furniture, road topology, building topology, gameplay evidence objects or light sources.

## M5.1 responsibility audit — complete

The audit was performed against the merged PR #69 implementation and current `main` street authorities before any M5 runtime geometry was added.

### Existing authorities that M5 must not duplicate

PR #69 / `CitySurfacePresentationPolicy` / `StreetSurfaceDetailGeometry` already own:

- street/open-ground grid language;
- deterministic open-ground panels;
- generic open-ground scuff marks;
- road/asphalt base values and road-edge treatment;
- asphalt repair patches and patch seams;
- asphalt cracks;
- gutter bands;
- gutter grime/stain runs;
- drains and drain-bar presentation;
- major/local road paint and worn centre markings;
- sidewalk material, joints, trims and canonical curbs;
- authoritative road-edge pavement bands;
- junction pavement/caps/completion;
- zebra/crosswalk geometry, stop lines and tactile paving;
- manhole/street-surface details already emitted by that presentation pass.

M4 separately owns light-coupled wet-road receiving response. M5 must not disguise another wet-reflection system as generic damp stains.

`StreetFurnitureSystem` owns gameplay dumpsters and their body-containment behaviour. M5 never creates a second dumpster, moves one, changes collision, or mutates its gameplay state.

### Explicitly rejected M5 families

Do not add any world-wide or road-wide family for:

- generic tyre/scuff fields;
- generic damp/gutter stains;
- asphalt patches, repairs or cracks;
- drains/manholes;
- curb dirt bands that simply restate the #69 gutter language;
- repeated road paint wear;
- generic procedural litter on a uniform world grid;
- reflective puddles coupled to lights (M4 authority);
- gameplay street furniture.

These would either duplicate an existing authority or create the repeated procedural texture the atmosphere program is trying to avoid.

## Allowed M5 presentation space

M5 may add **contextual, low-frequency, non-interactive** dressing driven by existing semantic anchors rather than a global texture grid:

- service/frontage grime immediately outside selected building service/frontage edges;
- compact oil/dirt residue only when constrained to a service/mechanical context;
- tiny litter fragments at selected industrial/warehouse service corners;
- small dirty accumulation where existing building semantics justify it and it does not overlap roads/crosswalks.

Narrative posters, readable graffiti and signage remain deferred to M7 environmental storytelling.

## M5.2 — `service-frontage-grime` — complete

The first M5 runtime family is implemented in `phaser/src/policies/CityGrimePresentationPolicy.js` and installed as a static presentation-only layer.

Delivered contract:

- reuses existing building presentation/frontage semantics;
- deterministic stable-ID hashing;
- biased toward service/industrial/warehouse/commercial contexts;
- road/crosswalk receiver rejection;
- hard descriptor/fragment caps;
- render-window culling;
- compact neutral fragments only;
- no gameplay/topology mutation;
- no bright/saturated or reflection-like response.

The first gameplay-scale iteration was too subtle. The accepted correction increased only this bounded family’s fragment size/alpha and added explicit focused guards preventing future visual drift.

Focused coverage: `tests/city-service-frontage-grime-presentation.test.js`.

Validated implementation head: `485ad7074f1ddfcbb1ab8e8f70d33125cd4a0aa4`.

- `Tests` run `32488128735`: **success**.
- `City atmosphere review` run `32488128814`: **success**.
- artifact `9448812773`.
- captures: `service-frontage-grime.png`, `mixed-grime-context.png`, `grime-dark-control.png`.

Acceptance: selected service frontage reads less sterile while remaining sparse, non-interactive and visually subordinate to lights/navigation/actors.

## M5.3 — `service-corner-litter` — complete

The second and final M5 family is implemented in `phaser/src/policies/CityServiceCornerDressingPolicy.js`.

### Source and authority contract

M5.3 deliberately does **not** read or mutate gameplay dumpster state. It consumes only the already-approved M5.2 `service-frontage-grime` descriptors and existing building geometry as read-only semantic anchors.

Only `service-strip` grime sources are eligible, and production selection is restricted to industrial/warehouse contexts. This keeps the service-corner layer tied to actual service semantics rather than spreading litter across the city.

### Placement and visual contract delivered

- family ID: `service-corner-litter`;
- deterministic stable hashing, no `Math.random()`;
- hard cap: at most 6 compositions city-wide in the descriptor pass;
- hard cap: at most 3 tiny fragments per composition;
- minimum spacing between compositions: 86 world units;
- maximum outward distance from the source building: 34 units;
- active render-window culling with a small margin;
- building, road and crosswalk rejection for anchors/fragments;
- tiny dull paper/debris polygons using neutral dark values only;
- no interactions, collision, Heat, pathfinding, mission or street-furniture state;
- no readable poster/graffiti/signage content.

Focused coverage: `tests/city-service-corner-dressing-presentation.test.js`.

Browser review extends `tests/browser/city-grime-review.spec.js` and captures:

- `service-corner-dressing.png`;
- `service-frontage-grime.png`;
- `mixed-grime-context.png`;
- `grime-dark-control.png`.

### Validation history

The first browser review failed only in the review harness because `buildServiceCornerDressingDescriptors()` intentionally returns an immutable/frozen array and the test attempted to sort that array in place. Production rendering and unit tests were unaffected. The harness was corrected to sort a copied array (`[...cornerDescriptors]`) rather than weakening immutability.

Validated final head: `034e165ecd9436e6b697ad248d7bab9b605214a8`.

- `Tests` run `32491558013`: **success** — unit tests, browser boot/campaign and all three browser-system shards passed.
- `City atmosphere review` run `32491558002`: **success**.
- artifact `9450153767`: `city-atmosphere-review`.

Visual assessment: **accepted**. The corner debris is discoverable as a tiny contextual detail around industrial/service edges, but is not visually competitive with roads, light pools, buildings, characters or gameplay UI. The mixed frame remains sparse and the dark-control frame does not become a generalized litter field.

## M5 exit — complete

- [x] representative service surfaces no longer feel uniformly sterile;
- [x] no M5 family duplicates PR #69 or M4;
- [x] clutter remains contextual and low-frequency;
- [x] descriptors are deterministic, hard-capped and culled;
- [x] decorative dressing remains non-interactive/non-collidable;
- [x] focused tests and gameplay-scale evidence pass;
- [x] readable storytelling content remains deferred to M7.

M5 is closed. The next milestone is M6 — grounding and shadow consistency.

## Execution cadence / stop rule

The initiative-wide default remains **task → validate → document → report → wait for user direction**.

After a bounded task is complete, update its task/checklist, machine state, progress evidence and PR summary as needed before starting the next bounded task.

The current user instruction explicitly authorizes one additional bounded task after M5.3 if M5.3 validates successfully. Therefore the next allowed task in this batch is **M6.1 shadow-language audit only**. Do not implement M6.2 contact shadows without another user instruction.
