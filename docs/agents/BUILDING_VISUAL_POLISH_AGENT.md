# Building visual polish agent contract

This is the operational contract for any agent continuing the ViceBlood building-polish initiative.

## Authority

The authoritative runtime boundary is:

- public facade: `phaser/src/rendering/BuildingPresentation.js`
- semantic catalog: `phaser/src/rendering/buildings/BuildingPresentationCatalog.js`
- visual profiles: `phaser/src/rendering/buildings/BuildingVisualProfileCatalog.js`
- silhouette geometry: `phaser/src/rendering/buildings/BuildingSilhouetteGeometry.js`
- planner: `phaser/src/rendering/buildings/BuildingPresentationPlanner.js`
- renderer: `phaser/src/rendering/buildings/BuildingPresentationRenderer.js`
- focused tests: `tests/building-presentation.test.js`

The art-direction authority is [`../BUILDING_VISUAL_POLISH.md`](../BUILDING_VISUAL_POLISH.md). The current task authority is [`../roadmaps/BUILDING_VISUAL_POLISH_ROADMAP.md`](../roadmaps/BUILDING_VISUAL_POLISH_ROADMAP.md).

## Mandatory startup sequence

Before changing code:

1. Read `AGENTS.md`.
2. Read `docs/AGENT_DEVELOPMENT.md`.
3. Read `docs/BUILDING_PRESENTATION.md`.
4. Read `docs/BUILDING_VISUAL_POLISH.md`.
5. Read the roadmap, progress log and status JSON.
6. Confirm the active milestone and next unchecked task.
7. Inspect only the files required by that task.
8. State scope, acceptance criteria and non-goals in the PR/progress entry before implementation.

Do not jump ahead to a later milestone because it looks visually interesting. Finish or explicitly block the active milestone first.

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
- Renderer decides **how planned modules are painted**.
- Visual profile catalog decides **family defaults**.
- Semantic catalog decides **module/archetype contracts**.
- `GameScene` only requests a presentation and draws opt-in labels.

Do not move profile logic into `GameScene`. Do not make renderer decisions from mission state.

### 2. Prefer shared visual primitives

A new visual effect should normally be one of:

- shared shadow helper;
- shared parapet helper;
- shared volume helper;
- shared prop renderer;
- data entry in a visual profile;
- deterministic planner module.

Avoid one-off code for `WARE`, `WORKS`, one hospital, or one club unless explicit authored metadata is the accepted design.

### 3. Separate geometry from polish

A renderer-only shadow may extend beyond the footprint. A planned annex, prop, frontage or service strip may not. Use `moduleFitsBuildingFootprint` and focused tests for all planned geometry.

### 4. Keep normal zoom as the truth

Do not optimize for a close-up screenshot at the expense of gameplay. Detail must remain readable when the player, roads, cars and NPCs are visible together.

### 5. Keep deterministic composition

Never use frame time or unseeded randomness for static building presentation.

## Milestone completion protocol

A milestone may be marked complete only when all are true:

1. code/document deliverables are present;
2. focused automated validation passes;
3. Netlify preview is available;
4. representative screenshots were reviewed against the rubric;
5. roadmap checkboxes are updated;
6. status JSON is updated;
7. an append-only progress entry records evidence, risks and next task.

If visual review is pending, use `implementation-complete / visual-validation-pending`, not `complete`.

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
node --test tests/building-presentation.test.js
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

## Visual review protocol

Capture representative buildings at normal gameplay zoom:

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

Stop and request user review when:

- a milestone requires subjective visual approval;
- two plausible visual directions would change the shared grammar;
- a required profile cannot be inferred safely from current authored metadata;
- a change would alter collision/topology/gameplay;
- the focused suite introduces a new failure;
- the active milestone has met implementation criteria and only visual validation remains.

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
- visual review:

### Known risks
...

### Files changed
...

### Next exact task
...
```

## Rollback policy

Keep changes milestone-bounded. A visual polish commit should be revertible without reverting prior planner, profile or topology work. Never combine unrelated gameplay fixes with this initiative merely to make global CI green.
