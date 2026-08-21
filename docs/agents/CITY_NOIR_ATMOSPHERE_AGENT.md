# City noir atmosphere agent contract

This file is the operational contract for an agent advancing the ViceBlood city-atmosphere initiative on branch `agent/city-noir-atmosphere`.

The canonical visual direction is [`../CITY_NOIR_ATMOSPHERE.md`](../CITY_NOIR_ATMOSPHERE.md). The roadmap is [`../roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md`](../roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md). Machine state is [`../progress/city-noir-atmosphere-status.json`](../progress/city-noir-atmosphere-status.json).

## Prime directive

Advance **exactly one bounded roadmap task at a time**. Do not reinterpret the whole initiative on every run and do not broaden scope merely because adjacent code is easy to change.

The desired result is a darker, wetter, more atmospheric city **using the existing city, building, character and simulation authorities**. Presentation may become richer; gameplay ownership must not move.

## Required startup sequence

Before editing:

1. read repository `AGENTS.md`;
2. read `docs/AGENT_DEVELOPMENT.md`;
3. read `docs/CITY_NOIR_ATMOSPHERE.md`;
4. read `docs/roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md`;
5. read `docs/progress/city-noir-atmosphere-status.json`;
6. read the latest relevant entries in `docs/progress/CITY_NOIR_ATMOSPHERE_PROGRESS.md`;
7. inspect the current state of PR #69 if the next task touches roads, sidewalks, crosswalks, curbs, asphalt wear, drains, cracks, repairs or street-surface presentation;
8. locate the existing authority and its focused tests using `rg` rather than scanning the whole repository.

Then state in the work log or commit notes:

- roadmap task being executed;
- authoritative system/presentation boundary;
- intended files;
- acceptance criteria;
- explicit non-goals.

## Branch rule

Work only on `agent/city-noir-atmosphere` for this initiative unless the user explicitly changes the branch strategy.

Do not merge `main` automatically. Synchronizing/rebasing after an explicit dependency such as PR #69 lands is allowed when necessary, but the agent must preserve the branch’s documentation and report the synchronization in the progress log.

## Dependency gate: PR #69

PR #69 (`City street visual pass`) is an active dependency for street-surface work.

If #69 is not merged:

- do not recreate its asphalt, paving, curb, crosswalk, gutter, drain, crack, repair or worn-paint work;
- do not copy a competing version into this branch;
- select a roadmap task that is demonstrably non-overlapping, or mark the dependent task blocked/waiting;
- record the exact dependency state in the progress log.

If #69 is merged:

- synchronize this branch with the post-merge `main` tree before changing the same presentation boundary;
- treat the merged city-surface implementation as the single authority;
- build atmosphere on top of it instead of replacing it wholesale.

## Bounded-task rule

A single agent iteration should normally do one of:

- one small rendering primitive/policy;
- one light family;
- one reflection family;
- one decal/detail family;
- one district presentation rule;
- one focused test group;
- one review/capture package;
- one bounded correction arising from visual review.

Do not combine several roadmap milestones in one opaque commit.

## User checkpoint cadence

The default execution cadence for this initiative is **task → validate → document → report → wait for user direction**.

After each bounded roadmap task is genuinely complete, the agent must:

1. finish the relevant implementation and validation for that task;
2. update the task document/checklist with what actually shipped and the exact evidence;
3. update `docs/progress/city-noir-atmosphere-status.json` so completed work and the next planned task are explicit;
4. append the relevant progress evidence to `docs/progress/CITY_NOIR_ATMOSPHERE_PROGRESS.md`;
5. update PR #72 when its current-state summary would otherwise become stale;
6. report the completed task, validation state, visual result and next proposed task to the user;
7. **stop before starting the next bounded roadmap task and wait for the user’s indication.**

The only exception is when the user explicitly gives a batch instruction such as “hazlo todo de golpe”, “continúa hasta que necesites mi intervención”, or otherwise clearly asks for autonomous multi-task execution. That instruction temporarily overrides the checkpoint wait for the requested scope only. Even in batch mode, every completed task must still be documented before the agent moves to the next one; batch mode removes only the wait-for-user step, never the documentation step.

A generic “continúa” after a checkpoint authorizes the next bounded task, not the whole remaining roadmap, unless the wording explicitly grants broader autonomy.

## Implementation rules

### Reuse authorities

Before adding a new class or policy, identify whether the behaviour belongs to:

- the existing city-surface renderer/policy;
- building presentation;
- vehicle presentation;
- character presentation;
- a presentation-only atmosphere compositor/helper.

A new helper is acceptable when it composes existing data without taking ownership of gameplay state. A second city model, building model, traffic model or lighting-as-gameplay model is not acceptable.

### Presentation is read-only

Atmosphere code may read:

- visible road/sidewalk/building geometry;
- existing district semantics;
- existing nearby vehicle/NPC state for rendering;
- existing authored IDs and coordinates;
- existing police/vehicle light state where exposed by presentation-safe APIs/events.

