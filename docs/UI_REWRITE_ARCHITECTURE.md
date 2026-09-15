# ViceBlood — viewport-native interface

## Scope and ownership

The approved title-screen art direction stays in `title-screen.css` and the existing
`TitleScreenController` / `MainMenuScene` flow. All production in-game panels are
rendered by `ui/` (React 19.2 and Radix Dialog/Tabs). The old scaled HUD markup and
vampire render bridges are retired, not layered beneath a second interface.

The game, campaign services, city compiler, save schema and movement remain the
authorities. This change does not upgrade Phaser or add territorial mechanics.
Archived mission-board and campaign-entry fixtures remain outside production boot;
world-space character labels, combat telegraphs and recovery effects stay in Phaser.

## Composition

```
#viceblood-app — actual browser content area
  #game-root — Phaser canvas, cover/crop only
  #game-effects — world blackout below readable interface
  #game-ui — CSS pixels, no root scale
    #interface-root — HUD / React lifecycle
    #ui-overlay-host — Radix windows and focus scopes
  #viceblood-title-screen — preserved title surface
```

`responsive-layout.js` observes the app container and fits only the world canvas.
Render-quality presets do not assign widths, heights or scale to the interface.
The menu camera accounts for the canvas's visible horizontal crop when composing
the player on the right; normal gameplay keeps the existing world viewport rules.

`app-bootstrap.js` awaits the compiled UI module before creating the game. A missing
bundle therefore surfaces through boot failure rather than silently omitting menus.

## Read boundary

`UiStore` publishes detached, immutable snapshots; unchanged snapshots keep their
identity for `useSyncExternalStore`. It never owns saved game data. `UIScene`
projects at a bounded cadence; the heavy domain snapshot is built only while open.
Static city map geometry is passed separately and does not enter per-frame snapshots.

`GameUiReadModel` consumes the existing registry and ledger authority.
`GameUiProjection` exposes HUD values, current interaction options and domain data.
`DomainNavigation` stores only view selection. Ownership, reception/reputation and
general hunting permission are separate fields from their existing services.
Personal donor consent is not a territorial hunting permit.

## Command and input boundary

`UIScene` is the one in-game UI command/lifecycle coordinator. Native React/Radix
controls own DOM activation and tab focus; the coordinator handles menu shortcuts
and resets gameplay edges through the existing InputSystem. There is no new world
keyboard reader, gameplay update loop or persistence owner.

Domain/interaction windows own a scene pause but not the service's `uiPaused`
modal flag. `uiKeyboardOwned` prevents stray gameplay edges. Explicit pause,
ledger, dialogue and garage also assert the modal flag. Only a pause acquired by
this UI is released by it.

Transactions selected from an interaction and carried-blood/mend requests resume
through the existing GameScene POST_UPDATE boundary. They execute once after the
real input frame is unlocked; no code forges `worldEnabled` to bypass a guard.
Opening pause or cleanup cancels a pending request. Real game methods retain their
feeding, frenzy, money, proximity and recovery constraints.

Map selection and Locate change inspection only. Go here validates a destination,
sets the persistent guide through VampireRuntime and closes the domain. Named
locations follow live people. Errand abandonment captures the current job and
requires a separate confirmation; a replaced/stage-changed job is not abandoned by
an old confirmation. Garage repair/recovery remain in their real service.

## Build and validation

```
npm ci --ignore-scripts --no-audit --no-fund
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run build
```

`build:ui` bundles only the web presentation. `build` also produces `dist/` with the
existing game modules/assets, the exact local Phaser distribution, and `build.json`.
No development dependency tree or private radio masters are packaged. Serving the
review directory at localhost enables the existing pinned local-engine boot path.

The dependency change conservatively selects `test:rc`. The user's explicit
no-browser-execution policy remains active; the permitted native/static gate is
run, but the RC/browser suite is not claimed as passed. `ui-rewrite.yml` validates
and uploads a review build. Its separate `prepare-pages` job receives contents-write
permission only to create and hash-check six immutable static blobs and export a
manifest; it never changes a ref, a Pages setting or a PR. Source branches are not
automatically published. The PR gate excludes browser execution on this branch.

After explicit publication approval, combine that exact tested source tree with
the six manifest entries, commit on the existing Pages source branch without force
or PR merging, and verify the Pages deployment. A branch-only `verify-pages` job
checks the public build.json and 16 runtime/assets against committed bytes over
HTTP, allowing up to four minutes for propagation. It does not execute a browser,
read saved games or validate visual layout. Keep build.json's source revision: the
publication commit necessarily differs because it also contains compiled assets.

Radix FocusScope defers unmount autofocus to a zero-delay timer. The DOM tests
flush that lifecycle on close and teardown instead of racing focus restoration.

New native tests exercise stable snapshots, canvas fitting, real campaign/UI
commands, pause restoration, deferred transaction guards and independent district
facts. jsdom tests mount the actual React UI with real campaign snapshots and
commands: tabs, SVG location selection, Locate/Go here, confirmation, escaping,
garage, dialogue and focus return. jsdom does not validate CSS layout or rendering.
Old tests that asserted the removed patch implementation are replaced by these
behavior tests; gameplay/economy/save regressions are retained.

## Required visual review (not automated proof)

Use both entry points and a cold and warm load. Check loading → gesture → title →
New Night with camera centering → HUD → City. Review at 1920×1080, 1366×768,
3440×1440 and narrow/short windows, including different render-quality presets and
browser zoom. Inspect all sections, a real contact transaction, active delivery,
Go here, Escape/M, blood use, garage and the death/recovery dialogue. Confirm no
unreadable fonts, overlaps, scroll traps, missing buttons or world click-through.

The public Pages branch and PR #83 must not be changed merely to make a local
review build visible. Publish only an exact tested revision with source/build
alignment and report visual acceptance separately.
