# Milestone 10 status

_Last updated: 2026-07-19_

## Status

**🟡 Core implementation and automated CI validation complete; final manual acceptance and dead-code cleanup pending.**

Validated gameplay source:

```text
f64837e6eab2ec58397593ec8033afb3b8a70eb1
```

GitHub Actions validation run 3 passed both jobs:

```text
unit-tests    ✅
browser-smoke ✅
```

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
- Playwright Chromium coverage for `/` and `/phaser/`.
- Killed and drained journalist golden paths.
- Sire dialogue before `REPORT ACCEPTED`.
- Police alert 1 → 2 → 3, helicopter and duplicate-neutralization coverage.
- Police recovery and sight/hearing split coverage.
- Pause/task input locks, Low/Ultra, resizing, accessibility and narrow HUD coverage.
- GitHub Actions unit-test and browser-smoke jobs passing on the validated source.

### Input groundwork

- Persistable keyboard-binding contract.
- Normalization, labels, conflict detection, load/save/reset helpers.
- Published binding snapshot used by pause-menu control copy.
- Deterministic DOM ownership for H, M, Escape and Enter UI commands.
- Complete player-facing remapping UI remains a later product decision.

## Current validation boundary

Automated release-candidate acceptance is green. Milestone 10 remains 🟡 until the manual pass confirms:

1. one complete mission on `/`;
2. one complete mission on `/phaser/`;
3. normal-speed intro and task-reveal camera feel;
4. physical mouse-wheel and trackpad behaviour;
5. a longer level-3 police encounter with memory inspection;
6. keyboard and screen-reader behaviour in at least one desktop browser.

## Remaining cleanup boundary

Several superseded prototype source files remain as unloaded historical implementation files. The playable HTML no longer imports them and source-ownership tests protect that fact. Physical deletion will occur after manual acceptance, followed by one final CI run.

## Release boundary

After manual acceptance and dead-code deletion:

```text
final cleanup commit
→ unit + browser CI
→ tag v0.1.0-rc.1
```

## Next product work after validation

The next planned milestone is **Milestone 11 — Campaign foundation**:

- data-driven missions;
- cash and transaction ledger;
- original faction/contact reputation;
- persistent campaign state;
- carried inventory and refuge records;
- save/load foundation.

Vehicle core follows immediately in Milestone 12.
