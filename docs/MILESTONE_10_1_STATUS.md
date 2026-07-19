# Milestone 10.1 — Vertical Slice Release Candidate

_Last updated: 2026-07-19_

## Status

**🟡 Automated release candidate green; final manual browser acceptance, dead-code cleanup and release tag pending.**

Validated gameplay source commit:

```text
f64837e6eab2ec58397593ec8033afb3b8a70eb1
```

Validation run 3 completed successfully on GitHub Actions:

```text
unit-tests    ✅
browser-smoke ✅
```

The validation branch differed from the source commit only by a pull-request note and was closed without merging. The tested gameplay source already lives on `main`.

The release-candidate pass remains feature-frozen. Campaign, vehicle, faction and economy work begins only after the remaining manual acceptance pass.

## Delivered

### Sire-first mission finale

The refuge finale is owned directly by `MissionSystem`:

```text
journalist killed or drained
→ objective changes to return to the refuge
→ player enters the refuge
→ world and input are locked
→ two short sire thought bubbles
→ player dismisses the final bubble
→ mission completes
→ REPORT ACCEPTED opens
```

`returnFinalePending` and `returnFinalePromise` prevent duplicate starts. The result cannot be published while the dialogue promise is unresolved. The finale emits:

- `mission:return-finale-started`
- `mission:return-finale-completed`

Unit and browser coverage verify killed and drained outcomes, premature refuge entry, repeated update calls, input clearing and dialogue-before-report ordering.

### Deterministic Phaser bootstrap

Both playable routes load `phaser/src/app-bootstrap.js` rather than a collection of independent scripts.

The bootstrap attempts sources in this order:

1. pinned local npm dependency: `phaser@3.90.0`;
2. pinned jsDelivr fallback;
3. pinned cdnjs fallback.

CI installs the npm dependency and browser tests require `window.NBD_PHASER_SOURCE === "local"`. Static hosting can still use a pinned fallback when `node_modules` is not deployed.

Runtime readiness is exposed through:

```js
window.NBD_APP_READY
window.NBD_PHASER_SOURCE
```

The query parameter `?rcTest=1` loads test-only instrumentation; normal gameplay does not expose the RC harness.

### Release-candidate browser harness

`ReleaseCandidateHarness` is available only in RC test mode:

```js
window.NBD_RC_HARNESS
```

It advances scenarios through public system APIs and events. It does not assign `mission.step` directly.

Covered scenarios:

- prepare the journalist objective;
- kill the journalist;
- drain the journalist;
- return to the refuge;
- verify the sire-first result order;
- police violence escalation 1 → 2 → 3;
- duplicate police neutralization protection;
- police recovery with restored resilience;
- visible witness versus heard-only `WTF`;
- level-three police/helicopter stress;
- runtime and DOM snapshots.

Task-reveal presentation uses shortened timing only in RC test mode, preserving normal player timing.

### Browser coverage

Playwright passes for:

- both `/` and `/phaser/` boot routes;
- pinned local Phaser ownership;
- one healthy `GameplayRuntime` and no owner conflict;
- click-driven opening dialogue without leaked attack input;
- killed-journalist golden path;
- drained-journalist golden path;
- sire dialogue before `REPORT ACCEPTED`;
- police alert progression 1 → 2 → 3;
- duplicate neutralization protection;
- helicopter activation;
- police recovery;
- visual witness versus heard-only reaction;
- sustained level-three structural/performance smoke;
- pause and task-reveal mouse/wheel lock protection;
- Low and Ultra internal render quality;
- wide-to-narrow resize and finite aim mapping;
- high-contrast aim persistence and keyboard activation;
- semantic HUD state and narrow-layout separation.

### Regressions found and fixed by CI

The first two browser runs were deliberately retained as diagnostic passes. They exposed and led to fixes for:

- continuous pause-modal DOM replacement and unstable focus;
- unreliable Phaser-frame polling for H/M/Escape/Enter UI commands;
- missing first-class weapon-HUD positioning after retiring its legacy module;
- native Enter activation being suppressed by Phaser's global keyboard manager;
- slow software-WebGL timing assumptions in task reveals and stress samples;
- uninitialized combat state in the police-recovery scenario.

The third run passed after those corrections.

### Input cleanup

`FeedingSystem.collectInteractions()` no longer exposes stun or kill through E. Public `kill()` and `stun()` methods remain available to mission logic and automation, but player combat remains:

```text
LMB → equipped attack
RMB → contextual drain
E   → non-combat interaction
```

### UI and accessibility stabilization

- H, M, Escape and Enter UI commands are owned by deterministic DOM keyboard events.
- Dialogue capture still has priority and prevents Escape/click leakage.
- Pause content uses a frozen snapshot, avoiding continuously changing diagnostic markup.
- Modal HTML is replaced only when its source content changes.
- High-contrast aim has explicit Enter/Space keyboard activation.
- Weapon HUD layout is defined in static first-class CSS and remains lower-right on narrow viewports.

### CI

The workflow is split into:

```text
unit-tests
→ browser-smoke
```

The browser job:

- installs exact top-level package versions;
- verifies `node_modules/phaser/dist/phaser.min.js` exists;
- installs Chromium;
- runs the complete RC browser suite;
- uploads Playwright reports and traces only on failure.

## Automated files

- `tests/mission-return-finale.test.js`
- `tests/browser/runtime-smoke.spec.js`
- `tests/browser/mission-golden-path.spec.js`
- `tests/browser/police-stress.spec.js`
- `tests/browser/perception-recovery.spec.js`
- `tests/browser/input-locks.spec.js`
- `tests/browser/render-quality.spec.js`
- `tests/browser/ui-accessibility.spec.js`
- `tests/source-ownership.test.js`
- `tests/no-legacy-e-combat.test.js`

## Pending before ✅

1. Perform one manual full mission on `/` and one on `/phaser/`.
2. Manually inspect normal-speed intro and task-reveal camera movement.
3. Validate mouse-wheel behaviour with a physical mouse and trackpad.
4. Run a longer manual level-three encounter and inspect memory in browser developer tools.
5. Confirm keyboard and screen-reader behaviour in at least one supported desktop browser.
6. Delete superseded unloaded prototype files after the manual pass.
7. Run CI once more after physical dead-code deletion.
8. Tag `v0.1.0-rc.1` only after that final cleanup commit is green.

## Non-goals

Milestone 10.1 does not add:

- vehicles;
- campaign money;
- faction reputation;
- safehouse inventory;
- paid ammunition;
- Retainers;
- new weapons.

Those begin after this release candidate is manually accepted and tagged.
