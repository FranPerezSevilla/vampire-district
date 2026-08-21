# City noir atmosphere progress

Append-only execution evidence for the ViceBlood city-atmosphere initiative.

Canonical direction: [`../CITY_NOIR_ATMOSPHERE.md`](../CITY_NOIR_ATMOSPHERE.md)  
Roadmap: [`../roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md`](../roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md)  
Machine state: [`city-noir-atmosphere-status.json`](city-noir-atmosphere-status.json)

> Historical detail through M5.2 is preserved in git history. From M5.3 onward, bounded checkpoint evidence is also written to dedicated immutable checkpoint files under this directory so the task → validate → document → report cadence remains recoverable without relying on chat context.

## 2026-08-21 — M5.3 service-corner litter complete

State: `complete`.

Authority:
- `phaser/src/policies/CityServiceCornerDressingPolicy.js` owns presentation-only `service-corner-litter`;
- existing M5.2 `service-strip` descriptors and building geometry are read-only source authority;
- gameplay dumpsters remain owned by `StreetFurnitureSystem` and are not mutated or duplicated.

Changed:
- added deterministic industrial/warehouse service-corner litter;
- maximum 6 compositions, maximum 3 tiny fragments per composition;
- minimum spacing 86 units and maximum outward distance 34 units;
- road/crosswalk/building rejection and bounded render-window culling;
- installed after M5.2 grime;
- added focused unit coverage and gameplay-scale browser evidence.

Validated:
- initial browser harness failed because it sorted an intentionally frozen descriptor array in place; production rendering/unit tests were unaffected;
- harness corrected at `034e165ecd9436e6b697ad248d7bab9b605214a8` to sort a copied array;
- `Tests` run `32491558013`: **success**;
- `City atmosphere review` run `32491558002`: **success**;
- artifact `9450153767`;
- captures `service-corner-dressing.png`, `service-frontage-grime.png`, `mixed-grime-context.png`, `grime-dark-control.png`.

Visual result:
- service-corner debris is discoverable but remains a tiny contextual detail;
- mixed and dark controls stay sparse;
- no generalized litter field or gameplay cue appears.

M5 exit: **complete**.

Exact next task authorized in the same user batch:
- M6.1 shadow-language audit only.

## 2026-08-21 — M6.1 shadow-language audit complete

State: `checkpoint-after-M6.1`.

Authority audit:
- buildings already have the approved PR #63 layered directional shadow/depth grammar in `BuildingPresentationPolishRenderer.js`; do not add a competing atmosphere building-shadow layer;
- modular characters already create a shallow black contact ellipse in `ModularCharacterView.js`; do not stack a second character shadow;
- vehicles currently use a nearly coincident dark underlay in `VehicleView.js`, which reads more as body depth than a soft ground contact cue; this is the clearest remaining grounding deficit;
- gameplay dumpsters in `StreetFurnitureSystemCore.js` have no separate contact shadow, but they are sparse and secondary; any prop adjustment is deferred until vehicle review proves it necessary.

Decision:
- M6.2 is locked to **vehicle contact shadow only**;
- keep `VehicleView` as sole vehicle presentation authority;
- use one cheap shallow low-alpha footprint with slight directional bias compatible with existing building shadow language;
- size from vehicle archetype footprint;
- no lighting/gameplay dependency or whole-city per-frame scan;
- no character/building/prop shadow changes in the M6.2 slice.

Canonical task contract:
- `docs/agent-tasks/2026-08-21-city-noir-m6-grounding-shadows.md`.

Detailed checkpoint evidence:
- `docs/progress/CITY_NOIR_ATMOSPHERE_M5_3_M6_1_CHECKPOINT.md`.

Exact next task:
- M6.2 vehicle contact shadow — **awaiting new user direction**. The explicit batch ends here.
