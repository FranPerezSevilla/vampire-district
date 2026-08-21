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