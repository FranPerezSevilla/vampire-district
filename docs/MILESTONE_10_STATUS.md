# Milestone 10 status

_Last updated: 2026-07-18_

## Status

**🟡 Core implementation complete; automated CI confirmation and full browser/mission regression pending.**

## Delivered

### Architecture

- One gameplay update owner: `GameplayRuntime`.
- Direct `GameScene` and `UIScene` composition.
- First-class input, weapons, combat, damage, drain, movement noise, props, sensory awareness, AI, police violence, task reveal, outskirts, objective guidance and UX systems.
- First-class narrative `TutorialDirector` and sire-first refuge finale.
- Runtime owner diagnostics and source-ownership tests.
- Previous runtime patch stacks removed from both playable HTML boot paths.

### Performance

- Layer-aware `SpatialHash` for nearby NPC queries.
- Camera-margin NPC/marker culling.
- Cached outskirts graphics.
- Change-aware Phaser registry publication.
- Change-aware mission and interaction DOM markup.
- In-browser frame timing and runtime snapshot.

### Testing

- Pure tests for bindings, spatial queries, registry publication and runtime ownership.
- Source tests preventing the old bootstrap stack from returning.
- Direct PoliceSystem regression tests.
- Playwright Chromium smoke tests for `/` and `/phaser/`.
- GitHub Actions unit-test and browser-smoke jobs.

### Input groundwork

- Persistable keyboard-binding contract.
- Normalization, labels, conflict detection, load/save/reset helpers.
- Published binding snapshot used by pause-menu control copy.
- Complete player-facing remapping UI remains a later product decision.

## Current validation boundary

The code and automated suites are committed, but this status remains 🟡 until the same target commit has:

1. a confirmed passing unit-test CI job;
2. a confirmed passing Playwright Chromium job;
3. a complete manual mission run on both playable routes;
4. Low and Ultra render-quality passes;
5. wide, narrow and resized viewport passes;
6. keyboard/accessibility verification;
7. a sustained level-3 police encounter performance check.

## Remaining cleanup boundary

Several superseded prototype source files may still exist as unloaded historical implementation files. The playable HTML no longer imports them and source-ownership tests protect that fact. Physical deletion should be performed only after the consolidated runtime passes CI and the full mission regression, so a verified rollback remains possible during the transition.

## Next product work after validation

Once Milestone 10 becomes ✅, the next roadmap decision is content-focused rather than architectural. Candidate directions are:

- weapon pickup/reload/economy progression;
- a second mission and reusable objective scripting;
- additional district interiors or a second district;
- art/audio production pass;
- save/load campaign progression;
- a complete in-game input remapping screen.
