# City noir atmosphere progress

Append-only execution evidence for the ViceBlood city-atmosphere initiative.

Canonical direction: [`../CITY_NOIR_ATMOSPHERE.md`](../CITY_NOIR_ATMOSPHERE.md)  
Roadmap: [`../roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md`](../roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md)  
Machine state: [`city-noir-atmosphere-status.json`](city-noir-atmosphere-status.json)

Do not rewrite previous entries to hide failed experiments or dependency waits. Add a new dated entry whenever milestone state or the exact next action materially changes.

## 2026-08-21 — M0 initiative bootstrap

State: `complete`

Authority:
- documentation and presentation planning only;
- no runtime authority changed.

Changed:
- established `CITY_NOIR_ATMOSPHERE.md` as the canonical mood/art-direction authority;
- established a detailed milestone roadmap;
- established the autonomous/manual agent contract;
- established machine-readable progress state;
- added committed north-star and current-baseline reference images so future work does not depend on chat context;
- identified PR #69 as the existing street-surface presentation dependency.

Baseline diagnosis:
- current city geometry is structurally usable and should not be rebuilt;
- scene values are too compressed into a similar blue-grey band;
- the target requires darkness as the base, sparse practical lights, wet local reflections, low-frequency wear, grounding and contextual set dressing;
- the target does not require photorealistic assets or replacing the project’s scalable procedural/top-down language.

Validated:
- documentation-only bootstrap; runtime checks are not required by the affected-test selector for this commit set;
- repository authorities and recent visual PRs were inspected before defining scope.

Non-goals preserved:
- no changes to gameplay, AI, missions, Heat, police, traffic, pedestrians, collision, navigation or generated topology;
- no duplicate building renderer;
- no duplicate character renderer;
- no duplicate street-surface renderer;
- no street-surface implementation copied from active PR #69.

Dependency evidence at bootstrap:
- PR #69 `City street visual pass` is open and draft;
- it already contains asphalt/sidewalk/crosswalk presentation, gutters, drains, repairs, cracks and worn road paint;
- M1 therefore remains `waiting-on-dependency` until #69 is merged or the user explicitly changes integration strategy.

Exact next task:
- M1.1 — inspect PR #69 state. If it is merged, synchronize this branch with post-merge `main` and perform the post-#69 atmosphere baseline audit. If it remains unmerged, do not duplicate its street-surface scope.

## 2026-08-21 — M1 integrated / M2 night hierarchy started

State: `autonomous-in-progress`

### M1 dependency resolution and authority integration

PR #69 is merged. The atmosphere branch was synchronized with post-merge `main` through merge commit `a408a1342989868ad62a09e0df12d0742830ee4a`, using `f803c974817c92666b82a60fac808d54c2c4bc05` as the integrated main parent.

After synchronization, `main...agent/city-noir-atmosphere` reports `behind_by: 0`. The atmosphere branch therefore builds on the same street foundation rather than replaying or forking it.

Post-#69 street presentation authority:
- `phaser/src/policies/CitySurfacePresentationPolicy.js` owns road/open-ground/sidewalk/crosswalk presentation composition;
- `phaser/src/policies/SidewalkCoveragePresentationPolicy.js` and the sidewalk/curb rendering helpers preserve the canonical pedestrian-surface/curb geometry;
- `phaser/src/rendering/StreetSurfaceDetailGeometry.js` owns deterministic gutters, drains, road repairs/cracks and related low-frequency street-surface geometry;
- `phaser/src/data/balance.js` remains the shared world colour/value source used by that presentation layer;
- focused #69 tests remain the city-surface, curb, sidewalk-coverage/completion and street-surface-detail suites.

M1 non-duplication boundary is now locked:
- atmosphere work must not recreate curb topology, sidewalk completion, gutters, drains, asphalt repairs, cracks, zebra geometry or worn road-paint cadence;
- those features are treated as input/foundation for later light, wetness and atmospheric passes.

### M1 post-merge baseline audit

