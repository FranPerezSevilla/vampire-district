# ViceBlood main menu v1

## Goal

Introduce a production-facing title screen that sells the urban vampire fantasy without creating a second gameplay or rendering authority.

The visual target is **urban noir rather than gothic fantasy**: ViceBlood opens on the real living city, with the menu presented as a clean title layer rather than a framed web demo.

## Locked direction

- Fullscreen presentation while the title screen is active: no outer web frame, top bar, build notes or gameplay HUD.
- Pure top-down city imagery, consistent with the game itself.
- Large `VICEBLOOD` wordmark: pale distressed `VICE`, deep red `BLOOD`, restrained fang cue.
- Minimal main navigation: `CONTINUE`, `NEW NIGHT`, `OPTIONS`, `CREDITS`.
- `NEW NIGHT` is the default selection.
- No ornate gothic frames, cathedral imagery, bats or dripping-blood UI chrome.
- The city remains clearly visible; the left noir veil exists only to protect menu readability.
- Menu copy stays crisp and scalable rather than relying on raster button art.

## Runtime implementation

`MainMenuScene` remains a presentation/composition layer over the authoritative game world.

Normal boot:

```text
BootScene
  -> MainMenuScene
      -> switch page shell to fullscreen menu mode
      -> hide gameplay HUD and page chrome
      -> launch GameScene
      -> keep GameScene running so city streaming, traffic and NPCs populate
      -> disable GameScene input while the title screen owns controls

NEW NIGHT
  -> fade title layer
  -> restart GameScene from a clean state
  -> launch UIScene
  -> restore normal page/game presentation
  -> stop MainMenuScene
```

The first implementation paused `GameScene` immediately. That prevented parts of the streamed city from materializing and produced an almost black/static background. The accepted revision keeps the simulation alive but blocks gameplay input, then restarts the game when `NEW NIGHT` is chosen.

`GameScene` remains the single gameplay authority. The menu does not reimplement traffic, NPCs, city geometry or player state.

The release-candidate browser test profile (`window.NBD_RC_TEST_MODE`) keeps direct `GameScene + UIScene` boot so the existing automated gameplay suite does not depend on menu navigation.

## V1 interaction

Main navigation:

- `Up` / `W`: previous item.
- `Down` / `S`: next item.
- `Enter` / `Space`: activate.
- `Esc`: close options/credits.
- Mouse hover/click is supported.

`CONTINUE` remains intentionally disabled until save-slot/menu semantics are connected deliberately to campaign persistence.

## Options

Render quality now belongs inside `OPTIONS`; the old page-header selector is removed.

Available presets:

- `LOW` — 960 × 640 internal target.
- `HIGH` — 1280 × 853.
- `VERY HIGH` — 1440 × 960.
- `ULTRA` — 1920 × 1280.

The option writes the existing `nbd-resolution-preset` preference and reloads, so there is still one resolution authority rather than a second settings system.

## Art

Runtime logo: `phaser/assets/ui/viceblood-logo.svg`.

The loader path is rooted from the production page (`phaser/assets/...`) so Netlify/GitHub Pages resolve the asset correctly. The first preview incorrectly used `assets/...`, which produced the missing-texture rectangle seen during validation.

The production logo remains a scalable translation of the approved generated concept: condensed distressed lettering, pale `VICE`, dark crimson `BLOOD`, and a subtle fang treatment on the `V`.

## Visual acceptance notes from first preview

The first Netlify preview was rejected because it:

- rendered inside the old web frame instead of fullscreen;
- exposed Hunger, Police, Mission, Ledger and menu HUD chrome on the title screen;
- kept render quality outside `OPTIONS`;
- failed to load the logo;
- over-darkened the city with a 76% global veil;
- paused the live game before city streaming had populated the background;
- left the navigation visually underdeveloped.

Those are implementation defects, not the target look, and are explicitly guarded by the revised menu contract.

## Future polish

- Lock a deliberately authored rooftop/city camera composition rather than relying on the initial free-roam spawn camera.
- Add menu-specific ambient audio mix and rare city one-shots.
- Add restrained steam/rain/neon motion where the gameplay scene does not already provide it.
- Connect `CONTINUE` to canonical campaign persistence.
- Add audio/accessibility options once their runtime owners expose stable menu-facing settings.
- Consider a seamless camera transition into player control once the menu composition itself is accepted.

## Non-goals

- No duplicate city simulation.
- No new save system.
- No production HUD redesign.
- No city compiler/generated-geometry changes.
- No broad sprite/environment replacement in this PR.
