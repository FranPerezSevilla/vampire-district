# Building visual polish agent contract

This is the operational contract for any agent continuing the ViceBlood building-polish initiative.

## Authority

The authoritative runtime boundary is:

- public facade: `phaser/src/rendering/BuildingPresentation.js`
- semantic catalog: `phaser/src/rendering/buildings/BuildingPresentationCatalog.js`
- visual profiles: `phaser/src/rendering/buildings/BuildingVisualProfileCatalog.js`
- silhouette geometry: `phaser/src/rendering/buildings/BuildingSilhouetteGeometry.js`
- planner: `phaser/src/rendering/buildings/BuildingPresentationPlanner.js`
- base module painter: `phaser/src/rendering/buildings/BuildingPresentationRenderer.js`
- public polish compositor: `phaser/src/rendering/buildings/BuildingPresentationPolishRenderer.js`
- focused tests: `tests/building-presentation.test.js` and `tests/building-visual-shadow.test.js`

The art-direction authority is [`../BUILDING_VISUAL_POLISH.md`](../BUILDING_VISUAL_POLISH.md). The current task authority is [`../roadmaps/BUILDING_VISUAL_POLISH_ROADMAP.md`](../roadmaps/BUILDING_VISUAL_POLISH_ROADMAP.md). Machine state is [`../progress/building-visual-polish-status.json`](../progress/building-visual-polish-status.json). Hourly execution is tracked in GitHub issue #64.

## Execution mode

**Autonomous final-gate mode is approved.**

- Advance the roadmap without requesting intermediate subjective approval.
- Complete exactly one bounded task per session or hourly run.
- Use focused tests, repository safety checks and Netlify deployment as intermediate gates.
- Defer the single user-facing visual validation until M6 has produced the complete representative review package.
- Keep PR #63 in draft and never merge it autonomously.

Autonomy does not authorize changes to gameplay, collision, topology, navigation, missions, AI or generated city data.

## Mandatory startup sequence

Before changing code:

1. Read `AGENTS.md`.
2. Read `docs/AGENT_DEVELOPMENT.md`.
3. Read `docs/BUILDING_PRESENTATION.md`.
4. Read `docs/BUILDING_VISUAL_POLISH.md`.
5. Read the roadmap, progress log and status JSON.
6. Confirm the active milestone and next unchecked task.
7. Inspect only the files required by that task.
8. State scope, acceptance criteria and non-goals in the progress entry before implementation.

Do not jump ahead because a later milestone looks visually interesting. Finish, safely defer or explicitly block the active task first.

## Scope declaration template

Every implementation session must begin with a bounded declaration in the progress log:

```md
### Scope
- Active milestone:
- Task:
- Authoritative files:
- Focused tests:
- Acceptance criteria:
- Explicit non-goals:
```

## Change protocol

### 1. Preserve authorities

- Planner decides **what exists and where**.
- Base module painter decides **how each module kind is painted**.
- Public polish compositor applies the shared shadow/parapet/volume language and is the only renderer exported by the public facade.
- Visual profile catalog decides **family defaults**.
- Semantic catalog decides **module/archetype contracts**.
- `GameScene` only requests a presentation and draws opt-in labels.

Do not move profile logic into `GameScene`. Do not make renderer decisions from mission state.

### 2. Preserve invisible collision authority

The authored `x`, `y`, `w`, and `h` rectangle may remain exact collision and navigation truth without being painted as a complete visual frame.

- A low visual slab may cover the collider footprint.
- A renderer-only shadow may extend beyond it.
- The visible architectural silhouette may be inset, irregular or layered.
- Do not alter collision merely to improve visual massing.
- Do not expose the collider rectangle through debug-like perimeter lines in normal gameplay.

### 3. Prefer shared visual primitives

A new visual effect should normally be one of:

- shared shadow helper;
- shared parapet helper;
- shared volume helper;
- shared prop renderer;
- data entry in a visual profile;
- deterministic planner module.

Avoid one-off code for `WARE`, `WORKS`, one hospital or one club unless explicit authored metadata is the accepted design.

### 4. Separate geometry from polish

A renderer-only shadow may extend beyond the footprint. A planned annex, prop, frontage or service strip may not. Use `moduleFitsBuildingFootprint` and focused tests for all planned geometry.

### 5. Keep normal zoom as the truth

Do not optimize for a close-up screenshot at the expense of gameplay. Detail must remain readable when the player, roads, cars and NPCs are visible together.

### 6. Keep deterministic composition

Never use frame time or unseeded randomness for static building presentation.

