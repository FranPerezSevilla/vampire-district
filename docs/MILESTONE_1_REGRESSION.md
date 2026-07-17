# Milestone 1 browser regression checklist

Use this checklist before changing Milestone 1 from 🟡 to ✅. Record browser, operating system, viewport, render quality and commit SHA for every run.

## Required test matrix

Run the complete opening tutorial and at least one full mission completion in:

1. Laptop viewport around 1366 × 768 at **Low** quality.
2. Desktop viewport around 1920 × 1080 at **Ultra** quality.
3. Narrow viewport at or below 720 CSS pixels wide at **High** or **Very high** quality.

At least one run must resize the browser several times without reloading.

## Startup and UI ownership

- Intro banner opens and world input does nothing behind it.
- Enter starts the tutorial exactly once.
- Escape advances one dialogue bubble at a time.
- Holding movement, Space, E, Q, R, F or either mouse button while closing a dialogue does not replay that action afterward.
- H opens/closes the menu outside restricted tutorial states.
- M opens/closes the mission drawer outside restricted tutorial states.
- Game input does not fire while a modal, task reveal or pause screen is active.

## Tutorial control modes

### Intro / locked

- WASD, arrows, Space, E, Q, R and F do nothing.
- Mouse clicks do not queue an attack or drain action for later.

### Rooftop movement

- WASD/arrows move.
- Space still runs and activates the nearby rooftop route in the current compatibility build.
- E and Q/R/F remain unavailable.

### Rooftop blocker / drain tutorial

- The thug and sire dialogue lock movement.
- After dialogue, movement and Space work.
- E drains the tutorial target.
- Q/R/F remain unavailable until the tutorial finishes.

### Police informant / tip

- Space traversal and E clue interaction work.
- Other interaction options stay filtered.
- The informant conversation does not accept world actions behind the dialogue.
- Controls return after the final sire message.

### Full mode

- Space traversal, E interactions and Q/R/F powers all work.
- Interaction menus navigate with W/S or arrows, confirm with E/Enter, cancel with Escape and accept number shortcuts.

## Traversal and interaction separation

Test at least one of every route type:

- rooftop jump;
- roof drop;
- street-to-roof fire escape;
- roof-to-street fire escape;
- street-to-sewer access;
- sewer-to-street exit;
- private shaft to the refuge.

For each route:

- Space activates it.
- E does not activate it.
- When a route and a normal interaction are both nearby, the HUD shows the correct contextual key.
- Repeated Space presses during an active transition do not start another transition.

## Powers

- Q uses Dash once per press and never activates from Space.
- R uses Whisper once per press.
- F uses Blood Sense once per press.
- Powers do not fire while an interaction menu is open.
- Holding a power key through pause/dialogue does not fire it after resuming.

## Responsive pointer mapping

Open the browser console and inspect `game.scene.getScene("GameScene").currentInputFrame.aimWorld` while moving the pointer over recognizable world positions.

- Aim coordinates correspond to the same world location before and after resizing.
- Aim remains correct at Low and Ultra quality.
- Aim remains correct on street, rooftop and sewer camera zooms.
- Moving the pointer outside the canvas clears held pointer actions.
- Right-click inside the canvas does not open the browser context menu.
- Right-click outside the game retains normal browser behaviour.
- The mouse wheel still scrolls the page normally because weapon ownership has not been enabled yet.

## Browser lifecycle and stuck-input checks

- Hold movement, switch browser tabs, release the key, then return: the player does not continue moving.
- Hold Space, blur/refocus the window: running/traversal does not remain stuck.
- Hold a mouse button, move outside the canvas and release: no held action remains.
- Pause while moving, release the key, then resume: movement remains neutral.
- Resize while moving: no input state becomes stuck.
- Crossing the district boundary warning resets input cleanly after Escape.

## Mission regression

- The first objective arrow sequence still advances correctly.
- Rooftop blocker ordering and forced tutorial drain still work.
- Police informant gives the factual clue, leaves and disappears.
- Sire gives the final instruction once.
- Journalist mission steps advance normally.
- Police, witnesses, Hunger, feeding and evidence systems continue updating outside locks.
- Mission success reaches the sire report screen.
- Failure and arrest screens still lock world input.

## Pass criteria

Milestone 1 may be marked ✅ only when:

- all required matrix runs pass;
- no control action is owned by two active gameplay paths;
- no held/pressed input leaks across a lock boundary;
- responsive aim remains correct across tested sizes and qualities;
- every failure is fixed or explicitly recorded as a known limitation.
