# Tutorial UX and accessibility

_Status: Milestone 9 implementation complete; browser regression and tuning remain pending._

## Purpose

Milestone 9 teaches the systems added after the original rooftop tutorial without adding another long dialogue sequence. It also makes the HUD and aiming easier to read without relying exclusively on colour.

The implementation has four goals:

1. teach mouse-wheel weapon cycling at the first moment the player has full control;
2. explain police/hunter recovery at the moment it becomes relevant;
3. remove HUD overlap and expose meaningful assistive-technology labels;
4. provide an optional high-contrast aim presentation.

## Authoritative files

- `phaser/src/data/ux-guidance.js` — pure tutorial phase, recovery countdown and aim-presentation rules.
- `phaser/src/systems/UxGuidanceSystem.js` — compact guidance strip, recovery labels and first-use event handling.
- `phaser/src/ux/milestone9-runtime.js` — scene integration, high-contrast reticle and accessible pause-menu controls.
- `phaser/src/movement-controls.js` — loads the Milestone 9 runtime after weapon and AI systems.
- `tests/ux-guidance.test.js` — pure preference, first-use and recovery-presentation coverage.
- `docs/MILESTONE_9_REGRESSION.md` — manual browser acceptance matrix.

## First-use weapon tutorial

The opening rooftop tutorial remains entirely Unarmed. Weapon cycling is still suppressed by the tutorial control modes.

After the police informant leaves, full control is restored and any task-reveal cinematic has closed. At that point a compact, non-blocking strip appears:

```text
WHEEL · Change weapon. Scroll once to equip the Iron Pipe or Pistol.
```

Rules:

- the world remains interactive;
- the strip does not pause movement, combat or traversal;
- the weapon HUD receives a visible attention pulse;
- dialogue, pause, task reveals, transitions and interaction menus hide the strip;
- the first successful `weapon:changed` event completes this teaching step;
- the player then receives a brief `LMB` confirmation describing the equipped weapon and attack input;
- cycling before the strip becomes visible still counts, preventing a stale tutorial prompt.

The guidance is event-driven. It does not read raw wheel input or create a second input path.

## Enemy recovery teaching

Police and hunters can recover after being downed, while civilians, the journalist and rooftop thug remain down permanently.

The first time a recoverable enemy is downed, a compact message appears:

```text
DOWN · Police and hunters recover if left down. Drain or finish them before the timer ends.
```

Every downed recoverable enemy also receives a world-space countdown:

```text
POLICE RISES 18s
HUNTER RISES 24s
```

Presentation rules:

- the countdown is shown only on the current world layer;
- it disappears during pause/task cinematics;
- the final four seconds switch to an urgent treatment;
- starting a drain hides the label because recovery is suspended;
- death, completed drain or leaving the downed state removes the label;
- `combat:entity-recovered` produces a short warning that the enemy has re-entered the fight.

The labels consume `npc.ai.recoverAt`; they do not own or change the recovery timer.

## HUD layout pass

The weapon HUD is moved to the lower-right corner. The power dock remains lower-left and the contextual prompt remains centred, eliminating the previous weapon/power overlap.

Weapon HUD typography is increased and continues to show:

- equipped weapon name;
- ammunition or unlimited use;
- empty state;
- wheel reminder.

The first-use pulse uses movement and brightness as well as colour, so the prompt does not depend on hue alone.

## High-contrast aim

The Pause Menu contains a keyboard-operable button:

```text
High-contrast aim: On / Off
```

When enabled, the standard weapon-coloured aim indicator receives:

- a thick near-black outline;
- a white centre line;
- a larger outlined reticle;
- a perpendicular cross mark.

The option therefore remains readable against light streets, dark roofs, coloured lighting and broken-light shadows without relying on the equipped weapon colour.

The preference is stored under:

```text
nbd-aim-high-contrast
```

Storage failure does not block the option; it still applies for the current page.

## Accessible DOM semantics

Milestone 9 adds or updates:

- Hunger as a `progressbar` with current, minimum and maximum values;
- police alert as a polite live status with level and textual state;
- weapon state as a polite live status with name, ammunition and inventory slot;
- prompt and toast regions as polite status messages;
- `aria-expanded` on Mission and Menu buttons;
- `aria-pressed` on the high-contrast aim toggle;
- visible focus outlines for HUD buttons, accessibility controls and the render-quality selector.

The pause modal only replaces its body when content changes, preventing needless DOM recreation every frame and making keyboard focus more stable.

## Motion preference

When the operating system requests reduced motion, Milestone 9 removes non-essential animation and transition effects from:

- compact guidance;
- weapon-HUD attention pulse;
- HUD toasts;
- task reveals;
- tutorial dialogue.

This does not yet disable world camera shake. A complete reduced-camera-motion setting remains a possible later accessibility extension.

## Player-facing copy sweep

Both playable HTML routes now use:

- `Vampire District` as the visible project title;
- `Render quality` rather than a misleading browser-window resolution label;
- current mouse, wheel, Shift, Space and E controls;
- no visible instruction that Space sprints or that E breaks streetlights.

The source values for render presets remain unchanged; only their player-facing purpose is clarified.

## Events and dependencies

`UxGuidanceSystem` consumes existing plain-data events:

- `weapon:changed`;
- `combat:entity-downed`;
- `combat:entity-recovered`;
- `feeding:started`.

It does not modify combat damage, ammunition, AI recovery or mission progression.

Dependency order:

```text
Input / Weapon / Combat / AI
  → existing gameplay events and state
  → UxGuidanceSystem presentation
  → DOM guidance + world recovery labels
```

## Automated coverage

`tests/ux-guidance.test.js` verifies:

- stored boolean preference parsing;
- weapon tutorial locked/awaiting/completed phases;
- rounded police and hunter countdown labels;
- urgent final recovery window;
- no recovery label for civilians;
- suppression during drain, death or non-downed state;
- high-contrast aim geometry being larger and dual-tone.

## Known limitations

- Browser-level screen-reader behaviour has not been tested with every assistive technology.
- Trackpad wheel granularity still depends on the existing normalized wheel event.
- Recovery labels can overlap in extremely dense piles of downed enemies.
- The high-contrast option covers the aim line and reticle, not every combat telegraph.
- Camera shake is not yet independently configurable.
- Runtime integration still uses prototype adapters and will be consolidated in Milestone 10.
