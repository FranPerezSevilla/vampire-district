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