The post-merge code/presentation audit classifies the remaining atmosphere deficit as intended by the roadmap:
- **value hierarchy:** broad surfaces still occupied a compressed blue-grey range (`streetBase 0x171b28`, `road 0x202536`, `sidewalk 0x373a47`), leaving insufficient darkness/headroom for local light;
- **local lighting:** no practical-light island layer exists yet;
- **wet response:** #69 supplies surface wear but no light-coupled wet reflection language;
- **non-#69 grime/set dressing:** still largely absent and remains a later milestone;
- **grounding/depth:** building depth exists, but city-wide vehicle/character/prop grounding is not yet unified;
- **environmental storytelling:** sparse contextual city life exists through simulation, but presentation-specific signs/steam/micro-scenes remain future work.

No #69 surface defect was identified that justifies reopening its geometry authority. M1 is therefore complete.

### M2.1 value palette audit

Observed broad-world values before the M2 change:
- void `0x05060b`;
- street/open ground `0x171b28`;
- road `0x202536`;
- sidewalk `0x373a47`;
- generic building authored base `0x262838` before profile/material mixing;
- generic building trim `0x5a5869` before profile/material mixing;
- player highlight `0xe8d9e9`;
- navigation/high-value world marks such as crosswalk `0xc8cad3`;
- rare semantic accents remain amber/red/magenta/green rather than becoming broad fill values.

Desired relative ordering is now explicit:
1. near-black void/deep background;
2. very dark open ground and unlit roof mass;
3. dark asphalt;
4. restrained but clearly separable sidewalk/concrete;
5. local navigation edges/paint;
6. future practical-light pools/highlights;
7. player and tiny bright source highlights;
8. rare saturated semantic accents, used locally rather than as area fill.

### M2.2 first runtime implementation

The first bounded runtime change deliberately uses **palette refinement**, not a fullscreen dark overlay. This keeps existing geometry/material authorities intact and avoids crushing player/NPC/vehicle contrast uniformly.

`phaser/src/data/balance.js` now shifts the broad city palette down while preserving hierarchy:
- `void` → `0x030409`;
- `streetBase` → `0x0d1018`;
- `road` → `0x151a24`;
- `sidewalk` → `0x292c37`;
- curb/trim/paint/detail colours were reduced proportionally so navigation structure remains visible without reading as self-lit;
- crosswalk/player/high-value identity colours retain substantial headroom above broad surfaces;
- gameplay values, simulation state and visibility rules are untouched.

This is intentionally not M3 lighting. It only creates the dark value range into which later practical lights can be inserted.

### M2.3 focused guard added

`tests/city-night-value-hierarchy.test.js` asserts:
- broad surfaces remain under a dark-value ceiling;
- `void < streetBase < road < sidewalk` in luma;
- sidewalk remains clearly separable from asphalt;
- curb/crosswalk structure remains readable;
- player value priority remains above broad street markings;
- road wear stays subordinate to navigation structure.

Browser/gameplay-scale evidence is still required before M2 can be marked complete.

Non-goals preserved:
- no AI/stealth/light-visibility mechanics;
- no generated geometry changes;
- no building/character renderer rewrite;
- no practical lights or wet reflections yet;
- no duplicate street detail from #69.

Exact next task:
- M2.3 — inspect affected CI and obtain gameplay-scale browser evidence showing a deliberately dark block, a readable road edge and clear player/NPC/threat silhouettes. If the M2 rubric passes, mark M2 complete and begin M3.1 with one static presentation-only practical-light family.

## 2026-08-21 — M2 closed / M3 warm practical-light slice started

State: `autonomous-in-progress`

### M2.3 gameplay-scale evidence

A dedicated browser capture harness now lives in `tests/browser/city-atmosphere-review.spec.js`, with the PR-only workflow `.github/workflows/city-atmosphere-review.yml`. The harness discovers representative locations from authored/generated city data rather than relying on hard-coded art-test coordinates.

Successful M2 evidence run:
- workflow: `City atmosphere review` run `32464436723`;
- head: `bde644822ebb532c39bd0202d3db36b073b0ba41`;
- conclusion: `success`;
- artifact: `city-atmosphere-review` / artifact id `9440164701`;
- gameplay zoom captured: approximately `1.978`;
- evidence frames: `intersection.png`, `mixed-street.png`, `dark-block.png` plus `manifest.json`.

