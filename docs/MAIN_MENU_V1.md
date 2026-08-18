# ViceBlood main menu v1

## Product goal

The title screen sells the urban-vampire fantasy over the real living city. It is a fullscreen product surface, not a framed web demo and not a second game simulation.

## Canonical presentation

- First paint is the clean ivory/red `VICEBLOOD` wordmark over an opaque noir background.
- Once the world is ready, the same persistent HTML title surface reveals the city and presents the wordmark at the browser's top-left.
- Navigation is `CONTINUE`, `NEW NIGHT`, `OPTIONS`, `CREDITS`; `CONTINUE` remains disabled until canonical save semantics exist.
- `OPTIONS` and `CREDITS` use a browser-anchored drawer spanning the full viewport height.
- The gameplay HUD is hidden while the title screen owns focus.
- Mouse movement never rotates the player or moves the combat reticle while the title screen is active.
- Loading the title screen clears inherited Heat/Wanted response state while preserving durable Exposure/evidence and campaign progression.

## Architecture

The title screen is split by responsibility.

### DOM title controller

`phaser/src/ui/TitleScreenController.js` owns all title UI as semantic HTML:

- boot lockup;
- top-left runtime wordmark;
- menu navigation;
- render-quality options;
- credits drawer;
- keyboard and pointer navigation;
- the visual exit into gameplay.

The controller operates one persistent DOM surface, `#viceblood-title-screen`. The boot splash is not removed and replaced with a second UI. Instead, that same surface changes from `boot` to `prepared` to `menu` state.

This removes the old race between an HTML splash, a separately rendered Phaser menu, canvas crop calculations and delayed polling that guessed when layout had settled.

### MainMenuScene

`phaser/src/scenes/MainMenuScene.js` is only a world-preview coordinator. It:

1. obtains the authoritative `GameScene` instance;
2. subscribes to the official Phaser Scene `CREATE` lifecycle event **before** launching it;
3. treats that event as the readiness boundary because it fires after `GameScene.create()` has constructed the world, `GameplayRuntime` and `InputSystem`;
4. freezes Phaser input, world input, pointer aim and combat graphics;
5. asks `TitleScreenController` to reveal the already-positioned DOM menu;
6. restores control when `NEW NIGHT` completes its DOM exit.

If `GameScene` is already active and owns an `InputSystem`, the same activation path runs immediately. There is no polling loop, retry counter or renderer-event dependency.

`MainMenuScene` does not draw text, logos, buttons, panels or gradients. It does not calculate browser crop coordinates.

### First-paint CSS

`phaser/title-screen.css` owns the complete viewport presentation from the first HTML paint:

- fullscreen shell and canvas;
- HUD suppression during title ownership;
- opaque boot cover;
- left noir menu veil;
- stable top-left logo anchoring;
- full-height drawer;
- responsive and reduced-motion behavior.

Because title UI is positioned against the browser viewport rather than internal Phaser coordinates, it cannot be clipped by the 3:2 canvas cover crop.

## No-flicker contract

The handoff is event-driven, not heuristic.

```text
HTML first paint
  -> persistent title surface is already opaque
  -> MainMenuScene subscribes to GameScene CREATE
  -> GameScene launches and completes create()
  -> CREATE event confirms the world and input authority exist
  -> MainMenuScene freezes gameplay input and aim
  -> DOM menu is prepared while the boot cover remains opaque
  -> two browser animation frames commit its final CSS state
  -> boot cover crossfades, revealing the already-positioned top-left menu
```

There is no `getBoundingClientRect()` polling, stable-frame counter, arbitrary splash timeout, game-level post-render dependency or Phaser duplicate of the menu UI.

The earlier persistent-logo failure came from waiting on a game-level `POST_RENDER` callback after the preview authority had already been acquired. On the hosted build, that callback was not completing the title handoff, so the DOM surface remained permanently in `boot`. The production path now uses the Scene `CREATE` event—the actual lifecycle boundary needed here—and cannot be stranded waiting for a later renderer signal.

## Hosted diagnostics

The transition exposes two read-only snapshots in DevTools so a hosted failure is diagnosable instead of appearing as an unexplained frozen logo:

- `window.NBD_MAIN_MENU_READINESS` records the Phaser-side boundary (`waiting-for-game-scene-create`, `game-scene-created`, `presenting-title`, `title-presented` or `failure`).
- `window.NBD_TITLE_SCREEN_STATE` records the DOM-side state (`boot`, `preparing`, `menu`, `exiting`, `world`, `disabled` or `failure`).

These snapshots do not drive the transition. They only report which explicit boundary was reached.

## NEW NIGHT handoff

```text
NEW NIGHT
  -> DOM navigation, logo and noir veil animate away
  -> no black curtain
  -> no camera fade
  -> no GameScene stop or restart
  -> UIScene launches over the existing world
  -> player input, pointer aim and combat presentation restore
  -> only MainMenuScene stops
```

The city visible behind the title is literally the city that receives control.

## Session-start neutrality

The title screen is the boundary between playable sessions. Campaign bootstrap clears the transient Heat/Wanted response snapshot when `MainMenuScene` is active and persists that reset immediately. It does not clear Exposure, evidence, wallet, reputation, territory, inventory or other durable campaign state.

## Assets

Canonical runtime logo: `phaser/assets/ui/viceblood-logo.svg`.

The wordmark is intentionally clean:

- ivory `VICE`;
- deep-red `BLOOD`;
- no fang;
- no scratches or dark streaks;
- no gradients, noise field or background.

## Acceptance checklist

- The first visible frame is the ViceBlood lockup, never the old web shell or HUD.
- The centered boot lockup always progresses to the interactive menu after `GameScene.create()` completes.
- The runtime wordmark is fully visible at the browser top-left.
- Splash-to-menu is a deliberate crossfade with no reframe or flash.
- `OPTIONS` and `CREDITS` reach the absolute top and bottom of the viewport.
- Moving the mouse cannot rotate the hidden player while the title is active.
- No inherited pursuit or response vehicles spawn behind the menu.
- `NEW NIGHT` reveals the same world with no blackout or reset.
- HUD appears only after the title surface exits.
- GitHub Pages and Netlify skip the unavailable hosted `node_modules` Phaser request.
