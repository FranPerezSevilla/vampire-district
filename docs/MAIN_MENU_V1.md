# ViceBlood main menu v1

## Goal

Introduce a production-facing title screen that sells the urban vampire fantasy without creating a second gameplay or rendering authority.

The visual target is **urban noir rather than gothic fantasy**: ViceBlood opens on the real living city, with the menu presented as a clean title layer rather than a framed web demo.

## Locked direction

- Fullscreen presentation: no outer web frame, top bar or build notes.
- Pure top-down city imagery, consistent with the game itself.
- Large `VICEBLOOD` wordmark: pale distressed `VICE`, deep red `BLOOD`, restrained fang cue.
- The main-menu wordmark remains fully visible at the **top-left**, above navigation.
- Minimal main navigation: `CONTINUE`, `NEW NIGHT`, `OPTIONS`, `CREDITS`.
- `NEW NIGHT` is the default selection.
- `OPTIONS` and `CREDITS` use a left drawer that covers the **entire browser-visible height**.
- No ornate gothic frames, cathedral imagery, bats or dripping-blood UI chrome.
- The city remains clearly visible; the left noir veil exists only to protect menu readability.
- Mouse movement must never rotate the player or move the gameplay reticle while the title screen owns input.

## Runtime implementation

`MainMenuScene` is only a presentation/composition layer over the authoritative `GameScene`.

Normal boot:

```text
HTML first paint
  -> fitted fullscreen ViceBlood splash
  -> BootScene
  -> MainMenuScene
      -> switch shell to fullscreen menu mode
      -> hide gameplay HUD/page chrome
      -> launch the authoritative GameScene
      -> keep ambient city streaming/traffic alive
      -> freeze Phaser input + ViceBlood world input + pointer aim
      -> reveal the composed menu
```

`GameScene` remains the single gameplay authority. The title screen never creates a duplicate city simulation.

### NEW NIGHT: seamless handoff

The menu preview is now the actual scene that becomes gameplay.

```text
NEW NIGHT
  -> menu/logo/veil slide and fade away
  -> NO black curtain
  -> NO camera fade-to-black
  -> NO GameScene stop
  -> NO GameScene restart
  -> launch UIScene on top of the already-running world
  -> restore InputSystem, pointer aim and combat presentation
  -> switch from fullscreen-menu CSS to fullscreen-world CSS
  -> stop only MainMenuScene
```

This means cars, pedestrians and the visible city do not jump to a fresh state when the player starts. The world seen behind the menu is literally the world that receives control.

The fullscreen presentation also remains active after the handoff, so removing the menu does not cause the canvas to snap back into the old framed web-demo layout. The gameplay HUD becomes visible on top of the same fullscreen world.

## Input ownership

The live city must continue to feel alive without letting the hidden player react to menu input.

While `MainMenuScene` is active:

- Phaser `GameScene.input.enabled` is false.
- ViceBlood `InputSystem.worldEnabled` is false.
- `pointerWorldPoint` is temporarily pinned to the player's own position.
- combat aim graphics are hidden.
- city streaming, traffic and other ambient systems may continue updating.

At the seamless handoff all captured input state is restored before `MainMenuScene` stops.

## Fullscreen crop / safe viewport

The internal game surface is 3:2 while desktop browser windows are commonly wider. The canvas therefore uses CSS cover sizing and is vertically cropped on widescreen displays.

The menu must **not infer that crop from aspect-ratio maths alone**. Browser CSS layout is the source of truth.

`MainMenuScene.visibleViewportBounds()` reads the actual post-layout canvas rectangle with `canvas.getBoundingClientRect()` and maps the browser-visible intersection back into internal Phaser coordinates. Logo, navigation, footer and panel content are anchored to those measured bounds.

Layout is recalculated on:

- Phaser resize;
- browser resize;
- `visualViewport` resize when available;
- two animation frames after entering fullscreen, so CSS cover sizing has definitely settled.

The wordmark has an explicit safe inset from the measured visible top and left edges.

## Full-height submenu contract

`OPTIONS` and `CREDITS` content is positioned within the measured visible crop, but their dark backdrop and red boundary rule deliberately extend through the **entire internal canvas height**. Because the canvas itself covers the browser, the drawer cannot end early above the bottom edge due to rounding or crop calculations.

## Options

Render quality belongs inside `OPTIONS`; the old page-header selector is removed.

Available presets:

- `LOW` — 960 × 640 internal target.
- `HIGH` — 1280 × 853.
- `VERY HIGH` — 1440 × 960.
- `ULTRA` — 1920 × 1280.

The option writes the existing `nbd-resolution-preset` preference and reloads, preserving one resolution authority.

## Art

Runtime logo: `phaser/assets/ui/viceblood-logo.svg`.

The SVG intentionally avoids full-surface procedural turbulence. The earlier `feTurbulence` treatment generated a visible rectangular noisy field behind the wordmark in browsers. Distress is represented only by authored scratches/marks, leaving the surrounding asset transparent.

The HTML splash constrains the wordmark with `object-fit: contain` and a viewport-relative maximum height so it remains complete across aspect ratios.

## Acceptance checklist

- Splash wordmark is complete and has no rectangular noise field.
- Main-menu wordmark is complete and visibly inset from the top-left browser edge.
- `OPTIONS` / `CREDITS` backdrop reaches the absolute top and bottom of the viewport.
- Moving the mouse over the menu never affects player aim.
- `NEW NIGHT` reveals the same running city with no blackout and no simulation reset.
- HUD appears only after the world handoff.
- Gameplay remains fullscreen after the title UI disappears.

## Future polish

- Lock a deliberately authored rooftop/city camera composition rather than relying on the initial free-roam spawn camera.
- Add menu-specific ambient audio mix and rare city one-shots.
- Add restrained steam/rain/neon motion where gameplay does not already provide it.
- Connect `CONTINUE` to canonical campaign persistence.
- Add audio/accessibility options once their runtime owners expose stable menu-facing settings.

## Non-goals

- No duplicate city simulation.
- No new save system.
- No production HUD redesign.
- No city compiler/generated-geometry changes.
- No broad sprite/environment replacement in this PR.