Visual review result:
- the intersection frame is no longer a flat blue-grey field; road, sidewalk, curb and zebra values remain immediately separable;
- the player and nearby vehicles/police remain readable against the dark city base;
- the mixed-street frame preserves different building-family material values while leaving meaningful headroom for local illumination;
- the deliberately dark `blackwaterTerminal` block reads as a large low-value mass without erasing road navigation around it;
- the base therefore satisfies the M2 objective: darkness dominates area while navigation/entity readability remains intact.

The first version of the capture harness briefly failed because it queried stale `camera.worldView` coordinates after programmatic centering; the captured image itself already showed the player. The harness was corrected to calculate visible world extents from camera dimensions and zoom. The failed experiment remains represented in CI history rather than being hidden.

M2 is now considered complete. It did not alter gameplay visibility, AI, stealth, collision, navigation, generated topology or #69 street-surface geometry.

### M3.1 / M3.2 first bounded implementation

The first practical-light family is now implemented in `phaser/src/policies/CityPracticalLightPresentationPolicy.js` and installed after the city-surface presentation policy.

Authority and behavior:
- source anchors are the existing deterministic generated `lights` collection; no second light-placement authority is created;
- descriptors preserve stable source IDs and expose only presentation fields such as family, world position, bounded visual radius and soft-pool dimensions;
- the only enabled family is `warm-street`;
- visual radius is deliberately capped below the authored source radius and nearby sources remain spatially sparse because the topology compiler already spaces lamp anchors;
- the pool is built from several low-alpha nested filled ellipses with no hard spotlight outline;
- a tiny pure-overhead fixture marker identifies the source without introducing perspective/isometric lamp art;
- rendering is culled to the current urban render bounds plus a small margin and occurs only during static map redraw, not as an expensive whole-world per-frame effect;
- legacy `brokenLights` state may suppress a source for compatibility but the policy never mutates gameplay or authored light state.

Focused coverage in `tests/city-practical-light-presentation.test.js` guards determinism, non-mutation, source identity, bounded radius, render-window culling and soft-layer policy.

The gameplay-scale browser harness has also been extended with a deterministic `warm-light` review target. The next gate is visual/CI validation of that frame before adding building/window spill or any additional colour family.

Exact next task:
- complete M3.2 validation on the latest PR head: inspect the `warm-light.png` artifact at gameplay scale and verify sparse local amber islands are visible without blanket illumination or navigation loss. If accepted, mark M3.1/M3.2 complete and move to M3.3 selected building/window/door spill rather than adding more street-light density.

## 2026-08-21 — M3.1–M3.3 validated

State: `autonomous-in-progress`

### Warm street-light visual iteration

The first browser rendering of the warm street-light family was intentionally rejected during autonomous review: four relatively strong concentric ellipses produced obvious bullseye bands around each lamp. The implementation was not accepted merely because tests were green.

The falloff was refined to many very-low-alpha nested fills. This keeps the implementation shader-free and deterministic while reading much closer to a soft radial practical light at normal gameplay zoom.

Validated warm-light evidence:
- workflow: `City atmosphere review` run `32465404259`;
- head: `c4dee832f3a3b623e55c3031ca2d55a8f989bb9d`;
- conclusion: `success`;
- artifact: `city-atmosphere-review` / artifact id `9440519917`;
- `warm-light.png` shows sparse amber pools with no blanket illumination and no navigation/readability loss.

The resulting pools are deliberately subtle. M4 wet response is expected to make selected lights read more strongly on asphalt without globally increasing light intensity.

### M3.3 selected frontage spill

A second bounded family, `warm-frontage`, now derives from the existing building presentation semantics rather than inventing storefront positions independently.

Rules:
- only ordinary `default`, `residential` and `commercial` visual profiles are eligible;
- deterministic profile-specific selection rates keep most buildings dark;
- `frontage: none` buildings are excluded;
- the existing presentation definition supplies the frontage edge;
- a small source mark stays on that edge while a compact soft spill projects just outside the building footprint;
- police/civic, club/nightlife and industrial families remain reserved for M3.4 rather than being colored as generic warm storefronts.

