# Milestone 1 browser regression checklist

Use this checklist before changing Milestone 1 from 🟡 to ✅. Record browser, operating system, viewport, render quality and commit SHA.

## Required matrix

Run the complete tutorial and at least one mission completion in:

1. Laptop viewport around 1366 × 768 at Low quality.
2. Desktop viewport around 1920 × 1080 at Ultra quality.
3. Narrow viewport at or below 720 CSS pixels at High or Very high quality.
4. Resize during at least one run without reloading.

## Startup and UI ownership

- Intro blocks all world actions.
- Enter starts the tutorial once.
- Left click advances one dialogue bubble; Escape is fallback.
- Dialogue clicks never become attacks or drains.
- Holding movement, Shift, Space, E, Q, R, F or mouse buttons through a lock does not replay afterward.
- H and M work outside restricted states.
- Modal, task reveal, dialogue and result UI own input correctly.

## Tutorial control modes

### Locked intro

- Movement, Shift, Space, E, Q/R/F and mouse combat do nothing.
- No pointer action queues for later.

### Rooftop movement

- WASD/arrows run by default.
- Shift slows movement.
- Space activates only a nearby route.
- E, attacks, drain and powers remain filtered as designed.

### Rooftop blocker

- Dialogue locks the world.
- Mouse aim and left-click punch work after dialogue.
- Four punches down the thug.
- Right-click drain is invalid while standing and valid after knockdown.
- Completing the drain advances the lesson.

### Police informant

- Space traversal and E clue interaction work.
- Combat actions remain filtered during the restricted tip state.
- Controls return after the sire message.

### Full mode

- Default run, Shift quiet movement, Space traversal, E interaction, left-click attack, right-click drain and Q/R/F work.
- Interaction menus use W/S or arrows, E/Enter, Escape and number shortcuts.

## Traversal and interaction separation

Test:

- rooftop jump;
- roof drop;
- fire escape up/down;
- sewer entry/exit;
- private refuge shaft.

For every route:

- `SPACE` world marker and HUD prompt agree;
- Space activates it;
- Space does not alter speed;
- E does not activate it;
- repeated Space during transition is ignored;
- two nearby routes resolve consistently.

## Powers

- Q uses Dash once per press and never from Space.
- R uses Whisper once per press.
- F uses Blood Sense once per press.
- Powers do not leak through menus, dialogue or hit stun.

## Pointer mapping

Inspect `GameScene.currentInputFrame.aimWorld` over known positions:

- coordinates remain correct after resize;
- Low and Ultra agree;
- street, roof and sewer zooms agree;
- pointer leave clears held attack/drain;
- right-click context menu is suppressed only inside the game;
- wheel still scrolls because weapons do not own it yet.

## Lifecycle and stuck input

- Tab away while holding movement/Shift/Space and return: nothing remains stuck.
- Pause while moving and release: movement is neutral after resume.
- Pointer leave/release clears held mouse state.
- Resize while moving does not stick input.
- Boundary and sire dialogues restore controls after dismissal.

## Mission regression

- Objective arrow sequence advances.
- Blocker combat/drain tutorial completes.
- Informant gives the clue and leaves.
- Journalist objective advances.
- Handling journalist requires return to refuge.
- Sire dialogue appears before final report.
- Failure/arrest/frenzy screens lock world input.

## Pass criteria

Milestone 1 becomes ✅ only when:

- all matrix runs pass;
- no action has two active gameplay owners;
- no held/pressed action leaks across locks;
- pointer aim remains correct;
- every route works;
- failures are fixed or explicitly documented.
