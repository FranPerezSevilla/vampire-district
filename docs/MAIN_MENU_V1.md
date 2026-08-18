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

`phaser/src/scenes/MainMenuScene.js` is now only a world-preview coordinator. It:

1. launches the authoritative `GameScene`;
2. waits until its input authority exists;
3. freezes Phaser input, world input, pointer aim and combat graphics;
4. waits for two explicit Phaser post-render frames;
5. asks `TitleScreenController` to reveal the already-positioned DOM menu;
6. restores control when `NEW NIGHT` completes its DOM exit.

It does not draw text, logos, buttons, panels or gradients. It does not calculate browser crop coordinates.

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
  -> Phaser and GameScene boot behind it
  -> MainMenuScene acquires and freezes input authority
  -> two actual Phaser post-render frames complete
  -> DOM menu is prepared while still covered
  -> two browser animation frames commit its CSS state
  -> boot cover crossfades, revealing the already-positioned top-left menu
```

There is no `getBoundingClientRect()` polling, stable-frame counter, arbitrary splash timeout or Phaser duplicate of the menu UI.

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
- The runtime wordmark is fully visible at the browser top-left.
- Splash-to-menu is a deliberate crossfade with no reframe or flash.
- `OPTIONS` and `CREDITS` reach the absolute top and bottom of the viewport.
- Moving the mouse cannot rotate the hidden player while the title is active.
- No inherited pursuit or response vehicles spawn behind the menu.
- `NEW NIGHT` reveals the same world with no blackout or reset.
- HUD appears only after the title surface exits.
- GitHub Pages and Netlify skip the unavailable hosted `node_modules` Phaser request.