Focused tests now also guard deterministic sparse selection, profile restrictions, source non-mutation and outward projection from the authored frontage edge.

Validated combined evidence:
- workflow: `City atmosphere review` run `32465707840`;
- head: `b31dd74b6f659e328b1d4bb3324411d80b8a1c6d`;
- conclusion: `success`;
- artifact: `city-atmosphere-review` / artifact id `9440621156`;
- the representative mixed street contains both the warm street-light rhythm and one selected warm frontage spill while the majority of buildings remain dark;
- unit-tests job for the same head completed successfully, including the new practical-light tests.

M3.1, M3.2 and M3.3 are complete. The next bounded task is M3.4: add semantic accent families one at a time—cool civic/institutional, restrained nightlife magenta/red, then industrial/service dirty warm—without increasing ordinary street-light density.

## 2026-08-21 — M3 completed, M4 validated, M5 responsibility boundary locked

State: `autonomous-in-progress`

### M3.4 contextual accent families

The practical-light authority was extended with sparse semantic families while preserving the dark/warm base hierarchy:

- `cool-civic` for restrained institutional/civic frontage light;
- `nightlife-accent` for localized magenta/red nightlife emphasis;
- `industrial-dirty` for subdued dirty industrial/service light.

Validated contextual evidence:
- workflow: `City atmosphere review` run `32468999890`;
- head: `06d18d039c01f67eb3312329aff224279de28f3e`;
- artifact id `9441823514`;
- captures: `civic-cool.png`, `nightlife.png`, `industrial.png`, `mixed-families.png`;
- assessment: contextual families remain local and subordinate; nightlife is deliberately the strongest special building accent while civic and industrial light stay restrained.

### M3.5 vehicle/emergency contribution

`CityVehicleLightPresentationPolicy` reuses existing vehicle/police runtime state for bounded presentation-only headlights, tail response and police red/blue pulses. It does not rewrite vehicle simulation or police behaviour.

Validated dynamic-source evidence:
- workflow: `City atmosphere review` run `32470828688`;
- head: `82cb34a884a00d470a7229ac10ccb1216d4aa9d7`;
- artifact id `9442522378`;
- captures: `vehicle-lights.png`, `police-lights-red.png`, `police-lights-blue.png`.

M3 is complete: warm street/frontage, contextual civic/nightlife/industrial accents and bounded vehicle/emergency sources coexist with real dark gaps and no gameplay-lighting authority.

### M4 wet asphalt and local reflection language

`phaser/src/policies/CityWetStreetPresentationPolicy.js` consumes the existing M3 source descriptors and generated `roads` authority. It attaches low-alpha broken fragments only to eligible road receivers, uses deterministic source/road hashes, bounds per-family reach, and keeps dynamic vehicle/police response inside the camera/render window.

The first M4 browser review failed specifically because the authored nightclub practical source was farther from asphalt than the production nightlife maximum receiver distance. That was treated as a validation-fixture problem, not permission to weaken production bounds. Commit `62e2eb4fd4aade64e1f4e6393996e09d4e7db4f9` creates a test-only nightlife source on the nearest real generated asphalt receiver and runs it through the unchanged production descriptor builder/renderer. Production nightlife reach remains `90px`.

Validated M4 evidence on that implementation head:
- `Tests` run `32475694164`: **success**, including unit tests, browser boot/campaign and all browser-system shards;
- `City atmosphere review` run `32475694166`: **success**;
- artifact id `9444326985`;
- static captures: `wet-warm-street.png`, `wet-nightlife.png`, `wet-dark-control.png`;
- dynamic captures: `wet-vehicle.png`, `wet-police-red.png`, `wet-police-blue.png`;
- assessment: reflections remain irregular, asphalt-bound and local; dark road dominates between highlights; special colours do not flood the district; gameplay readability is preserved.

M4 is complete.

### M5.1 responsibility audit

Before adding any new grime geometry, the merged PR #69 street presentation and current street-furniture authorities were re-audited.

