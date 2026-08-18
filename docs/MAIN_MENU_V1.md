# ViceBlood main menu v1

## Goal

Introduce a production-facing title screen that sells the urban vampire fantasy without creating a second gameplay or rendering authority.

The visual target is **urban noir rather than gothic fantasy**: ViceBlood should open on a living city, with the vampire framed as a small predatory presence inside it.

## Locked direction

- Pure top-down city imagery, consistent with the game itself.
- Large, aggressive `VICEBLOOD` wordmark: pale distressed `VICE`, deep red `BLOOD`, restrained fang cue.
- Minimal menu surface: `CONTINUE`, `NEW NIGHT`, `OPTIONS`, `CREDITS`.
- `NEW NIGHT` is the default selection.
- No ornate gothic frames, cathedral imagery, bats or dripping-blood UI chrome.
- The city remains the visual star; UI occupies roughly the left third of the composition.
- Menu copy stays crisp and scalable rather than relying on raster button art.

## Runtime implementation

`MainMenuScene` is a presentation/composition layer only.

Normal boot:

```text
BootScene
  -> MainMenuScene
      -> launch GameScene
      -> pause GameScene
      -> render menu over the real game world

NEW NIGHT
  -> resume GameScene
  -> launch UIScene
  -> stop MainMenuScene
```

`GameScene` remains the single gameplay authority. The menu does not reimplement traffic, NPCs, city geometry, player state or simulation.

The release-candidate browser test profile (`window.NBD_RC_TEST_MODE`) keeps the previous direct `GameScene + UIScene` boot so the existing automated gameplay suite does not become dependent on menu navigation.

## V1 interaction

Keyboard:

- `Up` / `W`: previous item.
- `Down` / `S`: next item.
- `Enter` / `Space`: activate.
- `Esc`: close options/credits panel.

Mouse hover and click are supported on enabled items.

`CONTINUE` is intentionally present but disabled until save-slot/menu semantics are connected deliberately to campaign persistence.

`OPTIONS` currently explains where resolution controls live. It is intentionally not a second settings authority. Audio/accessibility/gameplay settings can migrate into the panel when their existing owners expose stable menu-facing contracts.

## Art

The first logo asset is `phaser/assets/ui/viceblood-logo.svg`.

It translates the approved generated concept into a lightweight, scalable runtime asset: condensed distressed lettering, pale `VICE`, dark crimson `BLOOD`, and a subtle fang treatment on the `V`.

The generated concept remains the visual reference for later polish. The production asset should remain readable first; texture and damage must never compromise the wordmark at normal menu size.

## Future polish, not part of v1

- Choose and lock a particularly strong rooftop/city camera composition for the menu preview.
- Add menu-specific ambient audio mix and rare city one-shots.
- Add restrained steam/rain/neon motion where the gameplay scene does not already provide it.
- Connect `CONTINUE` to the canonical campaign save authority.
- Move stable settings into `OPTIONS` without duplicating their existing owners.
- Add a seamless camera/UX transition from menu composition into active player control if it can be done without mutating gameplay authority during preview.

## Non-goals

- No new gameplay loop.
- No duplicate city simulation.
- No new save system.
- No redesign of the production HUD.
- No city compiler or generated-geometry changes.
- No replacement of existing gameplay sprites or environment assets in this PR.
