# Input system

_Status: implemented in Milestone 1; browser regression validation remains required before the milestone is marked fully complete._

## Purpose

`InputSystem` is the authoritative source of gameplay input. Keyboard, pointer buttons, pointer position and mouse-wheel movement are collected once per simulation frame and exposed as an action snapshot. Gameplay systems no longer decide independently whether Space, E, Q, R or F were pressed.

The UI scene still owns UI-only keys such as menu/help and mission-panel navigation. World actions are suppressed centrally whenever the game is paused, a task reveal is active or the tutorial selects a restricted control mode.

## Files

- `phaser/src/input/actions.js` — action names, control modes, empty-frame factory and pure action gating.
- `phaser/src/input/InputSystem.js` — raw browser/Phaser input collection and frame creation.
- `phaser/src/input/input-runtime.js` — integration with `GameScene`, `InteractionSystem` and `PowersSystem`.
- `phaser/src/input/tutorial-input-adapter.js` — maps tutorial states to central control modes.
- `phaser/src/utils/geometry.js` — pure vector, cone, client-to-game and screen-to-world helpers.
- `phaser/src/movement-controls.js` — thin bootstrap plus HUD copy compatibility; it no longer owns gameplay controls.

## Frame contract

Every active `GameScene` update receives one object with this shape:

```js
{
  timestamp,
  controlMode,
  worldEnabled,
  move: { x, y },
  hasMovementIntent,
  aimWorld: { x, y },
  pointerInside,
  sprintHeld,
  primaryHeld,
  primaryPressed,
  drainHeld,
  drainPressed,
  traversePressed,
  interactPressed,
  weaponStep,
  dashPressed,
  whisperPressed,
  bloodSensePressed,
  menuUpPressed,
  menuDownPressed,
  menuConfirmPressed,
  menuCancelPressed,
  menuDigitPressed,
  debugLayerPressed
}
```

The combat fields are already present even though combat and weapons are later milestones. This prevents the mouse-combat work from introducing a second input path.

## Current bindings preserved by Milestone 1

Milestone 1 changes ownership, not the player-facing control design:

- WASD / arrows create the normalized `move` vector.
- Space creates `traversePressed` and currently remains `sprintHeld` for compatibility with the existing tutorial.
- E creates `interactPressed` and menu confirmation.
- Q creates `dashPressed`.
- R creates `whisperPressed`.
- F creates `bloodSensePressed`.
- Left mouse creates primary-attack held/pressed state for Milestone 2.
- Right mouse creates drain held/pressed state for Milestone 4 and suppresses the browser context menu inside the canvas.
- Wheel events are coalesced into a discrete `weaponStep` for Milestone 7.

Space stops modifying speed in Milestone 5. The compatibility behaviour is intentionally isolated to one line in `InputSystem`.

## Control modes

| Mode | Allowed world actions |
|---|---|
| `full` | All current and future world actions. |
| `movement` | Movement, aim and traversal. |
| `drain` | Movement, aim, traversal and the current E-based tutorial drain interaction. |
| `tip` | Movement, aim, traversal and clue interaction. |
| `locked` | Aim tracking only; no world action is emitted. |

The tutorial adapter changes modes instead of disabling individual gameplay keys. Raw keys remain enabled so dialogue Escape handling and later remapping are not coupled to tutorial logic.

## Pointer mapping

Responsive CSS changes the displayed canvas size without changing its internal game coordinate system. Pointer conversion therefore follows two explicit stages:

1. Browser client coordinates are converted to internal game coordinates using the canvas bounding rectangle and camera dimensions.
2. Internal game coordinates are converted to world coordinates using the camera world view and zoom.

This is covered by unit tests for CSS-scaled canvases and camera zoom. Manual browser checks are still required for every render-quality preset and representative viewport.

## Browser lifecycle

`InputSystem` resets held and edge-triggered input when:

- the browser window loses focus;
- the document becomes hidden;
- the UI pause state changes;
- the task-reveal/cinematic lock changes;
- the tutorial changes control mode or disables world input;
- the scene shuts down.

Pointer-held actions are cancelled when the pointer leaves the canvas. Pointer and wheel actions received while world input is locked are discarded rather than replayed after a dialogue or modal closes. Context-menu suppression is scoped to the game canvas only. Wheel scrolling is only prevented when a future `WeaponSystem` explicitly enables wheel capture.

## Runtime ownership

`GameScene` consumes one input frame and is the only owner of:

- traversal dispatch;
- E interaction dispatch;
- movement-vector application;
- interaction-menu navigation;
- power action dispatch.

`PowersSystem` receives abstract actions rather than querying Phaser keys. `InteractionSystem` receives menu actions rather than querying keys. This removes the previous duplicate Space/E/Q/R/F handling from `movement-controls.js`.

## Tests

Run:

```bash
npm test
```

The zero-dependency Node test suite currently covers:

- action gating for every tutorial mode;
- world-lock behaviour;
- pointer/wheel suppression while locked;
- reset behaviour across UI/task locks and browser lifecycle changes;
- wheel-step normalization;
- vector normalization and cone queries;
- responsive client-to-game mapping;
- camera screen-to-world mapping;
- InputSystem edge consumption.

The same command runs automatically in GitHub Actions on pushes to `main` and on pull requests.

## Known limitations

- The integration layer still replaces a small set of legacy prototype methods because the original vertical slice predates first-class bootstrap composition. The previous multi-purpose `movement-controls.js` patch has been removed, but final core-file migration belongs to Milestone 10.
- UI-only keyboard handling remains in `UIScene`; the new system is authoritative for world/gameplay input.
- Wheel events are collected but not consumed by gameplay until `WeaponSystem` exists.
- Primary attack and right-click drain fields are collected but intentionally unused until their milestones.
- Browser smoke tests have not yet been automated.