PR #69 already owns and therefore excludes from M5:
- open-ground grid, panels and generic scuffs;
- asphalt material/edge treatment;
- road repairs, patch seams and cracks;
- gutter bands and gutter stains;
- drains/manholes;
- worn road/centre paint;
- sidewalks, joints, curbs and authoritative pavement completion;
- junction pavement/caps;
- zebra/crosswalk geometry, stop lines and tactile paving.

M4 separately owns light-coupled wet-road response. `StreetFurnitureSystem` owns gameplay dumpsters, including their collision/hidden-body behaviour, so M5 may never duplicate or mutate them.

The remaining non-overlapping M5 space is deliberately contextual rather than world-grid based. A new task contract, `docs/agent-tasks/2026-08-21-city-noir-m5-grime-dressing.md`, locks the first runtime slice to one presentation family: **`service-frontage-grime`**. It must derive from existing building/frontage semantics, stay close to selected service/industrial/commercial edges, reject road/crosswalk receiving points, remain deterministic/capped/culled and create no interaction or collision.

Readable posters, graffiti and signage are deferred to M7 environmental storytelling. Generic tyre/scuff/damp fields are rejected because they would duplicate #69 or M4.

Current `main` advanced after the atmosphere branch was originally synchronized: `805ea5d107dcddcef4cd564294569455093af4b0` contains merged vehicle-dynamics PR #71. This does not change the M5.1 authority result; PR #72 remains mergeable. Runtime M5 work should re-check branch/main synchronization before touching shared runtime seams.

Exact next task:
- M5.2 — implement only `service-frontage-grime` under the new task contract, with focused determinism/non-mutation/surface-compatibility/culling tests and gameplay-scale evidence before adding any second M5 family.

## 2026-08-21 — M5.2 service-frontage grime complete / user checkpoint cadence locked

State: `autonomous-in-progress` with `checkpoint-after-M5.2`.

Authority:
- `phaser/src/policies/CityGrimePresentationPolicy.js` owns the new presentation-only `service-frontage-grime` family;
- building/frontage semantics remain the source authority;
- #69 street-surface geometry and `StreetFurnitureSystem` gameplay dumpsters remain untouched.

Changed:
- implemented deterministic, hard-capped service/frontage grime near selected industrial/service/commercial contexts;
- rejected road/crosswalk receiving points and kept the family outside collision/interactions;
- added `tests/city-service-frontage-grime-presentation.test.js`;
- added browser review `tests/browser/city-grime-review.spec.js`;
- first gameplay-scale version was too subtle, so fragment size/alpha was increased only inside the bounded family and explicit upper/lower visual guards were added;
- branch was synchronized with current `main` (`805ea5d107dcddcef4cd564294569455093af4b0` / merged PR #71) without expanding atmosphere scope.

Validated:
- implementation head `485ad7074f1ddfcbb1ab8e8f70d33125cd4a0aa4`;
- `Tests` run `32488128735`: **success**;
- `City atmosphere review` run `32488128814`: **success**;
- artifact `9448812773`;
- captures `service-frontage-grime.png`, `mixed-grime-context.png`, `grime-dark-control.png`;
- `main...agent/city-noir-atmosphere` reports `behind_by: 0` after the integration.

Visual result:
- selected service/industrial frontage reads less sterile;
- fragments are visible at gameplay scale but remain compact/subordinate;
- mixed and dark controls preserve the dark sparse city hierarchy;
- no repeated world-grid grime field appears;
- no false pickup/collision/interactive cue appears.

Non-goals preserved:
- no road-wide oil/scuff/damp system;
- no duplicate cracks/repairs/gutters/drains/paint wear;
- no new gameplay street furniture;
- no posters/graffiti/signage (deferred to M7).

Workflow policy recorded from user instruction:
- default cadence is now **task → validate → document → report → wait for user direction**;
- every bounded task must update its task/checklist, machine state and progress evidence before the next task starts;
- PR #72 is updated whenever its current-state summary would otherwise be stale;
- a generic “continúa” authorizes the next bounded task only;
- an explicit batch instruction such as “hazlo todo de golpe” may temporarily remove the wait step for the granted scope, but documentation remains mandatory between tasks.

Exact next task:
- planned M5.3 `service-corner-composition`, but **do not start it until the user indicates to continue** under the new default checkpoint cadence.
