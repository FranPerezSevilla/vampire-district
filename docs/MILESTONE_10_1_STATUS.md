# Milestone 10.1 — Vertical Slice Release Candidate

_Last updated: 2026-07-19_

## Status

**🟡 Implementation and automated coverage complete; remote CI confirmation and final manual browser pass pending.**

The release-candidate pass is intentionally feature-frozen. It validates the current vertical slice before campaign, vehicle, faction and economy work begins.

## Delivered

### Sire-first mission finale

The refuge finale is now owned directly by `MissionSystem`:

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

Unit coverage verifies killed and drained outcomes, premature refuge entry, repeated update calls and dialogue-before-report ordering.

### Deterministic Phaser bootstrap

Both playable routes now load `phaser/src/app-bootstrap.js` rather than a collection of independent scripts.

The bootstrap attempts sources in this order:

1. pinned local npm dependency: `phaser@3.90.0`;
2. pinned jsDelivr fallback;
3. pinned cdnjs fallback.

CI installs the npm dependency and browser tests require `window.NBD_PHASER_SOURCE === "local"`. Public static hosting can still use a pinned CDN fallback when `node_modules` is not deployed.

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
- level-three police/helicopter stress;
- runtime and DOM snapshots.

Task-reveal presentation uses shortened timing only in RC test mode, preserving normal player timing.

### Browser coverage

Playwright now covers:

- both `/` and `/phaser/` boot routes;
- pinned local Phaser ownership;
- one healthy `GameplayRuntime` and no owner conflict;
- click-driven opening dialogue without leaked attack input;
- killed-journalist golden path;
- drained-journalist golden path;
- sire dialogue before `REPORT ACCEPTED`;
- police alert progression 1 → 2 → 3;
- helicopter activation;
- a sustained level-three structural/performance smoke test;
- pause and task-reveal mouse/wheel lock protection;
- Low and Ultra internal render quality;
- wide-to-narrow resize and finite aim mapping;
- high-contrast aim persistence;
- semantic HUD state and narrow-layout separation.

### Input cleanup

`FeedingSystem.collectInteractions()` no longer exposes stun or kill through E. Public `kill()` and `stun()` methods remain available to mission logic and automation, but player combat remains:

```text
LMB → equipped attack
RMB → contextual drain
E   → non-combat interaction
```

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
- uploads Playwright report and traces on failure.

## Automated files

- `tests/mission-return-finale.test.js`
- `tests/browser/runtime-smoke.spec.js`
- `tests/browser/mission-golden-path.spec.js`
- `tests/browser/police-stress.spec.js`
- `tests/browser/input-locks.spec.js`
- `tests/browser/render-quality.spec.js`
- `tests/browser/ui-accessibility.spec.js`
- `tests/source-ownership.test.js`
- `tests/no-legacy-e-combat.test.js`

## Pending before ✅

1. Confirm the GitHub Actions unit job on the final target commit.
2. Confirm the GitHub Actions Playwright job on the same commit.
3. Perform one manual full mission on `/` and one on `/phaser/`.
4. Manually inspect normal-speed task reveals and tutorial camera movement.
5. Validate mouse wheel behaviour with a physical mouse and trackpad.
6. Run a longer manual level-three encounter and inspect memory in browser developer tools.
7. Confirm keyboard and screen-reader behaviour in at least one supported desktop browser.
8. Delete superseded unloaded prototype files only after the above passes.
9. Tag `v0.1.0-rc.1` after the final target commit is green.

## Non-goals

Milestone 10.1 does not add:

- vehicles;
- campaign money;
- faction reputation;
- safehouse inventory;
- paid ammunition;
- Retainers;
- new weapons.

Those begin after this release candidate is validated.