It must not mutate gameplay to make a visual effect convenient.

### Determinism

Static detail placement must be deterministic from stable authored identifiers/coordinates and explicit seeds.

Forbidden:

- unseeded `Math.random()` affecting persistent/static visual composition;
- frame-dependent placement that changes when a sector is redrawn;
- decorative props that shift around after camera movement.

### Culling and cost

- Static surface detail should respect the current urban render window/sector boundary.
- Dynamic effects must query only visible/nearby sources.
- Never scan every city object every frame if a streamed/visible collection already exists.
- Particle populations require explicit caps.
- Prefer a small number of composed graphics layers over hundreds of independent animated game objects.

### No fake gameplay props

Decorative signs, litter, steam, puddles and decals are visual unless a separate gameplay task explicitly promotes them.

They must not:

- block movement;
- affect traffic avoidance;
- become interactable;
- create Heat/noise;
- alter pathfinding;
- become mission targets.

### Pure top-down invariant

Do not introduce an isometric camera language. Depth cues must remain compatible with pure overhead geometry.

## Visual quality rules

Every implementation task should improve at least one named rubric category from `CITY_NOIR_ATMOSPHERE.md`.

### Darkness

Do not solve darkness by adding one opaque fullscreen rectangle that destroys local hierarchy. The result must preserve the ability to create bright local events and keep the player, road boundaries and threats readable.

### Lighting

Prefer sparse practical-light pools with distinct roles. Avoid blanket glow, uniform neon edge tracing or overlapping every light until the scene becomes brighter than the baseline.

### Reflections

Reflections are irregular material responses, not perfect copies. Keep them cheap, local and surface-aware.

### Grime/detail

Prefer low-frequency composition. If the procedural algorithm is visibly tiled or noisy at gameplay zoom, reduce density/contrast before adding more variation.

### Colour

A dark neutral base is mandatory. Saturated red, blue and magenta are accents and should remain scarce enough to carry meaning.

## Validation ladder

For every runtime change:

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Add focused unit tests for deterministic geometry/presentation helpers.

Add/extend browser visual coverage only when the changed layer cannot be meaningfully protected by unit tests. Reuse existing city/building review infrastructure when practical rather than creating a parallel test harness.

Use `npm run test:rc` only when the repository guidance calls for it or when final integration becomes cross-cutting enough to justify it.

## Visual validation

Automated tests cannot determine whether the city feels noir. For milestone exits, generate or capture gameplay-scale evidence from representative real-city locations.

A review capture must:

- use normal gameplay zoom;
- avoid debug overlays unless the capture is explicitly diagnostic;
- identify location/building/road IDs where practical;
- include the same or comparable viewpoint before/after when evaluating a visual change;
- be stored/referenced in progress documentation when it gates a milestone.

Intermediate milestones do not require subjective approval to be technically accepted, but the default user-checkpoint cadence still applies between bounded tasks unless the user explicitly enables batch execution.

## Status transitions

Allowed top-level states:

- `planned`
- `autonomous-in-progress`
- `blocked`
- `final-validation-pending`
- `complete`

For a milestone use:

- `planned`
- `waiting-on-dependency`
- `autonomous-in-progress`
- `implementation-complete / automated-validation-pending`
- `complete`
- `blocked`

Update `city-noir-atmosphere-status.json` whenever the exact next task or milestone state changes materially.

Append progress evidence; do not rewrite history to make the path look cleaner.

## Stop conditions

Stop implementation and set/report an appropriate state when:

- a bounded task has been completed/documented and the default checkpoint cadence requires the user’s next indication;
- the next task depends on unmerged #69 and no non-overlapping task remains;
- a requested visual change would require moving gameplay authority;
- tests expose an architecture conflict that cannot be resolved within the bounded task;
- performance regresses materially and the fix would require broad unrelated refactoring;
- the roadmap reaches `final-validation-pending`;
- the user’s subjective decision is required.

Do not invent user approval.

## Commit discipline

Prefer commits that can be understood independently, for example:

- `feat: add presentation-only street light pools`
- `feat: add deterministic wet asphalt reflections`
- `feat: add bounded urban grime decals`
- `test: cover atmosphere geometry determinism`
- `docs: record M3 atmosphere review`

Avoid vague commits such as `polish`, `more vibe`, `fix visuals`, or milestone-wide mega-commits containing unrelated changes.

## Progress entry template

Append a short section to `docs/progress/CITY_NOIR_ATMOSPHERE_PROGRESS.md`:

```md
## YYYY-MM-DD — Mx.y short title

State: `complete | blocked | ...`

Authority:
- ...

Changed:
- ...

Validated:
- ...

Visual result:
- ...

Non-goals preserved:
- ...

Exact next task:
- ...
```

## Final handoff

When all implementation milestones are complete:

1. build the representative gameplay-scale review package;
2. score the acceptance rubric honestly;
3. run the required automated validation;
4. set top-level state to `final-validation-pending`;
5. stop autonomous visual changes;
6. ask for the single final user visual validation;
7. merge only after explicit user approval.
