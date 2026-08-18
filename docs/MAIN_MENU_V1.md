# ViceBlood main menu v1

## Goal

Introduce a production-facing title screen that sells the urban vampire fantasy without creating a second gameplay or rendering authority.

The visual target is **urban noir rather than gothic fantasy**: ViceBlood opens on the real living city, with the menu presented as a clean title layer rather than a framed web demo.

## Locked direction

- Fullscreen presentation while the title screen is active: no outer web frame, top bar, build notes or gameplay HUD.
- Pure top-down city imagery, consistent with the game itself.
- Large `VICEBLOOD` wordmark: pale distressed `VICE`, deep red `BLOOD`, restrained fang cue.
- In the actual main menu the wordmark remains visible at the **top-left**, above the navigation.
- Minimal main navigation: `CONTINUE`, `NEW NIGHT`, `OPTIONS`, `CREDITS`.
- `NEW NIGHT` is the default selection.
- `OPTIONS` and `CREDITS` use a full-height left drawer rather than a floating card.
- No ornate gothic frames, cathedral imagery, bats or dripping-blood UI chrome.
- The city remains clearly visible; the left noir veil exists only to protect menu readability.
- Menu copy stays crisp and scalable rather than relying on raster button art.

## Runtime implementation

`MainMenuScene` remains a presentation/composition layer over the authoritative game world.

Normal boot:

```text
HTML first paint
  -> fullscreen ViceBlood splash (no legacy shell/HUD flash)
  -> BootScene
  -> MainMenuScene
      -> switch page shell to fullscreen menu mode
      -> hide gameplay HUD and page chrome
      -> launch GameScene
      -> keep GameScene running so city streaming and ambient traffic populate
      -> disable GameScene world input and pointer aim while the title screen owns controls
      -> reveal menu once the composed scene is ready

NEW NIGHT
  -> fade menu controls
  -> start the live-city camera zoom
  -> keep the ViceBlood logo visible through most of the zoom
  -> fade the logo into black
  -> restart GameScene from a clean state
  -> launch UIScene
  -> restore normal page/game presentation
  -> stop MainMenuScene
```

`GameScene` remains the single gameplay authority. The menu does not reimplement traffic, NPCs, city geometry or player state.

The live preview deliberately keeps enough simulation running to make the city feel alive, but both Phaser scene input and ViceBlood's canvas-level `InputSystem` world controls are blocked. The preview temporarily resolves mouse aim to the player's own position and hides combat aim graphics, so moving the mouse over menu items cannot rotate the character or move the gameplay reticle.

The fullscreen canvas uses cover sizing and can crop the internal 3:2 render surface on widescreen displays. Menu layout therefore computes the **actually visible internal viewport** and anchors the logo, navigation, footer and full-height drawers inside those visible bounds. This prevents the top-left wordmark from disappearing above the crop.

The release-candidate browser test profile (`window.NBD_RC_TEST_MODE`) keeps direct `GameScene + UIScene` boot so the existing automated gameplay suite does not depend on menu navigation.

## V1 interaction

Main navigation:

- `Up` / `W`: previous item.
- `Down` / `S`: next item.
- `Enter` / `Space`: activate.
- `Esc`: close options/credits.
- Mouse hover/click is supported for menu UI only; gameplay aim is frozen while the title screen is active.

`CONTINUE` remains intentionally disabled until save-slot/menu semantics are connected deliberately to campaign persistence.

## Options

Render quality belongs inside `OPTIONS`; the old page-header selector is removed.

Available presets:

- `LOW` — 960 × 640 internal target.
- `HIGH` — 1280 × 853.
- `VERY HIGH` — 1440 × 960.
- `ULTRA` — 1920 × 1280.

The option writes the existing `nbd-resolution-preset` preference and reloads, so there is still one resolution authority rather than a second settings system.

## Art

Runtime logo: `phaser/assets/ui/viceblood-logo.svg`.

The loader path is rooted from the production page (`phaser/assets/...`) so Netlify/GitHub Pages resolve the asset correctly.

The SVG intentionally avoids full-surface procedural turbulence. The earlier `feTurbulence` treatment generated a visible rectangular noisy field behind the wordmark in browsers. Distress is now represented only by authored scratches/marks, keeping the surrounding asset genuinely transparent. The SVG viewBox also includes explicit side breathing room to prevent edge clipping.

The HTML splash constrains the logo with `object-fit: contain` and a viewport-relative maximum height so the wordmark remains complete across widescreen and taller displays.

## Visual acceptance history

The first Netlify preview was rejected because it rendered inside the old web frame, exposed gameplay HUD chrome, kept render quality outside `OPTIONS`, failed to load the logo, over-darkened the city and paused streaming too early.

Later review identified four additional presentation defects that are now part of the contract:

- splash wordmark must never be cropped;
- the logo asset must have no rectangular noise field;
- the final main-menu wordmark stays visible at top-left despite fullscreen canvas cropping;
- submenu panels use the full visible vertical dimension;
- mouse movement must never control player aim while the main menu owns input.

## Future polish

- Lock a deliberately authored rooftop/city camera composition rather than relying on the initial free-roam spawn camera.
- Add menu-specific ambient audio mix and rare city one-shots.
- Add restrained steam/rain/neon motion where the gameplay scene does not already provide it.
- Connect `CONTINUE` to canonical campaign persistence.
- Add audio/accessibility options once their runtime owners expose stable menu-facing settings.

## Non-goals

- No duplicate city simulation.
- No new save system.
- No production HUD redesign.
- No city compiler/generated-geometry changes.
- No broad sprite/environment replacement in this PR.