### 7. Keep family accents local

Police blue, nightclub magenta, medical light and religious warmth should live on local architectural features such as entrances, glazing, equipment or markers. Do not use a full-perimeter color as the primary identity language.

## One-task-per-run protocol

Each autonomous run must:

1. read the status JSON;
2. exit without modification if state is `blocked`, `paused`, `final-validation-pending` or `complete`;
3. select the first unchecked task in the active milestone;
4. declare bounded scope;
5. implement only that task;
6. add or update focused tests;
7. run focused validation;
8. update roadmap/status/progress;
9. leave a concise handoff with the next exact task;
10. commit only when validation passes.

A run must not opportunistically refactor unrelated systems or fix known unrelated CI failures.

## Milestone completion protocol

For M1–M5, a milestone may be marked complete when all are true:

1. code/document deliverables are present;
2. focused automated validation passes;
3. Netlify preview is green;
4. roadmap checkboxes are updated;
5. status JSON is advanced;
6. an append-only progress entry records evidence, risks and next task;
7. no new building-focused or affected failure exists.

Intermediate user visual approval is deliberately deferred. Record residual visual risk and continue to the next milestone when the implementation contract is satisfied.

M6 is different: it must set status to `final-validation-pending`, pause automation and request the single final user validation before the PR can leave draft state.

## Required documentation updates per push

For every meaningful push:

- append one entry to `docs/progress/BUILDING_VISUAL_POLISH_PROGRESS.md`;
- update current milestone/task in `docs/progress/building-visual-polish-status.json`;
- update roadmap status only when a task state genuinely changes;
- update `docs/BUILDING_VISUAL_POLISH.md` only when the canonical art contract changes;
- update `docs/BUILDING_PRESENTATION.md` only when runtime architecture or authored override contracts change.

Never rewrite old progress entries. Corrections are new entries referencing the corrected entry.

## Validation ladder

Minimum focused validation:

```bash
node --test tests/building-presentation.test.js tests/building-visual-shadow.test.js
```

Repository safety validation:

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Full RC validation is reserved for release-candidate or cross-cutting work:

```bash
npm run test:rc
```

Known unrelated failures must be recorded precisely; they are not permission to ignore new failures.

## Visual evidence protocol

During M1–M5, preserve visual risk notes and use the Netlify preview as the deployed evidence surface. Do not pause solely for subjective review.

At M6, capture representative buildings at normal gameplay zoom:

- warehouse;
- industrial;
- police;
- hospital/medical;
- church;
- club/nightlife;
- generic/residential/commercial;
- one mixed-street context.

Review each against:

- silhouette;
- parapet;
- shadow layering;
- material;
- prop integration;
- family identity;
- gameplay clarity.

Reference [`../BUILDING_VISUAL_POLISH.md`](../BUILDING_VISUAL_POLISH.md) for the scoring rubric.

## Stop conditions

Stop autonomous progression and mark status `blocked` when:

- a change would alter collision, topology, navigation, gameplay, missions or AI;
- two plausible shared art directions cannot be resolved from the committed north star and canonical rules;
- a required profile cannot be inferred safely and explicit metadata policy is insufficient;
- focused tests introduce a new failure that cannot be fixed inside the active task;
- the branch cannot be pushed safely because it diverged or conflicts;
- autonomous execution credentials are missing;
- required repository permissions are unavailable.

Stop normally and set `final-validation-pending` when M6 has assembled the complete review package. Do not stop merely because an intermediate milestone would previously have requested subjective approval.

## Hourly workflow contract

The scheduled workflow lives on the default branch and targets `agent/building-visual-poc`.

It must:

- use concurrency protection;
- run at most one bounded task per hour;
- use `openai/codex-action` with workspace-write sandboxing;
- require repository secret `OPENAI_API_KEY`;
- validate allowed changed paths;
- run the focused building suite;
- commit and push only validated changes;
- comment issue #64 with result, commit and next task;
- never merge or mark PR #63 ready for review.

Because scheduled GitHub Actions execute only from the default branch, workflow infrastructure is maintained separately from the feature implementation. The target branch remains the sole code branch for the polish initiative.

## Handoff template

```md
## Building polish handoff

### Active milestone
...

### Implemented
...

### Validation
- focused:
- affected:
- Netlify:
- visual risk:

### Known risks
...

### Files changed
...

### Next exact task
...
```

## Rollback policy

Keep changes task-bounded. A visual polish commit should be revertible without reverting prior planner, profile or topology work. Never combine unrelated gameplay fixes with this initiative merely to make global CI green.
