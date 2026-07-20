# Milestone 10.1 — Vertical Slice Release Candidate

_Last updated: 2026-07-20_

## Status

**🟡 Automated release candidate and physical dead-code cleanup green; final manual acceptance and release tag pending.**

Cleanup validation source:

```text
7e311aa1119603c5b7cdca5040ee8a90699dd0a5
```

GitHub Actions run `348` completed successfully:

```text
unit-tests    ✅
browser-smoke ✅
```

The release-candidate pass remains feature-frozen. Campaign, vehicle, faction and economy work may be developed on separate branches, but `v0.1.0-rc.1` is not tagged until the remaining physical-device and manual acceptance checks are recorded.

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
→ closing the report restores full free roam
```

`returnFinalePending` and `returnFinalePromise` prevent duplicate starts. The result cannot be published while the dialogue promise is unresolved. The finale emits:

- `mission:return-finale-started`
- `mission:return-finale-completed`

Unit and browser coverage verify killed and drained outcomes, premature refuge entry, repeated update calls, input clearing, dialogue-before-report ordering and working weapons after the report closes.

### Deterministic Phaser bootstrap

Both playable routes load `phaser/src/app-bootstrap.js`.

The bootstrap attempts Phaser sources in this order:

1. pinned local npm dependency: `phaser@3.90.0`;
2. pinned jsDelivr fallback;
3. pinned cdnjs fallback.

CI installs the npm dependency and browser tests require `window.NBD_PHASER_SOURCE === "local"`. Runtime readiness is exposed through:

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
- verify armed and unarmed free roam after `REPORT ACCEPTED`;
- police violence escalation 1 → 2 → 3;
- duplicate police-neutralization protection;
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
- post-report weapon cycling and unarmed impacts;
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

### Physical dead-code deletion

Thirty superseded source files were physically removed rather than merely left unloaded. The deletion covers the previous:

- input and movement runtime adapters;
- combat and police-alert compatibility patches;
- Milestone 8 AI guards;
- weapon and Milestone 9 UI patches;
- old tutorial, copy and dialogue patch stack;
- old objective-marker, outskirts and sensory-awareness implementations;
- compatibility/no-op bootstraps.

The active bootstrap imports `responsive-layout.js` directly. `tests/source-ownership.test.js` now fails if any retired file reappears.

Obsolete tests that existed only to exercise deleted wrappers were removed or replaced with tests against the first-class `PoliceSystem`, `InputSystem` and `MissionSystem` implementations.

### Regressions found during cleanup

The cleanup CI initially exposed tests that still imported deleted adapters. Those tests were migrated or removed before the green run:

- movement input is now tested directly through `InputSystem`;
- police leader hold and containment facing are tested against `PoliceSystem`;
- the redundant old finale helper test was removed because `mission-return-finale.test.js` covers the first-class mission path.

CI now preserves `unit-test.log` as a seven-day artifact whenever the unit job fails, making future source-cleanup failures diagnosable without relying on truncated console output.

### Input cleanup

`FeedingSystem.collectInteractions()` no longer exposes stun or kill through E. Public `kill()` and `stun()` methods remain available to mission logic and automation, but player combat remains:

```text
LMB → equipped attack
RMB → contextual drain
E   → non-combat interaction
```

### UI and accessibility stabilization

- H, M, Escape and Enter UI commands are owned by deterministic DOM keyboard events.
- Dialogue capture has priority and prevents Escape/click leakage.
- Pause content uses a frozen snapshot, avoiding continuously changing diagnostic markup.
- Modal HTML is replaced only when its source content changes.
- High-contrast aim has explicit Enter/Space keyboard activation.
- Weapon HUD layout is first-class CSS and remains lower-right on narrow viewports.

## Automated files

- `tests/mission-return-finale.test.js`
- `tests/ai-police-formation-runtime.test.js`
- `tests/input-system.test.js`
- `tests/browser/runtime-smoke.spec.js`
- `tests/browser/mission-golden-path.spec.js`
- `tests/browser/post-mission-free-roam.spec.js`
- `tests/browser/police-stress.spec.js`
- `tests/browser/perception-recovery.spec.js`
- `tests/browser/input-locks.spec.js`
- `tests/browser/render-quality.spec.js`
- `tests/browser/ui-accessibility.spec.js`
- `tests/source-ownership.test.js`
- `tests/no-legacy-e-combat.test.js`

## Pending before ✅ and `v0.1.0-rc.1`

1. Complete one normal-timing manual mission on `/` and one on `/phaser/`.
2. Inspect normal-speed intro and task-reveal camera movement.
3. Validate wheel behaviour with a physical mouse and a trackpad.
4. Run a longer manual level-three encounter and inspect memory in browser developer tools.
5. Confirm keyboard and screen-reader behaviour in at least one supported desktop-browser combination.
6. Create the `v0.1.0-rc.1` tag after those checks are recorded.

## Non-goals

Milestone 10.1 does not add:

- vehicles;
- campaign money;
- faction reputation;
- safehouse inventory;
- paid ammunition;
- Retainers;
- new weapons.

Those begin in Milestone 11 and later branches after the release-candidate runtime is protected by the green cleanup suite.
